from __future__ import annotations

import time
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from minikb.auth.api_key import create_jwt_api_key, looks_like_jwt
from minikb.auth.jwt_access import decode_mini_auth_access_token
from minikb.config.settings import Settings
from minikb.main import app


SECRET = "test-minikb-jwt-secret"
ISSUER = "https://auth.liuyidi.me"
AUDIENCE = "mini-auth"


def _access_token(*, token_use: str = "access", secret: str = SECRET, exp_offset: int = 600) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": "user-1",
            "iss": ISSUER,
            "aud": AUDIENCE,
            "iat": now,
            "nbf": now,
            "exp": now + exp_offset,
            "jti": str(uuid.uuid4()),
            "sid": str(uuid.uuid4()),
            "token_use": token_use,
        },
        secret,
        algorithm="HS256",
    )


def test_looks_like_jwt() -> None:
    assert looks_like_jwt(_access_token())
    assert not looks_like_jwt("token_urlsafe_api_key_without_dots")


def test_decode_rejects_refresh_and_wrong_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MINIKB_JWT_SECRET", SECRET)
    monkeypatch.setenv("MINIKB_JWT_ISSUER", ISSUER)
    monkeypatch.setenv("MINIKB_JWT_AUDIENCE", AUDIENCE)
    payload = decode_mini_auth_access_token(_access_token())
    assert payload["sub"] == "user-1"
    with pytest.raises(Exception):
        decode_mini_auth_access_token(_access_token(token_use="refresh"))
    with pytest.raises(Exception):
        decode_mini_auth_access_token(_access_token(secret="other"))


def test_jwt_api_key_prefix() -> None:
    key = create_jwt_api_key(sub="user-1", org_id=uuid.uuid4())
    assert key.prefix == "jwt"
    assert key.name == "jwt:user-1"


def test_require_api_key_true_rejects_anonymous(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MINIKB_REQUIRE_API_KEY", "true")
    monkeypatch.setenv("MINIKB_JWT_SECRET", SECRET)
    client = TestClient(app)
    resp = client.get("/v1/kb")
    assert resp.status_code == 401


def test_require_api_key_true_accepts_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MINIKB_REQUIRE_API_KEY", "true")
    monkeypatch.setenv("MINIKB_JWT_SECRET", SECRET)
    monkeypatch.setenv("MINIKB_JWT_ISSUER", ISSUER)
    monkeypatch.setenv("MINIKB_JWT_AUDIENCE", AUDIENCE)
    client = TestClient(app)
    resp = client.get("/v1/kb", headers={"Authorization": f"Bearer {_access_token()}"})
    assert resp.status_code == 200
    assert "items" in resp.json()
