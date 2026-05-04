"""Unit coverage for device JWT issuance and verification."""

import time
import uuid

import jwt
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from api.app.config import Settings
from api.app.device_auth import (
    issue_device_token,
    looks_like_device_token,
    resolve_device_identity,
)
from api.app.errors import ApiError, api_error_handler


_SECRET = "unit-test-secret-32-bytes-long!!"


def _settings():
    return Settings(
        auth_mode="local",
        device_jwt_secret=_SECRET,
        device_jwt_audience="detox-device",
    )


def _client_with_settings(settings: Settings) -> TestClient:
    app = FastAPI()
    app.state.settings = settings
    app.add_exception_handler(ApiError, api_error_handler)

    @app.get("/whoami")
    def whoami(request: Request):
        identity = resolve_device_identity(request)
        return {"user_id": identity.user_id, "device_id": identity.device_id}

    return TestClient(app, raise_server_exceptions=False)


def test_issue_round_trips():
    settings = _settings()
    user_id = str(uuid.uuid4())
    device_id = str(uuid.uuid4())
    token = issue_device_token(settings, user_id=user_id, device_id=device_id)

    client = _client_with_settings(settings)
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json() == {"user_id": user_id, "device_id": device_id}


def test_issue_requires_secret():
    settings = Settings(auth_mode="local", device_jwt_secret=None)
    with pytest.raises(ApiError):
        issue_device_token(
            settings,
            user_id=str(uuid.uuid4()),
            device_id=str(uuid.uuid4()),
        )


def test_wrong_audience_rejected():
    settings = _settings()
    bad_token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "device_id": str(uuid.uuid4()),
            "aud": "something-else",
            "iat": int(time.time()),
        },
        _SECRET,
        algorithm="HS256",
    )
    client = _client_with_settings(settings)
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {bad_token}"})
    assert resp.status_code == 401


def test_missing_device_id_claim_rejected():
    settings = _settings()
    bad_token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "aud": "detox-device",
            "iat": int(time.time()),
        },
        _SECRET,
        algorithm="HS256",
    )
    client = _client_with_settings(settings)
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {bad_token}"})
    assert resp.status_code == 401


def test_expired_token_rejected():
    settings = _settings()
    expired = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "device_id": str(uuid.uuid4()),
            "aud": "detox-device",
            "iat": int(time.time()) - 7200,
            "exp": int(time.time()) - 60,
        },
        _SECRET,
        algorithm="HS256",
    )
    client = _client_with_settings(settings)
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


def test_looks_like_device_token_detects_alg():
    settings = _settings()
    device_token = issue_device_token(
        settings,
        user_id=str(uuid.uuid4()),
        device_id=str(uuid.uuid4()),
    )
    assert looks_like_device_token(f"Bearer {device_token}") is True

    # Hand-craft a JWT with an RS256 header — we don't care about the
    # signature, only that get_unverified_header reports alg=RS256.
    import base64
    import json

    def _b64(obj: dict) -> bytes:
        raw = json.dumps(obj, separators=(",", ":")).encode("utf-8")
        return base64.urlsafe_b64encode(raw).rstrip(b"=")

    fake_rs256 = b".".join(
        [_b64({"alg": "RS256", "typ": "JWT"}), _b64({"sub": "x"}), b"sig"]
    ).decode("ascii")

    assert looks_like_device_token(f"Bearer {fake_rs256}") is False
    assert looks_like_device_token(None) is False
    assert looks_like_device_token("") is False
    assert looks_like_device_token("Basic abc") is False
    assert looks_like_device_token("Bearer not-a-jwt") is False
