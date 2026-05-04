"""Verify the Supabase JWT path against an in-test RSA keypair.

The api never speaks to Supabase in these tests — we generate a keypair,
publish it as a JWKS document via ``monkeypatch``, and assert that the
resolver accepts well-formed tokens and rejects everything else with the
right status code.
"""

import time
import uuid
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.app import supabase_auth
from api.app.config import Settings
from api.app.errors import ApiError, api_error_handler


_KID = "test-kid-1"
_AUDIENCE = "authenticated"


def _generate_keypair():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _jwk_from_public(public_key) -> dict[str, str]:
    numbers = public_key.public_numbers()

    def _b64(value: int) -> str:
        import base64

        length = (value.bit_length() + 7) // 8
        raw = value.to_bytes(length, "big")
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")

    return {
        "kty": "RSA",
        "alg": "RS256",
        "use": "sig",
        "kid": _KID,
        "n": _b64(numbers.n),
        "e": _b64(numbers.e),
    }


def _sign_token(private_key, claims: dict[str, Any]) -> str:
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return jwt.encode(claims, pem, algorithm="RS256", headers={"kid": _KID})


@pytest.fixture
def keypair():
    return _generate_keypair()


@pytest.fixture
def jwks(keypair):
    return {"keys": [_jwk_from_public(keypair.public_key())]}


@pytest.fixture(autouse=True)
def _patch_jwks_fetch(monkeypatch, jwks):
    supabase_auth._reset_cache_for_tests()
    monkeypatch.setattr(supabase_auth, "_fetch_jwks", lambda url: jwks)
    yield
    supabase_auth._reset_cache_for_tests()


def _client_with_settings() -> tuple[TestClient, FastAPI]:
    settings = Settings(
        auth_mode="supabase",
        supabase_url="https://example.supabase.co",
        supabase_jwt_jwks_url="https://example.supabase.co/auth/v1/keys",
        supabase_jwt_audience=_AUDIENCE,
    )

    app = FastAPI()
    app.state.settings = settings
    app.add_exception_handler(ApiError, api_error_handler)

    from fastapi import Request

    @app.get("/whoami")
    async def whoami(request: Request):
        from api.app.auth import resolve_user_id

        user_id = resolve_user_id(request)
        return {"user_id": user_id}

    return TestClient(app, raise_server_exceptions=False), app


def test_valid_token_returns_sub(keypair):
    user_id = str(uuid.uuid4())
    token = _sign_token(
        keypair,
        {
            "sub": user_id,
            "aud": _AUDIENCE,
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
        },
    )
    client, _ = _client_with_settings()
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json() == {"user_id": user_id}


def test_wrong_audience_rejected(keypair):
    token = _sign_token(
        keypair,
        {
            "sub": str(uuid.uuid4()),
            "aud": "not-authenticated",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
        },
    )
    client, _ = _client_with_settings()
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    assert "invalid" in resp.json()["error"].lower()


def test_expired_token_rejected(keypair):
    token = _sign_token(
        keypair,
        {
            "sub": str(uuid.uuid4()),
            "aud": _AUDIENCE,
            "iat": int(time.time()) - 1200,
            "exp": int(time.time()) - 600,
        },
    )
    client, _ = _client_with_settings()
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_unknown_kid_rejected(keypair):
    other_key = _generate_keypair()
    pem = other_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "aud": _AUDIENCE,
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
        },
        pem,
        algorithm="RS256",
        headers={"kid": "nope"},
    )
    client, _ = _client_with_settings()
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    assert "unknown signing key" in resp.json()["error"]


def test_missing_header_rejected():
    client, _ = _client_with_settings()
    resp = client.get("/whoami")
    assert resp.status_code == 401
    assert "missing bearer token" in resp.json()["error"]


def test_token_without_sub_rejected(keypair):
    token = _sign_token(
        keypair,
        {
            "aud": _AUDIENCE,
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
        },
    )
    client, _ = _client_with_settings()
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
    # PyJWT enforces required claims before our sub check, so either path is
    # acceptable as long as it's a 401.
    assert resp.status_code == 401


def test_supabase_mode_without_jwks_url_returns_500():
    settings = Settings(
        auth_mode="supabase",
        supabase_url=None,
        supabase_jwt_jwks_url=None,
    )
    app = FastAPI()
    app.state.settings = settings
    app.add_exception_handler(ApiError, api_error_handler)

    from fastapi import Request

    @app.get("/whoami")
    async def whoami(request: Request):
        from api.app.auth import resolve_user_id

        return {"user_id": resolve_user_id(request)}

    client = TestClient(app, raise_server_exceptions=False)
    resp = client.get("/whoami", headers={"Authorization": "Bearer x"})
    assert resp.status_code == 500
