"""Upload worker: automatic background processing of queued uploads.

The worker polls calls with source='upload' AND transcribed_at IS NULL,
claims them atomically, and processes each through process_call (transcribe
+ analyze). These tests exercise claim/retry/stale semantics with the heavy
pipeline steps mocked out.
"""

import time

import pytest

from pipeline.worker import process_uploads


def _queue_upload(conn, sid, attempts=0, claimed_at=None):
    from api.db import upsert_person

    cid = upsert_person(conn, "customers", "Uploader")
    aid = upsert_person(conn, "agents", "Agent X")
    conn.execute(
        "INSERT INTO calls(sid, customer_id, agent_id, source, upload_attempts,"
        " upload_claimed_at, started_at)"
        " VALUES(%s,%s,%s,'upload',%s,%s,%s)"
        " ON CONFLICT (sid) DO UPDATE SET source='upload'",
        (sid, cid, aid, attempts, claimed_at, time.time() * 1000),
    )
    conn.commit()


def test_worker_processes_pending_upload(clean_db, monkeypatch, tmp_path):
    from api import db

    conn = db.connect()
    _queue_upload(conn, "up1")
    (tmp_path / "up1.mp3").write_bytes(b"fake-audio")
    conn.close()

    calls = []

    def fake_process_call(c, sid, audio, parsed, source="upload"):
        calls.append((sid, audio, parsed, source))
        c.execute("UPDATE calls SET transcribed_at=%s, analyzed_at=%s WHERE sid=%s",
                  (time.time(), time.time(), sid))
        c.commit()
        return {"sid": sid, "turns": 2, "words": 9, "citations_verified": 1.0}

    monkeypatch.setattr("pipeline.ingest.process_call", fake_process_call)

    conn = db.connect()
    ok, fail, skipped = process_uploads(conn, limit=10)
    conn.close()

    assert (ok, fail, skipped) == (1, 0, 0)
    assert calls[0][0] == "up1"
    assert str(calls[0][1]).endswith("up1.mp3")
    assert calls[0][2]["customer_name"] == "Uploader"
    assert calls[0][2]["agent_name"] == "Agent X"
    assert calls[0][3] == "upload"


def test_worker_skips_missing_audio(clean_db):
    from api import db

    conn = db.connect()
    _queue_upload(conn, "up-nofile")
    conn.close()

    conn = db.connect()
    ok, fail, skipped = process_uploads(conn, limit=10)
    conn.close()

    assert (ok, fail, skipped) == (0, 0, 1)
    conn = db.connect()
    row = conn.execute("SELECT upload_attempts FROM calls WHERE sid='up-nofile'").fetchone()
    conn.close()
    assert row["upload_attempts"] == 1


def test_worker_retries_failures_then_gives_up(clean_db, monkeypatch, tmp_path):
    from api import db

    conn = db.connect()
    _queue_upload(conn, "up-bad")
    (tmp_path / "up-bad.mp3").write_bytes(b"fake-audio")
    conn.close()

    def boom(c, sid, audio, parsed, source="upload"):
        raise RuntimeError("stt exploded")

    monkeypatch.setattr("pipeline.ingest.process_call", boom)

    conn = db.connect()
    assert process_uploads(conn, limit=10, max_attempts=2) == (0, 1, 0)
    # released for retry after failure
    row = conn.execute(
        "SELECT upload_attempts, upload_claimed_at FROM calls WHERE sid='up-bad'"
    ).fetchone()
    assert row["upload_attempts"] == 1
    assert row["upload_claimed_at"] is None

    assert process_uploads(conn, limit=10, max_attempts=2) == (0, 1, 0)
    assert process_uploads(conn, limit=10, max_attempts=2) == (0, 0, 0)  # attempt cap hit
    conn.close()


def test_worker_reclaims_stale_claims(clean_db, monkeypatch, tmp_path):
    from api import db

    conn = db.connect()
    _queue_upload(conn, "up-stale", claimed_at=time.time() - 3600)
    (tmp_path / "up-stale.mp3").write_bytes(b"fake-audio")
    conn.close()

    done = []

    def fake_process_call(c, sid, audio, parsed, source="upload"):
        done.append(sid)
        c.execute("UPDATE calls SET transcribed_at=%s WHERE sid=%s", (time.time(), sid))
        c.commit()
        return {"sid": sid, "turns": 0, "words": 0, "citations_verified": 1.0}

    monkeypatch.setattr("pipeline.ingest.process_call", fake_process_call)

    conn = db.connect()
    assert process_uploads(conn, limit=10) == (1, 0, 0)
    conn.close()
    assert done == ["up-stale"]


def test_worker_does_not_double_claim(clean_db, monkeypatch, tmp_path):
    from api import db

    conn = db.connect()
    _queue_upload(conn, "up-fresh", claimed_at=time.time())
    (tmp_path / "up-fresh.mp3").write_bytes(b"fake-audio")
    conn.close()

    conn = db.connect()
    assert process_uploads(conn, limit=10) == (0, 0, 0)  # claim not stale yet
    conn.close()


def test_health_reports_worker(client):
    body = client.get("/health").json()
    assert body["upload_worker"]["enabled"] is False  # conftest disables the worker
    assert "pending" in body["upload_worker"]
    assert "running" in body["upload_worker"]