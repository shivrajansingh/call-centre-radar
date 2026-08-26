import logging
import subprocess
import tempfile
from pathlib import Path

from openai import OpenAI

from pipeline.config import MLX_MODEL, STT_PROVIDERS, STT_PROVIDER, TURN_GAP_S, stt_api_config

log = logging.getLogger("radar.asr")


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


def _g(o, name, default=None):
    if isinstance(o, dict):
        return o.get(name, default)
    return getattr(o, name, default)


def _words_from_segments(segments: list, speaker: str) -> list:
    out = []
    for seg in segments:
        words = _g(seg, "words", None) or []
        for w in words:
            text = str(_g(w, "word", "") or "").strip()
            if not text:
                continue
            out.append({
                "speaker": speaker,
                "start": float(_g(w, "start", 0) or 0),
                "end": float(_g(w, "end", 0) or 0),
                "text": text,
            })
    return out


def _words_from_segment_text(segments: list, speaker: str, offset: float = 0.0,
                             fallback_end: float | None = None) -> list:
    """Segment-level timestamps only: distribute each segment's words evenly
    across the segment window so word-level sync still works (approximately)."""
    out = []
    for i, seg in enumerate(segments):
        start = float(_g(seg, "start", 0) or 0)
        end = float(_g(seg, "end", 0) or 0)
        if not end and fallback_end:
            end = start if i == 0 else float(_g(segments[i - 1], "end", 0) or start)
        text = str(_g(seg, "text", "") or "").strip()
        if not text:
            continue
        toks = text.split()
        n = len(toks)
        span = max(0.0, end - start)
        for j, tok in enumerate(toks):
            w0 = offset + start + span * j / n
            w1 = offset + start + span * (j + 1) / n
            out.append({"speaker": speaker, "start": w0, "end": w1, "text": tok})
    return out


def _ffprobe_duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip() or 0)


def _speech_intervals(wav_path: str, noise: str = "-35dB", min_gap: float = 0.6,
                      min_len: float = 0.35, pad: float = 0.15) -> list:
    """Speech intervals from an ffmpeg silencedetect pass.

    Returns [(start, end), ...] with gaps < min_gap merged and short blips dropped.
    A fully-speech clip yields [(0, duration)].
    """
    duration = _ffprobe_duration(wav_path)
    proc = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", wav_path,
         "-af", f"silencedetect=noise={noise}:d={min_gap}", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    speech_ends, speech_starts = [], []
    for line in proc.stderr.splitlines():
        if "silence_start:" in line:
            speech_ends.append(float(line.split("silence_start: ")[1].split()[0]))
        if "silence_end:" in line:
            speech_starts.append(float(line.split("silence_end: ")[1].split()[0]))
    speech_starts = [0.0] + speech_starts
    speech_ends = speech_ends + [duration]
    intervals = []
    for s, e in zip(speech_starts, speech_ends):
        if intervals and s - intervals[-1][1] < min_gap:
            intervals[-1] = (intervals[-1][0], max(intervals[-1][1], e))
        else:
            intervals.append((s, e))
    return [
        (max(0.0, s - pad), min(duration, e + pad))
        for s, e in intervals if e - s >= min_len
    ]


def _plain_text_words(res, wav_path: str, offset: float):
    """Simple text response: distribute tokens evenly over the chunk window."""
    text = str(_g(res, "text", "") or "").strip()
    if not text:
        return None
    chunk_len = _ffprobe_duration(wav_path)
    toks = text.split()
    n = len(toks)
    span = max(0.5, chunk_len)
    return [
        {"start": offset + span * i / n, "end": offset + span * (i + 1) / n, "text": tok}
        for i, tok in enumerate(toks)
    ]


def _transcribe_chunk(client, model, language, wav_path: str, offset: float,
                      support_verbose: list) -> list:
    """Transcribe one speech chunk; timestamps are relative to the chunk, so
    absolute time = offset + relative. Returns [{start, end, text}].

    Attempts, in order: verbose+language, plain+language, plain (some hosted
    providers reject the language hint — retry without it).
    """
    with open(wav_path, "rb") as f:
        attempts = [(support_verbose[0], True), (False, True)]
        if language:
            attempts.append((False, False))
        last_err = None
        for want_verbose, with_lang in attempts:
            try:
                f.seek(0)
                kwargs = {"model": model, "file": f}
                if with_lang:
                    kwargs["language"] = language
                if want_verbose:
                    kwargs["response_format"] = "verbose_json"
                    kwargs["timestamp_granularities"] = ["word"]
                res = client.audio.transcriptions.create(**kwargs)
                last_err = None
            except Exception as e:
                support_verbose[0] = False
                last_err = e
                continue
            if want_verbose:
                words = list(_g(res, "words", None) or [])
                segs = list(_g(res, "segments", None) or [])
                if not words and segs:
                    words = [w for seg in segs for w in (_g(seg, "words", None) or [])]
                if words:
                    return [
                        {"start": offset + float(_g(w, "start", 0) or 0),
                         "end": offset + float(_g(w, "end", 0) or 0),
                         "text": str(_g(w, "word", "") or "").strip()}
                        for w in words if str(_g(w, "word", "") or "").strip()
                    ]
                if segs:
                    support_verbose[0] = True
                    return _words_from_segment_text(
                        segs, "x", offset=offset, fallback_end=offset + (res.duration or 0)
                    )
            plain = _plain_text_words(res, wav_path, offset)
            if plain:
                return plain
        if last_err is not None:
            log.warning("chunk %s failed all attempts: %s", wav_path, last_err)
    return []  # chunk had no transcribable speech (silence/noise) — skip it


def transcribe_call_local(mp3_path: str) -> dict:
    import mlx_whisper

    with tempfile.TemporaryDirectory() as tmp:
        paths = split_channels(mp3_path, tmp)
        agent = mlx_whisper.transcribe(
            paths["agent"], path_or_hf_repo=MLX_MODEL, word_timestamps=True, language="en"
        )
        caller = mlx_whisper.transcribe(
            paths["caller"], path_or_hf_repo=MLX_MODEL, word_timestamps=True, language="en"
        )
    words = sorted(
        _words_from_segments(agent.get("segments", []), "agent")
        + _words_from_segments(caller.get("segments", []), "caller"),
        key=lambda w: w["start"],
    )
    return {"words": words, "turns": merge_turns(words), "provider": "local", "model": MLX_MODEL}


def transcribe_call_api(mp3_path: str) -> dict:
    """Hosted transcription: split channels, detect speech intervals per channel,
    transcribe each speech chunk (timestamps relative to the chunk), stitch."""
    cfg = stt_api_config()
    client = OpenAI(base_url=cfg["base_url"], api_key=cfg["api_key"], timeout=180.0, max_retries=3)
    support_verbose = [True]
    words = []
    with tempfile.TemporaryDirectory() as tmp:
        paths = split_channels(mp3_path, tmp)
        for speaker, ch in (("agent", paths["agent"]), ("caller", paths["caller"])):
            before = len(words)
            for i, (s, e) in enumerate(_speech_intervals(ch)):
                chunk = f"{tmp}/{speaker}_{i}.wav"
                subprocess.run(
                    ["ffmpeg", "-y", "-v", "error", "-ss", f"{s:.3f}", "-t", f"{e - s:.3f}",
                     "-i", ch, "-ar", "16000", "-ac", "1", chunk],
                    check=True,
                )
                for w in _transcribe_chunk(client, cfg["model"], cfg["language"], chunk, s, support_verbose):
                    w["speaker"] = speaker
                    words.append(w)
            if len(words) == before:
                raise RuntimeError(
                    f"{speaker} channel produced no transcription "
                    f"(STT_PROVIDER=api, model={cfg['model']})"
                )
    words.sort(key=lambda w: w["start"])
    return {"words": words, "turns": merge_turns(words), "provider": "api", "model": cfg["model"]}


def transcribe_call(mp3_path: str, provider: str | None = None) -> dict:
    """Transcribe a stereo call. Left channel = agent, right = caller.

    provider: 'local' (mlx-whisper on Apple Silicon, default, offline)
              'api'   (hosted OpenAI-compatible /audio/transcriptions endpoint)
    Selects from STT_PROVIDER env when not given.
    """
    provider = (provider or STT_PROVIDER).strip().lower()
    if provider not in STT_PROVIDERS:
        raise ValueError(
            f"unknown STT_PROVIDER {provider!r} — choose one of {STT_PROVIDERS} "
            "(set STT_PROVIDER in .env)"
        )
    if provider == "local":
        return transcribe_call_local(mp3_path)
    return transcribe_call_api(mp3_path)


def merge_turns(words: list, gap: float = TURN_GAP_S) -> list:
    turns = []
    for w in words:
        if (
            turns
            and turns[-1]["speaker"] == w["speaker"]
            and w["start"] - turns[-1]["end"] < gap
        ):
            turns[-1]["text"] += " " + w["text"]
            turns[-1]["end"] = w["end"]
        else:
            turns.append(
                {
                    "speaker": w["speaker"],
                    "start": w["start"],
                    "end": w["end"],
                    "text": w["text"],
                }
            )
    return turns