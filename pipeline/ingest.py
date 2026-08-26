import json
import time


def parse_metadata(meta: dict) -> dict:
    caller = meta.get("caller") or {}
    agent = meta.get("agent") or {}
    caller_meta = caller.get("metadata") or {}
    agent_meta = agent.get("metadata") or {}
    survey = (caller.get("survey_response") or {}).get("data") or {}

    def _f(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    return {
        "customer_name": caller_meta.get("first and last name") or "Unknown Caller",
        "agent_name": agent_meta.get("agent_name") or "Unknown Agent",
        "started_at": meta.get("start_time_ms"),
        "ended_at": meta.get("end_time_ms"),
        "session": meta.get("session"),
        "survey_ease": _f(survey.get("ease_of_connection")),
        "survey_partner": _f(survey.get("partner_rating")),
        "caller_mos": _f((meta.get("labels") or {}).get("caller_mos")),
    }


def store_call_record(conn, sid: str, parsed: dict, source: str):
    from api.db import name_key, upsert_person

    customer_id = upsert_person(conn, "customers", parsed["customer_name"])
    agent_id = upsert_person(conn, "agents", parsed["agent_name"])
    duration = (
        (parsed["ended_at"] - parsed["started_at"]) / 1000.0
        if parsed["started_at"] and parsed["ended_at"]
        else None
    )
    conn.execute(
        """INSERT INTO calls(sid, customer_id, agent_id, started_at, ended_at,
           duration_s, session, survey_ease, survey_partner, caller_mos, source)
           VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
           ON CONFLICT(sid) DO UPDATE SET
             customer_id=EXCLUDED.customer_id, agent_id=EXCLUDED.agent_id,
             started_at=EXCLUDED.started_at, ended_at=EXCLUDED.ended_at,
             duration_s=EXCLUDED.duration_s, session=EXCLUDED.session,
             survey_ease=EXCLUDED.survey_ease, survey_partner=EXCLUDED.survey_partner,
             caller_mos=EXCLUDED.caller_mos""",
        (
            sid, customer_id, agent_id, parsed["started_at"], parsed["ended_at"],
            duration, parsed["session"], parsed["survey_ease"],
            parsed["survey_partner"], parsed["caller_mos"], source,
        ),
    )
    conn.commit()


def store_transcript(conn, sid: str, words: list, turns: list):
    conn.execute("DELETE FROM words WHERE sid=%s", (sid,))
    conn.execute("DELETE FROM turns WHERE sid=%s", (sid,))
    conn.cursor().executemany(
        'INSERT INTO words(sid, speaker, "start", "end", text) VALUES(%s,%s,%s,%s,%s)',
        [(sid, w["speaker"], w["start"], w["end"], w["text"]) for w in words],
    )
    conn.cursor().executemany(
        'INSERT INTO turns(sid, speaker, "start", "end", text) VALUES(%s,%s,%s,%s,%s)',
        [(sid, t["speaker"], t["start"], t["end"], t["text"]) for t in turns],
    )


def store_analysis(conn, sid: str, result: dict):
    a = result["analysis"]
    mood = a.get("mood") or {}
    shift = mood.get("shift")
    na = a.get("needs_attention") or {}
    intent_cit = (a.get("intent") or {}).get("citation")
    res_cit = (a.get("resolution") or {}).get("citation")
    conn.execute(
        "DELETE FROM analyses WHERE sid=%s", (sid,)
    )
    conn.execute(
        """INSERT INTO analyses(sid, intent_label, intent_citation,
           mood_start, mood_end, mood_timeline,
           mood_shift_t, mood_shift_from, mood_shift_to, mood_shift_citation,
           resolution, resolution_citation, summary,
           attention_score, attention_reasons, citations_verified, model, created_at)
           VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (
            sid,
            (a.get("intent") or {}).get("label"),
            json.dumps(intent_cit) if intent_cit else None,
            mood.get("start"), mood.get("end"),
            json.dumps(mood.get("timeline") or []),
            shift.get("t") if shift else None,
            shift.get("from") if shift else None,
            shift.get("to") if shift else None,
            json.dumps(shift.get("citation")) if shift and shift.get("citation") else None,
            (a.get("resolution") or {}).get("status"),
            json.dumps(res_cit) if res_cit else None,
            a.get("summary"),
            na.get("score"),
            json.dumps(na.get("reasons") or []),
            round(result.get("citations_verified", 0.0), 3),
            result.get("model"),
            time.time(),
        ),
    )


def process_call(conn, sid: str, audio_path: str, parsed: dict, source="dataset",
                 transcribe: bool = True, transcript: dict | None = None):
    store_call_record(conn, sid, parsed, source)

    if not transcribe:
        return {"sid": sid, "status": "queued"}

    from pipeline import asr, analyze

    if transcript is None:
        try:
            result = asr.transcribe_call(audio_path)
            words, turns = result["words"], result["turns"]
        except Exception as e:
            conn.execute("UPDATE calls SET asr_error=%s WHERE sid=%s",
                         (f"{type(e).__name__}: {e}", sid))
            conn.commit()
            raise
        store_transcript(conn, sid, words, turns)
        conn.execute("UPDATE calls SET transcribed_at=%s, asr_error=NULL WHERE sid=%s",
                     (time.time(), sid))
        conn.commit()
    else:
        words, turns = transcript["words"], transcript["turns"]

    try:
        analysis_result = analyze.analyze_call(turns, words)
    except Exception as e:
        conn.execute("UPDATE calls SET analysis_error=%s WHERE sid=%s",
                     (f"{type(e).__name__}: {e}", sid))
        conn.commit()
        raise
    conn.execute("UPDATE calls SET analysis_error=NULL WHERE sid=%s", (sid,))
    store_analysis(conn, sid, analysis_result)
    conn.execute("UPDATE calls SET analyzed_at=%s WHERE sid=%s", (time.time(), sid))
    conn.commit()
    return {"sid": sid, "turns": len(turns), "words": len(words),
            "citations_verified": analysis_result["citations_verified"]}
