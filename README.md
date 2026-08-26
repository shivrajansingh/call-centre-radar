# Call-Centre Radar

Conversation-intelligence system over raw call-centre recordings: speech-to-text with
speaker separation, per-call judgments (intent, mood + shift point, resolution, summary,
needs-attention score) where **every claim carries a verbatim, timestamped quote verified
against the transcript**, plus an admin dashboard (manager queue, trending issues,
customer histories, agent stats, QA reviews).

> Full implementation reference: [docs/](docs/README.md) — architecture, pipeline,
> database schema, API reference, UI guide, operations.

## Architecture

```
callradar-data/audio/*.mp3 ──► pipeline (ASR + analysis, runs on host) ──► PostgreSQL ──► FastAPI ──► React dashboard
        (or POST /ingest for fresh audio)                                 (docker)      (docker)      (docker)
```

- **ASR** (`pipeline/asr.py`): stereo recordings are split per channel with ffmpeg
  (left = agent, right = customer → speaker labels are free, no diarization), each channel
  is transcribed with word-level timestamps, then merged into turns. Two interchangeable
  providers, selected with `STT_PROVIDER` in `.env`:

  | `STT_PROVIDER` | Engine | Notes |
  |---|---|---|
  | `local` (default) | `mlx-whisper` (`whisper-large-v3-turbo`, 4-bit) on Apple Silicon GPU | Free, offline, ~3.4× realtime |
  | `api` | Hosted OpenAI-compatible `/audio/transcriptions` endpoint (OpenRouter, OpenAI, Groq…) | Works on any machine; configured via `TRANSCRIPTION_*` vars; speech chunks are detected with ffmpeg silence detection, transcribed per chunk and stitched with real absolute timestamps (also avoids the 60 s upstream timeout on long clips) |
- **Analysis** (`pipeline/analyze.py`): one LLM request per transcript returns strict JSON —
  intent, mood timeline, mood-shift moment, resolution, ≤40-word summary, attention score
  0–100 — every field citing `{t_start, t_end, quote}`.
- **Citation validator**: every returned quote is fuzzy-matched verbatim against the actual
  words near the cited timestamp; failures trigger regeneration; anything unverified is
  flagged and rendered as such in the UI.
- **Storage**: PostgreSQL 16 (Docker). Audio stays on disk (`data/audio/` for uploads,
  `callradar-data/audio/` for the dataset) and is served statically. Nothing is
  re-transcribed on request.

## Why the transcription pipeline runs on the host

MLX (Apple's machine-learning framework) only exists on macOS. The ASR step therefore runs
**outside** Docker, on the Mac itself, and writes straight into the Postgres container via
`localhost:5432`. The API, database and dashboard run fully in Docker.

## Quick start (Docker)

Requirements: Docker Desktop, `ffmpeg` on PATH (`brew install ffmpeg`), Python 3.12,
Node 18+.

```bash
# 1. start the stack: postgres + api + dashboard
docker compose up -d --build

# 2. API on :8100 · dashboard on :8081 · postgres on :5432
#    login: admin / admin123  (change it on the Users page)

# 3. optional: migrate data from a previous SQLite run
.venv/bin/python scripts/migrate_sqlite.py data/radar.db
```

## Run the transcription + analysis pipeline

The pipeline is resumable — it skips calls that already have an analysis. Pick the STT
provider via `STT_PROVIDER=local|api` (default `local`):

```bash
# subset first (sanity check)
PYTHONPATH=. RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
  .venv/bin/python scripts/backfill.py --limit 50

# all 1,441 dataset calls (local: ~7 h on Apple Silicon; api: ~1-2 s per call)
PYTHONPATH=. RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
  .venv/bin/python scripts/backfill.py

# hosted STT instead of local MLX (same command, different flag)
PYTHONPATH=. STT_PROVIDER=api RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
  .venv/bin/python scripts/backfill.py

# process recordings uploaded through the dashboard UI
PYTHONPATH=. RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
  .venv/bin/python scripts/backfill.py --uploads
```

## Development without Docker

```bash
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
npm --prefix ui install

# a local Postgres (or the docker `db` container) must be reachable at :5432
.venv/bin/uvicorn api.main:app --port 8100        # API
npm --prefix ui run dev                            # dashboard at :5173 (proxies /api → :8100)
```

`.env` (repo root) — see `.env.example` for the full set of options:

```
# --- analysis LLM (text-only) ---
OPENAI_URL=https://your-gateway/v1/chat/completions   # full endpoint or base URL both work
OPENAI_API_KEY=sk-...
OPENAI_MODEL=your-model-name

# --- speech-to-text: local (default) or hosted API ---
STT_PROVIDER=local
TRANSCRIPTION_BASE_URL=https://openrouter.ai/api/v1   # only used with STT_PROVIDER=api
TRANSCRIPTION_API_KEY=sk-or-...
TRANSCRIPTION_MODEL=nvidia/nemotron-3.5-asr-streaming-multilingual-0.6b
TRANSCRIPTION_LANGUAGE=en
```

## API surface

| Endpoint | Purpose |
|---|---|
| `POST /auth/login` · `GET /auth/me` | Session tokens (HMAC-signed, 7-day TTL) |
| `GET /users` · `POST /users` · `PATCH /users/{id}` | Admin-only user/role management |
| `GET /kpis` | Headline KPIs, calls-over-time series, resolution & mood splits |
| `POST /ingest` | Fresh audio (`audio` file + optional `metadata` JSON / `caller_name` / `agent_name`) → queued for the pipeline |
| `GET /calls` | List + search + filters (`resolution`, `min_score`, `agent_id`, `customer_id`, `sort`) + pagination |
| `GET /calls/{sid}` | Full transcript + analysis + citations + QA reviews |
| `GET/POST /calls/{sid}/reviews` · `DELETE .../reviews/{rid}` | Manager QA reviews (1–5 stars + note) |
| `GET /audio/{sid}.mp3` | Recording stream |
| `GET /customers` · `POST /customers` · `GET /customers/{id}` | Customer directory / registration / full history |
| `GET /attention` | Ranked manager queue (score × recency, unresolved boosted) |
| `GET /trending` | Clustered issue labels with unresolved rates |
| `GET /agents` · `POST /agents` · `GET /agents/{id}` | Per-agent volumes, handle times, outcomes |

## Dashboard

- **Dashboard** — KPI cards, calls-over-time chart, resolution donut, mood mix, ranked
  "needs a manager's attention" list, trending issues.
- **Calls** — searchable/filterable/sortable table → **call detail**: playable recording,
  transcript synced word-by-word to playback, clickable mood timeline with the shift
  marker, summary/intent/resolution/attention each backed by click-to-play citations
  (verified quotes in blue, unverified in red), customer-survey scores, QA review widget.
- **Customers / Agents** — directories with registration, profile pages with stats and
  full call history.
- **Upload** — drag-and-drop intake for new recordings (managers), processed by
  `scripts/backfill.py --uploads`.
- **Users** — admin-only role management (admin / manager / agent); agents get a
  read-only view, managers add uploads + QA reviews.

Roles: `admin` (everything), `manager` (analytics, upload, QA, register customers/agents),
`agent` (read-only). Seeded login: **admin / admin123**.

## Tests

```bash
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest            # needs the postgres container up (uses a separate radar_test DB)
```

57 tests: citation verifier, metadata ingestion, ASR turn-merging & chunking, auth
tokens/passwords, and full API coverage (auth, role gating, reviews, upload queue,
filters, KPIs). The API tests caught and fixed a real connection-leak bug on 404 paths.

## Design note: evidence discipline

Every judgment shown in the UI cites a moment in the call. Citations are validated by
`CitationVerifier` (`pipeline/analyze.py`): the quoted text must appear verbatim (fuzzy ≥0.82)
in the transcript words within ±3 s of the claimed timestamp, otherwise the model is asked to
fix it and persistent failures are surfaced as *unverified* rather than silently displayed.