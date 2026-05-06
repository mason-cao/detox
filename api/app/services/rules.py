"""User-scoped rules read model + ETag computation.

The agent polls ``GET /v1/rules`` every 30 s with ``If-None-Match`` so an
unchanged rules set returns ``304 Not Modified`` and avoids round-tripping
the full payload. The etag is a SHA-256 of the canonical JSON of the
payload, truncated to 16 hex chars — content-addressable, so we don't need
``updated_at`` columns on every table.

Task 8 added Redis-backed caching: the etag is stored under
``rules:etag:<user_id>`` for 30 s so a 304 short-circuits before we touch
the database. ``invalidate_etag`` busts that key on every rule write.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import redis_client


def etag_cache_key(user_id: str) -> str:
    return f"rules:etag:{user_id}"


def get_rules_payload(session: Session, *, user_id: str) -> dict[str, Any]:
    """Return the user's blocks, category blocks, goals, and settings.

    Assumes the session has had ``app.current_user_id`` set so RLS scopes
    every query — the user_id parameter is informational, used only for
    callers that want to log who they read for.
    """
    blocks = [
        {
            "app_name": row[0],
            "block_type": row[1],
            "daily_limit_minutes": row[2],
        }
        for row in session.execute(
            text(
                "SELECT app_name, block_type, daily_limit_minutes "
                "FROM app_blocks ORDER BY app_name"
            )
        ).all()
    ]

    category_blocks = [
        {"category_name": row[0], "active": bool(row[1])}
        for row in session.execute(
            text(
                "SELECT category_name, active FROM category_blocks "
                "WHERE active = 1 ORDER BY category_name"
            )
        ).all()
    ]

    goals = [
        {
            "id": row[0],
            "type": row[1],
            "target_minutes": row[2],
            "app_name": row[3],
            "bedtime_hour": row[4],
            "bedtime_minute": row[5],
            "active": bool(row[6]) if row[6] is not None else True,
        }
        for row in session.execute(
            text(
                "SELECT id, type, target_minutes, app_name, "
                "bedtime_hour, bedtime_minute, active "
                "FROM goals ORDER BY id"
            )
        ).all()
    ]

    settings_dict = {
        row[0]: row[1]
        for row in session.execute(
            text("SELECT key, value FROM settings ORDER BY key")
        ).all()
    }

    return {
        "blocks": blocks,
        "category_blocks": category_blocks,
        "goals": goals,
        "settings": settings_dict,
    }


def compute_etag(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f'W/"{digest[:16]}"'


def invalidate_etag(app, user_id: str | None) -> None:
    """Bust the cached etag for ``user_id`` so the next pull recomputes."""
    if not user_id:
        return
    client = redis_client.get_redis(app)
    if client is None:
        return
    redis_client.cache_delete(client, etag_cache_key(user_id))


def bust_for_request(request) -> None:
    """Convenience: bust the etag for whoever made this request."""
    user_id = getattr(request.state, "user_id", None)
    invalidate_etag(request.app, user_id)
