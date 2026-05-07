"""Settings service — Postgres-backed.

Defaults come from ``agent/config.py``; writes go to the user-scoped
``settings`` row table. RLS scopes everything to ``app.current_user_id``
so the SQL doesn't carry an explicit ``user_id`` clause.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from agent.config import DEFAULT_SETTINGS, MAX_IDLE_TIMEOUT_MINUTES

from ..errors import ApiError


def get_settings(session: Session, *, user_id: str) -> dict[str, str]:
    rows = session.execute(text("SELECT key, value FROM settings")).all()
    overrides = {r[0]: r[1] for r in rows}
    return {**DEFAULT_SETTINGS, **overrides}


def set_settings(session: Session, *, user_id: str, payload: dict) -> None:
    for key, value in payload.items():
        normalized = _normalize_setting(key, value)
        session.execute(
            text(
                """
                INSERT INTO settings (user_id, key, value)
                VALUES (:user_id, :key, :value)
                ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
                """
            ),
            {"user_id": user_id, "key": key, "value": str(normalized)},
        )


def _normalize_setting(key: str, value: object) -> object:
    if key == "idle_timeout_minutes":
        try:
            minutes = int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError) as exc:
            raise ApiError("idle_timeout_minutes must be a number") from exc
        if minutes < 0 or minutes > MAX_IDLE_TIMEOUT_MINUTES:
            raise ApiError(
                f"idle_timeout_minutes must be between 0 and {MAX_IDLE_TIMEOUT_MINUTES}"
            )
        return str(minutes)

    if key == "whitelist_mode":
        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "on", "yes"}:
            return "1"
        if normalized in {"0", "false", "off", "no"}:
            return "0"
        raise ApiError("whitelist_mode must be enabled or disabled")

    return value
