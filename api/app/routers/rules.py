"""Rules pull endpoint with weak ETag support."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from ..auth import require_device_jwt
from ..db import db_session
from ..device_auth import DeviceIdentity
from ..services import rules as rules_service

router = APIRouter(prefix="/v1", tags=["rules"])


@router.get("/rules", summary="Active rules for the device's user")
async def get_rules(
    request: Request,
    identity: DeviceIdentity = Depends(require_device_jwt),
    session: Session = Depends(db_session),
):
    payload = rules_service.get_rules_payload(session, user_id=identity.user_id)
    etag = rules_service.compute_etag(payload)

    if_none_match = request.headers.get("if-none-match")
    if if_none_match and if_none_match.strip() == etag:
        return Response(status_code=304, headers={"ETag": etag})

    body = {"etag": etag, **payload}
    return JSONResponse(body, headers={"ETag": etag})
