"""Rules puller. Polls /v1/rules and mirrors the response locally.

When the device is paired, a 30-second timer fires ``pull_once``: it
sends ``If-None-Match`` with the cached etag and either gets a 304 (no
change) or a fresh body that gets written into the ``cloud_*`` mirror
tables. The blocker reads from those mirrors so enforcement reflects
whatever the cloud said most recently, with no per-block round-trip.
"""

from __future__ import annotations

import threading
import time
from typing import Callable

from agent import cloud
from agent import database as db
from agent.config import CLOUD_PULL_INTERVAL_SECONDS


def _read_state(key: str) -> str | None:
    with db.get_db() as conn:
        row = conn.execute(
            "SELECT value FROM sync_state WHERE key = ?",
            (key,),
        ).fetchone()
    return row["value"] if row else None


def _write_state(key: str, value: str) -> None:
    with db.get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)",
            (key, value),
        )


def pull_once() -> str:
    """Fetch /v1/rules. Returns 'unchanged' / 'applied' / 'unpaired' / 'error: …'."""
    if not cloud.is_paired():
        return "unpaired"

    etag = _read_state("rules_etag")
    headers = {"If-None-Match": etag} if etag else {}
    try:
        resp = cloud.get("/v1/rules", headers=headers)
    except cloud.HTTPError as exc:
        return f"error: {exc}"

    if resp.status_code == 304:
        _write_state("rules_pulled_at", str(time.time()))
        return "unchanged"

    if resp.status_code != 200:
        return f"error: {resp.status_code}"

    try:
        payload = resp.json()
    except ValueError as exc:
        return f"error: invalid json ({exc})"

    db.replace_rules_mirror(payload)
    new_etag = payload.get("etag") or resp.headers.get("ETag", "")
    if new_etag:
        _write_state("rules_etag", new_etag)
    _write_state("rules_pulled_at", str(time.time()))
    return "applied"


class RulesPuller:
    """Background thread that calls ``pull_once`` on a fixed cadence."""

    def __init__(
        self,
        *,
        interval_seconds: float = CLOUD_PULL_INTERVAL_SECONDS,
        on_result: Callable[[str], None] | None = None,
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
            target=self._run, daemon=True, name="detox-rules-puller"
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
                result = pull_once()
            except Exception as exc:  # pragma: no cover - defensive
                result = f"error: {exc}"
            if self._on_result:
                try:
                    self._on_result(result)
                except Exception:
                    pass
            self._stop.wait(self._interval)
