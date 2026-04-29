"""Dashboard read-model service.

This Phase 2 slice intentionally reuses the local SQLite query helpers so the
new FastAPI route contracts can be validated before the Postgres port lands.
"""

from __future__ import annotations

from agent import database as db


def get_dashboard(date: str) -> dict[str, object]:
    db.run_rollup_if_needed()

    goals = db.get_goals()
    goal_target = next(
        (goal["target_minutes"] for goal in goals if goal["type"] == "daily_total"),
        None,
    )

    return {
        "date": date,
        "total_minutes": db.get_daily_total(date),
        "apps": db.get_daily_usage(date),
        "hourly": db.get_hourly_breakdown(date),
        "categories": db.get_category_breakdown(date),
        "goal_target": goal_target,
    }


def get_weekly_dashboard(week_start: str) -> dict[str, object]:
    db.run_rollup_if_needed()
    return db.get_weekly_data(week_start)

