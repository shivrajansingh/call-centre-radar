"""Benchmark: mlx-whisper (Metal GPU) vs faster-whisper on one call.
Loads HF_TOKEN from .env for model downloads."""

import os
import sys
import time
from pathlib import Path

from pipeline.transcribe_smoke import split_channels, merge_turns


def load_env(path=".env"):
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def main():
    load_env()
    mp3 = sys.argv[1] if len(sys.argv) > 1 else "callradar-data/audio/004860b1ab2e4c88.mp3"

    import mlx_whisper

    with tempfile_dir() as tmp:
        paths = split_channels(mp3, tmp)
        t0 = time.time()
        agent = mlx_whisper.transcribe(
            paths["agent"], path_or_hf_repo="mlx-community/whisper-large-v3-turbo",
            word_timestamps=True, language="en",
        )
        caller = mlx_whisper.transcribe(
            paths["caller"], path_or_hf_repo="mlx-community/whisper-large-v3-turbo",
            word_timestamps=True, language="en",
        )
        dt = time.time() - t0

    norm = lambda ws: [{"start": w["start"], "end": w["end"], "text": w["word"].strip()} for w in ws]
    aw = norm(w for s in agent["segments"] for w in s.get("words", []))
    cw = norm(w for s in caller["segments"] for w in s.get("words", []))
    turns = merge_turns(aw, cw)

    dur = float(os.popen(f"ffprobe -v error -show_entries format=duration -of csv=p=0 '{mp3}'").read())
    print(f"\n=== {mp3} | audio {dur:.1f}s | mlx {dt:.1f}s | speedup {dur/dt:.1f}x realtime ===\n")
    for t in turns:
        print(f"[{t['start']:7.2f} - {t['end']:7.2f}] {t['speaker']:6s} | {t['text']}")


def tempfile_dir():
    import tempfile
    return tempfile.TemporaryDirectory()


if __name__ == "__main__":
    main()
