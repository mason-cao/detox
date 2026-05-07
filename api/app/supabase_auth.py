"""Verify Supabase Auth JWTs against the project's JWKS.

The api never speaks to Supabase per request — at most every hour the JWKS
document is fetched once, cached in-memory, and used to verify the user's
JWT locally. We accept whichever asymmetric algorithm the Supabase project
publishes (ES256, EdDSA, or RS256) by reading ``alg`` from the matching
JWK rather than hardcoding one. The signed ``sub`` claim is the user's
UUID, which the rest of the request lifecycle uses to scope row-level
security.
"""

from __future__ import annotations

import threading
import time
from typing import Final

import httpx
import jwt
from fastapi import Request

from .config import Settings
from .errors import ApiError

_JWKS_TTL_SECONDS: Final = 3600
_ALLOWED_ALGS: Final = ("RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "EdDSA")

_cache_lock = threading.Lock()
_cached_jwks: dict | None = None
_cached_at: float = 0.0


def _fetch_jwks(url: str) -> dict:
    with httpx.Client(timeout=5.0) as client:
        resp = client.get(url)
        resp.raise_for_status()
        return resp.json()


def _get_jwks(url: str) -> dict:
    global _cached_jwks, _cached_at
    with _cache_lock:
        if _cached_jwks and (time.time() - _cached_at) < _JWKS_TTL_SECONDS:
            return _cached_jwks
        _cached_jwks = _fetch_jwks(url)
        _cached_at = time.time()
        return _cached_jwks


def _reset_cache_for_tests() -> None:
    """Test-only: clear the JWKS cache so monkeypatched fetchers take effect."""
    global _cached_jwks, _cached_at
    with _cache_lock:
        _cached_jwks = None
        _cached_at = 0.0


def _signing_key_and_alg(token: str, jwks: dict):
    """Find the JWK whose ``kid`` matches the token header. Returns (PyJWK, alg).

    PyJWT's ``PyJWK`` wrapper handles RSA / EC / OKP key materials uniformly,
    so we don't have to branch on ``kty`` here. We do read ``alg`` from the
    JWK so ``jwt.decode`` is told the right algorithm; if the JWK omits it,
    we fall back to the token header's ``alg`` (still constrained to the
    asymmetric whitelist below).
    """
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    for jwk in jwks.get("keys", []):
        if jwk.get("kid") == kid:
            alg = jwk.get("alg") or header.get("alg")
            if alg not in _ALLOWED_ALGS:
                raise ApiError(f"unsupported alg: {alg}", status_code=401)
            return jwt.PyJWK(jwk).key, alg
    raise ApiError("unknown signing key", status_code=401)


def resolve_supabase_user_id(request: Request) -> str:
    settings: Settings = request.app.state.settings
    if not settings.supabase_jwt_jwks_url:
        raise ApiError("supabase auth not configured", status_code=500)

    header = (request.headers.get("authorization") or "").strip()
    if not header.lower().startswith("bearer "):
        raise ApiError("missing bearer token", status_code=401)
    token = header.split(" ", 1)[1].strip()

    jwks = _get_jwks(settings.supabase_jwt_jwks_url)
    try:
        key, alg = _signing_key_and_alg(token, jwks)
        claims = jwt.decode(
            token,
            key=key,
            algorithms=[alg],
            audience=settings.supabase_jwt_audience,
        )
    except jwt.PyJWTError as exc:
        raise ApiError(f"invalid token: {exc}", status_code=401)

    sub = claims.get("sub")
    if not sub:
        raise ApiError("token missing sub claim", status_code=401)
    return sub
