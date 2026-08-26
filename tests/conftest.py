"""Test fixtures: isolated Postgres database + FastAPI TestClient.

The suite uses a dedicated `radar_test` database (created on demand) so the
real `radar` database is never touched. Requires the docker `db` container
(or any Postgres at RADAR_DB_URL) to be reachable on :5432.
"""

import os
import sys
import time
from pathlib import Path

ADMIN_DB_URL = os.environ.get(
    "RADAR_DB_URL", "postgresql://radar:radar@localhost:5432/radar"
)
TEST_DB = os.environ.get("RADAR_TEST_DB", "radar_test")
TEST_DB_URL = f"postgresql://radar:radar@localhost:5432/{TEST_DB}"

os.environ["RADAR_DB_URL"] = TEST_DB_URL

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import psycopg  # noqa: E402

import pytest  # noqa: E402


def _ensure_test_db() -> None:
    conn = psycopg.connect(ADMIN_DB_URL, autocommit=True)
    exists = conn.execute(
        "SELECT 1 FROM pg_database WHERE datname=%s", (TEST_DB,)
    ).fetchone()
    if not exists:
        conn.execute(f'CREATE DATABASE "{TEST_DB}"')
    conn.close()


_ensure_test_db()

from api import db  # noqa: E402
from api.main import app  # noqa: E402
from pipeline.auth import hash_password  # noqa: E402


@pytest.fixture()
def clean_db(monkeypatch, tmp_path):
    """Fresh schema + seeded admin user per test; uploads go to a tmp dir."""
    monkeypatch.setattr(db, "AUDIO_DIR", tmp_path)
    db.init_db()
    conn = db.connect()
    conn.execute(
        "TRUNCATE users, call_reviews, analyses, words, turns, calls,"
        " customers, agents RESTART IDENTITY CASCADE"
    )
    conn.execute(
        "INSERT INTO users(name, username, password_hash, role, active, created_at)"
        " VALUES(%s,%s,%s,%s,1,%s)",
        ("Administrator", "admin", hash_password("admin123"), "admin", time.time()),
    )
    conn.commit()
    conn.close()
    yield


@pytest.fixture()
def client(clean_db):
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c


def login(client, username="admin", password="admin123"):
    r = client.post("/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def make_call(conn, sid, customer="Jane Doe", agent="Sam Carter",
              resolution=None, attention=None, started_at=1600000000000):
    from api.db import upsert_person

    cid = upsert_person(conn, "customers", customer)
    aid = upsert_person(conn, "agents", agent)
    conn.execute(
        "INSERT INTO calls(sid, customer_id, agent_id, started_at, ended_at, duration_s,"
        " source, transcribed_at, analyzed_at)"
        " VALUES(%s,%s,%s,%s,%s,%s,'dataset',1,1)"
        " ON CONFLICT (sid) DO UPDATE SET customer_id=EXCLUDED.customer_id,"
        " agent_id=EXCLUDED.agent_id",
        (sid, cid, aid, started_at, started_at + 60000, 60.0),
    )
    if resolution is not None:
        conn.execute(
            "INSERT INTO analyses(sid, intent_label, resolution, attention_score,"
            " citations_verified, created_at)"
            " VALUES(%s,%s,%s,%s,1.0,%s) ON CONFLICT (sid) DO NOTHING",
            (sid, "Account enquiry", resolution, attention if attention is not None else 5,
             time.time()),
        )
    conn.commit()
    return cid, aid