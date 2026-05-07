"""Apps read-model service — Postgres-backed."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session


_POLL_INTERVAL_SECONDS = 2.0
_USAGE_MINUTES_SQL = f"COUNT(*) * {_POLL_INTERVAL_SECONDS} / 60.0"


def list_apps(session: Session) -> list[dict]:
    rows = session.execute(
        text(
            f"""
            SELECT u.app_name,
                   COALESCE(c.category, 'Uncategorized') AS category,
                   {_USAGE_MINUTES_SQL} AS total_minutes
            FROM app_usage u
            LEFT JOIN app_categories c ON u.app_name = c.app_name
            GROUP BY u.app_name, c.category
            ORDER BY total_minutes DESC
            """
        )
    ).all()
    return [
        {
            "app_name": r.app_name,
            "category": r.category,
            "total_minutes": float(r.total_minutes or 0),
        }
        for r in rows
    ]


def app_suggestions(session: Session) -> list[str]:
    """Aggregate app names the cloud has seen for this user."""
    names: set[str] = set()
    for r in session.execute(text("SELECT DISTINCT app_name FROM app_usage")).all():
        names.add(r[0])
    for r in session.execute(text("SELECT app_name FROM app_categories")).all():
        if r[0]:
            names.add(r[0])
    for r in session.execute(text("SELECT app_name FROM goals WHERE app_name IS NOT NULL")).all():
        if r[0]:
            names.add(r[0])
    for r in session.execute(text("SELECT app_name FROM app_blocks")).all():
        if r[0]:
            names.add(r[0])
    return sorted(names, key=str.casefold)


def _app_total(session: Session, app_name: str, date: str) -> float:
    row = session.execute(
        text(
            f"SELECT {_USAGE_MINUTES_SQL} AS minutes FROM app_usage "
            "WHERE app_name = :app AND date = :d"
        ),
        {"app": app_name, "d": date},
    ).one()
    return round(float(row[0] or 0), 1)


def _app_hourly(session: Session, app_name: str, date: str) -> dict[int, float]:
    rows = session.execute(
        text(
            f"""
            SELECT EXTRACT(HOUR FROM to_timestamp(timestamp))::int AS hour,
                   {_USAGE_MINUTES_SQL} AS minutes
            FROM app_usage
            WHERE app_name = :app AND date = :d
            GROUP BY hour
            ORDER BY hour
            """
        ),
        {"app": app_name, "d": date},
    ).all()
    result = {i: 0.0 for i in range(24)}
    for r in rows:
        result[int(r.hour)] = round(float(r.minutes or 0), 1)
    return result


def _app_daily_totals(session: Session, app_name: str, *, days: int, end_date: str) -> list[dict]:
    end = datetime.strptime(end_date, "%Y-%m-%d")
    out = []
    for i in range(days - 1, -1, -1):
        d = (end - timedelta(days=i)).strftime("%Y-%m-%d")
        out.append({"date": d, "minutes": _app_total(session, app_name, d)})
    return out


def app_detail(session: Session, *, app_name: str, date: str, period: str) -> dict:
    days = 7 if period == "week" else 30
    return {
        "app_name": app_name,
        "date": date,
        "selected_total": _app_total(session, app_name, date),
        "hourly": _app_hourly(session, app_name, date),
        "daily_totals": _app_daily_totals(session, app_name, days=days, end_date=date),
    }


def list_categories(session: Session) -> list[dict]:
    rows = session.execute(
        text("SELECT app_name, category FROM app_categories ORDER BY category, app_name")
    ).all()
    return [{"app_name": r.app_name, "category": r.category} for r in rows]


def set_category(session: Session, *, user_id: str, app_name: str, category: str) -> None:
    session.execute(
        text(
            """
            INSERT INTO app_categories (user_id, app_name, category)
            VALUES (:user_id, :app, :cat)
            ON CONFLICT (user_id, app_name) DO UPDATE SET category = EXCLUDED.category
            """
        ),
        {"user_id": user_id, "app": app_name, "cat": category},
    )
