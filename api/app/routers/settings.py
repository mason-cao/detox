"""Settings routes ported from the local Flask agent."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..dependencies import api_request_setup
from ..services import settings as settings_service
from ..validation import require_json_object

router = APIRouter(
    prefix="/api",
    tags=["settings"],
    dependencies=[Depends(api_request_setup)],
)


@router.get("/settings", summary="Read all settings (defaults merged with overrides)")
async def get_settings() -> dict[str, str]:
    return settings_service.get_settings()


@router.post("/settings", summary="Update settings")
async def set_settings(request: Request) -> dict[str, bool]:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)
    settings_service.set_settings(body)
    return {"ok": True}
