"""Idempotent batch ingest from agents."""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..auth import require_device_jwt
from ..db import db_session
from ..device_auth import DeviceIdentity
from ..errors import ApiError
from ..redis_client import get_redis, incr_with_expiry
from ..services import ingest as ingest_service
from ..services import rewards as rewards_service

router = APIRouter(prefix="/v1", tags=["ingest"])


def _enforce_rate_limit(request: Request, device_id: str) -> None:
    settings = request.app.state.settings
    limit = int(settings.ingest_rate_limit_per_minute or 0)
    if limit <= 0:
        return
    client = get_redis(request.app)
    if client is None:
        return  # Redis unavailable — fail open rather than dropping ingest.
    bucket = int(time.time()) // 60
    key = f"rl:ingest:{device_id}:{bucket}"
    count = incr_with_expiry(client, key, expiry_seconds=70)
    if count is not None and count > limit:
        raise ApiError(
            f"rate limit exceeded ({limit} req/min)",
            status_code=429,
        )


def _list_or_empty(value, name: str) -> list:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ApiError(f"{name} must be a list", status_code=400)
    return value


@router.post("/ingest", summary="Batch upload agent-collected rows")
async def ingest(
    request: Request,
    identity: DeviceIdentity = Depends(require_device_jwt),
    session: Session = Depends(db_session),
) -> dict:
    settings = request.app.state.settings

    try:
        payload = await request.json()
    except ValueError:
        raise ApiError("body must be JSON", status_code=400)
    if not isinstance(payload, dict):
        raise ApiError("body must be a JSON object", status_code=400)

    body_device_id = payload.get("device_id")
    if not isinstance(body_device_id, str) or body_device_id != identity.device_id:
        raise ApiError(
            "device_id in body does not match token",
            status_code=403,
        )

    _enforce_rate_limit(request, identity.device_id)

    sessions = _list_or_empty(payload.get("sessions"), "sessions")
    app_usage = _list_or_empty(payload.get("app_usage"), "app_usage")
    pickups = _list_or_empty(payload.get("pickups"), "pickups")
    total = len(sessions) + len(app_usage) + len(pickups)
    if total > settings.ingest_max_batch_rows:
        raise ApiError(
            f"batch exceeds {settings.ingest_max_batch_rows} rows",
            status_code=413,
        )

    counts = ingest_service.ingest_batch(
        session,
        user_id=identity.user_id,
        device_id=identity.device_id,
        sessions=sessions,
        app_usage=app_usage,
        pickups=pickups,
    )

    # New rows can change today's earned ☀ and finalize past days for the
    # streak rollup. Both are cheap and idempotent — recompute eagerly so
    # the agent's HUD reflects the new ingest before the next puller tick.
    if counts.sessions or counts.app_usage or counts.pickups:
        rewards_service.run_milestone_rollup(session, user_id=identity.user_id)
        rewards_service.recompute_balances(session, user_id=identity.user_id)

    return {"accepted": counts.as_dict()}
