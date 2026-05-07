"""Dashboard read-model service backed by Postgres.

Mirrors the local SQLite agent's dashboard shape but issues user-scoped
queries against the cloud Postgres. RLS scopes every row to whoever set
``app.current_user_id`` on the session, so the queries themselves don't
need a ``WHERE user_id = …`` clause.
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


def _daily_total(session: Session, date: str) -> float:
    row = session.execute(
        text(f"SELECT {_USAGE_MINUTES_SQL} AS minutes FROM app_usage WHERE date = :d"),
        {"d": date},
    ).one()
    return round(float(row[0] or 0), 1)


def _daily_usage(session: Session, date: str) -> list[dict]:
    rows = session.execute(
        text(
            f"""
            SELECT u.app_name,
                   {_USAGE_MINUTES_SQL} AS minutes,
                   COALESCE(c.category, 'Uncategorized') AS category
            FROM app_usage u
            LEFT JOIN app_categories c ON u.app_name = c.app_name
            WHERE u.date = :d
            GROUP BY u.app_name, c.category
            ORDER BY minutes DESC
            """
        ),
        {"d": date},
    ).all()
    return [
        {
            "app_name": row.app_name,
            "minutes": float(row.minutes or 0),
            "category": row.category,
        }
        for row in rows
    ]


def _hourly_breakdown(session: Session, date: str) -> dict[int, float]:
    rows = session.execute(
        text(
            f"""
            SELECT EXTRACT(HOUR FROM to_timestamp(timestamp))::int AS hour,
                   {_USAGE_MINUTES_SQL} AS minutes
            FROM app_usage
            WHERE date = :d
            GROUP BY hour
            ORDER BY hour
            """
        ),
        {"d": date},
    ).all()
    result = {i: 0.0 for i in range(24)}
    for row in rows:
        result[int(row.hour)] = round(float(row.minutes or 0), 1)
    return result


def _category_breakdown(session: Session, date: str) -> list[dict]:
    rows = session.execute(
        text(
            f"""
            SELECT COALESCE(c.category, 'Uncategorized') AS category,
                   {_USAGE_MINUTES_SQL} AS minutes
            FROM app_usage u
            LEFT JOIN app_categories c ON u.app_name = c.app_name
            WHERE u.date = :d
            GROUP BY category
            ORDER BY minutes DESC
            """
        ),
        {"d": date},
    ).all()
    return [
        {"category": row.category, "minutes": float(row.minutes or 0)}
        for row in rows
    ]


def _active_daily_total_goal(session: Session) -> int | None:
    row = session.execute(
        text(
            """
            SELECT target_minutes FROM goals
            WHERE active = 1
              AND type = 'daily_total'
              AND target_minutes IS NOT NULL
            ORDER BY id DESC
            LIMIT 1
            """
        )
    ).one_or_none()
    return int(row[0]) if row else None


def get_dashboard(session: Session, *, date: str) -> dict[str, object]:
    return {
        "date": date,
        "total_minutes": _daily_total(session, date),
        "apps": _daily_usage(session, date),
        "hourly": _hourly_breakdown(session, date),
        "categories": _category_breakdown(session, date),
        "goal_target": _active_daily_total_goal(session),
    }


def get_weekly_dashboard(session: Session, *, week_start: str) -> dict[str, object]:
    start = datetime.strptime(week_start, "%Y-%m-%d")
    days = []
    for i in range(7):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        days.append({"date": d, "minutes": _daily_total(session, d)})
    totals = [d["minutes"] for d in days]
    return {
        "days": days,
        "weekly_total": round(sum(totals), 1),
        "daily_average": round(sum(totals) / len(totals), 1) if totals else 0,
        "shortest_day": round(min(totals), 1) if totals else 0,
        "longest_day": round(max(totals), 1) if totals else 0,
    }
