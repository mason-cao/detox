"""Device pairing + heartbeat routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..auth import require_device_jwt, require_user_jwt
from ..db import db_session
from ..device_auth import DeviceIdentity
from ..errors import ApiError
from ..services import devices as devices_service
from ..validation import require_json_object, require_text

router = APIRouter(prefix="/v1/devices", tags=["devices"])


@router.post("/pair-init", summary="Mint a single-use pairing code")
async def pair_init(
    request: Request,
    user_id: str = Depends(require_user_jwt),
    session: Session = Depends(db_session),
) -> dict:
    settings = request.app.state.settings
    result = devices_service.pair_init(
        session,
        user_id=user_id,
        ttl_seconds=settings.pairing_code_ttl_seconds,
    )
    return {
        "code": result.code,
        "expires_at": result.expires_at.isoformat(),
    }


@router.post("/pair-claim", summary="Claim a pairing code as a new device")
async def pair_claim(
    request: Request,
    session: Session = Depends(db_session),
) -> dict:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)
    code = require_text(body, "code").upper()
    device_name = require_text(body, "device_name")
    agent_version = body.get("agent_version")
    if agent_version is not None and not isinstance(agent_version, str):
        raise ApiError("agent_version must be a string", status_code=400)

    settings = request.app.state.settings
    result = devices_service.pair_claim(
        session,
        settings,
        code=code,
        device_name=device_name,
        agent_version=agent_version,
    )
    return {
        "device_id": result.device_id,
        "api_token": result.api_token,
    }


@router.get("", summary="List the authenticated user's devices")
async def list_devices(
    user_id: str = Depends(require_user_jwt),
    session: Session = Depends(db_session),
) -> list[dict]:
    return devices_service.list_devices(session, user_id=user_id)


@router.post("/{device_id}/heartbeat", summary="Record agent liveness")
async def heartbeat(
    device_id: str,
    request: Request,
    identity: DeviceIdentity = Depends(require_device_jwt),
    session: Session = Depends(db_session),
) -> dict:
    if identity.device_id != device_id:
        raise ApiError(
            "device_id in path does not match token",
            status_code=403,
        )

    try:
        payload = await request.json()
    except ValueError:
        payload = {}
    body = payload if isinstance(payload, dict) else {}
    agent_version = body.get("agent_version")
    if agent_version is not None and not isinstance(agent_version, str):
        raise ApiError("agent_version must be a string", status_code=400)

    devices_service.heartbeat(
        session,
        device_id=device_id,
        agent_version=agent_version,
    )
    return {"ok": True}
