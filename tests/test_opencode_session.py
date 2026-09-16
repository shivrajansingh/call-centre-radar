"""OpenCode Zen/Go routing: one stable session id per conversation.

The gateway pins every turn of a conversation to one backend through the
x-opencode-session header; a fresh id per request (or a missing header)
degrades routing and prompt caching.
"""

import json
from types import SimpleNamespace

import pytest

from pipeline import analyze, config

ANALYSIS = {
    "intent": {
        "label": "card blocked",
        "citation": {"t_start": 0.0, "t_end": 1.2, "quote": "my card is blocked"},
    },
    "mood": {
        "start": "concerned",
        "end": "neutral",
        "timeline": [{"t": 0.0, "mood": "concerned"}, {"t": 1.2, "mood": "neutral"}],
        "shift": None,
    },
    "resolution": {
        "status": "resolved",
        "citation": {"t_start": 0.0, "t_end": 1.2, "quote": "my card is blocked"},
    },
    "summary": "Caller reported a blocked card.",
    "needs_attention": {
        "score": 10,
        "reasons": [
            {
                "reason": "card issue",
                "citation": {"t_start": 0.0, "t_end": 1.2, "quote": "my card is blocked"},
            }
        ],
    },
}

WORDS = [
    {"speaker": "caller", "start": 0.0, "end": 0.4, "text": "my"},
    {"speaker": "caller", "start": 0.4, "end": 0.7, "text": "card"},
    {"speaker": "caller", "start": 0.7, "end": 0.9, "text": "is"},
    {"speaker": "caller", "start": 0.9, "end": 1.2, "text": "blocked"},
]
TURNS = [{"speaker": "caller", "start": 0.0, "end": 1.2, "text": "my card is blocked"}]


class StubClient:
    def __init__(self, contents: list):
        self.contents = contents
        self.calls: list[dict] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        content = self.contents[min(len(self.calls) - 1, len(self.contents) - 1)]
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
        )


def use_stub(monkeypatch, contents: list) -> StubClient:
    stub = StubClient(contents)
    monkeypatch.setattr(analyze, "_client", lambda: (stub, "stub-model"))
    return stub


class TestHostMatch:
    def test_auto_sends_only_to_opencode_hosts(self, monkeypatch):
        monkeypatch.delenv("OPENCODE_SESSION_MODE", raising=False)
        monkeypatch.setenv("OPENAI_URL", "https://api.example.com/v1")
        assert config.opencode_headers("call-7") == {}

        monkeypatch.setenv("OPENAI_URL", "https://opencode.ai/zen/v1")
        headers = config.opencode_headers("call-7")
        assert headers["x-opencode-session"] == "call-7"
        assert headers["x-opencode-client"] == "call-centre-radar"

    def test_always_sends_through_proxies_and_never_disables(self, monkeypatch):
        monkeypatch.setenv("OPENAI_URL", "https://llm-proxy.internal/v1")

        monkeypatch.setenv("OPENCODE_SESSION_MODE", "always")
        assert config.opencode_headers("call-7")["x-opencode-session"] == "call-7"

        monkeypatch.setenv("OPENCODE_SESSION_MODE", "never")
        assert config.opencode_headers("call-7") == {}


class TestSessionResolution:
    def test_fallback_id_is_stable_across_calls(self, monkeypatch):
        monkeypatch.setenv("OPENCODE_SESSION_MODE", "always")
        monkeypatch.delenv("OPENCODE_SESSION_ID", raising=False)
        first = config.opencode_headers()["x-opencode-session"]
        second = config.opencode_headers()["x-opencode-session"]
        assert first == second

    def test_explicit_id_beats_fallback(self, monkeypatch):
        monkeypatch.setenv("OPENCODE_SESSION_MODE", "always")
        monkeypatch.setenv("OPENCODE_SESSION_ID", "batch-42")
        assert config.opencode_headers()["x-opencode-session"] == "batch-42"
        assert config.opencode_headers("call-7")["x-opencode-session"] == "call-7"


class TestAnalyzeCallHeaders:
    @pytest.fixture(autouse=True)
    def routing_env(self, monkeypatch):
        monkeypatch.setenv("OPENCODE_SESSION_MODE", "always")
        monkeypatch.setenv("OPENCODE_CLIENT", "call-centre-radar")
        monkeypatch.delenv("OPENCODE_SESSION_ID", raising=False)

    def test_every_retry_reuses_the_conversation_id(self, monkeypatch):
        stub = use_stub(monkeypatch, ["no json here", json.dumps(ANALYSIS)])
        result = analyze.analyze_call(TURNS, WORDS, session_id="call-123", max_retries=1)

        assert len(stub.calls) == 2
        assert {c["extra_headers"]["x-opencode-session"] for c in stub.calls} == {"call-123"}
        assert all(
            c["extra_headers"]["x-opencode-client"] == "call-centre-radar"
            for c in stub.calls
        )
        assert result["citations_verified"] == 1.0

    def test_calls_without_conversation_share_the_process_id(self, monkeypatch):
        first = use_stub(monkeypatch, [json.dumps(ANALYSIS)])
        analyze.analyze_call(TURNS, WORDS, max_retries=0)
        second = use_stub(monkeypatch, [json.dumps(ANALYSIS)])
        analyze.analyze_call(TURNS, WORDS, max_retries=0)

        assert first.calls[0]["extra_headers"]["x-opencode-session"] == (
            second.calls[0]["extra_headers"]["x-opencode-session"]
        )
