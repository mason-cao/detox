"""Goals service — thin wrapper over the local SQLite layer."""

from __future__ import annotations

from agent import database as db


def list_goals() -> list[dict]:
    return db.get_goals()


def create_goal(
    *,
    goal_type: str,
    target_minutes: int | None,
    app_name: str | None,
    bedtime_hour: int | None,
    bedtime_minute: int | None,
) -> int:
    return db.create_goal(
        goal_type=goal_type,
        target_minutes=target_minutes,
        app_name=app_name,
        bedtime_hour=bedtime_hour,
        bedtime_minute=bedtime_minute,
    )


def delete_goal(goal_id: int) -> None:
    db.delete_goal(goal_id)
