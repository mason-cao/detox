"""Dashboard routes — Postgres-backed."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ..db import db_session
from ..dependencies import api_request_setup
from ..services import dashboard as dashboard_service
from ..validation import validate_date

router = APIRouter(
    prefix="/api",
    tags=["dashboard"],
    dependencies=[Depends(api_request_setup)],
)


@router.get("/dashboard", summary="Daily dashboard")
async def dashboard(
    request: Request,
    date: str | None = Query(default=None),
    session: Session = Depends(db_session),
) -> dict[str, object]:
    selected = validate_date(date or datetime.now().strftime("%Y-%m-%d"))
    return dashboard_service.get_dashboard(
        session, user_id=request.state.user_id, date=selected
    )


@router.get("/dashboard/weekly", summary="Weekly dashboard")
async def dashboard_weekly(
    request: Request,
    week_start: str | None = Query(default=None),
    session: Session = Depends(db_session),
) -> dict[str, object]:
    if week_start is None:
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        selected_week_start = monday.strftime("%Y-%m-%d")
    else:
        selected_week_start = validate_date(week_start, "week_start")
    return dashboard_service.get_weekly_dashboard(
        session,
        user_id=request.state.user_id,
        week_start=selected_week_start,
    )
