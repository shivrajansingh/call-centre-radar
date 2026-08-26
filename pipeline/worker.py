"""Background upload worker.

`POST /ingest` stores the recording and queues the call (transcribed_at IS NULL).
This module polls that queue and processes each call through the full pipeline
(transcribe -> analyze), so dashboard uploads are handled automatically without
a manual `scripts/backfill.py --uploads` run.

Design:
- Claims are atomic (UPDATE ... RETURNING sid), so multiple API workers
  (uvicorn --workers N, or several containers) never double-process a call.
- Stale claims (process died mid-call) are re-claimable after STALE_CLAIM_S.
- Failures are recorded on `calls.asr_error`/`analysis_error` and retried up to
  `max_attempts` times, after which the call is left for manual inspection
  (still visible in the queue with its error).
"""

import logging
import threading
import time

from pipeline.config import (
    UPLOAD_WORKER_ENABLED,
    UPLOAD_WORKER_MAX_ATTEMPTS,
    UPLOAD_WORKER_POLL_S,
    UPLOAD_WORKER_STALE_CLAIM_S,
)

log = logging.getLogger("radar.worker")


def process_uploads(conn, limit: int | None = None,
                    max_attempts: int | None = None) -> tuple[int, int, int]:
    """Transcribe + analyze one batch of queued uploads. Returns (ok, fail, skipped).

    Audio lives in the shared audio dir (db.AUDIO_DIR). Customer/agent names were
    captured at queue time — preserve them.
    """
    from api import db
    from pipeline.ingest import process_call

    max_attempts = max_attempts or UPLOAD_WORKER_MAX_ATTEMPTS
    now = time.time()
    stale_before = now - UPLOAD_WORKER_STALE_CLAIM_S
    cands = conn.execute(
        """SELECT c.sid FROM calls c
           WHERE c.source='upload' AND c.transcribed_at IS NULL
             AND c.upload_attempts < %s
             AND (c.upload_claimed_at IS NULL OR c.upload_claimed_at < %s)
           ORDER BY c.started_at NULLS LAST, c.sid
           LIMIT %s""",
        (max_attempts, stale_before, limit or 50),
    ).fetchall()
    if not cands:
        return 0, 0, 0
    sids = [c["sid"] for c in cands]
    rows = conn.execute(
        """UPDATE calls SET upload_claimed_at=%s WHERE sid = ANY(%s)
           RETURNING sid""",
        (now, sids),
    ).fetchall()
    conn.commit()
    if not rows:
        return 0, 0, 0
    named = {
        r["sid"]: r for r in conn.execute(
            """SELECT c.sid, cu.name AS customer_name, ag.name AS agent_name
               FROM calls c JOIN customers cu ON cu.id=c.customer_id
               JOIN agents ag ON ag.id=c.agent_id
               WHERE c.sid = ANY(%s)""", (sids,)
        ).fetchall()
    }
    rows = [r for r in rows if r["sid"] in named]
    if not rows:
        return 0, 0, 0

    ok = fail = skipped = 0
    for r in rows:
        sid = r["sid"]
        n = named[sid]
        audio = db.AUDIO_DIR / f"{sid}.mp3"
        if not audio.exists():
            conn.execute("UPDATE calls SET upload_attempts=upload_attempts+1,"
                         " upload_claimed_at=NULL WHERE sid=%s", (sid,))
            conn.commit()
            skipped += 1
            continue
        parsed = {
            "customer_name": n["customer_name"],
            "agent_name": n["agent_name"],
            "started_at": None, "ended_at": None, "session": None,
            "survey_ease": None, "survey_partner": None, "caller_mos": None,
        }
        try:
            res = process_call(conn, sid, str(audio), parsed, source="upload")
            ok += 1
            log.info("%s ok turns=%s cites=%s", sid, res["turns"], res["citations_verified"])
        except Exception as e:
            fail += 1
            log.warning("%s FAIL %s", sid, e)
            conn.execute("UPDATE calls SET upload_attempts=upload_attempts+1,"
                         " upload_claimed_at=NULL WHERE sid=%s", (sid,))
            conn.commit()
    return ok, fail, skipped


def _pending_count(conn) -> int:
    row = conn.execute(
        """SELECT COUNT(*) AS n FROM calls
           WHERE source='upload' AND transcribed_at IS NULL"""
    ).fetchone()
    return row["n"] if row else 0


def upload_worker_loop(stop: threading.Event | None = None,
                       poll_s: float | None = None,
                       max_attempts: int | None = None) -> None:
    """Poll the upload queue until `stop` is set. Runs inside a daemon thread."""
    from api import db

    poll_s = poll_s or UPLOAD_WORKER_POLL_S
    stop = stop or threading.Event()
    while not stop.is_set():
        try:
            conn = db.connect()
            try:
                ok, fail, skipped = process_uploads(conn, max_attempts=max_attempts)
                if ok or fail or skipped:
                    log.info("upload batch done ok=%s fail=%s skipped=%s", ok, fail, skipped)
            finally:
                conn.close()
        except Exception as e:
            log.error("upload worker pass failed: %s", e)
        stop.wait(poll_s)


def start_upload_worker() -> threading.Thread:
    thread = threading.Thread(
        target=upload_worker_loop,
        name="upload-worker",
        daemon=True,
    )
    thread.start()
    log.info("upload worker started (poll=%ss, max_attempts=%s)",
             UPLOAD_WORKER_POLL_S, UPLOAD_WORKER_MAX_ATTEMPTS)
    return thread


def upload_worker_status(conn) -> dict:
    try:
        pending = _pending_count(conn)
    except Exception:
        pending = None
    return {
        "enabled": UPLOAD_WORKER_ENABLED,
        "running": any(
            t.name == "upload-worker" and t.is_alive()
            for t in threading.enumerate()
        ),
        "pending": pending,
        "poll_s": UPLOAD_WORKER_POLL_S,
        "max_attempts": UPLOAD_WORKER_MAX_ATTEMPTS,
    }