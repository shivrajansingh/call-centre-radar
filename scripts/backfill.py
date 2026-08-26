import argparse
import json
import sys
import time
from pathlib import Path

from api import db
from pipeline.ingest import parse_metadata, process_call

DATA_DIR = Path("callradar-data")


def process_uploads(conn):
    """Transcribe + analyze calls uploaded via the API (source='upload', not yet transcribed).

    Audio lives in the shared audio dir (db.AUDIO_DIR, mounted into the API container).
    Customer/agent names were captured at queue time — preserve them.
    """
    pending = conn.execute(
        """SELECT c.sid, cu.name AS customer_name, ag.name AS agent_name
           FROM calls c JOIN customers cu ON cu.id=c.customer_id
           JOIN agents ag ON ag.id=c.agent_id
           WHERE c.source='upload' AND c.transcribed_at IS NULL"""
    ).fetchall()
    if not pending:
        print("no pending uploads")
        return 0, 0
    ok = fail = 0
    for r in pending:
        sid = r["sid"]
        audio = db.AUDIO_DIR / f"{sid}.mp3"
        if not audio.exists():
            print(f"{sid} MISSING AUDIO ({audio})", flush=True)
            fail += 1
            continue
        parsed = {
            "customer_name": r["customer_name"],
            "agent_name": r["agent_name"],
            "started_at": None, "ended_at": None, "session": None,
            "survey_ease": None, "survey_partner": None, "caller_mos": None,
        }
        try:
            res = process_call(conn, sid, str(audio), parsed, source="upload")
            ok += 1
            print(f"{sid} ok turns={res['turns']} cites={res['citations_verified']:.0%}", flush=True)
        except Exception as e:
            fail += 1
            print(f"{sid} FAIL {e}", flush=True)
    return ok, fail


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--skip", type=int, default=0)
    ap.add_argument("--uploads", action="store_true",
                    help="process calls uploaded via the API instead of the dataset")
    args = ap.parse_args()

    db.init_db()
    conn = db.connect()

    if args.uploads:
        ok, fail = process_uploads(conn)
        print(f"\nuploads done ok={ok} fail={fail}")
        sys.exit(1 if fail and not ok else 0)

    done = {r["sid"] for r in conn.execute(
        "SELECT sid FROM calls WHERE analyzed_at IS NOT NULL"
    ).fetchall()}

    metas = sorted(DATA_DIR.glob("metadata/*.json"))[args.skip:]
    if args.limit:
        metas = metas[: args.limit]

    ok = fail = skipped = 0
    t0 = time.time()
    for i, mp in enumerate(metas):
        meta = json.loads(mp.read_text())
        sid = meta.get("sid") or mp.stem
        if sid in done:
            skipped += 1
            continue
        audio = DATA_DIR / "audio" / f"{sid}.mp3"
        if not audio.exists():
            print(f"[{i}] {sid} MISSING AUDIO", flush=True)
            fail += 1
            continue
        transcript = None
        tx = conn.execute("SELECT transcribed_at FROM calls WHERE sid=%s", (sid,)).fetchone()
        if tx and tx["transcribed_at"]:
            words = conn.execute(
                'SELECT speaker, "start", "end", text FROM words WHERE sid=%s ORDER BY "start"',
                (sid,)).fetchall()
            turns = conn.execute(
                'SELECT speaker, "start", "end", text FROM turns WHERE sid=%s ORDER BY "start"',
                (sid,)).fetchall()
            if words:
                transcript = {"words": [dict(w) for w in words], "turns": [dict(t) for t in turns]}
        try:
            r = process_call(conn, sid, str(audio), parse_metadata(meta), transcript=transcript)
            ok += 1
            print(f"[{i}] {sid} ok turns={r['turns']} cites={r['citations_verified']:.0%} "
                  f"elapsed={time.time() - t0:.0f}s", flush=True)
        except Exception as e:
            fail += 1
            print(f"[{i}] {sid} FAIL {e}", flush=True)
    conn.close()
    print(f"\ndone ok={ok} fail={fail} skipped={skipped} in {time.time() - t0:.0f}s")
    sys.exit(1 if fail and not ok else 0)


if __name__ == "__main__":
    main()