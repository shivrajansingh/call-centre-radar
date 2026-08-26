"""Auth: HMAC tokens and scrypt password hashing."""

import time

from pipeline.auth import hash_password, make_token, parse_token, verify_password


class TestPasswords:
    def test_roundtrip(self):
        h = hash_password("s3cret!")
        assert h != "s3cret!"
        assert verify_password("s3cret!", h)

    def test_wrong_password_rejected(self):
        h = hash_password("right")
        assert not verify_password("wrong", h)

    def test_hash_is_salted(self):
        assert hash_password("same") != hash_password("same")

    def test_malformed_hash_rejected(self):
        assert not verify_password("x", "not-a-valid-hash")


class TestTokens:
    def test_roundtrip(self):
        token = make_token(7, "manager")
        payload = parse_token(token)
        assert payload["uid"] == 7
        assert payload["role"] == "manager"

    def test_tampered_token_rejected(self):
        token = make_token(1, "admin")
        tampered = token[:-3] + ("abc" if not token.endswith("abc") else "xyz")
        assert parse_token(tampered) is None

    def test_expired_token_rejected(self):
        token = make_token(1, "admin", ttl_days=-1)
        assert parse_token(token) is None

    def test_garbage_rejected(self):
        assert parse_token("not.a.token") is None