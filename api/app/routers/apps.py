"""Apps routes — Postgres-backed."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ..db import db_session
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
async def list_apps(session: Session = Depends(db_session)) -> list[dict]:
    return apps_service.list_apps(session)


@router.get("/app-suggestions", summary="Suggest app names for autocomplete")
async def app_suggestions(session: Session = Depends(db_session)) -> list[str]:
    return apps_service.app_suggestions(session)


@router.get("/apps/{app_name}", summary="App usage detail")
async def app_detail(
    app_name: str,
    date: str | None = Query(default=None),
    period: str = Query(default="week"),
    session: Session = Depends(db_session),
) -> dict:
    if period not in _VALID_PERIODS:
        raise ApiError("Invalid period. Use week or month")
    selected_date = validate_date(date or datetime.now().strftime("%Y-%m-%d"))
    return apps_service.app_detail(
        session, app_name=app_name, date=selected_date, period=period
    )


@router.get("/categories", summary="List app categories")
async def list_categories(session: Session = Depends(db_session)) -> list[dict]:
    return apps_service.list_categories(session)


@router.post("/categories", summary="Set an app's category")
async def set_category(
    request: Request,
    session: Session = Depends(db_session),
) -> dict[str, bool]:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)
    app_name = require_text(body, "app_name")
    category = require_text(body, "category")
    apps_service.set_category(
        session,
        user_id=request.state.user_id,
        app_name=app_name,
        category=category,
    )
    return {"ok": True}
