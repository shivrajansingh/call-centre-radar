"""Copy existing data from the legacy SQLite database into PostgreSQL.

Run AFTER Postgres is up (docker compose up -d db):

    RADAR_DB_URL=postgresql://radar:radar@localhost:5432/radar \
    .venv/bin/python scripts/migrate_sqlite.py [path/to/radar.db]

Idempotent: skips records that already exist in Postgres.
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path

from api import db


def connect_sqlite(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sqlite_db", nargs="?", default="data/radar.db")
    args = ap.parse_args()
    if not Path(args.sqlite_db).exists():
        print(f"no sqlite db at {args.sqlite_db} — nothing to migrate", file=sys.stderr)
        return

    src = connect_sqlite(args.sqlite_db)
    db.init_db()
    dst = db.connect()

    def table_exists(conn, name: str) -> bool:
        return conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
        ).fetchone() is not None

    if not table_exists(src, "calls"):
        print("legacy db has no calls table — nothing to migrate")
        return

    def copy(table: str, cols: str, keys: str):
        rows = src.execute(f"SELECT {cols} FROM {table}").fetchall()
        if not rows:
            print(f"{table}: 0 rows")
            return
        for r in rows:
            try:
                dst.execute(
                    f"INSERT INTO {table}({cols}) VALUES({','.join(['%s'] * len(r.keys()))})"
                    f" ON CONFLICT ({keys}) DO NOTHING",
                    tuple(r[k] for k in r.keys()),
                )
            except Exception as e:
                print(f"{table}: row skipped ({e})")
        dst.commit()
        print(f"{table}: {len(rows)} rows")

    # customers / agents must go first (calls reference them)
    copy("customers", "id, name, name_key", "name_key")
    copy("agents", "id, name, name_key", "name_key")

    call_cols = ["sid", "customer_id", "agent_id", "started_at", "ended_at", "duration_s",
                 "session", "survey_ease", "survey_partner", "caller_mos", "source",
                 "transcribed_at", "analyzed_at", "asr_error", "analysis_error"]
    existing = {r["name"] for r in src.execute("PRAGMA table_info(calls)").fetchall()}
    call_cols = [c for c in call_cols if c in existing]
    copy("calls", ", ".join(call_cols), "sid")
    for table in ("words", "turns"):
        if not table_exists(src, table):
            continue
        rows = src.execute('SELECT sid, speaker, start, "end", text FROM ' + table).fetchall()
        if not rows:
            print(f"{table}: 0 rows")
            continue
        dst.cursor().executemany(
            f'INSERT INTO {table}(sid, speaker, "start", "end", text)'
            " VALUES(%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
            [tuple(r[k] for k in r.keys()) for r in rows],
        )
        dst.commit()
        print(f"{table}: {len(rows)} rows")

    if table_exists(src, "analyses"):
        rows = src.execute("SELECT * FROM analyses").fetchall()
        if rows:
            for r in rows:
                dst.execute(
                    "INSERT INTO analyses(sid, intent_label, intent_citation, mood_start,"
                    " mood_end, mood_timeline, mood_shift_t, mood_shift_from, mood_shift_to,"
                    " mood_shift_citation, resolution, resolution_citation, summary,"
                    " attention_score, attention_reasons, citations_verified, model, created_at)"
                    " VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
                    " ON CONFLICT (sid) DO NOTHING",
                    tuple(r[k] for k in r.keys()),
                )
            dst.commit()
            print(f"analyses: {len(rows)} rows")

    for table in ("customers", "agents", "words", "turns", "call_reviews"):
        dst.execute(
            f"SELECT setval(pg_get_serial_sequence('{table}','id'),"
            f" COALESCE(MAX(id), 1)) FROM {table}"
        )
    dst.commit()

    dst.close()
    src.close()
    print("migration complete")


if __name__ == "__main__":
    main()