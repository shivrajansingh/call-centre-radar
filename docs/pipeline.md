# Pipeline

The pipeline turns raw recordings into judged, citable transcripts. It runs on the host
as `scripts/backfill.py` (Apple Silicon MLX can't run in Docker; hosted STT keys live in
`.env`). It is **resumable**: a call is only re-processed when `calls.analyzed_at IS NULL`.

## Stage 0 — Ingest (`pipeline/ingest.py`)

`parse_metadata` normalizes the callradar metadata JSON:

| Field | Source |
|---|---|
| `customer_name` | `caller.metadata["first and last name"]` |
| `agent_name` | `agent.metadata["agent_name"]` |
| `started_at` / `ended_at` | `start_time_ms` / `end_time_ms` |
| `session` | `session` |
| `survey_ease` / `survey_partner` | `caller.survey_response.data.ease_of_connection` / `partner_rating` |
| `caller_mos` | `labels.caller_mos` |

`store_call_record` upserts the call (customers/agents resolved by normalized name via
`db.upsert_person`). `store_transcript` and `store_analysis` replace any previous words /
turns / analysis for the sid, so re-runs never duplicate data.

## Stage 1 — ASR (`pipeline/asr.py`)

### Channel splitting

```bash
ffmpeg -i call.mp3 -filter_complex "[0:a]channelsplit=channel_layout=stereo[l][r]" \
       -map "[l]" -ar 16000 -ac 1 left.wav \
       -map "[r]" -ar 16000 -ac 1 right.wav
```

Left = **agent**, right = **caller** — speaker labels come from the channels, no
diarization.

### Provider `local` (default) — MLX Whisper

- `mlx_whisper.transcribe(path, path_or_hf_repo=MLX_MODEL, word_timestamps=True, language="en")`
- Model: `whisper-large-v3-turbo` 4-bit (env `RADAR_MLX_MODEL`), Apple Silicon GPU.
- Throughput ≈ 3.3–3.4× realtime on M2/8 GB; full 1,441-call corpus ≈ 7 h.
- Cost: $0. Fully offline.

### Provider `api` — hosted `/audio/transcriptions`

Selected with `STT_PROVIDER=api`. Configuration (env):

| Var | Default | Purpose |
|---|---|---|
| `TRANSCRIPTION_BASE_URL` | — | OpenAI-compatible endpoint (`https://openrouter.ai/api/v1`) |
| `TRANSCRIPTION_API_KEY` | — | Bearer key |
| `TRANSCRIPTION_MODEL` | `openai/whisper-1` | e.g. `nvidia/nemotron-3.5-asr-streaming-multilingual-0.6b` |
| `TRANSCRIPTION_LANGUAGE` | `en` | ISO-639-1 hint |

How it works (`transcribe_call_api`):

1. Channels are split as above.
2. `_speech_intervals` runs ffmpeg `silencedetect` (`noise=-35dB`, `d=0.6s`) to find
   speech segments; gaps < 0.6 s are merged, short blips dropped, ±0.15 s padding.
3. Each speech chunk is extracted and transcribed separately via the OpenAI SDK
   (`client.audio.transcriptions.create`). Because each request is a fresh clip, the
   returned timestamps are relative to the chunk — adding the chunk offset yields
   **absolute timestamps**.
4. Timestamp strategy per chunk:
   - `response_format="verbose_json"` + `timestamp_granularities=["word"]` when the
     provider supports it (exact word sync; e.g. `openai/whisper-1`).
   - otherwise plain `json` → words are spread evenly within the short chunk
     (approximate but within the citation validator's ±3 s window).
   - the first chunk probes support; subsequent chunks skip unsupported attempts.
5. Empty chunks (noise-only) are skipped; a channel that yields zero words raises so the
   error is recorded in `calls.asr_error`.

Chunking also sidesteps OpenRouter's 60 s upstream timeout on long clips.

### Turn merging

Words are sorted by time; a new turn starts when the speaker changes or the gap to the
previous word ≥ 0.8 s (`TURN_GAP_S`).

## Stage 2 — Analysis (`pipeline/analyze.py`)

One LLM request per call (`openai` SDK, `OPENAI_URL`/`OPENAI_API_KEY`/`OPENAI_MODEL`,
temperature 0). The prompt embeds the turn transcript with timestamps:

```
[0.00-2.10] AGENT: Thank you for calling...
[2.10-6.80] CALLER: I lost my credit card...
```

Required JSON schema (strict):

```json
{
  "intent":        {"label": "...", "citation": C},
  "mood":          {"start": M, "end": M,
                    "timeline": [{"t": 12.3, "mood": M}, ...],
                    "shift": {"t": 92.0, "from": M, "to": M, "citation": C} | null},
  "resolution":    {"status": "resolved|partial|unresolved", "citation": C},
  "summary":       "<= 40 words, factual, third person",
  "needs_attention": {"score": 0..100, "reasons": [{"reason": "...", "citation": C}, ...]}
}
C = {"t_start": s, "t_end": s, "quote": "<verbatim words>"}
M ∈ positive | neutral | concerned | frustrated | angry | anxious
```

Prompt rules enforce: quotes must be verbatim substrings; resolution judged by facts
(polite false-closure ≠ resolved); attention score guidance (70–100 = unresolved/anger/
threats/repeats, >85 reserved for serious cases); ≤40-word summary.

### Citation validation loop

1. `CitationVerifier` builds a normalized word stream (punctuation stripped, lowercased).
2. Each returned quote must appear verbatim in the stream; otherwise a windowed
   `SequenceMatcher` search within ±3 s (`CITATION_WINDOW_S`) with ratio ≥ 0.82
   (`CITATION_MIN_RATIO`).
3. Verified quotes get corrected timestamps (`time_corrected` flag); failures are fed
   back to the model ("your quote was not found at that timestamp, fix it") for up to
   2 regenerations.
4. Persistent failures are stored with `verified: false` — the UI renders them red and
   never as fact.
5. `analyses.citations_verified` = verified / total citations.

## Stage 3 — Aggregation (API-side)

| Endpoint | Aggregation |
|---|---|
| `/attention` | `attention_score × 1/(1 + age_days/7)` recency weight; unresolved × 1.15 (cap 100); sorted desc |
| `/trending` | Intents normalized → clusters by frequency; unresolved rate per cluster; example sids |
| `/kpis` | Volume, transcription/analysis progress, resolution & mood splits, calls-over-time (14-day series), survey averages, QA stats |
| `/agents`, `/customers` | SQL rollups: volume, handle time, resolution rate, avg attention, mood-shift count, avg QA stars |

## Uploads queue

`POST /ingest` (manager+) stores the audio into `data/audio/{sid}.mp3` and creates the
call record with `source='upload'` — **no transcription happens in the API container**
(MLX is unavailable there). The host picks it up:

```bash
PYTHONPATH=. RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
  .venv/bin/python scripts/backfill.py --uploads
```

`process_uploads` selects `source='upload' AND transcribed_at IS NULL`, preserving the
customer/agent names captured at queue time, and processes each one.

## Dead-letter & retries

`backfill.py` continues past failures, prints per-call progress, and exits non-zero if
any call failed (so CI/scripts notice). Failed calls keep `asr_error`/`analysis_error`
and are retried on the next run — analysis-only retries are cheap because transcription
is skipped (the check is on `analyzed_at`, but `transcribe_call` runs again only when
`transcribed_at` is missing; see `process_call`).