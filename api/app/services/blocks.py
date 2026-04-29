"""Blocks and category-blocks service."""

from __future__ import annotations

from agent import database as db


def list_blocks() -> list[dict]:
    return db.get_blocks()


def add_block(
    *,
    app_name: str,
    block_type: str,
    daily_limit_minutes: int | None,
) -> None:
    db.add_block(
        app_name=app_name,
        block_type=block_type,
        daily_limit_minutes=daily_limit_minutes,
    )


def remove_block(app_name: str) -> None:
    db.remove_block(app_name)


def list_category_blocks() -> list[dict]:
    return db.get_category_blocks()


def add_category_block(category_name: str) -> None:
    db.add_category_block(category_name)


def remove_category_block(category_name: str) -> None:
    db.remove_category_block(category_name)
