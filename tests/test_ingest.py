"""Ingest: metadata normalization and storage semantics."""

import time

import pytest

from pipeline.ingest import parse_metadata, store_call_record, store_transcript

SAMPLE_META = {
    "sid": "abc123",
    "start_time_ms": 1600000000000,
    "end_time_ms": 1600000060000,
    "session": "S-42",
    "caller": {
        "metadata": {"first and last name": "Mary Smith"},
        "survey_response": {
            "data": {"ease_of_connection": 9, "partner_rating": 8.5}
        },
    },
    "agent": {"metadata": {"agent_name": "Robert"}},
    "labels": {"caller_mos": 4.2},
}


class TestParseMetadata:
    def test_full_metadata(self):
        p = parse_metadata(SAMPLE_META)
        assert p["customer_name"] == "Mary Smith"
        assert p["agent_name"] == "Robert"
        assert p["started_at"] == 1600000000000
        assert p["ended_at"] == 1600000060000
        assert p["session"] == "S-42"
        assert p["survey_ease"] == 9
        assert p["survey_partner"] == 8.5
        assert p["caller_mos"] == 4.2

    def test_missing_survey_fields_are_none(self):
        p = parse_metadata({"caller": {}, "agent": {}})
        assert p["survey_ease"] is None
        assert p["survey_partner"] is None
        assert p["caller_mos"] is None
        assert p["customer_name"] == "Unknown Caller"

    def test_non_numeric_survey_is_none(self):
        meta = dict(SAMPLE_META)
        meta["caller"]["survey_response"] = {"data": {"ease_of_connection": "high"}}
        assert parse_metadata(meta)["survey_ease"] is None


class TestStorage:
    def test_store_call_record_upserts_instead_of_duplicating(self, clean_db):
        from api import db

        conn = db.connect()
        parsed = {
            "customer_name": "Mary Smith", "agent_name": "Robert",
            "started_at": 1000, "ended_at": 4000, "session": None,
            "survey_ease": None, "survey_partner": None, "caller_mos": None,
        }
        store_call_record(conn, "sid1", parsed, "dataset")
        store_call_record(conn, "sid1", parsed, "dataset")
        n = conn.execute("SELECT COUNT(*) AS n FROM calls WHERE sid='sid1'").fetchone()["n"]
        assert n == 1
        row = conn.execute(
            "SELECT duration_s FROM calls WHERE sid='sid1'"
        ).fetchone()
        assert row["duration_s"] == 3.0
        conn.close()

    def test_store_transcript_replaces_old_rows(self, clean_db):
        from api import db

        conn = db.connect()
        parsed = {"customer_name": "A", "agent_name": "B", "started_at": None,
                  "ended_at": None, "session": None, "survey_ease": None,
                  "survey_partner": None, "caller_mos": None}
        store_call_record(conn, "sid2", parsed, "dataset")
        store_transcript(conn, "sid2",
                         [{"speaker": "agent", "start": 0.0, "end": 0.5, "text": "hi"}],
                         [{"speaker": "agent", "start": 0.0, "end": 0.5, "text": "hi"}])
        store_transcript(conn, "sid2",
                         [{"speaker": "agent", "start": 0.0, "end": 0.5, "text": "hi"},
                          {"speaker": "caller", "start": 1.0, "end": 1.4, "text": "yo"}],
                         [{"speaker": "caller", "start": 1.0, "end": 1.4, "text": "yo"}])
        words = conn.execute("SELECT COUNT(*) AS n FROM words WHERE sid='sid2'").fetchone()["n"]
        turns = conn.execute("SELECT COUNT(*) AS n FROM turns WHERE sid='sid2'").fetchone()["n"]
        assert words == 2
        assert turns == 1
        conn.close()

    def test_duration_none_when_missing_times(self, clean_db):
        from api import db

        conn = db.connect()
        parsed = {"customer_name": "A", "agent_name": "B", "started_at": None,
                  "ended_at": None, "session": None, "survey_ease": None,
                  "survey_partner": None, "caller_mos": None}
        store_call_record(conn, "sid3", parsed, "dataset")
        row = conn.execute("SELECT duration_s FROM calls WHERE sid='sid3'").fetchone()
        assert row["duration_s"] is None
        conn.close()