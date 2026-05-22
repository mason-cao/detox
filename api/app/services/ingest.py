"""Idempotent ingest of agent-batched sessions / app_usage / pickups.

Each row is inserted with ``ON CONFLICT DO NOTHING`` against the partial
unique indexes added in migration 0003. A replayed batch therefore returns
the same accepted counts as the original — the agent doesn't need to track
acks at the row level, just "did the request succeed".
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..errors import ApiError


@dataclass(frozen=True)
class IngestCounts:
    sessions: int = 0
    app_usage: int = 0
    pickups: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "sessions": self.sessions,
            "app_usage": self.app_usage,
            "pickups": self.pickups,
        }


def _date_for(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")


def _date_from_row(row: dict, timestamp_key: str) -> str:
    value = row.get("date")
    if value is None:
        return _date_for(_require_float(row, timestamp_key))
    if not isinstance(value, str):
        raise ApiError("row has invalid 'date'", status_code=400)
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise ApiError("row has invalid 'date'", status_code=400)
    return value


def _require_str(row: dict, key: str) -> str:
    value = row.get(key)
    if not isinstance(value, str) or not value:
        raise ApiError(f"row missing {key!r}", status_code=400)
    return value


def _require_float(row: dict, key: str) -> float:
    value = row.get(key)
    if not isinstance(value, (int, float)):
        raise ApiError(f"row missing numeric {key!r}", status_code=400)
    return float(value)


def insert_sessions(
    session: Session,
    *,
    user_id: str,
    device_id: str,
    rows: list[dict],
) -> int:
    accepted = 0
    for row in rows:
        app_name = _require_str(row, "app_name")
        start_time = _require_float(row, "start_time")
        end_time = _require_float(row, "end_time")
        duration = max(end_time - start_time, 0.0)
        result = session.execute(
            text(
                """
                INSERT INTO sessions
                    (user_id, device_id, app_name, start_time, end_time,
                     duration_seconds, date)
                VALUES
                    (:user_id, :device_id, :app_name, :start_time, :end_time,
                     :duration, :date)
                ON CONFLICT (user_id, device_id, start_time, app_name)
                    WHERE device_id IS NOT NULL
                DO NOTHING
                """
            ),
            {
                "user_id": user_id,
                "device_id": device_id,
                "app_name": app_name,
                "start_time": start_time,
                "end_time": end_time,
                "duration": duration,
                "date": _date_from_row(row, "start_time"),
            },
        )
        accepted += result.rowcount or 0
    return accepted


def insert_app_usage(
    session: Session,
    *,
    user_id: str,
    device_id: str,
    rows: list[dict],
) -> int:
    accepted = 0
    for row in rows:
        app_name = _require_str(row, "app_name")
        timestamp = _require_float(row, "timestamp")
        result = session.execute(
            text(
                """
                INSERT INTO app_usage
                    (user_id, device_id, app_name, timestamp, date)
                VALUES
                    (:user_id, :device_id, :app_name, :timestamp, :date)
                ON CONFLICT (user_id, device_id, timestamp, app_name)
                    WHERE device_id IS NOT NULL
                DO NOTHING
                """
            ),
            {
                "user_id": user_id,
                "device_id": device_id,
                "app_name": app_name,
                "timestamp": timestamp,
                "date": _date_from_row(row, "timestamp"),
            },
        )
        accepted += result.rowcount or 0
    return accepted


def insert_pickups(
    session: Session,
    *,
    user_id: str,
    device_id: str,
    rows: list[dict],
) -> int:
    accepted = 0
    for row in rows:
        timestamp = _require_float(row, "timestamp")
        result = session.execute(
            text(
                """
                INSERT INTO pickups
                    (user_id, device_id, timestamp, date)
                VALUES
                    (:user_id, :device_id, :timestamp, :date)
                ON CONFLICT (user_id, device_id, timestamp)
                    WHERE device_id IS NOT NULL
                DO NOTHING
                """
            ),
            {
                "user_id": user_id,
                "device_id": device_id,
                "timestamp": timestamp,
                "date": _date_from_row(row, "timestamp"),
            },
        )
        accepted += result.rowcount or 0
    return accepted


def ingest_batch(
    session: Session,
    *,
    user_id: str,
    device_id: str,
    sessions: list[dict],
    app_usage: list[dict],
    pickups: list[dict],
) -> IngestCounts:
    counts = IngestCounts(
        sessions=insert_sessions(
            session, user_id=user_id, device_id=device_id, rows=sessions
        ),
        app_usage=insert_app_usage(
            session, user_id=user_id, device_id=device_id, rows=app_usage
        ),
        pickups=insert_pickups(
            session, user_id=user_id, device_id=device_id, rows=pickups
        ),
    )
    # Touch last_sync_at so the dashboard's "monitor online" check has a
    # fresh signal — the agent's sync.flush is the canonical heartbeat.
    session.execute(
        text(
            "UPDATE devices SET last_sync_at = now() "
            "WHERE id = :id AND user_id = :user_id"
        ),
        {"id": device_id, "user_id": user_id},
    )
    return counts
