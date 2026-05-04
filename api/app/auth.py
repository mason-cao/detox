"""Local dev authentication for the FastAPI service.

When ``DETOX_DEV_TOKEN`` and ``DETOX_DEV_USER_ID`` are both set in the
environment, every ``/api/*`` request must present the token as
``Authorization: Bearer <token>``. The matching user UUID is stashed on
``request.state.user_id`` for downstream handlers and (eventually)
propagated into a Postgres ``app.current_user_id`` GUC for RLS.

When ``DETOX_DEV_TOKEN`` is *unset* the check is a no-op so the local
agent's pre-auth dashboard keeps working. This is not a real auth system
— it exists to unblock integration testing of the multi-tenant Postgres
tier before the Phase 4 Clerk integration lands.
"""

from __future__ import annotations

import re
from typing import Final

from fastapi import Request

from .config import Settings
from .errors import ApiError


_BEARER_RE: Final = re.compile(r"^Bearer\s+(.+)$", re.IGNORECASE)
_UUID_RE: Final = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def resolve_dev_user_id(request: Request) -> str | None:
    settings = _settings(request)
    if not settings.dev_token:
        return None

    if not settings.dev_user_id or not _UUID_RE.match(settings.dev_user_id):
        raise ApiError(
            "DETOX_DEV_USER_ID must be a UUID when DETOX_DEV_TOKEN is set",
            status_code=500,
        )

    header = (request.headers.get("authorization") or "").strip()
    match = _BEARER_RE.match(header)
    if not match:
        raise ApiError("missing bearer token", status_code=401)
    if match.group(1).strip() != settings.dev_token:
        raise ApiError("invalid bearer token", status_code=401)

    return settings.dev_user_id


def resolve_user_id(request: Request) -> str | None:
    """Dispatch to the configured auth mode.

    ``local`` (default) keeps the optional dev-token shim used by the agent's
    pre-cloud dashboard. ``supabase`` requires a verified Supabase Auth JWT.

    When a device JWT (HS256) is presented we transparently accept it — the
    sub claim is the same user id Supabase would have produced, so the rest
    of the request scoping is identical.
    """
    from .device_auth import looks_like_device_token, resolve_device_identity

    if looks_like_device_token(request.headers.get("authorization")):
        identity = resolve_device_identity(request)
        request.state.device_id = identity.device_id
        return identity.user_id

    settings = _settings(request)
    if settings.auth_mode == "supabase":
        from .supabase_auth import resolve_supabase_user_id

        return resolve_supabase_user_id(request)
    return resolve_dev_user_id(request)


def require_user_jwt(request: Request) -> str:
    """Reject device tokens — used by pair-init, where only a real user can act."""
    if request.headers.get("authorization", "").lower().startswith("bearer "):
        from .device_auth import looks_like_device_token

        if looks_like_device_token(request.headers.get("authorization")):
            raise ApiError(
                "this endpoint requires a user session, not a device token",
                status_code=403,
            )
    user_id = resolve_user_id(request)
    if not user_id:
        raise ApiError("authentication required", status_code=401)
    return user_id


def require_device_jwt(request: Request):
    """Require an HS256 device token; used by ingest, rules pull, heartbeat."""
    from .device_auth import resolve_device_identity

    identity = resolve_device_identity(request)
    request.state.user_id = identity.user_id
    request.state.device_id = identity.device_id
    return identity
