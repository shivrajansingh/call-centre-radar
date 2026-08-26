"""API: auth flow, role gating, reviews, uploads, filters, KPIs."""

import io

from tests.conftest import auth, login, make_call


def _create_user(client, token, name, username, password, role):
    r = client.post("/users", data={"name": name, "username": username,
                                    "password": password, "role": role},
                    headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ---------- auth ----------

def test_login_ok(client):
    r = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["role"] == "admin"
    assert body["token"]


def test_login_wrong_password_401(client):
    r = client.post("/auth/login", data={"username": "admin", "password": "nope"})
    assert r.status_code == 401


def test_login_unknown_user_401(client):
    r = client.post("/auth/login", data={"username": "ghost", "password": "x"})
    assert r.status_code == 401


def test_unauthenticated_requests_rejected(client):
    assert client.get("/calls").status_code == 401
    assert client.get("/kpis").status_code == 401


def test_invalid_token_rejected(client):
    r = client.get("/calls", headers={"Authorization": "Bearer garbage.token.here"})
    assert r.status_code == 401


def test_auth_me(client):
    token = login(client)
    r = client.get("/auth/me", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["username"] == "admin"


# ---------- role gating ----------

def _make_agent_and_manager(client):
    token = login(client)
    _create_user(client, token, "Agent One", "agent1", "agent123", "agent")
    _create_user(client, token, "Manager One", "mgr1", "mgr123", "manager")
    agent_token = login(client, "agent1", "agent123")
    mgr_token = login(client, "mgr1", "mgr123")
    return token, agent_token, mgr_token


def test_agent_can_read_but_not_write(client):
    _, agent_token, _ = _make_agent_and_manager(client)
    assert client.get("/calls", headers=auth(agent_token)).status_code == 200
    assert client.get("/kpis", headers=auth(agent_token)).status_code == 200
    assert client.post("/customers", data={"name": "X"}, headers=auth(agent_token)).status_code == 403
    assert client.post("/agents", data={"name": "Y"}, headers=auth(agent_token)).status_code == 403
    assert client.get("/users", headers=auth(agent_token)).status_code == 403
    assert client.post("/users", data={}, headers=auth(agent_token)).status_code == 403


def test_manager_can_write_but_not_manage_users(client):
    _, agent_token, mgr_token = _make_agent_and_manager(client)
    assert client.post("/customers", data={"name": "Jane"}, headers=auth(mgr_token)).status_code == 200
    assert client.get("/users", headers=auth(mgr_token)).status_code == 403
    assert client.post("/users", data={}, headers=auth(mgr_token)).status_code == 403


def test_agent_cannot_upload(client):
    _, agent_token, _ = _make_agent_and_manager(client)
    r = client.post("/ingest", files={"audio": ("a.mp3", b"x", "audio/mpeg")},
                    headers=auth(agent_token))
    assert r.status_code == 403


# ---------- users (admin) ----------

def test_admin_user_crud(client):
    token = login(client)
    uid = _create_user(client, token, "Dana Price", "dana", "dana123", "manager")
    users = client.get("/users", headers=auth(token)).json()["users"]
    assert any(u["id"] == uid and u["role"] == "manager" for u in users)

    r = client.patch(f"/users/{uid}", data={"active": 0}, headers=auth(token))
    assert r.status_code == 200
    assert client.post("/auth/login", data={"username": "dana", "password": "dana123"}).status_code == 401

    client.patch(f"/users/{uid}", data={"role": "agent", "active": 1}, headers=auth(token))
    dana_token = login(client, "dana", "dana123")
    assert client.get("/users", headers=auth(dana_token)).status_code == 403
    assert client.get("/customers", headers=auth(dana_token)).status_code == 200


def test_duplicate_username_409(client):
    token = login(client)
    r = client.post("/users", data={"name": "Dup", "username": "admin",
                                    "password": "x12345", "role": "agent"},
                    headers=auth(token))
    assert r.status_code == 409


# ---------- reviews ----------

def test_review_upsert_and_delete(client, clean_db):
    from api import db

    token = login(client)
    conn = db.connect()
    make_call(conn, "call1")
    conn.close()

    r = client.post("/calls/call1/reviews", data={"stars": 4, "note": "good"},
                    headers=auth(token))
    assert r.status_code == 200
    r = client.post("/calls/call1/reviews", data={"stars": 5, "note": "even better"},
                    headers=auth(token))
    assert r.status_code == 200

    reviews = client.get("/calls/call1/reviews", headers=auth(token)).json()["reviews"]
    assert len(reviews) == 1  # upserted, not duplicated
    assert reviews[0]["stars"] == 5

    rid = reviews[0]["id"]
    assert client.delete(f"/calls/call1/reviews/{rid}", headers=auth(token)).status_code == 200
    reviews = client.get("/calls/call1/reviews", headers=auth(token)).json()["reviews"]
    assert reviews == []


def test_review_validation(client, clean_db):
    from api import db

    token = login(client)
    conn = db.connect()
    make_call(conn, "call2")
    conn.close()
    assert client.post("/calls/call2/reviews", data={"stars": 0},
                       headers=auth(token)).status_code == 400
    assert client.post("/calls/call2/reviews", data={"stars": 6},
                       headers=auth(token)).status_code == 400
    assert client.post("/calls/nonexistent/reviews", data={"stars": 3},
                       headers=auth(token)).status_code == 404


def test_agent_cannot_review(client, clean_db):
    from api import db

    _, agent_token, _ = _make_agent_and_manager(client)
    conn = db.connect()
    make_call(conn, "call3")
    conn.close()
    r = client.post("/calls/call3/reviews", data={"stars": 3}, headers=auth(agent_token))
    assert r.status_code == 403


def test_manager_cannot_delete_others_review(client, clean_db):
    from api import db

    token, _, mgr_token = _make_agent_and_manager(client)
    conn = db.connect()
    make_call(conn, "call4")
    conn.close()
    client.post("/calls/call4/reviews", data={"stars": 4}, headers=auth(token))
    rid = client.get("/calls/call4/reviews", headers=auth(mgr_token)).json()["reviews"][0]["id"]
    assert client.delete(f"/calls/call4/reviews/{rid}", headers=auth(mgr_token)).status_code == 403
    assert client.delete(f"/calls/call4/reviews/{rid}", headers=auth(token)).status_code == 200


# ---------- ingest (upload queue) ----------

def test_ingest_queues_call(client, clean_db):
    token = login(client)
    r = client.post(
        "/ingest",
        files={"audio": ("freshcall.mp3", b"fake-mp3-bytes", "audio/mpeg")},
        data={"caller_name": "New Caller", "agent_name": "New Agent"},
        headers=auth(token),
    )
    assert r.status_code == 200
    body = r.json()
    assert body == {"sid": "freshcall", "status": "queued"}

    from api import db

    conn = db.connect()
    row = conn.execute(
        "SELECT c.sid, c.source, cu.name AS cname, ag.name AS aname"
        " FROM calls c JOIN customers cu ON cu.id=c.customer_id"
        " JOIN agents ag ON ag.id=c.agent_id WHERE c.sid='freshcall'"
    ).fetchone()
    assert row["source"] == "upload"
    assert row["cname"] == "New Caller"
    assert row["aname"] == "New Agent"
    assert conn.execute("SELECT transcribed_at FROM calls WHERE sid='freshcall'").fetchone()["transcribed_at"] is None
    conn.close()


def test_ingest_requires_manager(client):
    token = login(client)
    _create_user(client, token, "Agent Two", "agent2", "agent123", "agent")
    agent_token = login(client, "agent2", "agent123")
    r = client.post("/ingest", files={"audio": ("x.mp3", b"x", "audio/mpeg")},
                    headers=auth(agent_token))
    assert r.status_code == 403


# ---------- calls list & filters ----------

def test_calls_list_and_filters(client, clean_db):
    from api import db

    token = login(client)
    conn = db.connect()
    make_call(conn, "c1", customer="Alice", resolution="resolved", attention=10)
    make_call(conn, "c2", customer="Bob", resolution="unresolved", attention=90)
    make_call(conn, "c3", customer="Carol", resolution="unresolved", attention=40)
    conn.close()

    calls = client.get("/calls", headers=auth(token)).json()["calls"]
    assert len(calls) == 3

    filtered = client.get("/calls?resolution=unresolved", headers=auth(token)).json()["calls"]
    assert {c["sid"] for c in filtered} == {"c2", "c3"}

    filtered = client.get("/calls?min_score=50", headers=auth(token)).json()["calls"]
    assert [c["sid"] for c in filtered] == ["c2"]

    filtered = client.get("/calls?q=alice", headers=auth(token)).json()["calls"]
    assert [c["sid"] for c in filtered] == ["c1"]

    sorted_attention = client.get("/calls?sort=attention", headers=auth(token)).json()["calls"]
    assert [c["sid"] for c in sorted_attention] == ["c2", "c3", "c1"]


def test_call_detail_shape(client, clean_db):
    from api import db

    token = login(client)
    conn = db.connect()
    make_call(conn, "detail1", resolution="resolved")
    conn.execute(
        "INSERT INTO turns(sid, speaker, start, \"end\", text) VALUES('detail1','agent',0,1,'hi')"
    )
    conn.execute(
        "INSERT INTO words(sid, speaker, start, \"end\", text) VALUES('detail1','agent',0,0.5,'hi')"
    )
    conn.commit()
    conn.close()

    body = client.get("/calls/detail1", headers=auth(token)).json()
    assert body["sid"] == "detail1"
    assert body["customer_name"] == "Jane Doe"
    assert body["analysis"]["intent_label"] == "Account enquiry"
    assert body["analysis"]["resolution"] == "resolved"
    assert body["turns"][0]["text"] == "hi"
    assert body["words"][0]["text"] == "hi"
    assert body["reviews"] == []


def test_call_detail_404(client):
    token = login(client)
    assert client.get("/calls/doesnotexist", headers=auth(token)).status_code == 404


# ---------- kpis / customers / agents / attention ----------

def test_kpis_shape(client, clean_db):
    from api import db

    token = login(client)
    conn = db.connect()
    make_call(conn, "k1", resolution="resolved", attention=5)
    make_call(conn, "k2", resolution="unresolved", attention=80)
    conn.close()

    k = client.get("/kpis", headers=auth(token)).json()
    assert k["total_calls"] == 2
    assert k["analyzed"] == 2
    assert k["resolution_split"]["resolved"] == 1
    assert k["resolution_split"]["unresolved"] == 1
    assert k["avg_attention"]["critical"] == 1
    assert len(k["calls_over_time"]) == 14
    assert k["avg_handle_time_s"] == 60.0


def test_customers_and_agents_endpoints(client, clean_db):
    from api import db

    token = login(client)
    conn = db.connect()
    make_call(conn, "p1", customer="Pat", agent="Ria", resolution="resolved")
    conn.close()

    customers = client.get("/customers", headers=auth(token)).json()["customers"]
    assert customers[0]["name"] == "Pat"
    assert customers[0]["call_count"] == 1

    detail = client.get(f"/customers/{customers[0]['id']}", headers=auth(token)).json()
    assert detail["stats"]["call_count"] == 1
    assert detail["calls"][0]["sid"] == "p1"

    agents = client.get("/agents", headers=auth(token)).json()["agents"]
    assert agents[0]["name"] == "Ria"
    assert agents[0]["resolution_rate"] == 1.0

    agent_detail = client.get(f"/agents/{agents[0]['id']}", headers=auth(token)).json()
    assert agent_detail["calls"][0]["customer_name"] == "Pat"


def test_attention_ranks_unresolved_first(client, clean_db):
    from api import db

    token = login(client)
    conn = db.connect()
    make_call(conn, "a1", resolution="resolved", attention=50, started_at=1600000000000)
    make_call(conn, "a2", resolution="unresolved", attention=45, started_at=1600000000000)
    conn.close()

    rows = client.get("/attention", headers=auth(token)).json()["calls"]
    # 45 × 1.15 (unresolved boost) = 51.75 > 50
    assert rows[0]["sid"] == "a2"
    assert rows[0]["recency_weighted_score"] > rows[0]["attention_score"]


def test_customer_and_agent_registration(client):
    token = login(client)
    r = client.post("/customers", data={"name": "Brand New"}, headers=auth(token))
    assert r.status_code == 200
    assert isinstance(r.json()["id"], int)
    r = client.post("/customers", data={"name": "brand new"}, headers=auth(token))
    assert r.json()["id"] == r.json()["id"]  # normalized name → same person
    r = client.post("/agents", data={"name": "Fresh Agent"}, headers=auth(token))
    assert r.status_code == 200