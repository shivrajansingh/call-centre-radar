# API Reference

Base URL: `http://localhost:8100` (or `http://localhost:8081/api` through the nginx
proxy). All endpoints except `/auth/login`, `/health` and `/audio/{sid}.mp3` require
`Authorization: Bearer <token>`.

## Authentication & roles

- `POST /auth/login` — form: `username`, `password` → `{token, user}`. Tokens are
  HMAC-SHA256-signed (`pipeline/auth.py`), payload `{uid, role, exp}`, 7-day TTL.
- `GET /auth/me` — current user.
- Roles: `admin` (everything), `manager` (analytics + upload + QA + register people),
  `agent` (read-only). Failures return 401 (unauthenticated) / 403 (wrong role).

| Endpoint | admin | manager | agent |
|---|---|---|---|
| `GET /kpis /calls /customers /agents /attention /trending` | ✓ | ✓ | ✓ |
| `POST /ingest`, `POST /customers`, `POST /agents`, `POST/DELETE .../reviews` | ✓ | ✓ | ✗ |
| `GET/PATCH /users` | ✓ | ✗ | ✗ |

## Endpoints

### Health & KPIs

**`GET /health`** → `{status, calls, transcribed, analyzed}` — container healthcheck.

**`GET /kpis?days=14`** → headline metrics for the dashboard:
`total_calls, transcribed, analyzed, errors, avg_handle_time_s, avg_survey_ease,
avg_survey_partner, resolution_split {resolved,partial,unresolved,unknown},
mood_distribution {mood: count}, avg_attention {score, critical}, calls_over_time
[{day, count, unresolved} × days], reviews {count, avg_stars}`.

### Calls

**`GET /calls`** — filters (query params): `q` (customer/agent/sid/intent ILIKE),
`agent_id`, `customer_id`, `resolution`, `min_score` (attention ≥), `analyzed` (0|1),
`sort` (`recent` | `attention`), `limit` (≤500, default 200), `offset`. Each row:
`sid, started_at, duration_s, session, survey_ease, survey_partner, caller_mos, source,
transcribed_at, analyzed_at, asr_error, analysis_error, customer_name/id, agent_name/id,
intent_label, resolution, attention_score, mood_start/end, citations_verified, summary,
mood_shift_t, review_count, avg_stars`.

**`GET /calls/{sid}`** — everything about one call: the row above plus `analysis`
(parsed citations/timeline/reasons), `turns [{speaker,start,end,text}]`, `words`
(word-level, used for playback sync), `reviews [{id, stars, note, created_at,
user_name, user_id}]`.

**`GET /audio/{sid}.mp3`** — streams the recording (upload dir first, then the dataset
dir). Supports HTTP Range → seeking works through the nginx proxy.

### QA reviews

**`GET /calls/{sid}/reviews`** · **`POST /calls/{sid}/reviews`** (form `stars` 1–5,
`note`) — upserts per user (`UNIQUE(sid, user_id)`), so re-reviewing updates in place.
**`DELETE /calls/{sid}/reviews/{rid}`** — own review, or any review for admins.

### Customers & Agents

**`GET /customers`** — list with `call_count, last_call_at, avg_attention,
unresolved_count, avg_review_stars`.

**`POST /customers`** (form `name`, manager+) → `{id}` — registered via
`upsert_person` (idempotent by normalized name).

**`GET /customers/{id}`** — `stats {call_count, avg_handle_time_s, avg_attention,
unresolved_count, resolved_count, avg_review_stars}` + `calls[]` (with agent links).

**`GET /agents`** — per-agent `call_count, avg_handle_time_s, resolution_rate,
avg_attention_score, mood_shifts, avg_review_stars`.

**`POST /agents`** (manager+) → `{id}`. **`GET /agents/{id}`** — `stats` (incl.
`resolution_rate`, `mood_shifts`) + `calls[]` (with customer links).

### Attention & trends

**`GET /attention?limit=50`** — ranked queue: recency-weighted
`score × 1/(1 + age_days/7)`, unresolved boosted ×1.15 (cap 100). Returns
`reference_day` + `calls[]` with parsed `attention_reasons` and `recency_weighted_score`.

**`GET /trending?days=30`** — intent-label clusters: `label, count, unresolved,
unresolved_rate, examples[{sid, started_at}]`.

### Users (admin)

**`GET /users`** — with `agent_name` joins. **`POST /users`** (form `name, username,
password, role`). **`PATCH /users/{id}`** (form `active`, `password`, `role`).

### Ingest (manager+)

**`POST /ingest`** — multipart: `audio` (file), optional `metadata` (JSON string),
`caller_name`, `agent_name`. Stores the recording and queues the call:
`{sid, status: "queued"}`. A background worker (see `pipeline/worker.py`,
`GET /health` → `upload_worker`) picks it up within `UPLOAD_WORKER_POLL_S` seconds and
transcribes + analyzes it automatically. Fallback when the worker is disabled:
`scripts/backfill.py --uploads`.

## Error handling

- 400 invalid input (bad JSON, stars out of range, bad role), 401 auth, 403 role,
  404 missing resource, 409 duplicate username, 500 processing failure.
- Errors are JSON `{"detail": "..."}`; the dashboard surfaces them in toasts / inline
  error boxes.

## Conventions

- Form bodies (`application/x-www-form-urlencoded`) everywhere a mutation happens.
- Times: `started_at` ms epoch; `transcribed_at`/`analyzed_at`/`created_at` unix seconds.
- Analysis timestamps (`t_start`/`t_end`, `mood_shift_t`) are seconds within the audio.