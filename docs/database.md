# Database (PostgreSQL 16)

Connection: `RADAR_DB_URL` (default `postgresql://radar:radar@localhost:5432/radar`).
Schema is created/upgraded idempotently by `api.db.init_db()` on API startup (no manual
migration step). JSON-ish fields are stored as `TEXT` and parsed in the API layer — the
schema predates JSONB and the corpus size makes it irrelevant.

## Tables

### `customers` / `agents`

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | TEXT | Display name |
| `name_key` | TEXT UNIQUE | Normalized (`" ".join(name.lower().split())`) — identity across calls |
| `created_at` | REAL | |

`upsert_person(conn, table, name)` resolves by `name_key`, inserting on miss (race-safe
via `ON CONFLICT (name_key) DO NOTHING` + re-select).

### `calls`

| Column | Type | Notes |
|---|---|---|
| `sid` | TEXT PK | Call ID (dataset sid or upload filename stem) |
| `customer_id`, `agent_id` | INTEGER FK | |
| `started_at`, `ended_at` | BIGINT | ms epoch |
| `duration_s` | REAL | Derived (ended−started)/1000 |
| `session` | TEXT | Dataset session tag |
| `survey_ease`, `survey_partner` | REAL | Caller survey, /10 |
| `caller_mos` | REAL | Mean opinion score label |
| `source` | TEXT | `dataset` \| `upload` |
| `transcribed_at`, `analyzed_at` | REAL | Pipeline checkpoints (resume keys) |
| `asr_error`, `analysis_error` | TEXT | Last failure, surfaced in UI |

### `words` / `turns`

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `sid` | TEXT FK | |
| `speaker` | TEXT | `agent` \| `caller` (CHECK) |
| `start`, `end` | REAL | Seconds (`end` is quoted — reserved word) |
| `text` | TEXT | A word (words) / a turn's full utterance (turns) |

Indexed by `sid`. Words are the citation ground truth; turns are what the LLM sees and
what the UI renders.

### `analyses`

One row per call (`sid` TEXT PK):

| Column | Notes |
|---|---|
| `intent_label`, `intent_citation` | Intent + evidence JSON |
| `mood_start`, `mood_end`, `mood_timeline` | Timeline JSON `[{t, mood}]` |
| `mood_shift_t`, `mood_shift_from`, `mood_shift_to`, `mood_shift_citation` | Shift moment + evidence |
| `resolution`, `resolution_citation` | `resolved` \| `partial` \| `unresolved` |
| `summary` | ≤40 words |
| `attention_score` | 0–100 |
| `attention_reasons` | JSON `[{reason, citation}]` |
| `citations_verified` | REAL 0–1 (verified/total) |
| `model`, `created_at` | LLM + run time |

### `users`

| Column | Notes |
|---|---|
| `id` SERIAL PK | |
| `name`, `username` (UNIQUE, lowercased) | |
| `password_hash` | scrypt, `salt$hex` (pipeline/auth.py) |
| `role` | `admin` \| `manager` \| `agent` (CHECK) |
| `agent_id` | Optional link to an agent row |
| `active` | 1/0 — disabled users cannot log in |
| `created_at` | |

Seeded on first startup: `admin` / `admin123` (change it!).

### `call_reviews`

| Column | Notes |
|---|---|
| `id` SERIAL PK | |
| `sid` FK, `user_id` FK | UNIQUE(sid, user_id) — one review per manager per call, upserted |
| `stars` | 1–5 (CHECK) |
| `note` | TEXT |
| `created_at` | REAL |

## Indexes

- `idx_turns_sid`, `idx_words_sid`
- `idx_calls_customer`, `idx_calls_agent`, `idx_calls_started`

## Conventions

- All writes go through `psycopg` with `dict_row`; commit is explicit (matches the
  pipeline's checkpointing).
- Placeholders are `%s`; `end` columns are always quoted as `"end"`.
- `ROUND(AVG(x)::numeric, n)::float8` is used everywhere JSON output needs a float
  (Postgres has no `ROUND(double, int)`).

## Migrating from the legacy SQLite database

`scripts/migrate_sqlite.py` copies `customers`, `agents`, `calls`, `words`, `turns`,
`analyses` into Postgres, skipping rows that already exist, and resets serial sequences
afterwards so new inserts never collide with migrated IDs:

```bash
RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
  .venv/bin/python scripts/migrate_sqlite.py data/radar.db
```

Idempotent — safe to run more than once.