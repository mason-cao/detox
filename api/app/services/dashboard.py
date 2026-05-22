"""Dashboard read-model service backed by Postgres.

Mirrors the local SQLite agent's dashboard shape but issues explicitly
user-scoped queries against the cloud Postgres. RLS remains enabled as a
database-side defense.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session


# Same constant as the local agent — usage minutes derive from COUNT(*) *
# poll-interval / 60. If the agent's poll cadence ever changes, update
# this in lock-step with ``agent.config.POLL_INTERVAL``.
_POLL_INTERVAL_SECONDS = 2.0
_USAGE_MINUTES_SQL = f"COUNT(*) * {_POLL_INTERVAL_SECONDS} / 60.0"


def _daily_total(session: Session, *, user_id: str, date: str) -> float:
    row = session.execute(
        text(
            f"SELECT {_USAGE_MINUTES_SQL} AS minutes FROM app_usage "
            "WHERE user_id = :user_id AND date = :d"
        ),
        {"user_id": user_id, "d": date},
    ).one()
    return round(float(row[0] or 0), 1)


def _daily_usage(session: Session, *, user_id: str, date: str) -> list[dict]:
    rows = session.execute(
        text(
            f"""
            SELECT u.app_name,
                   {_USAGE_MINUTES_SQL} AS minutes,
                   COALESCE(c.category, 'Uncategorized') AS category
            FROM app_usage u
            LEFT JOIN app_categories c
              ON c.user_id = :user_id AND u.app_name = c.app_name
            WHERE u.user_id = :user_id AND u.date = :d
            GROUP BY u.app_name, c.category
            ORDER BY minutes DESC
            """
        ),
        {"user_id": user_id, "d": date},
    ).all()
    return [
        {
            "app_name": row.app_name,
            "minutes": float(row.minutes or 0),
            "category": row.category,
        }
        for row in rows
    ]


def _hourly_breakdown(session: Session, *, user_id: str, date: str) -> dict[int, float]:
    rows = session.execute(
        text(
            f"""
            SELECT EXTRACT(HOUR FROM to_timestamp(timestamp))::int AS hour,
                   {_USAGE_MINUTES_SQL} AS minutes
            FROM app_usage
            WHERE user_id = :user_id AND date = :d
            GROUP BY hour
            ORDER BY hour
            """
        ),
        {"user_id": user_id, "d": date},
    ).all()
    result = {i: 0.0 for i in range(24)}
    for row in rows:
        result[int(row.hour)] = round(float(row.minutes or 0), 1)
    return result


def _category_breakdown(session: Session, *, user_id: str, date: str) -> list[dict]:
    rows = session.execute(
        text(
            f"""
            SELECT COALESCE(c.category, 'Uncategorized') AS category,
                   {_USAGE_MINUTES_SQL} AS minutes
            FROM app_usage u
            LEFT JOIN app_categories c
              ON c.user_id = :user_id AND u.app_name = c.app_name
            WHERE u.user_id = :user_id AND u.date = :d
            GROUP BY category
            ORDER BY minutes DESC
            """
        ),
        {"user_id": user_id, "d": date},
    ).all()
    return [
        {"category": row.category, "minutes": float(row.minutes or 0)}
        for row in rows
    ]


def _active_daily_total_goal(session: Session, *, user_id: str) -> int | None:
    row = session.execute(
        text(
            """
            SELECT target_minutes FROM goals
            WHERE user_id = :user_id
              AND active = 1
              AND type = 'daily_total'
              AND target_minutes IS NOT NULL
            ORDER BY id DESC
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    ).one_or_none()
    return int(row[0]) if row else None


def get_dashboard(session: Session, *, user_id: str, date: str) -> dict[str, object]:
    return {
        "date": date,
        "total_minutes": _daily_total(session, user_id=user_id, date=date),
        "apps": _daily_usage(session, user_id=user_id, date=date),
        "hourly": _hourly_breakdown(session, user_id=user_id, date=date),
        "categories": _category_breakdown(session, user_id=user_id, date=date),
        "goal_target": _active_daily_total_goal(session, user_id=user_id),
    }


def get_weekly_dashboard(
    session: Session, *, user_id: str, week_start: str
) -> dict[str, object]:
    start = datetime.strptime(week_start, "%Y-%m-%d")
    days = []
    for i in range(7):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        days.append(
            {"date": d, "minutes": _daily_total(session, user_id=user_id, date=d)}
        )
    totals = [d["minutes"] for d in days]
    return {
        "days": days,
        "weekly_total": round(sum(totals), 1),
        "daily_average": round(sum(totals) / len(totals), 1) if totals else 0,
        "shortest_day": round(min(totals), 1) if totals else 0,
        "longest_day": round(max(totals), 1) if totals else 0,
    }
