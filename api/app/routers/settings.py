"""Settings routes — Postgres-backed."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..db import db_session
from ..dependencies import api_request_setup
from ..services import rules as rules_service
from ..services import settings as settings_service
from ..validation import require_json_object

router = APIRouter(
    prefix="/api",
    tags=["settings"],
    dependencies=[Depends(api_request_setup)],
)


@router.get("/settings", summary="Read all settings (defaults merged with overrides)")
async def get_settings(
    request: Request,
    session: Session = Depends(db_session),
) -> dict[str, str]:
    return settings_service.get_settings(session, user_id=request.state.user_id)


@router.post("/settings", summary="Update settings")
async def set_settings(
    request: Request,
    session: Session = Depends(db_session),
) -> dict[str, bool]:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)
    settings_service.set_settings(session, user_id=request.state.user_id, payload=body)
    rules_service.bust_for_request(request)
    return {"ok": True}
