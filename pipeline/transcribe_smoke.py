"""Smoke-test: split stereo call audio into agent/caller channels,
transcribe each with faster-whisper (word timestamps), merge into turns."""

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

from faster_whisper import WhisperModel


def split_channels(mp3_path: str, out_dir: str) -> dict:
    paths = {
        "agent": str(Path(out_dir) / "left.wav"),
        "caller": str(Path(out_dir) / "right.wav"),
    }
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-i", mp3_path,
            "-filter_complex", "[0:a]channelsplit=channel_layout=stereo[l][r]",
            "-map", "[l]", "-ar", "16000", "-ac", "1", paths["agent"],
            "-map", "[r]", "-ar", "16000", "-ac", "1", paths["caller"],
        ],
        check=True,
    )
    return paths


def transcribe_channel(model, path: str):
    segments, _ = model.transcribe(path, word_timestamps=True, vad_filter=True)
    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append({"start": w.start, "end": w.end, "text": w.word.strip()})
    return words


def merge_turns(agent_words, caller_words, gap=0.8):
    tagged = [("agent", w) for w in agent_words] + [("caller", w) for w in caller_words]
    tagged.sort(key=lambda x: x[1]["start"])
    turns = []
    for speaker, w in tagged:
        if turns and turns[-1]["speaker"] == speaker and w["start"] - turns[-1]["end"] < gap:
            turns[-1]["text"] += " " + w["text"]
            turns[-1]["end"] = w["end"]
            turns[-1]["words"].append(w)
        else:
            turns.append(
                {"speaker": speaker, "start": w["start"], "end": w["end"], "text": w["text"], "words": [w]}
            )
    return turns


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mp3")
    ap.add_argument("--model", default="base")
    args = ap.parse_args()

    print(f"loading '{args.model}' ...", file=sys.stderr)
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    with tempfile.TemporaryDirectory() as tmp:
        paths = split_channels(args.mp3, tmp)
        print(f"transcribing {args.mp3} ...", file=sys.stderr)
        agent_words = transcribe_channel(model, paths["agent"])
        caller_words = transcribe_channel(model, paths["caller"])

    turns = merge_turns(agent_words, caller_words)
    print(f"\n=== {args.mp3} | {len(turns)} turns "
          f"({len(agent_words)} agent words / {len(caller_words)} caller words) ===\n")
    for t in turns:
        print(f"[{t['start']:7.2f} - {t['end']:7.2f}] {t['speaker']:6s} | {t['text']}")


if __name__ == "__main__":
    main()
