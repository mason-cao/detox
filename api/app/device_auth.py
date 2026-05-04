"""Issue and verify long-lived device JWTs.

Device tokens are HS256 with the api's own secret — they're never seen by
Supabase and never leave the user's Mac. The JWT carries ``sub`` (user id),
``device_id``, ``aud="detox-device"``, ``iat``, and an optional ``exp``.

Tokens are issued by ``POST /v1/devices/pair-claim`` and verified on every
``/v1/ingest``, ``/v1/rules``, etc. request. The shape is intentionally
disjoint from a Supabase JWT (RS256, ``aud="authenticated"``) so the auth
dispatcher can pick the right verifier from the token alone.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Final

import jwt
from fastapi import Request

from .config import Settings
from .errors import ApiError


_ALG: Final = "HS256"


@dataclass(frozen=True)
class DeviceIdentity:
    user_id: str
    device_id: str


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def issue_device_token(
    settings: Settings,
    *,
    user_id: str,
    device_id: str,
    expires_in_seconds: int | None = None,
) -> str:
    if not settings.device_jwt_secret:
        raise ApiError(
            "DETOX_DEVICE_JWT_SECRET must be set to issue device tokens",
            status_code=500,
        )
    now = int(time.time())
    claims: dict[str, object] = {
        "sub": user_id,
        "device_id": device_id,
        "aud": settings.device_jwt_audience,
        "iat": now,
    }
    if expires_in_seconds is not None:
        claims["exp"] = now + expires_in_seconds
    return jwt.encode(claims, settings.device_jwt_secret, algorithm=_ALG)


def resolve_device_identity(request: Request) -> DeviceIdentity:
    settings = _settings(request)
    if not settings.device_jwt_secret:
        raise ApiError("device auth not configured", status_code=500)

    header = (request.headers.get("authorization") or "").strip()
    if not header.lower().startswith("bearer "):
        raise ApiError("missing bearer token", status_code=401)
    token = header.split(" ", 1)[1].strip()

    try:
        claims = jwt.decode(
            token,
            key=settings.device_jwt_secret,
            algorithms=[_ALG],
            audience=settings.device_jwt_audience,
        )
    except jwt.PyJWTError as exc:
        raise ApiError(f"invalid device token: {exc}", status_code=401)

    sub = claims.get("sub")
    device_id = claims.get("device_id")
    if not sub or not device_id:
        raise ApiError("device token missing claims", status_code=401)
    return DeviceIdentity(user_id=str(sub), device_id=str(device_id))


def looks_like_device_token(authorization_header: str | None) -> bool:
    """Best-effort detection so the dispatcher can pick the right verifier.

    Inspects the unverified header — if ``alg=HS256`` we treat it as a device
    token and try device verification; anything else (RS256 from Supabase, or
    a missing/malformed header) falls through to the user verifier.
    """
    if not authorization_header:
        return False
    header = authorization_header.strip()
    if not header.lower().startswith("bearer "):
        return False
    token = header.split(" ", 1)[1].strip()
    try:
        unverified = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        return False
    return unverified.get("alg") == _ALG
