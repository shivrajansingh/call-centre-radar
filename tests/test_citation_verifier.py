"""CitationVerifier: the evidence discipline at the core of the product.

Every judgment must cite a verbatim moment in the call; quotes that can't be
matched near their claimed timestamp must be flagged, never silently trusted.
"""

from pipeline.analyze import CitationVerifier

WORDS = [
    {"start": 1.0, "end": 1.3, "text": "Thank"},
    {"start": 1.3, "end": 1.6, "text": "you"},
    {"start": 1.6, "end": 2.1, "text": "for"},
    {"start": 2.1, "end": 2.5, "text": "calling"},
    {"start": 2.5, "end": 3.2, "text": "Hubbard"},
    {"start": 3.2, "end": 3.8, "text": "Valley"},
    {"start": 4.0, "end": 4.4, "text": "Bank"},
    {"start": 4.4, "end": 4.9, "text": "how"},
    {"start": 4.9, "end": 5.3, "text": "can"},
    {"start": 5.3, "end": 5.8, "text": "I"},
    {"start": 5.8, "end": 6.4, "text": "help"},
]


def verifier():
    return CitationVerifier(WORDS)


def test_exact_quote_verified_with_corrected_times():
    v = verifier()
    r = v.verify({"t_start": 1.0, "t_end": 3.0, "quote": "Thank you for calling"})
    assert r["verified"] is True
    assert r["t_start"] == 0.8  # first word start - 0.2s padding
    assert r["claimed_time_ok"] is True


def test_quote_with_punctuation_differences_verified():
    v = verifier()
    r = v.verify({"quote": "Thank you, for calling!"})
    assert r["verified"] is True


def test_case_insensitive_match():
    v = verifier()
    r = v.verify({"quote": "THANK YOU for Calling"})
    assert r["verified"] is True


def test_fuzzy_match_above_ratio_is_verified():
    v = verifier()
    r = v.verify({"quote": "Thank you for callin"})  # one letter missing
    assert r["verified"] is True


def test_invented_quote_is_not_verified():
    v = verifier()
    r = v.verify({"quote": "you owe me a thousand dollars"})
    assert r["verified"] is False


def test_empty_quote_is_not_verified():
    v = verifier()
    r = v.verify({"quote": ""})
    assert r["verified"] is False


def test_far_away_claimed_time_is_corrected():
    v = verifier()
    r = v.verify({"t_start": 500.0, "t_end": 501.0, "quote": "Hubbard Valley Bank"})
    assert r["verified"] is True
    assert r["claimed_time_ok"] is False  # flagged: model's timestamp was wrong
    assert abs(r["t_start"] - 2.3) < 0.01  # corrected to the real moment


def test_quote_across_speaker_gap_still_found():
    v = verifier()
    r = v.verify({"quote": "Bank how can I help"})
    assert r["verified"] is True


def test_single_word_quote():
    v = verifier()
    r = v.verify({"quote": "help"})
    assert r["verified"] is True


def test_verify_never_mutates_input():
    v = verifier()
    cit = {"t_start": 1.0, "t_end": 3.0, "quote": "Thank you for calling"}
    before = dict(cit)
    v.verify(cit)
    assert cit == before