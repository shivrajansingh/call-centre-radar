# Call-Centre Radar

## Summary

Call-Centre Radar is a conversation-intelligence platform for consumer-bank support teams. It turns raw stereo call recordings into searchable, speaker-labelled transcripts with word-level timings, then analyses each conversation for customer intent, mood, mood-shift point, resolution status, a concise summary, and a 0–100 manager-attention score.

Every analysis claim is tied to evidence: a timestamp and verbatim quote from the transcript. Quotes are checked against the recorded words and cited moments can be played directly from the call, making the system useful for accountable reviews rather than opaque AI-generated conclusions.

The dashboard gives managers a ranked attention queue, trending issue clusters, KPI and mood/resolution reporting, agent performance views, customer directories with complete call histories, and detailed call pages with synchronized playback, transcript, mood timeline, citations, survey scores, and QA reviews. Managers can also upload new recordings; a background worker automatically transcribes and analyses them.

The stack uses a React dashboard, FastAPI API, PostgreSQL storage, ffmpeg audio processing, and a resumable Python pipeline. Speech-to-text can run locally with MLX Whisper on Apple Silicon or through a hosted OpenAI-compatible transcription API. Analysis results are stored and served through the API, so calls are not re-transcribed on every request.

**Live demo:** https://call-centre-radar.technicalheist.com/

> Full implementation reference: [docs/](docs/README.md) — architecture, pipeline,
> database schema, API reference, UI guide, operations.

## Architecture

```mermaid
flowchart TB
    subgraph Sources["Call sources"]
        direction TB
        Dataset["Dataset recordings<br/>callradar-data/audio/*.mp3"]
        Upload["New recording<br/>POST /ingest"]
    end

    subgraph Host["Host pipeline"]
        direction TB
        Backfill["scripts/backfill.py"]
        Queue["Upload queue"]
        ASR["ASR: ffmpeg channel split<br/>+ local MLX Whisper or hosted STT"]
        Turns["Merge word timestamps<br/>into speaker turns"]
        Analysis["LLM analysis<br/>intent, mood, resolution, summary, score"]
        Verify["CitationVerifier<br/>validate timestamped quotes"]
    end

    subgraph Docker["Docker services"]
        direction TB
        DB[("PostgreSQL 16<br/>transcripts + analysis + reviews")]
        API["FastAPI<br/>REST API + upload worker"]
        UI["React dashboard<br/>nginx :8081"]
    end

    Dataset --> Backfill --> ASR
    Upload --> API --> Queue --> ASR
    ASR --> Turns --> Analysis --> Verify --> DB
    DB --> API --> UI
    DB --> Audio["Audio files served<br/>from data/audio/"] --> UI

    classDef host fill:#fff4d6,stroke:#b7791f,color:#4a2c00
    classDef docker fill:#e6f4ff,stroke:#2b6cb0,color:#12304a
    class Backfill,Queue,ASR,Turns,Analysis,Verify host
    class DB,API,UI,Audio docker
```

The pipeline runs on the host because MLX Whisper requires Apple Silicon; PostgreSQL,
FastAPI, and the dashboard run in Docker. With hosted STT (`STT_PROVIDER=api`), the
transcription and analysis worker can also run inside the API container.

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
  0–100 — every field citing `{t_start, t_end, quote}`. Each call is labelled with a mood
  (`positive | neutral | concerned | frustrated | angry | anxious`) at start and end, a
  3–6 point mood timeline, and the moment the mood shifted (with a verbatim quote).
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

Dataset backfill is resumable — it skips calls that already have an analysis.
Pick the STT provider via `STT_PROVIDER=local|api` (default `local`):

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

# process recordings uploaded through the dashboard UI (fallback — see below)
PYTHONPATH=. RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
  .venv/bin/python scripts/backfill.py --uploads
```

### Uploads are processed automatically

`POST /ingest` stores the recording and queues it; a built-in background worker
(`pipeline/worker.py`, started with the API) picks up the queue every
`UPLOAD_WORKER_POLL_S` seconds and runs transcription + analysis, so no manual
step is needed. `GET /health` reports worker status (`upload_worker`).

- Failures are retried up to `UPLOAD_WORKER_MAX_ATTEMPTS` (default 3) with the
  error stored on `calls.asr_error`/`analysis_error`.
- Claims are atomic and stale claims (a worker dying mid-call) are re-claimed
  after 15 min, so multiple API replicas never double-process a call.
- Disable with `UPLOAD_WORKER_ENABLED=0` (e.g. local STT while the API runs in
  Docker, where MLX is unavailable) — uploads then stay queued and
  `scripts/backfill.py --uploads` processes them on the host, as before.
- Production note: `mlx-whisper` only runs on Apple Silicon, so in Docker use
  `STT_PROVIDER=api` (OpenRouter etc.) — the API container has both the worker
  and the hosted-STT client baked in.

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

# --- background upload worker (auto-processes POST /ingest uploads) ---
UPLOAD_WORKER_ENABLED=1
UPLOAD_WORKER_POLL_S=5
UPLOAD_WORKER_MAX_ATTEMPTS=3
```

## API surface

| Endpoint | Purpose |
|---|---|
| `POST /auth/login` · `GET /auth/me` | Session tokens (HMAC-signed, 7-day TTL) |
| `GET /users` · `POST /users` · `PATCH /users/{id}` | Admin-only user/role management |
| `GET /kpis` | Headline KPIs, calls-over-time series, resolution & mood splits |
| `POST /ingest` | Fresh audio (`audio` file + optional `metadata` JSON / `caller_name` / `agent_name`) → queued, then transcribed + analyzed automatically by the background worker |
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
- **Upload** — drag-and-drop intake for new recordings (managers); transcribed
  and analyzed automatically in the background (fallback: `scripts/backfill.py --uploads`).
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
