"""Drain ``sync_queue`` to the cloud's ``POST /v1/ingest`` endpoint.

Phase 4 turns the queue from a passive log into an actual outbox: every
``record_*`` call enqueues a row, and ``flush()`` ships up to
``CLOUD_INGEST_BATCH_ROWS`` of them at a time, deleting only on a
successful 2xx. Idempotent inserts on the api side mean replaying after
a crash is safe.
"""

from __future__ import annotations

import json
import threading
import time
from typing import Callable

from agent import cloud
from agent import database as db
from agent import privacy
from agent.config import (
    CLOUD_INGEST_BATCH_ROWS,
    CLOUD_PUSH_INTERVAL_SECONDS,
)


def device_id():
    with db.get_db() as conn:
        row = conn.execute(
            "SELECT value FROM sync_state WHERE key = 'device_id'"
        ).fetchone()
        return row["value"] if row else ""


def pending_count():
    with db.get_db() as conn:
        row = conn.execute("SELECT COUNT(*) AS n FROM sync_queue").fetchone()
        return row["n"] if row else 0


def _set_state(conn, key: str, value: str) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)",
        (key, value),
    )


def _record_status(status: str, last_error: str | None = None) -> None:
    with db.get_db() as conn:
        _set_state(conn, "last_push_status", status)
        if status == "ok":
            _set_state(conn, "last_push_success_at", str(time.time()))
            _set_state(conn, "last_push_error", "")
        elif last_error is not None:
            _set_state(conn, "last_push_error", last_error)


def _next_batch(batch_size: int):
    sessions: list[dict] = []
    app_usage: list[dict] = []
    pickups: list[dict] = []
    row_ids: list[int] = []

    with db.get_db() as conn:
        rows = conn.execute(
            "SELECT id, kind, payload_json FROM sync_queue "
            "ORDER BY queued_at, id LIMIT ?",
            (batch_size,),
        ).fetchall()

    ghost = privacy.is_enabled()
    for row in rows:
        try:
            payload = json.loads(row["payload_json"])
        except (TypeError, ValueError):
            continue
        if row["kind"] == "session":
            if ghost and isinstance(payload.get("app_name"), str):
                payload["app_name"] = privacy.hash_app_name(payload["app_name"])
            sessions.append(payload)
        elif row["kind"] == "app_usage":
            if ghost and isinstance(payload.get("app_name"), str):
                payload["app_name"] = privacy.hash_app_name(payload["app_name"])
            app_usage.append(payload)
        elif row["kind"] == "pickup":
            pickups.append(payload)
        else:
            continue
        row_ids.append(int(row["id"]))

    return sessions, app_usage, pickups, row_ids


def _delete_rows(row_ids: list[int]) -> None:
    if not row_ids:
        return
    placeholders = ",".join("?" for _ in row_ids)
    with db.get_db() as conn:
        conn.execute(
            f"DELETE FROM sync_queue WHERE id IN ({placeholders})",
            tuple(row_ids),
        )


def flush(batch_size: int = CLOUD_INGEST_BATCH_ROWS) -> dict:
    """Ship up to ``batch_size`` queued rows. Returns a status dict."""
    if not cloud.is_paired():
        return {
            "posted": 0,
            "pending": pending_count(),
            "status": "unpaired",
        }

    sessions, app_usage, pickups, row_ids = _next_batch(batch_size)
    if not row_ids:
        _record_status("ok")
        return {"posted": 0, "pending": 0, "status": "idle"}

    body = {
        "device_id": device_id(),
        "sessions": sessions,
        "app_usage": app_usage,
        "pickups": pickups,
    }

    try:
        resp = cloud.post_json("/v1/ingest", body)
    except cloud.HTTPError as exc:
        _record_status("error", last_error=str(exc))
        return {
            "posted": 0,
            "pending": pending_count(),
            "status": "error",
            "last_error": str(exc),
        }

    _delete_rows(row_ids)
    accepted = resp.get("accepted") if isinstance(resp, dict) else None
    if isinstance(accepted, dict):
        posted = sum(int(v or 0) for v in accepted.values())
    else:
        posted = len(row_ids)
    _record_status("ok")
    return {
        "posted": posted,
        "pending": pending_count(),
        "status": "ok",
    }


class SyncPusher:
    """Background thread that calls ``flush`` on a fixed cadence."""

    def __init__(
        self,
        *,
        interval_seconds: float = CLOUD_PUSH_INTERVAL_SECONDS,
        on_result: Callable[[dict], None] | None = None,
    ):
        self._interval = float(interval_seconds)
        self._on_result = on_result
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run, daemon=True, name="detox-sync-pusher"
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
        self._thread = None

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                result = flush()
            except Exception as exc:  # pragma: no cover - defensive
                result = {"status": "error", "last_error": str(exc)}
            if self._on_result:
                try:
                    self._on_result(result)
                except Exception:
                    pass
            self._stop.wait(self._interval)


def last_push_status() -> dict:
    """Snapshot of the most recent flush, for the menubar."""
    with db.get_db() as conn:
        rows = conn.execute(
            "SELECT key, value FROM sync_state "
            "WHERE key IN ('last_push_status','last_push_success_at','last_push_error')"
        ).fetchall()
    state = {row["key"]: row["value"] for row in rows}
    return {
        "status": state.get("last_push_status") or "idle",
        "last_success_at": state.get("last_push_success_at"),
        "last_error": state.get("last_push_error") or "",
        "pending": pending_count(),
    }
