"""Goals routes ported from the local Flask agent."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..dependencies import api_request_setup
from ..errors import ApiError
from ..services import goals as goals_service
from ..services import rules as rules_service
from ..validation import (
    optional_positive_int,
    require_json_object,
    require_text,
)

router = APIRouter(
    prefix="/api",
    tags=["goals"],
    dependencies=[Depends(api_request_setup)],
)

_GOAL_TYPES = {"daily_total", "app_limit", "bedtime"}


@router.get("/goals", summary="List active goals")
async def list_goals() -> list[dict]:
    return goals_service.list_goals()


@router.post("/goals", status_code=201, summary="Create a goal")
async def create_goal(request: Request) -> dict[str, int]:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)

    goal_type = body.get("type")
    if goal_type not in _GOAL_TYPES:
        raise ApiError("Invalid goal type")

    target_minutes = optional_positive_int(body, "target_minutes")
    app_name: str | None = body.get("app_name")
    bedtime_hour = body.get("bedtime_hour")
    bedtime_minute = body.get("bedtime_minute")

    if goal_type in {"daily_total", "app_limit"} and target_minutes is None:
        raise ApiError("target_minutes is required")
    if goal_type == "app_limit":
        app_name = require_text(body, "app_name")
    if goal_type == "bedtime":
        try:
            bedtime_hour = int(bedtime_hour)
            bedtime_minute = int(bedtime_minute or 0)
        except (TypeError, ValueError) as exc:
            raise ApiError("Invalid bedtime") from exc
        if not (0 <= bedtime_hour <= 23 and 0 <= bedtime_minute <= 59):
            raise ApiError("Invalid bedtime")

    goal_id = goals_service.create_goal(
        goal_type=goal_type,
        target_minutes=target_minutes,
        app_name=app_name,
        bedtime_hour=bedtime_hour,
        bedtime_minute=bedtime_minute,
    )
    rules_service.bust_for_request(request)
    return {"id": goal_id}


@router.delete("/goals/{goal_id}", summary="Delete a goal")
async def delete_goal(goal_id: int, request: Request) -> dict[str, bool]:
    goals_service.delete_goal(goal_id)
    rules_service.bust_for_request(request)
    return {"ok": True}
