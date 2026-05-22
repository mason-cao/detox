"""Goals service — Postgres-backed."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session


def list_goals(session: Session, *, user_id: str) -> list[dict]:
    rows = session.execute(
        text(
            "SELECT id, type, target_minutes, app_name, bedtime_hour, bedtime_minute, active "
            "FROM goals WHERE user_id = :user_id AND active = 1"
        ),
        {"user_id": user_id},
    ).all()
    return [
        {
            "id": r.id,
            "type": r.type,
            "target_minutes": r.target_minutes,
            "app_name": r.app_name,
            "bedtime_hour": r.bedtime_hour,
            "bedtime_minute": r.bedtime_minute,
            "active": int(r.active or 0),
        }
        for r in rows
    ]


def create_goal(
    session: Session,
    *,
    user_id: str,
    goal_type: str,
    target_minutes: int | None,
    app_name: str | None,
    bedtime_hour: int | None,
    bedtime_minute: int | None,
) -> int:
    if goal_type == "daily_total":
        session.execute(
            text(
                "UPDATE goals SET active = 0 "
                "WHERE user_id = :user_id AND active = 1 AND type = 'daily_total'"
            ),
            {"user_id": user_id},
        )
    elif goal_type == "app_limit" and app_name:
        session.execute(
            text(
                "UPDATE goals SET active = 0 "
                "WHERE user_id = :user_id AND active = 1 "
                "AND type = 'app_limit' AND app_name = :app"
            ),
            {"user_id": user_id, "app": app_name},
        )
    elif goal_type == "bedtime":
        session.execute(
            text(
                "UPDATE goals SET active = 0 "
                "WHERE user_id = :user_id AND active = 1 AND type = 'bedtime'"
            ),
            {"user_id": user_id},
        )

    row = session.execute(
        text(
            """
            INSERT INTO goals
                (user_id, type, target_minutes, app_name, bedtime_hour, bedtime_minute, active)
            VALUES
                (:user_id, :type, :target_minutes, :app_name, :bh, :bm, 1)
            RETURNING id
            """
        ),
        {
            "user_id": user_id,
            "type": goal_type,
            "target_minutes": target_minutes,
            "app_name": app_name,
            "bh": bedtime_hour,
            "bm": bedtime_minute,
        },
    ).one()
    return int(row[0])


def delete_goal(session: Session, *, user_id: str, goal_id: int) -> None:
    session.execute(
        text("UPDATE goals SET active = 0 WHERE user_id = :user_id AND id = :id"),
        {"user_id": user_id, "id": goal_id},
    )
