# Architecture

## High-level design

The system is a batch pipeline feeding a query API, with a dashboard on top. There are
deliberately **no moving pieces beyond these three**: the pipeline runs as plain Python
scripts, the API is a single FastAPI process, the dashboard is a static React build
served by nginx.

```
┌──────────────────────────────────────────────────────────────────────┐
│ HOST (macOS)                                                          │
│  callradar-data/audio/*.mp3 ─┐                                        │
│  callradar-data/metadata/*.json ─┤                                    │
│                                ▼                                      │
│  scripts/backfill.py ──► pipeline/asr.py (ffmpeg split → STT)         │
│                             pipeline/analyze.py (LLM + citations)     │
│                                 │                                     │
└─────────────────────────────────┼─────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ DOCKER                                                               │
│  postgres:16 (port 5432) ◄── data/audio + callradar-data mounted     │
│      ▲                                                               │
│  api (FastAPI, port 8100) ── serves /calls /customers /kpis ...      │
│      ▲                                                               │
│  ui (nginx, port 8081) ── static React build, /api proxied to api    │
└──────────────────────────────────────────────────────────────────────┘
```

## Component responsibilities

| Component | Files | Responsibility |
|---|---|---|
| Ingest | `pipeline/ingest.py` | Normalize metadata JSON → customers/agents/calls rows; persist words, turns, analyses |
| ASR | `pipeline/asr.py` | Channel split (ffmpeg), transcription via `local` (MLX) or `api` (hosted) provider, turn merging |
| Analysis | `pipeline/analyze.py` | One LLM call per transcript → strict-JSON judgments; `CitationVerifier` validates every quote |
| Aggregation | `api/main.py` (`/attention`, `/trending`, `/kpis`, `/agents`) | Recency-weighted attention ranking, intent clustering, SQL rollups |
| API | `api/main.py`, `api/db.py` | HTTP surface, auth (HMAC tokens), role gating, static audio |
| Dashboard | `ui/src/**` | React SPA: router, auth, dashboard, calls, customers, agents, upload, users |
| Orchestration | `scripts/backfill.py` | Resumable batch runner over the dataset + `--uploads` mode |

## Key design decisions

1. **Speaker identity is free.** Recordings are stereo; the left channel is the agent and
   the right channel is the caller, so no diarization model is needed. This is the single
   biggest simplification in the project (PLAN §1).
2. **No judgment without evidence.** Every verdict field (intent, mood shift, resolution,
   attention reasons) carries `{t_start, t_end, quote}`. The `CitationVerifier`
   (`pipeline/analyze.py:CitationVerifier`) fuzzy-matches each quote against the actual
   transcript words within ±3 s of the claimed time (normalized punctuation/whitespace,
   ≥0.82 similarity). Failures trigger up to 2 regenerations; persistent failures are
   stored with `verified=false` and rendered in red in the UI — never silently as fact.
3. **Transcription runs once.** The pipeline checkpoints via `calls.transcribed_at` /
   `calls.analyzed_at`; the API never re-transcribes. Fresh uploads are queued (record +
   audio stored, no processing) and picked up by `backfill.py --uploads` on the host.
4. **Two interchangeable STT providers.** `STT_PROVIDER=local` (MLX, Apple Silicon, free,
   offline) or `STT_PROVIDER=api` (any OpenAI-compatible `/audio/transcriptions`
   endpoint). See [pipeline.md](pipeline.md).
5. **PostgreSQL in Docker, pipeline on the host.** MLX only exists on macOS, so the
   transcription step cannot run inside a Linux container. The API/UI/DB are fully
   containerized; the pipeline connects to the DB container via `localhost:5432`.
6. **Text-only LLM for analysis.** Only the transcript text (not audio) is sent to the
   LLM gateway, keeping analysis cheap and provider-agnostic.
7. **KPIs and aggregations are computed, not stored.** `calls_over_time`, resolution
   splits, mood distributions, attention ranking and agent stats are derived in SQL on
   every request — the corpus is small (1,441 calls), so no materialization is needed.

## Data flow for one call

1. `backfill.py` picks the next call whose `analyzed_at IS NULL` (resume-safe).
2. `process_call` → `asr.transcribe_call`:
   - ffmpeg splits stereo → `left.wav` (agent) / `right.wav` (caller), 16 kHz mono.
   - Local: `mlx_whisper.transcribe(..., word_timestamps=True)` per channel.
   - API: speech intervals detected via ffmpeg `silencedetect`; each chunk transcribed
     separately (word timestamps when the provider supports `verbose_json`, else words
     spread within the chunk); chunks stitched with absolute offsets.
   - Words are merged into turns (same speaker, gap < 0.8 s).
3. Words + turns are persisted (`words`, `turns` tables).
4. `analyze.analyze_call` sends the turn-level transcript to the LLM with a strict-JSON
   prompt; every citation is verified; the result is persisted (`analyses`), with
   `citations_verified` = verified/total.
5. On any failure, `asr_error` / `analysis_error` is recorded on the call and the batch
   runner moves on; the call is retried on the next run.
6. The API exposes the stored result; the dashboard renders it with citations that
   seek the audio player to the exact moment.

## Failure handling

| Failure | Effect | Recovery |
|---|---|---|
| Transcription error | `calls.asr_error` set | Retried by next `backfill.py` run |
| Analysis error (LLM timeout/gateway) | `calls.analysis_error` set | Retried by next run; transcription is skipped (only analysis re-runs) |
| Unverified citation | Citation marked `verified=false`, shown red in UI | `analyze_call` regenerates up to 2× before giving up |
| Provider returns empty chunk | Chunk skipped; channel with zero words raises | Surfaced as `asr_error` |