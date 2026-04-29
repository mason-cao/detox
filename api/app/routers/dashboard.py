"""Dashboard routes ported from the local Flask agent."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query

from ..dependencies import api_request_setup
from ..services import dashboard as dashboard_service
from ..validation import validate_date

router = APIRouter(
    prefix="/api",
    tags=["dashboard"],
    dependencies=[Depends(api_request_setup)],
)


@router.get("/dashboard", summary="Daily dashboard")
async def dashboard(date: str | None = Query(default=None)) -> dict[str, object]:
    selected_date = validate_date(date or datetime.now().strftime("%Y-%m-%d"))
    return dashboard_service.get_dashboard(selected_date)


@router.get("/dashboard/weekly", summary="Weekly dashboard")
async def dashboard_weekly(
    week_start: str | None = Query(default=None),
) -> dict[str, object]:
    if week_start is None:
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        selected_week_start = monday.strftime("%Y-%m-%d")
    else:
        selected_week_start = validate_date(week_start, "week_start")
    return dashboard_service.get_weekly_dashboard(selected_week_start)

