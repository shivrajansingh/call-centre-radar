import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

DB_URL = os.environ.get(
    "RADAR_DB_URL", "postgresql://radar:radar@localhost:5432/radar"
)
AUDIO_DIR = Path(os.environ.get("RADAR_AUDIO_DIR", "data/audio"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS customers(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT UNIQUE NOT NULL,
  created_at REAL
);
CREATE TABLE IF NOT EXISTS agents(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT UNIQUE NOT NULL,
  created_at REAL
);
CREATE TABLE IF NOT EXISTS calls(
  sid TEXT PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  agent_id INTEGER REFERENCES agents(id),
  started_at BIGINT,
  ended_at BIGINT,
  duration_s REAL,
  session TEXT,
  survey_ease REAL,
  survey_partner REAL,
  caller_mos REAL,
  source TEXT DEFAULT 'dataset',
  transcribed_at REAL,
  analyzed_at REAL,
  asr_error TEXT,
  analysis_error TEXT
);
CREATE TABLE IF NOT EXISTS turns(
  id SERIAL PRIMARY KEY,
  sid TEXT REFERENCES calls(sid),
  speaker TEXT NOT NULL CHECK(speaker IN ('agent','caller')),
  start REAL, "end" REAL, text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','manager','agent')),
  agent_id INTEGER REFERENCES agents(id),
  active INTEGER DEFAULT 1,
  created_at REAL
);
CREATE TABLE IF NOT EXISTS call_reviews(
  id SERIAL PRIMARY KEY,
  sid TEXT REFERENCES calls(sid),
  user_id INTEGER REFERENCES users(id),
  stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
  note TEXT,
  created_at REAL,
  UNIQUE(sid, user_id)
);
CREATE TABLE IF NOT EXISTS words(
  id SERIAL PRIMARY KEY,
  sid TEXT REFERENCES calls(sid),
  speaker TEXT NOT NULL,
  start REAL, "end" REAL, text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analyses(
  sid TEXT PRIMARY KEY REFERENCES calls(sid),
  intent_label TEXT, intent_citation TEXT,
  mood_start TEXT, mood_end TEXT, mood_timeline TEXT,
  mood_shift_t REAL, mood_shift_from TEXT, mood_shift_to TEXT, mood_shift_citation TEXT,
  resolution TEXT, resolution_citation TEXT,
  summary TEXT,
  attention_score INTEGER, attention_reasons TEXT,
  citations_verified REAL, model TEXT, created_at REAL
);
CREATE INDEX IF NOT EXISTS idx_turns_sid ON turns(sid);
CREATE INDEX IF NOT EXISTS idx_words_sid ON words(sid);
CREATE INDEX IF NOT EXISTS idx_calls_customer ON calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_calls_agent ON calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_started ON calls(started_at);
"""


def connect() -> psycopg.Connection:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    conn = psycopg.connect(DB_URL, row_factory=dict_row)
    return conn


def init_db() -> None:
    conn = connect()
    conn.execute(SCHEMA)
    conn.execute("ALTER TABLE calls ADD COLUMN IF NOT EXISTS analysis_error TEXT")
    conn.commit()
    conn.close()


def name_key(name: str) -> str:
    return " ".join(name.lower().split())


def upsert_person(conn, table: str, name: str) -> int:
    key = name_key(name)
    row = conn.execute(
        f"SELECT id FROM {table} WHERE name_key=%s", (key,)
    ).fetchone()
    if row:
        return row["id"]
    cur = conn.execute(
        f"INSERT INTO {table}(name, name_key, created_at) VALUES(%s,%s,%s)"
        " ON CONFLICT (name_key) DO NOTHING RETURNING id",
        (name.strip(), key, __import__("time").time()),
    )
    row = cur.fetchone()
    if row:
        return row["id"]
    return conn.execute(
        f"SELECT id FROM {table} WHERE name_key=%s", (key,)
    ).fetchone()["id"]