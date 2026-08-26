import base64
import hashlib
import hmac
import json
import os
import secrets
import time

SECRET = os.environ.get("AUTH_SECRET", "callradar-dev-secret-change-me")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, expected = stored.split("$", 1)
        dk = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1)
        return hmac.compare_digest(dk.hex(), expected)
    except (ValueError, TypeError):
        return False


def _sign(data: bytes) -> str:
    return hmac.new(SECRET.encode(), data, hashlib.sha256).hexdigest()


def make_token(user_id: int, role: str, ttl_days: int = 7) -> str:
    payload = {"uid": user_id, "role": role, "exp": int(time.time() + ttl_days * 86400)}
    raw = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return f"{raw}.{_sign(raw.encode())}"


def parse_token(token: str) -> dict | None:
    try:
        raw, sig = token.rsplit(".", 1)
        if not hmac.compare_digest(_sign(raw.encode()), sig):
            return None
        padded = raw + "=" * (-len(raw) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except (ValueError, json.JSONDecodeError):
        return None
