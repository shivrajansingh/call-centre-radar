# Operations

## Requirements

- macOS on Apple Silicon (required for the `local` STT provider / MLX)
- Docker Desktop (or any Docker with compose)
- Python 3.12, Node 18+ (host, for the pipeline)
- `ffmpeg` on PATH (`brew install ffmpeg`)
- An OpenAI-compatible chat endpoint for analysis (`.env`)
- Optional: an OpenAI-compatible `/audio/transcriptions` endpoint for `STT_PROVIDER=api`

## Environment variables

Copy `.env.example` → `.env` and fill in:

| Var | Used by | Purpose |
|---|---|---|
| `OPENAI_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL` | pipeline (`analyze.py`) | Analysis LLM gateway |
| `STT_PROVIDER` | pipeline (`asr.py`) | `local` (MLX) or `api` (hosted) |
| `TRANSCRIPTION_BASE_URL` / `TRANSCRIPTION_API_KEY` / `TRANSCRIPTION_MODEL` / `TRANSCRIPTION_LANGUAGE` | pipeline (`asr.py`, api mode) | Hosted STT |
| `HF_TOKEN` | pipeline | Speeds up mlx-whisper model download |
| `AUTH_SECRET` | api + pipeline | Signs session tokens (change from the default!) |
| `RADAR_DB_URL` | everything | Postgres DSN (compose sets it for the api container) |
| `RADAR_AUDIO_DIR` | api | Where uploads land (`data/audio`) |
| `RADAR_DATASET_DIR` | api | Dataset audio fallback for streaming |
| `RADAR_MLX_MODEL` | pipeline | Local whisper model id |

## Deployment (Docker)

```bash
docker compose up -d --build
```

- `db` — postgres:16-alpine, volume `pgdata`, healthchecked
- `api` — python:3.12-slim, uvicorn :8100; mounts `./data/audio` (uploads) and
  `./callradar-data` (dataset audio, read-only); `RADAR_DB_URL` points at the `db`
  service; healthchecked via `/health`
- `ui` — node build → nginx :80 mapped to host :8081; `/api/*` proxied to `api`

First boot: schema created + `admin/admin123` seeded by the API. Change the password on
the Users page.

### Ports

| Service | Host |
|---|---|
| Postgres | 5432 |
| API | 8100 |
| Dashboard | 8081 |

## Running the pipeline (host)

```bash
# transcribe + analyze a subset
PYTHONPATH=. RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
  .venv/bin/python scripts/backfill.py --limit 50

# everything (resumable — re-run continues where it stopped)
PYTHONPATH=. RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
  .venv/bin/python scripts/backfill.py

# hosted STT instead of local MLX
PYTHONPATH=. STT_PROVIDER=api RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
  .venv/bin/python scripts/backfill.py

# process dashboard uploads
PYTHONPATH=. RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
  .venv/bin/python scripts/backfill.py --uploads
```

Notes:

- Expected wall-clock for the full corpus with `local`: ~7 h on Apple Silicon (3.4×
  realtime, 24 h of audio). With `api`: ~1–2 s per call (chunked requests).
- The run is safe to interrupt — `analyzed_at` checkpointing picks up where it left.
- Failed calls are retried on the next run; the exit code is non-zero if anything failed.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `ModuleNotFoundError: mlx_whisper` inside api container | Expected — ASR never runs in Docker. Uploads are queued; run `backfill.py --uploads` on the host. |
| `connection refused: 5432` from the pipeline | Start the db first (`docker compose up -d db`) or point `RADAR_DB_URL` elsewhere. |
| API health shows `transcribed: null` after empty DB | Stale api image — `docker compose up -d --build api`. |
| Call shows "analysis pending" forever | Transient LLM failure (`calls.analysis_error`); re-run the pipeline — analysis-only retries are cheap. |
| Audio won't play for dataset calls | The api container needs `./callradar-data` mounted (compose does this) — check `docker compose config`. |
| Slow first MLX run | Model download; set `HF_TOKEN` to speed it up. |
| `STT_PROVIDER=api` returns nothing | Check `TRANSCRIPTION_BASE_URL` (full endpoint or base URL both accepted), key, and model slug; model must support `/audio/transcriptions`. |
| "duplicate key value violates unique constraint ... pkey" after migration | Run the sequence reset (included in `migrate_sqlite.py`) — `SELECT setval(pg_get_serial_sequence(t, 'id'), COALESCE(MAX(id),1)) FROM t` per table. |

## Backup & restore

Everything durable lives in the `pgdata` volume and `./data/audio`:

```bash
docker compose exec db pg_dump -U radar radar > radar-backup.sql
docker compose exec -T db pg_restore -U radar -d radar < radar-backup.sql   # via psql
```

## Demo flow (reviewer script)

1. `docker compose up -d --build`; open http://localhost:8081, sign in `admin/admin123`.
2. Dashboard → top of the attention queue → click a call.
3. Click a reason chip / citation → audio seeks to the cited second, words highlight live.
4. Mood timeline ⚡ shift marker → jumps to the exact utterance that turned the customer.
5. Customers → pick a customer with multiple calls → history shows repeated intents.
6. Agents → compare handle times and resolution rates.
7. Upload page → drop an MP3 → confirm queued → run `backfill.py --uploads` → the call
   appears fully analyzed.