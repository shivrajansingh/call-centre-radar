# Call-Centre Radar — Documentation

Conversation-intelligence system over raw call-centre recordings. This directory is the
deep reference for the implementation; the root [README](../README.md) covers the
from-scratch quick start.

## Contents

| Doc | What it covers |
|---|---|
| [architecture.md](architecture.md) | System design, data flow, component map, key design decisions |
| [pipeline.md](pipeline.md) | Ingest → ASR (local & API providers) → analysis → citation verification → aggregation |
| [database.md](database.md) | PostgreSQL schema, tables, indexes, JSON columns, migration from SQLite |
| [api.md](api.md) | Full API reference: auth, roles, endpoints, payloads, error handling |
| [ui.md](ui.md) | Dashboard routes, component map, state & auth, theming, conventions |
| [operations.md](operations.md) | Docker deployment, environment variables, running pipelines, troubleshooting, backup |

## One-paragraph overview

Call recordings (stereo MP3: left = agent, right = caller) are transcribed per channel —
either locally with `mlx-whisper` on Apple Silicon, or through a hosted OpenAI-compatible
`/audio/transcriptions` endpoint (`STT_PROVIDER=local|api`) — producing word-level
timestamps that are merged into speaker turns. A text-only LLM then judges each call
(intent, mood timeline + shift point, resolution, ≤40-word summary, needs-attention
score 0–100), and **every claim must carry a verbatim, timestamped quote** that a
`CitationVerifier` fuzzy-matches against the actual transcript before it is stored.
Aggregations (ranked attention queue, trending issues, agent stats, KPIs) are computed
on demand from PostgreSQL. A FastAPI service serves the data and a role-aware React
dashboard presents it — with the recording, the word-synced transcript, the cited
judgments, survey scores and QA reviews per call.

```
callradar-data/audio/*.mp3 ──► pipeline (host: ASR + LLM analysis) ──► PostgreSQL (docker)
        (or POST /ingest)            │        ▲                            │
                                     │        │                            │
                                     │   upload worker (in-process)        │
                                     └──── scripts/backfill.py ─────────────┘
                                                                              │
        React dashboard (docker) ◄── FastAPI (docker) ◄─────────────────────┘
        :8081                        :8100
```

## Running the pieces

| Piece | Where it runs | How |
|---|---|---|
| PostgreSQL 16 | Docker (`db` service) | `docker compose up -d db` — port 5432 |
| FastAPI | Docker (`api` service) | `docker compose up -d api` — port 8100 |
| Dashboard | Docker (`ui` service, nginx) | `docker compose up -d ui` — port 8081 |
| ASR + analysis pipeline | **host** (MLX is Apple-only; LLM keys live in `.env`) | `scripts/backfill.py` against `localhost:5432` |
| Upload worker | API container (or host) | Auto-processes `POST /ingest` uploads; disable with `UPLOAD_WORKER_ENABLED=0` |

One command brings up everything: `docker compose up -d --build`.