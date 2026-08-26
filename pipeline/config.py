import os
from pathlib import Path

MLX_MODEL = os.environ.get("RADAR_MLX_MODEL", "mlx-community/whisper-large-v3-turbo")
TURN_GAP_S = 0.8
CITATION_WINDOW_S = 3.0
CITATION_MIN_RATIO = 0.82

STT_PROVIDERS = ("local", "api")
STT_PROVIDER = os.environ.get("STT_PROVIDER", "local").strip().lower()

# Background upload worker: processes calls queued by POST /ingest automatically.
UPLOAD_WORKER_ENABLED = os.environ.get("UPLOAD_WORKER_ENABLED", "1").strip().lower() not in (
    "0", "false", "no",
)
UPLOAD_WORKER_POLL_S = float(os.environ.get("UPLOAD_WORKER_POLL_S", "5"))
UPLOAD_WORKER_MAX_ATTEMPTS = int(os.environ.get("UPLOAD_WORKER_MAX_ATTEMPTS", "3"))
UPLOAD_WORKER_STALE_CLAIM_S = float(os.environ.get("UPLOAD_WORKER_STALE_CLAIM_S", "900"))


def load_env(path: str = ".env") -> None:
    env_path = Path(path)
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


load_env()


def openai_config() -> dict:
    url = os.environ.get("OPENAI_URL", "").rstrip("/")
    if url.endswith("/chat/completions"):
        url = url[: -len("/chat/completions")]
    elif url and not url.endswith("/v1"):
        url += "/v1"
    return {
        "base_url": url or None,
        "api_key": os.environ.get("OPENAI_API_KEY", "missing"),
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
    }


def stt_api_config() -> dict:
    """Config for the hosted STT provider (STT_PROVIDER=api).

    Expects an OpenAI-compatible /audio/transcriptions endpoint (OpenRouter,
    OpenAI, Groq, ...). The full endpoint URL or the base URL both work.
    """
    url = os.environ.get("TRANSCRIPTION_BASE_URL", "").rstrip("/")
    if url.endswith("/audio/transcriptions"):
        url = url[: -len("/audio/transcriptions")]
    elif url and not url.endswith("/v1"):
        url += "/v1"
    return {
        "base_url": url or None,
        "api_key": os.environ.get("TRANSCRIPTION_API_KEY", "missing"),
        "model": os.environ.get(
            "TRANSCRIPTION_MODEL", "openai/whisper-1"
        ),
        "language": os.environ.get("TRANSCRIPTION_LANGUAGE", "en"),
    }
