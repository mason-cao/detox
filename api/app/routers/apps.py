"""Apps routes ported from the local Flask agent."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request

from ..dependencies import api_request_setup
from ..errors import ApiError
from ..services import apps as apps_service
from ..validation import (
    require_json_object,
    require_text,
    validate_date,
)

router = APIRouter(
    prefix="/api",
    tags=["apps"],
    dependencies=[Depends(api_request_setup)],
)

_VALID_PERIODS = {"week", "month"}


@router.get("/apps", summary="List tracked apps")
async def list_apps() -> list[dict]:
    return apps_service.list_apps()


@router.get("/app-suggestions", summary="Suggest app names for autocomplete")
async def app_suggestions() -> list[str]:
    return apps_service.app_suggestions()


@router.get("/apps/{app_name}", summary="App usage detail")
async def app_detail(
    app_name: str,
    date: str | None = Query(default=None),
    period: str = Query(default="week"),
) -> dict:
    if period not in _VALID_PERIODS:
        raise ApiError("Invalid period. Use week or month")
    selected_date = validate_date(date or datetime.now().strftime("%Y-%m-%d"))
    return apps_service.app_detail(app_name, selected_date, period)


@router.get("/categories", summary="List app categories")
async def list_categories() -> list[dict]:
    return apps_service.list_categories()


@router.post("/categories", summary="Set an app's category")
async def set_category(request: Request) -> dict[str, bool]:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)
    app_name = require_text(body, "app_name")
    category = require_text(body, "category")
    apps_service.set_category(app_name, category)
    return {"ok": True}
