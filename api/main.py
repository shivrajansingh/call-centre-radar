import json
import shutil
import tempfile
import time
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api import db
from pipeline.auth import hash_password, make_token, parse_token, verify_password
from pipeline.ingest import parse_metadata, process_call

app = FastAPI(title="Call-Centre Radar", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    db.init_db()
    conn = db.connect()
    if not conn.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        conn.execute(
            "INSERT INTO users(name, username, password_hash, role, active, created_at)"
            " VALUES(%s,%s,%s,%s,1,%s)",
            ("Administrator", "admin", hash_password("admin123"), "admin", time.time()),
        )
        conn.commit()
    conn.close()


security = HTTPBearer(auto_error=False)


def current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(401, "not authenticated")
    payload = parse_token(creds.credentials)
    if not payload:
        raise HTTPException(401, "invalid or expired token")
    conn = db.connect()
    user = conn.execute("SELECT * FROM users WHERE id=%s AND active=1", (payload["uid"],)).fetchone()
    conn.close()
    if not user:
        raise HTTPException(401, "user disabled")
    return user


def require_staff(user=Depends(current_user)):
    return user


def require_manager(user=Depends(current_user)):
    if user["role"] not in ("admin", "manager"):
        raise HTTPException(403, "manager or admin required")
    return user


def require_admin(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "admin required")
    return user


def rowd(r):
    return dict(r) if r is not None else None


def rowsd(rows):
    return [dict(r) for r in rows]


# ---------- auth ----------

@app.post("/auth/login")
def login(username: str = Form(...), password: str = Form(...)):
    conn = db.connect()
    user = conn.execute(
        "SELECT * FROM users WHERE username=%s AND active=1", (username.strip().lower(),)
    ).fetchone()
    conn.close()
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(401, "wrong username or password")
    role = user["role"]
    return {
        "token": make_token(user["id"], role),
        "user": {"id": user["id"], "name": user["name"], "username": user["username"], "role": role},
    }


@app.get("/auth/me")
def me(user=Depends(require_staff)):
    return {"id": user["id"], "name": user["name"], "username": user["username"], "role": user["role"]}


# ---------- users (admin) ----------

@app.get("/users")
def list_users(user=Depends(require_admin)):
    conn = db.connect()
    out = rowsd(conn.execute(
        """SELECT u.id, u.name, u.username, u.role, u.active, u.agent_id,
           a.name AS agent_name, u.created_at
           FROM users u LEFT JOIN agents a ON a.id=u.agent_id ORDER BY u.id"""
    ).fetchall())
    conn.close()
    return {"users": out}


@app.post("/users")
def create_user(
    name: str = Form(...), username: str = Form(...), password: str = Form(...),
    role: str = Form(...), user=Depends(require_admin),
):
    if role not in ("admin", "manager", "agent"):
        raise HTTPException(400, "invalid role")
    conn = db.connect()
    try:
        cur = conn.execute(
            "INSERT INTO users(name, username, password_hash, role, active, created_at)"
            " VALUES(%s,%s,%s,%s,1,%s) RETURNING id",
            (name.strip(), username.strip().lower(), hash_password(password), role, time.time()),
        )
        conn.commit()
        uid = cur.fetchone()["id"]
    except Exception:
        raise HTTPException(409, "username already exists")
    finally:
        conn.close()
    return {"id": uid}


@app.patch("/users/{uid}")
def update_user(uid: int, active: int | None = Form(None), password: str | None = Form(None),
                role: str | None = Form(None), user=Depends(require_admin)):
    conn = db.connect()
    if active is not None:
        conn.execute("UPDATE users SET active=%s WHERE id=%s", (1 if active else 0, uid))
    if password:
        conn.execute("UPDATE users SET password_hash=%s WHERE id=%s", (hash_password(password), uid))
    if role:
        if role not in ("admin", "manager", "agent"):
            raise HTTPException(403, "invalid role")
        conn.execute("UPDATE users SET role=%s WHERE id=%s", (role, uid))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/health")
def health():
    conn = db.connect()
    counts = rowd(conn.execute(
        "SELECT COUNT(*) AS calls, "
        "COALESCE(SUM(CASE WHEN transcribed_at IS NOT NULL THEN 1 ELSE 0 END),0) AS transcribed, "
        "COALESCE(SUM(CASE WHEN analyzed_at IS NOT NULL THEN 1 ELSE 0 END),0) AS analyzed "
        "FROM calls"
    ).fetchone())
    conn.close()
    return {"status": "ok", **counts}


# ---------- kpis ----------

@app.get("/kpis")
def kpis(days: int = 14, user=Depends(require_staff)):
    conn = db.connect()
    base = rowd(conn.execute(
        """SELECT COUNT(*) AS total_calls,
           SUM(CASE WHEN transcribed_at IS NOT NULL THEN 1 ELSE 0 END) AS transcribed,
           SUM(CASE WHEN analyzed_at IS NOT NULL THEN 1 ELSE 0 END) AS analyzed,
           SUM(CASE WHEN asr_error IS NOT NULL THEN 1 ELSE 0 END) AS errors,
           ROUND(AVG(duration_s)::numeric, 1)::float8 AS avg_handle_time_s,
           ROUND(AVG(survey_ease)::numeric, 2)::float8 AS avg_survey_ease,
           ROUND(AVG(survey_partner)::numeric, 2)::float8 AS avg_survey_partner
           FROM calls"""
    ).fetchone())

    resolution = rowsd(conn.execute(
        """SELECT COALESCE(a.resolution,'unknown') AS resolution, COUNT(*) AS count
           FROM calls c LEFT JOIN analyses a ON a.sid=c.sid
           GROUP BY 1"""
    ).fetchall())
    base["resolution_split"] = {r["resolution"]: r["count"] for r in resolution}

    mood = rowsd(conn.execute(
        """SELECT COALESCE(a.mood_end,'unknown') AS mood, COUNT(*) AS count
           FROM calls c LEFT JOIN analyses a ON a.sid=c.sid
           WHERE a.sid IS NOT NULL GROUP BY 1"""
    ).fetchall())
    base["mood_distribution"] = {r["mood"]: r["count"] for r in mood}

    base["avg_attention"] = rowd(conn.execute(
        "SELECT ROUND(AVG(attention_score)::numeric, 1)::float8 AS score, "
        "SUM(CASE WHEN attention_score>=70 THEN 1 ELSE 0 END) AS critical "
        "FROM analyses"
    ).fetchone())

    window = days * 86_400_000
    ref = rowd(conn.execute("SELECT MAX(started_at) AS mx FROM calls").fetchone())["mx"]
    series = []
    if ref:
        rows = rowsd(conn.execute(
            """SELECT (started_at / 86400000)::bigint * 86400000 AS day,
               COUNT(*) AS count,
               SUM(CASE WHEN a.resolution='unresolved' THEN 1 ELSE 0 END) AS unresolved
               FROM calls c LEFT JOIN analyses a ON a.sid=c.sid
               WHERE started_at >= %s
               GROUP BY 1 ORDER BY 1""", (ref - window,)
        ).fetchall())
        day_ms = 86_400_000
        series = []
        first_day = (ref - window) // day_ms * day_ms
        by_day = {r["day"]: r for r in rows}
        for i in range(days):
            d = first_day + i * day_ms
            r = by_day.get(d)
            series.append({
                "day": d,
                "count": r["count"] if r else 0,
                "unresolved": r["unresolved"] or 0 if r else 0,
            })
    base["calls_over_time"] = series

    base["reviews"] = rowd(conn.execute(
        "SELECT COUNT(*) AS count, ROUND(AVG(stars)::numeric, 2)::float8 AS avg_stars FROM call_reviews"
    ).fetchone())
    conn.close()
    return base


# ---------- ingest / upload ----------

@app.post("/ingest")
async def ingest(
    audio: UploadFile = File(...),
    metadata: str | None = Form(None),
    caller_name: str = Form("Unknown Caller"),
    agent_name: str = Form("Unknown Agent"),
    user=Depends(require_manager),
):
    raw = await audio.read()
    if not raw:
        raise HTTPException(400, "empty audio file")

    meta = None
    if metadata:
        try:
            meta = json.loads(metadata)
        except json.JSONDecodeError:
            raise HTTPException(400, "metadata must be valid JSON")

    sid = Path(audio.filename or "").stem or None
    if not sid:
        import uuid

        sid = uuid.uuid4().hex[:12]
    parsed = parse_metadata(meta) if meta else {
        "customer_name": caller_name,
        "agent_name": agent_name,
        "started_at": None,
        "ended_at": None,
        "session": None,
        "survey_ease": None,
        "survey_partner": None,
        "caller_mos": None,
    }

    dest = db.AUDIO_DIR / f"{sid}.mp3"
    tmp_audio = None
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
        tf.write(raw)
        tmp_audio = tf.name

    conn = db.connect()
    try:
        result = process_call(conn, sid, tmp_audio, parsed, source="upload", transcribe=False)
        shutil.move(tmp_audio, dest)
        return result
    except Exception as e:
        Path(tmp_audio).unlink(missing_ok=True)
        raise HTTPException(500, f"processing failed: {e}")
    finally:
        conn.close()


# ---------- calls ----------

@app.get("/calls")
def list_calls(q: str | None = None, agent_id: int | None = None,
               customer_id: int | None = None, resolution: str | None = None,
               min_score: int | None = None, analyzed: int | None = None,
               sort: str = "recent", limit: int = 200, offset: int = 0,
               user=Depends(require_staff)):
    if limit > 500:
        limit = 500
    conn = db.connect()
    sql = """SELECT c.sid, c.started_at, c.duration_s, c.session, c.survey_ease,
             c.survey_partner, c.caller_mos, c.source,
             c.transcribed_at, c.analyzed_at, c.asr_error, c.analysis_error,
             cu.name AS customer_name, cu.id AS customer_id,
             ag.name AS agent_name, ag.id AS agent_id,
             a.intent_label, a.resolution, a.attention_score, a.mood_start, a.mood_end,
             a.citations_verified, a.summary, a.mood_shift_t,
             rv.review_count, rv.avg_stars
             FROM calls c
             JOIN customers cu ON cu.id = c.customer_id
             JOIN agents ag ON ag.id = c.agent_id
             LEFT JOIN analyses a ON a.sid = c.sid
             LEFT JOIN (SELECT sid, COUNT(*) AS review_count, ROUND(AVG(stars)::numeric, 2)::float8 AS avg_stars
                        FROM call_reviews GROUP BY sid) rv ON rv.sid = c.sid
             WHERE 1=1"""
    params = []
    if q:
        sql += " AND (cu.name ILIKE %s OR ag.name ILIKE %s OR c.sid ILIKE %s OR a.intent_label ILIKE %s)"
        params += [f"%{q}%"] * 4
    if agent_id:
        sql += " AND c.agent_id = %s"
        params.append(agent_id)
    if customer_id:
        sql += " AND c.customer_id = %s"
        params.append(customer_id)
    if resolution:
        sql += " AND a.resolution = %s"
        params.append(resolution)
    if min_score is not None:
        sql += " AND a.attention_score >= %s"
        params.append(min_score)
    if analyzed is not None:
        sql += " AND a.sid IS NOT NULL" if analyzed else " AND a.sid IS NULL"
    sql += " ORDER BY " + ("a.attention_score DESC" if sort == "attention" else "c.started_at DESC")
    sql += " LIMIT %s OFFSET %s"
    params += [limit, offset]
    out = rowsd(conn.execute(sql, params).fetchall())
    conn.close()
    return {"calls": out}


@app.get("/calls/{sid}")
def get_call(sid: str, user=Depends(require_staff)):
    conn = db.connect()
    try:
        call = conn.execute(
            """SELECT c.*, cu.name AS customer_name, ag.name AS agent_name
               FROM calls c
               JOIN customers cu ON cu.id=c.customer_id
               JOIN agents ag ON ag.id=c.agent_id
               WHERE c.sid=%s""", (sid,)
        ).fetchone()
        if not call:
            raise HTTPException(404, "call not found")
        out = rowd(call)
        analysis = conn.execute("SELECT * FROM analyses WHERE sid=%s", (sid,)).fetchone()
        if analysis:
            a = rowd(analysis)
            for field in ("intent_citation", "mood_timeline", "mood_shift_citation",
                          "resolution_citation", "attention_reasons"):
                if a.get(field):
                    a[field] = json.loads(a[field])
            out["analysis"] = a
        out["turns"] = rowsd(conn.execute(
            'SELECT speaker, "start", "end", text FROM turns WHERE sid=%s ORDER BY "start"', (sid,)
        ).fetchall())
        out["words"] = rowsd(conn.execute(
            'SELECT speaker, "start", "end", text FROM words WHERE sid=%s ORDER BY "start"', (sid,)
        ).fetchall())
        out["reviews"] = rowsd(conn.execute(
            """SELECT r.id, r.sid, r.stars, r.note, r.created_at,
               u.name AS user_name, u.id AS user_id
               FROM call_reviews r JOIN users u ON u.id=r.user_id
               WHERE r.sid=%s ORDER BY r.created_at DESC""", (sid,)
        ).fetchall())
        return out
    finally:
        conn.close()


@app.get("/calls/{sid}/reviews")
def list_reviews(sid: str, user=Depends(require_staff)):
    conn = db.connect()
    rows = rowsd(conn.execute(
        """SELECT r.id, r.stars, r.note, r.created_at, u.name AS user_name, u.id AS user_id
           FROM call_reviews r JOIN users u ON u.id=r.user_id
           WHERE r.sid=%s ORDER BY r.created_at DESC""", (sid,)
    ).fetchall())
    conn.close()
    return {"reviews": rows}


@app.post("/calls/{sid}/reviews")
def create_review(sid: str, stars: int = Form(...), note: str = Form(""),
                  user=Depends(require_manager)):
    if stars < 1 or stars > 5:
        raise HTTPException(400, "stars must be 1-5")
    conn = db.connect()
    if not conn.execute("SELECT 1 FROM calls WHERE sid=%s", (sid,)).fetchone():
        conn.close()
        raise HTTPException(404, "call not found")
    conn.execute(
        """INSERT INTO call_reviews(sid, user_id, stars, note, created_at)
           VALUES(%s,%s,%s,%s,%s)
           ON CONFLICT (sid, user_id) DO UPDATE SET stars=%s, note=%s, created_at=%s""",
        (sid, user["id"], stars, note, time.time(), stars, note, time.time()),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/calls/{sid}/reviews/{rid}")
def delete_review(sid: str, rid: int, user=Depends(require_manager)):
    conn = db.connect()
    row = conn.execute("SELECT user_id FROM call_reviews WHERE id=%s AND sid=%s", (rid, sid)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "review not found")
    if row["user_id"] != user["id"] and user["role"] != "admin":
        conn.close()
        raise HTTPException(403, "not your review")
    conn.execute("DELETE FROM call_reviews WHERE id=%s", (rid,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/audio/{sid}.mp3")
def audio(sid: str):
    path = db.AUDIO_DIR / f"{sid}.mp3"
    if not path.exists():
        dataset_dir = Path(__import__("os").environ.get("RADAR_DATASET_DIR", "callradar-data"))
        alt = dataset_dir / "audio" / f"{sid}.mp3"
        if alt.exists():
            return FileResponse(alt, media_type="audio/mpeg")
        raise HTTPException(404, "audio not found")
    return FileResponse(path, media_type="audio/mpeg")


# ---------- customers ----------

@app.get("/customers")
def customers(user=Depends(require_staff)):
    conn = db.connect()
    out = rowsd(conn.execute(
        """SELECT cu.id, cu.name, COUNT(c.sid) AS call_count,
           MAX(c.started_at) AS last_call_at,
           ROUND(AVG(a.attention_score)::numeric, 1)::float8 AS avg_attention,
           SUM(CASE WHEN a.resolution='unresolved' THEN 1 ELSE 0 END) AS unresolved_count,
           ROUND(AVG(r.stars)::numeric, 2)::float8 AS avg_review_stars
           FROM customers cu
           JOIN calls c ON c.customer_id=cu.id
           LEFT JOIN analyses a ON a.sid=c.sid
           LEFT JOIN call_reviews r ON r.sid=c.sid
           GROUP BY cu.id ORDER BY last_call_at DESC"""
    ).fetchall())
    conn.close()
    return {"customers": out}


@app.post("/customers")
def create_customer(name: str = Form(...), user=Depends(require_manager)):
    if not name.strip():
        raise HTTPException(400, "name required")
    conn = db.connect()
    cid = db.upsert_person(conn, "customers", name.strip())
    conn.close()
    return {"id": cid}


@app.get("/customers/{customer_id}")
def customer_detail(customer_id: int, user=Depends(require_staff)):
    conn = db.connect()
    try:
        cu = conn.execute("SELECT * FROM customers WHERE id=%s", (customer_id,)).fetchone()
        if not cu:
            raise HTTPException(404, "customer not found")
        stats = rowd(conn.execute(
            """SELECT COUNT(*) AS call_count,
               ROUND(AVG(c.duration_s)::numeric,1)::float8 AS avg_handle_time_s,
               ROUND(AVG(a.attention_score)::numeric,1)::float8 AS avg_attention,
               SUM(CASE WHEN a.resolution='unresolved' THEN 1 ELSE 0 END) AS unresolved_count,
               SUM(CASE WHEN a.resolution='resolved' THEN 1 ELSE 0 END) AS resolved_count,
               ROUND(AVG(r.stars)::numeric,2)::float8 AS avg_review_stars
               FROM calls c LEFT JOIN analyses a ON a.sid=c.sid
               LEFT JOIN call_reviews r ON r.sid=c.sid
               WHERE c.customer_id=%s""", (customer_id,)
        ).fetchone())
        calls = rowsd(conn.execute(
            """SELECT c.sid, c.started_at, c.duration_s,
               ag.name AS agent_name, ag.id AS agent_id,
               a.intent_label, a.resolution, a.attention_score,
               a.summary, a.mood_start, a.mood_end
               FROM calls c JOIN agents ag ON ag.id=c.agent_id
               LEFT JOIN analyses a ON a.sid=c.sid
               WHERE c.customer_id=%s ORDER BY c.started_at DESC""", (customer_id,)
        ).fetchall())
        return {**rowd(cu), "stats": stats, "calls": calls}
    finally:
        conn.close()


# ---------- attention / trends ----------

@app.get("/attention")
def attention(limit: int = 50, user=Depends(require_staff)):
    conn = db.connect()
    rows = rowsd(conn.execute(
        """SELECT c.sid, c.started_at, c.duration_s, c.survey_ease, c.survey_partner,
           cu.name AS customer_name, ag.name AS agent_name,
           a.intent_label, a.resolution, a.attention_score, a.attention_reasons,
           a.summary, a.mood_shift_t, a.mood_shift_to
           FROM calls c
           JOIN customers cu ON cu.id=c.customer_id
           JOIN agents ag ON ag.id=c.agent_id
           JOIN analyses a ON a.sid=c.sid
           WHERE a.attention_score IS NOT NULL"""
    ).fetchall())
    conn.close()
    for r in rows:
        r["attention_reasons"] = json.loads(r["attention_reasons"]) if r["attention_reasons"] else []
    ref_day = max((r["started_at"] or 0) for r in rows) if rows else 0
    day_ms = 86_400_000
    for r in rows:
        age_days = max(0.0, (ref_day - (r["started_at"] or ref_day)) / day_ms)
        r["recency_weighted_score"] = round(r["attention_score"] * (1.0 / (1.0 + age_days / 7)), 1)
        if r["resolution"] == "unresolved":
            r["recency_weighted_score"] = round(min(100, r["recency_weighted_score"] * 1.15), 1)
    rows.sort(key=lambda r: -r["recency_weighted_score"])
    return {"reference_day": ref_day, "calls": rows[:limit]}


@app.get("/trending")
def trending(days: int = 30, user=Depends(require_staff)):
    conn = db.connect()
    rows = rowsd(conn.execute(
        """SELECT c.sid, c.started_at, a.intent_label, a.resolution
           FROM analyses a JOIN calls c ON c.sid=a.sid
           WHERE a.intent_label IS NOT NULL"""
    ).fetchall())
    conn.close()
    clusters = {}
    for r in rows:
        key = " ".join((r["intent_label"] or "other").lower().split())[:60]
        cl = clusters.setdefault(key, {"label": key, "count": 0, "unresolved": 0, "examples": []})
        cl["count"] += 1
        if r["resolution"] == "unresolved":
            cl["unresolved"] += 1
        if len(cl["examples"]) < 5:
            cl["examples"].append({"sid": r["sid"], "started_at": r["started_at"]})
    out = sorted(clusters.values(), key=lambda c: (-c["count"], c["label"]))
    for c in out:
        c["unresolved_rate"] = round(c["unresolved"] / c["count"], 2) if c["count"] else 0
    return {"issues": out}


# ---------- agents ----------

@app.get("/agents")
def agents(user=Depends(require_staff)):
    conn = db.connect()
    out = rowsd(conn.execute(
        """SELECT ag.id, ag.name,
           COUNT(c.sid) AS call_count,
           ROUND(AVG(c.duration_s)::numeric, 1)::float8 AS avg_handle_time_s,
           SUM(CASE WHEN a.resolution='resolved' THEN 1 ELSE 0 END) AS resolved,
           SUM(CASE WHEN a.resolution='unresolved' THEN 1 ELSE 0 END) AS unresolved,
           ROUND(AVG(a.attention_score)::numeric, 1)::float8 AS avg_attention_score,
           SUM(CASE WHEN a.mood_shift_t IS NOT NULL THEN 1 ELSE 0 END) AS mood_shifts,
           ROUND(AVG(r.stars)::numeric, 2)::float8 AS avg_review_stars
           FROM agents ag
           JOIN calls c ON c.agent_id=ag.id
           LEFT JOIN analyses a ON a.sid=c.sid
           LEFT JOIN call_reviews r ON r.sid=c.sid
           GROUP BY ag.id ORDER BY call_count DESC"""
    ).fetchall())
    conn.close()
    for a in out:
        known = (a["resolved"] or 0) + (a["unresolved"] or 0)
        a["resolution_rate"] = round((a["resolved"] or 0) / known, 2) if known else None
        del a["resolved"], a["unresolved"]
    return {"agents": out}


@app.post("/agents")
def create_agent(name: str = Form(...), user=Depends(require_manager)):
    if not name.strip():
        raise HTTPException(400, "name required")
    conn = db.connect()
    aid = db.upsert_person(conn, "agents", name.strip())
    conn.close()
    return {"id": aid}


@app.get("/agents/{agent_id}")
def agent_detail(agent_id: int, user=Depends(require_staff)):
    conn = db.connect()
    try:
        ag = conn.execute("SELECT * FROM agents WHERE id=%s", (agent_id,)).fetchone()
        if not ag:
            raise HTTPException(404, "agent not found")
        stats = rowd(conn.execute(
            """SELECT COUNT(*) AS call_count,
               ROUND(AVG(c.duration_s)::numeric,1)::float8 AS avg_handle_time_s,
               ROUND(AVG(a.attention_score)::numeric,1)::float8 AS avg_attention,
               SUM(CASE WHEN a.resolution='resolved' THEN 1 ELSE 0 END) AS resolved_count,
               SUM(CASE WHEN a.resolution='unresolved' THEN 1 ELSE 0 END) AS unresolved_count,
               SUM(CASE WHEN a.mood_shift_t IS NOT NULL THEN 1 ELSE 0 END) AS mood_shifts,
               ROUND(AVG(r.stars)::numeric,2)::float8 AS avg_review_stars
               FROM calls c LEFT JOIN analyses a ON a.sid=c.sid
               LEFT JOIN call_reviews r ON r.sid=c.sid
               WHERE c.agent_id=%s""", (agent_id,)
        ).fetchone())
        known = (stats["resolved_count"] or 0) + (stats["unresolved_count"] or 0)
        stats["resolution_rate"] = round((stats["resolved_count"] or 0) / known, 2) if known else None
        calls = rowsd(conn.execute(
            """SELECT c.sid, c.started_at, c.duration_s,
               cu.name AS customer_name, cu.id AS customer_id,
               a.intent_label, a.resolution, a.attention_score,
               a.summary, a.mood_start, a.mood_end
               FROM calls c JOIN customers cu ON cu.id=c.customer_id
               LEFT JOIN analyses a ON a.sid=c.sid
               WHERE c.agent_id=%s ORDER BY c.started_at DESC""", (agent_id,)
        ).fetchall())
        return {**rowd(ag), "stats": stats, "calls": calls}
    finally:
        conn.close()