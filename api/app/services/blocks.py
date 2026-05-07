"""Blocks + category-blocks service — Postgres-backed."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session


def list_blocks(session: Session) -> list[dict]:
    rows = session.execute(
        text(
            "SELECT app_name, block_type, daily_limit_minutes "
            "FROM app_blocks ORDER BY app_name"
        )
    ).all()
    return [
        {
            "app_name": r.app_name,
            "block_type": r.block_type,
            "daily_limit_minutes": r.daily_limit_minutes,
        }
        for r in rows
    ]


def add_block(
    session: Session,
    *,
    user_id: str,
    app_name: str,
    block_type: str,
    daily_limit_minutes: int | None,
) -> None:
    session.execute(
        text(
            """
            INSERT INTO app_blocks (user_id, app_name, block_type, daily_limit_minutes)
            VALUES (:user_id, :app_name, :block_type, :limit)
            ON CONFLICT (user_id, app_name) DO UPDATE
                SET block_type = EXCLUDED.block_type,
                    daily_limit_minutes = EXCLUDED.daily_limit_minutes
            """
        ),
        {
            "user_id": user_id,
            "app_name": app_name,
            "block_type": block_type,
            "limit": daily_limit_minutes,
        },
    )


def remove_block(session: Session, *, app_name: str) -> None:
    session.execute(
        text("DELETE FROM app_blocks WHERE app_name = :app"),
        {"app": app_name},
    )


def list_category_blocks(session: Session) -> list[dict]:
    rows = session.execute(
        text(
            "SELECT id, category_name, active "
            "FROM category_blocks WHERE active = 1 ORDER BY category_name"
        )
    ).all()
    return [
        {"id": r.id, "category_name": r.category_name, "active": int(r.active or 0)}
        for r in rows
    ]


def add_category_block(session: Session, *, user_id: str, category_name: str) -> None:
    session.execute(
        text(
            """
            INSERT INTO category_blocks (user_id, category_name, active)
            VALUES (:user_id, :name, 1)
            ON CONFLICT (user_id, category_name) DO UPDATE SET active = 1
            """
        ),
        {"user_id": user_id, "name": category_name},
    )


def remove_category_block(session: Session, *, category_name: str) -> None:
    session.execute(
        text(
            "UPDATE category_blocks SET active = 0 WHERE category_name = :name"
        ),
        {"name": category_name},
    )
