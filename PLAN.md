# Call-Centre Radar — Build Plan

## 1. What we know about the data

| Fact | Value / Implication |
|---|---|
| Calls | 1,441 MP3s, 8 kHz telephone quality |
| Avg duration | ~59 s (sampled 200) → **~24 h audio total**, one-time batch job |
| Channels | Left = agent, Right = customer → **speaker identity is free, no diarization needed** |
| Metadata | `agent.metadata.agent_name`, `caller.metadata["first and last name"]`, `start_time_ms`/`end_time_ms`, per-side `survey_response` (ease_of_connection, partner_rating), `labels.caller_mos` / `agent_mos`, `session` |
| Extras | Survey scores + MOS give us free signal for ranking & validation (e.g., low survey + "resolved" claim = suspicious call worth surfacing) |

## 2. Architecture

```
callradar-data/audio/*.mp3 ──┐
callradar-data/metadata/*.json ─┴─> [Ingest] ──> SQLite
                                     │
             ┌───────────────────────┘
             ▼
      [STT Pipeline]  ffmpeg L/R split → per-channel ASR → merge into turns
             │          (batch, resumable, parallel)
             ▼
      transcripts.words / turns  (SQLite, word-level timestamps)
             │
             ▼
      [Analysis Pipeline]  1 LLM call per transcript, JSON-schema output
             │              intent · mood timeline · shift point · resolution
             │              summary ≤40w · needs-attention score
             │              every field carries {t_start,t_end,quote}
             ├── citation validator: quote must exist in words near timestamp,
             │   else regenerate (max N retries) → guards against hallucinated evidence
             ▼
      analyses + citations (SQLite)
             │
             ├─> [Aggregate job] ranked attention list · trend clustering · agent stats
             ▼
      [FastAPI]  /calls/{id} · /customers · /attention · /trending · /agents · /audio/{id}.mp3
             │
             ▼
      [React dashboard]  Customers → history → Call detail (player + synced transcript +
                         mood timeline + cited summary) · Manager view · Agents view
```

**Core rule enforced everywhere:** no judgment without a citation `{seconds, quote}` that a validator has matched against actual transcript words.

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| STT | ffmpeg channel-split → **`mlx-whisper` (`whisper-large-v3-turbo`, 4-bit) on Apple Silicon GPU** — benchmarked 3.3–3.4× realtime on M2/8 GB; word timestamps verified | Text-only LLM gateway can't do audio; local = free, no keys; channel split gives speaker labels free |
| Analysis LLM | Text-only gateway, `OPENAI_MODEL`, JSON-schema prompting (or structured outputs if supported), temp 0 | Deterministic, parseable, citable |
| Storage | SQLite (WAL) | Zero ops, single file, enough for 1,441 calls; audio stays on disk, served statically |
| API | FastAPI + Uvicorn | Same language as pipeline, typed models double as response schemas |
| Dashboard | Vite + React + TypeScript + Tailwind, Recharts for mood timeline | Fast to build, easy to demo |
| Orchestration | Plain Python batch runner with checkpointing (skip completed IDs) | No Airflow-class machinery needed for a one-off corpus |

One language (Python) for everything except the UI keeps the project simple to run from scratch.

## 4. Database schema (SQLite)

```sql
customers(id TEXT PK, name TEXT)            -- keyed by normalized caller name
agents(id TEXT PK, name TEXT)
calls(sid TEXT PK, customer_id FK, agent_id FK,
      started_at INT, ended_at INT, duration_s REAL,
      session TEXT, survey_ease REAL, survey_partner REAL, caller_mos REAL)
words(call_sid FK, speaker TEXT CHECK(speaker IN('agent','caller')),
      start REAL, end REAL, text TEXT)               -- word-level
turns(id INTEGER PK, call_sid FK, speaker TEXT, start REAL, end REAL, text TEXT)
analyses(call_sid FK UNIQUE,
      intent TEXT, intent_citation JSON,
      mood_start TEXT, mood_end TEXT, mood_timeline JSON,   -- [{t,mood,label}]
      mood_shift REAL, mood_shift_citation JSON,
      resolved TEXT CHECK(resolved IN('resolved','unresolved','partial','unknown')),
      resolution_citation JSON,
      summary TEXT,                                          -- ≤40 words
      attention_score INTEGER, attention_reasons JSON)       -- [{reason,citation}]
citations(id PK, call_sid FK, field TEXT, start REAL, end REAL, quote TEXT, verified INT)
issue_clusters(id PK, label TEXT, count INT, sample_call_sids JSON)  -- trends
```

## 5. Pipeline stages

### Stage 0 — Ingest
Read all metadata JSONs → populate customers/agents/calls. Normalize names for customer identity ("Mary Smith" across calls = same person).

### Stage 1 — Transcribe (the expensive step, run once)
1. For each call not yet transcribed (checkpoint table drives resume):
2. `ffmpeg -i x.mp3 -filter_complex "[0:a]channelsplit=channels=2[l][r]"` → two mono 16 kHz WAVs.
3. Transcribe each channel → word timestamps (`timestamp_granularities[]=word`).
4. Merge: sort words by time, group into turns (same speaker + gap < 0.8 s).
5. Persist words + turns. Retries with backoff; failed IDs land in a dead-letter list.
- Preflight check: verify `STT_PROVIDER` (default `local`); ~24 h audio ≈ ~2–4 h wall-clock on Apple Silicon (mlx-whisper / large-v3-turbo), free.
- Quality guardrail: spot-check N random calls against audio during development; drop channels with no speech rather than inventing turns.

### Stage 2 — Analyze (LLM per call)
One request per call with the turn-level transcript (timestamps embedded), returning strict JSON:
```
intent (+citation) · mood_timeline [{t, mood}] · mood_shift {t, quote} | null ·
resolved (+citation) · summary ≤40 words · attention_score 0–100 +
attention_reasons [{reason, citation}]
```
Prompt rules baked in: quotes must be verbatim substrings of the transcript; cite the exact moment; unresolved ≠ claimed-resolved (watch for polite false closure); score drivers: negative mood shift, unresolved issue, repeated question, complaint language, escalation threats.

**Citation validator:** every returned quote is fuzzy-matched against `words` within ±3 s of the claimed timestamp (normalized whitespace/punct, ≥90 % similarity). Fail → regenerate up to 3× → mark unverified (never shown silently as fact).

### Stage 3 — Aggregate
- **Attention ranking**: `attention_score` recency-weighted (today's queue first), tie-break by unresolved > negative shift > low survey. Survey/MOS cross-check: flag "resolved" + survey ≤ 3 as suspect.
- **Trending issues**: cluster call intents/complaint topics (embedding similarity if the gateway serves embeddings; else LLM-assigned topic tags grouped by frequency over trailing 7 days vs prior).
- **Agent stats**: SQL rollups — volume, avg handle time, resolution rate, avg attention score, mood-shift rate.

### Stage 4 — API (FastAPI)
```
GET /calls                      # list + filters (attention, agent, customer)
GET /calls/{sid}                # transcript turns, analysis, all citations w/ timestamps
GET /audio/{sid}.mp3            # static file stream (for <audio> seek)
GET /customers                  # list + call counts + last call
GET /customers/{id}             # profile + full call history
GET /attention?date=today       # ranked manager queue
GET /trending                   # issue clusters + counts + example calls
GET /agents                     # per-agent volume/handle-time/outcomes
```

### Stage 5 — Dashboard (Vite + React)
1. **Manager view (home)**: ranked needs-attention list (score, reason chips → jump to cited moment), trending issues panel, KPI header (volume, resolution rate, avg sentiment).
2. **Customers**: searchable table → profile page with chronological call history.
3. **Call detail**: audio player + transcript turns synced (click a turn/citation ⇒ seek audio); mood timeline strip above transcript with the shift marker clickable; summary card where every sentence underlines its citation; intent/resolution badges with hover-to-evidence.
4. **Agents**: volume, AHT, outcomes table + drill-down.

## 6. Build order (each phase ends runnable)

| Phase | Deliverable | Exit criteria |
|---|---|---|
| P0 | Repo scaffold, ingest → SQLite | All 1,441 metadata rows loaded; names/times sane |
| P1 | STT pipeline + preflight + resume | 100 % calls transcribed (or dead-lettered), spot-check accuracy OK |
| P2 | Citation-validating analyzer | ≥95 % citations verify; summaries pass ≤40-word check |
| P3 | Aggregations | Attention list, trends, agent stats computable in SQL |
| P4 | FastAPI | Contract served for a handful of calls end-to-end |
| P5 | Dashboard | Manager + customer + call views live against real data |
| P6 | README (from-scratch run incl. transcription), demo script | Reviewer can clone → env → run pipeline → open dashboard |

P1 and P2 are independent of P4/P5 once the schema exists; UI work can start on partial data while the rest transcribes.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Local STT slower than expected / accuracy gaps on 8 kHz audio | Resample to 16 kHz, use large-v3-turbo; parallel workers across calls; spot-check N random transcripts against audio |
| LLM hallucinates citations | Verbatim-match validator + regenerate loop; unverifiable claims rendered as unverified, never as fact |
| Duplicate/ambiguous customer names | Normalize + disambiguate by co-occurring agents/dates; show raw name strings in UI |
| Evidence contradicts claim ("negative scoring") | Validator checks *quote existence*; prompt requires quote to support the specific field; manual audit sample per batch |

## 8. Demo flow (on the day)

1. Manager view → top-ranked call → click reason chip → audio seeks to cited second, words highlight live.
2. Show mood timeline with shift marker → jump to the exact utterance that turned the customer.
3. Customer page → history across multiple calls → same-intent pattern visible in trends.
4. Agents view → outlier handle times/resolution rates.
