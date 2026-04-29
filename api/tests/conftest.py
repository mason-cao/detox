"""Shared pytest fixtures for the API contract tests.

The agent (Flask) and the hosted API (FastAPI) both read and write through
``agent.database``. The fixtures here stand up a temporary SQLite database,
seed it with deterministic fixture data, and expose Flask/FastAPI test
clients that share the same DB so contract assertions are about *response
shape*, not data drift.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


SEED_FIXTURE_GOAL_MINUTES = 120


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    """Point ``agent.database`` at a fresh SQLite file for the test."""
    db_path = tmp_path / "screentime.db"

    monkeypatch.delenv("DETOX_DEV_TOKEN", raising=False)
    monkeypatch.delenv("DETOX_DEV_USER_ID", raising=False)

    from agent import config as agent_config
    from agent import database as agent_db

    monkeypatch.setattr(agent_db, "DB_PATH", str(db_path))
    monkeypatch.setattr(agent_config, "DB_PATH", str(db_path))
    return str(db_path)


@pytest.fixture
def reset_db(temp_db):
    """Return a callable that wipes the temp DB and reinstalls fixture data."""

    def _reset() -> None:
        if os.path.exists(temp_db):
            os.unlink(temp_db)
        from agent import database as agent_db

        agent_db.init_db()
        _populate_fixture(agent_db)

    _reset()
    return _reset


def _populate_fixture(agent_db) -> None:
    """Insert deterministic seed rows for parity assertions.

    Two days of usage, one app-block, one category-block, and a
    ``daily_total`` goal so the dashboard surfaces a non-null ``goal_target``.
    """
    fixtures = [
        ("2026-04-19", "Slack", 30),
        ("2026-04-19", "Code", 60),
        ("2026-04-20", "Slack", 30),
        ("2026-04-20", "Code", 60),
        ("2026-04-20", "YouTube", 90),
    ]
    with agent_db.get_db() as conn:
        for date, app_name, count in fixtures:
            base = datetime.strptime(date + " 09:00:00", "%Y-%m-%d %H:%M:%S").timestamp()
            for i in range(count):
                conn.execute(
                    "INSERT INTO app_usage (app_name, timestamp, date) VALUES (?, ?, ?)",
                    (app_name, base + i, date),
                )

    agent_db.create_goal(goal_type="daily_total", target_minutes=SEED_FIXTURE_GOAL_MINUTES)
    agent_db.add_block("YouTube", block_type="blocked")
    agent_db.add_category_block("Social")


@pytest.fixture
def flask_client(reset_db):
    from agent.server import app as flask_app

    flask_app.config["TESTING"] = True
    return flask_app.test_client()


@pytest.fixture
def fastapi_client(reset_db):
    from fastapi.testclient import TestClient

    from api.app.main import create_app

    return TestClient(create_app(), raise_server_exceptions=False)
