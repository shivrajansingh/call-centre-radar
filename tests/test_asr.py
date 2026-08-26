"""ASR helpers: turn merging and speech-interval chunking."""

import math
import struct
import subprocess
import wave

import pytest

from pipeline.asr import _speech_intervals, merge_turns


class TestMergeTurns:
    def test_same_speaker_within_gap_merges(self):
        words = [
            {"speaker": "agent", "start": 0.0, "end": 0.4, "text": "hello"},
            {"speaker": "agent", "start": 0.9, "end": 1.3, "text": "world"},
        ]
        turns = merge_turns(words)
        assert len(turns) == 1
        assert turns[0]["text"] == "hello world"
        assert turns[0]["start"] == 0.0
        assert turns[0]["end"] == 1.3

    def test_large_gap_splits_turn(self):
        words = [
            {"speaker": "agent", "start": 0.0, "end": 0.4, "text": "hello"},
            {"speaker": "agent", "start": 2.0, "end": 2.4, "text": "world"},
        ]
        assert len(merge_turns(words)) == 2

    def test_speaker_change_splits_turn(self):
        words = [
            {"speaker": "agent", "start": 0.0, "end": 0.4, "text": "hello"},
            {"speaker": "caller", "start": 0.5, "end": 0.9, "text": "hi"},
        ]
        turns = merge_turns(words)
        assert [t["speaker"] for t in turns] == ["agent", "caller"]

    def test_input_must_be_presorted(self):
        # merge_turns processes words in the order given (callers pre-sort by time)
        words = [
            {"speaker": "caller", "start": 1.0, "end": 1.5, "text": "later"},
            {"speaker": "agent", "start": 0.0, "end": 0.5, "text": "first"},
        ]
        turns = merge_turns(words)
        assert [t["text"] for t in turns] == ["later", "first"]

    def test_presorted_interleaved_speakers(self):
        words = [
            {"speaker": "agent", "start": 0.0, "end": 0.5, "text": "first"},
            {"speaker": "caller", "start": 0.6, "end": 1.0, "text": "mid"},
            {"speaker": "agent", "start": 2.0, "end": 2.5, "text": "later"},
        ]
        turns = merge_turns(words)
        assert [t["text"] for t in turns] == ["first", "mid", "later"]

    def test_empty_input(self):
        assert merge_turns([]) == []


def _make_wav(path: str, segments, rate=16000):
    """segments: list of (kind, seconds); kind in ('tone', 'silence')."""
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        for kind, secs in segments:
            n = int(rate * secs)
            if kind == "tone":
                frames = b"".join(
                    struct.pack("<h", int(12000 * math.sin(2 * math.pi * 440 * i / rate)))
                    for i in range(n)
                )
            else:
                frames = b"\x00\x00" * n
            w.writeframes(frames)


def _ffmpeg_available() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (OSError, subprocess.CalledProcessError):
        return False


@pytest.mark.skipif(not _ffmpeg_available(), reason="ffmpeg not on PATH")
class TestSpeechIntervals:
    def test_tone_silence_tone_gives_two_intervals(self, tmp_path):
        wav = tmp_path / "test.wav"
        _make_wav(wav, [("tone", 1.0), ("silence", 1.0), ("tone", 1.0)])
        intervals = _speech_intervals(str(wav))
        assert len(intervals) == 2
        s1, e1 = intervals[0]
        s2, e2 = intervals[1]
        assert s1 <= 0.05
        assert e1 < s2
        assert e2 >= 2.0

    def test_short_speech_blip_is_dropped(self, tmp_path):
        wav = tmp_path / "blip.wav"
        _make_wav(wav, [("silence", 0.5), ("tone", 0.2), ("silence", 0.5),
                        ("tone", 0.8), ("silence", 0.5)])
        intervals = _speech_intervals(str(wav))
        assert len(intervals) == 1

    def test_fully_speech_clip_is_single_interval(self, tmp_path):
        wav = tmp_path / "full.wav"
        _make_wav(wav, [("tone", 2.0)])
        intervals = _speech_intervals(str(wav))
        assert len(intervals) == 1
        assert intervals[0][1] >= 1.95