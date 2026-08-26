import json
import re
import string
import time
from difflib import SequenceMatcher

from openai import OpenAI

from pipeline.config import CITATION_MIN_RATIO, CITATION_WINDOW_S, openai_config

MOODS = ["positive", "neutral", "concerned", "frustrated", "angry", "anxious"]

SYSTEM_PROMPT = f"""You are a rigorous call-centre quality analyst for a consumer bank.
You receive a transcript with timestamps. You judge ONE call and output ONLY a JSON object.

Schema:
{{
  "intent": {{"label": "<=8 words describing what the caller wanted",
              "citation": C}},
  "mood": {{
    "start": MOOD, "end": MOOD,
    "timeline": [{{"t": <seconds>, "mood": MOOD}}, ... 3 to 6 points in chronological order],
    "shift": {{"t": <seconds>, "from": MOOD, "to": MOOD, "citation": C}} or null
  }},
  "resolution": {{"status": "resolved|partial|unresolved", "citation": C}},
  "summary": "<=40 words, factual, third person",
  "needs_attention": {{"score": <0-100 integer>,
                       "reasons": [{{"reason": "<=20 words", "citation": C}}, ... max 3]}}
}}

C = {{"t_start": <seconds>, "t_end": <seconds>, "quote": "<verbatim words spoken at that moment>"}}
MOOD is one of: {", ".join(MOODS)}.

Hard rules:
1. Every "quote" MUST be copied word-for-word from the transcript at the cited time. Never paraphrase, never invent.
2. Every claim requires its citation. No claim without evidence.
3. The quote must actually support the claim it is attached to.
4. resolution: "unresolved" if the caller's issue was NOT fixed even if the caller was polite; judge by facts in the transcript.
5. needs_attention score guide: 70-100 unresolved issues, anger, threats, repeated asks, complaints about service;
   30-69 visible frustration or partial resolution; 0-29 routine resolved calls. Reserve >85 for serious cases.
6. summary must be <=40 words.
Output JSON only, no markdown fences, no commentary."""


_norm_re = re.compile(rf"[{re.escape(string.punctuation)}]")


def _norm(s: str) -> str:
    return " ".join(_norm_re.sub(" ", s.lower()).split())


class CitationVerifier:
    def __init__(self, words: list):
        self.words = sorted(words, key=lambda w: w["start"])
        self.norm_texts = [_norm(w["text"]) for w in self.words]
        self.joined = " ".join(self.norm_texts)
        self.offsets = []
        pos = 0
        for t in self.norm_texts:
            self.offsets.append(pos)
            pos += len(t) + 1

    def verify(self, cit: dict) -> dict:
        quote = _norm(str(cit.get("quote", "")))
        if not quote:
            return {"verified": False}
        n_words = len(quote.split())
        hit = self.joined.find(quote)
        if hit == -1:
            hit, ratio = self._best_window(quote, n_words)
            if hit == -1 or ratio < CITATION_MIN_RATIO:
                return {"verified": False}
        start_idx = next((i for i, o in enumerate(self.offsets) if o + len(self.norm_texts[i]) > hit), 0)
        end_char = hit + len(quote)
        end_idx = next(
            (i for i, o in enumerate(self.offsets) if o + len(self.norm_texts[i]) >= end_char),
            len(self.words) - 1,
        )
        t_start = max(0.0, self.words[start_idx]["start"] - 0.2)
        t_end = min(self.words[end_idx]["end"] + 0.2, self.words[-1]["end"])
        claimed_ok = (
            abs(float(cit.get("t_start", t_start)) - t_start) <= CITATION_WINDOW_S
            and abs(float(cit.get("t_end", t_end)) - t_end) <= CITATION_WINDOW_S
        )
        return {"verified": True, "claimed_time_ok": claimed_ok, "t_start": t_start, "t_end": t_end}

    def _best_window(self, quote: str, n_words: int):
        total = len(self.words)
        lo = max(1, int(n_words * 0.7))
        hi = int(n_words * 1.4) + 1
        best, best_ratio = -1, 0.0
        for size in range(lo, hi):
            for i in range(0, total - size + 1):
                cand = " ".join(self.norm_texts[i : i + size])
                r = SequenceMatcher(None, quote, cand).ratio()
                if r > best_ratio:
                    best_ratio, best = r, self.offsets[i]
        return best, best_ratio


def _client() -> tuple[OpenAI, str]:
    cfg = openai_config()
    client = OpenAI(base_url=cfg["base_url"], api_key=cfg["api_key"], timeout=180.0, max_retries=2)
    return client, cfg["model"]


def _extract_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in response")
    return json.loads(text[start : end + 1])


def _transcript_for_prompt(turns: list) -> str:
    return "\n".join(
        f"[{t['start']:.2f}-{t['end']:.2f}] {t['speaker'].upper()}: {t['text']}" for t in turns
    )


def _check_structure(data: dict) -> list:
    errors = []
    if not isinstance(data.get("intent"), dict) or not data["intent"].get("label"):
        errors.append("missing intent.label")
    mood = data.get("mood") or {}
    if mood.get("start") not in MOODS or mood.get("end") not in MOODS:
        errors.append("invalid mood.start/mood.end")
    if not mood.get("timeline") or len(mood["timeline"]) < 2:
        errors.append("mood.timeline too short")
    res = data.get("resolution") or {}
    if res.get("status") not in ("resolved", "partial", "unresolved"):
        errors.append("invalid resolution.status")
    summary = data.get("summary") or ""
    if len(summary.split()) > 42:
        errors.append(f"summary too long ({len(summary.split())} words)")
    na = data.get("needs_attention") or {}
    score = na.get("score")
    if not isinstance(score, int) or not 0 <= score <= 100:
        errors.append("invalid needs_attention.score")
    if not na.get("reasons"):
        errors.append("missing needs_attention.reasons")
    for path, c in _walk_citations(data):
        if not isinstance(c, dict) or not c.get("quote"):
            errors.append(f"citation missing quote at {path}")
    return errors


def _walk_citations(node, path="root"):
    if isinstance(node, dict):
        if "quote" in node:
            yield path, node
        for k, v in node.items():
            yield from _walk_citations(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk_citations(v, f"{path}[{i}]")


def _fixup(data: dict, verifier: CitationVerifier) -> dict:
    stats = {"total": 0, "verified": 0}
    for path, c in list(_walk_citations(data)):
        result = verifier.verify(c)
        stats["total"] += 1
        if result["verified"]:
            stats["verified"] += 1
            c["t_start"], c["t_end"] = round(result["t_start"], 2), round(result["t_end"], 2)
            c["time_corrected"] = not result["claimed_time_ok"]
        else:
            c["verified"] = False
        c["verified"] = result["verified"]
    tl = (data.get("mood") or {}).get("timeline") or []
    for p in tl:
        p["t"] = round(float(p.get("t", 0)), 2)
        p["mood"] = p.get("mood") if p.get("mood") in MOODS else "neutral"
    shift = (data.get("mood") or {}).get("shift")
    if shift is not None and shift.get("to") not in MOODS:
        data["mood"]["shift"] = None
    return data


def analyze_call(turns: list, words: list, max_retries: int = 2) -> dict:
    client, model = _client()
    verifier = CitationVerifier(words)
    transcript = _transcript_for_prompt(turns)
    feedback = ""
    last_errors = ["unknown"]
    for attempt in range(max_retries + 1):
        user_msg = f"Call transcript:\n{transcript}"
        if feedback:
            user_msg += f"\n\nYour previous attempt had these problems, fix them:\n- " + "\n- ".join(feedback)
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0,
        )
        try:
            data = _extract_json(resp.choices[0].message.content)
        except (ValueError, json.JSONDecodeError) as e:
            last_errors = [f"unparseable JSON: {e}"]
            feedback = last_errors
            continue
        last_errors = _check_structure(data)
        bad_quotes = [
            f"{p}: quote not found in transcript"
            for p, c in _walk_citations(data)
            if isinstance(c, dict) and c.get("quote") and not verifier.verify(c)["verified"]
        ]
        if not last_errors and not bad_quotes:
            break
        feedback = last_errors + bad_quotes[:5]
    else:
        try:
            _extract_json(resp.choices[0].message.content)
        except Exception:
            raise RuntimeError(f"analysis failed after {max_retries + 1} attempts: {last_errors}")
    data = _fixup(data, verifier)
    na = data.get("needs_attention")
    if not isinstance(na, dict):
        na = {"score": None, "reasons": []}
    reasons = na.get("reasons")
    if not isinstance(reasons, list):
        reasons = []
    na["reasons"] = [r for r in reasons if isinstance(r, dict) and r.get("quote")]
    if not isinstance(na.get("score"), int):
        na["score"] = None
    data["needs_attention"] = na
    verified = sum(
        1 for _, c in _walk_citations(data) if isinstance(c, dict) and c.get("verified")
    )
    total = sum(1 for _ in _walk_citations(data))
    return {
        "analysis": data,
        "citations_verified": verified / total if total else 0.0,
        "model": model,
        "remaining_issues": feedback if feedback else [],
    }
