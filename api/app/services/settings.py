"""Settings service.

Defaults from ``agent/config.py`` are merged on read; writes flow through a
normalizer so the supported keys (``idle_timeout_minutes``, ``whitelist_mode``)
land in the database with the same shape the Flask agent has always produced.
"""

from __future__ import annotations

from agent import database as db
from agent.config import DEFAULT_SETTINGS, MAX_IDLE_TIMEOUT_MINUTES

from ..errors import ApiError


def get_settings() -> dict[str, str]:
    return {**DEFAULT_SETTINGS, **db.get_settings()}


def set_settings(payload: dict) -> None:
    for key, value in payload.items():
        db.set_setting(key, _normalize_setting(key, value))


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
