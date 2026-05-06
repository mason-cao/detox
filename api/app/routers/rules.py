"""Rules pull endpoint with weak ETag support."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from ..auth import require_device_jwt
from ..db import db_session
from ..device_auth import DeviceIdentity
from ..redis_client import cache_get, cache_set, get_redis
from ..services import rules as rules_service

router = APIRouter(prefix="/v1", tags=["rules"])


@router.get("/rules", summary="Active rules for the device's user")
async def get_rules(
    request: Request,
    identity: DeviceIdentity = Depends(require_device_jwt),
    session: Session = Depends(db_session),
):
    settings = request.app.state.settings
    redis = get_redis(request.app)
    cache_key = rules_service.etag_cache_key(identity.user_id)

    if_none_match = (request.headers.get("if-none-match") or "").strip()
    cached_etag = cache_get(redis, cache_key) if if_none_match else None
    if if_none_match and cached_etag and if_none_match == cached_etag:
        # Short-circuit: client already has the latest, no DB roundtrip.
        return Response(status_code=304, headers={"ETag": cached_etag})

    payload = rules_service.get_rules_payload(session, user_id=identity.user_id)
    etag = rules_service.compute_etag(payload)
    cache_set(
        redis,
        cache_key,
        etag,
        ttl_seconds=settings.rules_etag_cache_ttl_seconds,
    )

    if if_none_match and if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})

    body = {"etag": etag, **payload}
    return JSONResponse(body, headers={"ETag": etag})
