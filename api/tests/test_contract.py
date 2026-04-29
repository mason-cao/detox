"""Contract tests pinning Flask agent ↔ FastAPI service to identical JSON.

The agent's local dashboard talks to ``agent/server.py``. As routes are
ported to the hosted FastAPI tier in ``api/app/``, this suite asserts the
two implementations return byte-equivalent JSON for every shared route.

For mutation tests, the DB is reset between the Flask call and the FastAPI
call so each implementation observes the same starting state.
"""

from __future__ import annotations

from typing import Any

import pytest


# ── Helpers ─────────────────────────────────────────────────────────────


def _flask_call(client, method: str, path: str, json_body: Any = None):
    response = client.open(path, method=method, json=json_body)
    body = response.get_json(silent=True)
    return response.status_code, body


def _fastapi_call(client, method: str, path: str, json_body: Any = None):
    response = client.request(method, path, json=json_body)
    try:
        body = response.json()
    except ValueError:
        body = None
    return response.status_code, body


def _assert_parity(flask_client, fastapi_client, method: str, path: str, json_body=None):
    f_status, f_body = _flask_call(flask_client, method, path, json_body)
    a_status, a_body = _fastapi_call(fastapi_client, method, path, json_body)
    assert f_status == a_status, (
        f"{method} {path}: status mismatch — flask={f_status}, fastapi={a_status}"
    )
    assert f_body == a_body, (
        f"{method} {path}: body mismatch\nflask={f_body!r}\nfastapi={a_body!r}"
    )
    return f_status, f_body


# ── Read-route parity (read-only, shared DB) ────────────────────────────


def test_dashboard_parity(flask_client, fastapi_client):
    status, body = _assert_parity(
        flask_client, fastapi_client, "GET", "/api/dashboard?date=2026-04-20"
    )
    assert status == 200
    assert body["date"] == "2026-04-20"
    assert body["goal_target"] == 120
    assert any(app["app_name"] == "YouTube" for app in body["apps"])


def test_dashboard_weekly_parity(flask_client, fastapi_client):
    _assert_parity(
        flask_client,
        fastapi_client,
        "GET",
        "/api/dashboard/weekly?week_start=2026-04-13",
    )


def test_apps_parity(flask_client, fastapi_client):
    _assert_parity(flask_client, fastapi_client, "GET", "/api/apps")


def test_app_detail_parity(flask_client, fastapi_client):
    _assert_parity(
        flask_client,
        fastapi_client,
        "GET",
        "/api/apps/Slack?date=2026-04-20&period=week",
    )


def test_categories_parity(flask_client, fastapi_client):
    _assert_parity(flask_client, fastapi_client, "GET", "/api/categories")


def test_goals_parity(flask_client, fastapi_client):
    _assert_parity(flask_client, fastapi_client, "GET", "/api/goals")


def test_blocks_parity(flask_client, fastapi_client):
    _assert_parity(flask_client, fastapi_client, "GET", "/api/blocks")


def test_category_blocks_parity(flask_client, fastapi_client):
    _assert_parity(flask_client, fastapi_client, "GET", "/api/category-blocks")


def test_settings_parity(flask_client, fastapi_client):
    status, body = _assert_parity(flask_client, fastapi_client, "GET", "/api/settings")
    assert status == 200
    assert body["idle_timeout_minutes"] == "5"
    assert body["whitelist_mode"] == "0"


def test_app_suggestions_parity(monkeypatch, flask_client, fastapi_client):
    """OS-touching helpers are mocked deterministically on both sides."""
    from agent import server as flask_server
    from api.app.services import apps as fastapi_apps_service

    monkeypatch.setattr(flask_server, "get_frontmost_app_name", lambda: None)
    monkeypatch.setattr(flask_server, "get_installed_app_names", lambda: [])
    monkeypatch.setattr(fastapi_apps_service, "_frontmost_app_name", lambda: None)
    monkeypatch.setattr(fastapi_apps_service, "_installed_app_names", lambda: [])

    status, body = _assert_parity(
        flask_client, fastapi_client, "GET", "/api/app-suggestions"
    )
    assert status == 200
    assert "Slack" in body
    assert "YouTube" in body


# ── Error-shape parity ──────────────────────────────────────────────────


def test_invalid_date_query_returns_matching_400(flask_client, fastapi_client):
    f_status, f_body = _flask_call(flask_client, "GET", "/api/dashboard?date=not-a-date")
    a_status, a_body = _fastapi_call(fastapi_client, "GET", "/api/dashboard?date=not-a-date")
    assert f_status == a_status == 400
    assert f_body == a_body == {"error": "Invalid date format. Use YYYY-MM-DD"}


def test_unparseable_calendar_date_returns_matching_400(flask_client, fastapi_client):
    f_status, f_body = _flask_call(flask_client, "GET", "/api/dashboard?date=2026-13-40")
    a_status, a_body = _fastapi_call(fastapi_client, "GET", "/api/dashboard?date=2026-13-40")
    assert f_status == a_status == 400
    assert f_body == a_body == {"error": "Invalid date. Use a real calendar date"}


def test_invalid_period_returns_matching_400(flask_client, fastapi_client):
    f_status, f_body = _flask_call(
        flask_client, "GET", "/api/apps/Slack?date=2026-04-20&period=year"
    )
    a_status, a_body = _fastapi_call(
        fastapi_client, "GET", "/api/apps/Slack?date=2026-04-20&period=year"
    )
    assert f_status == a_status == 400
    assert f_body == a_body == {"error": "Invalid period. Use week or month"}


def test_create_goal_missing_type_returns_matching_400(flask_client, fastapi_client):
    f_status, f_body = _flask_call(flask_client, "POST", "/api/goals", {})
    a_status, a_body = _fastapi_call(fastapi_client, "POST", "/api/goals", {})
    assert f_status == a_status == 400
    assert f_body == a_body == {"error": "Invalid goal type"}


def test_create_block_missing_app_name_returns_matching_400(flask_client, fastapi_client):
    f_status, f_body = _flask_call(flask_client, "POST", "/api/blocks", {})
    a_status, a_body = _fastapi_call(fastapi_client, "POST", "/api/blocks", {})
    assert f_status == a_status == 400
    assert f_body == a_body == {"error": "Missing or invalid field: app_name"}


def test_set_settings_rejects_non_object(flask_client, fastapi_client):
    f_status, f_body = _flask_call(flask_client, "POST", "/api/settings", "not-an-object")
    a_status, a_body = _fastapi_call(fastapi_client, "POST", "/api/settings", "not-an-object")
    assert f_status == a_status == 400
    assert f_body == a_body == {"error": "Expected a JSON object"}


# ── Mutation parity (DB reset between calls so both observe the same seed) ──


def test_create_goal_parity(reset_db, flask_client, fastapi_client):
    body = {"type": "app_limit", "app_name": "Slack", "target_minutes": 30}

    reset_db()
    f_status, f_body = _flask_call(flask_client, "POST", "/api/goals", body)

    reset_db()
    a_status, a_body = _fastapi_call(fastapi_client, "POST", "/api/goals", body)

    assert f_status == a_status == 201
    assert f_body == a_body
    assert isinstance(f_body.get("id"), int) and f_body["id"] > 0


def test_create_block_parity(reset_db, flask_client, fastapi_client):
    body = {"app_name": "Twitter", "block_type": "blocked"}

    reset_db()
    f_status, f_body = _flask_call(flask_client, "POST", "/api/blocks", body)

    reset_db()
    a_status, a_body = _fastapi_call(fastapi_client, "POST", "/api/blocks", body)

    assert f_status == a_status == 201
    assert f_body == a_body == {"ok": True}


def test_delete_block_parity(reset_db, flask_client, fastapi_client):
    reset_db()
    f_status, f_body = _flask_call(flask_client, "DELETE", "/api/blocks/YouTube")

    reset_db()
    a_status, a_body = _fastapi_call(fastapi_client, "DELETE", "/api/blocks/YouTube")

    assert f_status == a_status == 200
    assert f_body == a_body == {"ok": True}


def test_create_category_block_parity(reset_db, flask_client, fastapi_client):
    body = {"category_name": "Entertainment"}

    reset_db()
    f_status, f_body = _flask_call(flask_client, "POST", "/api/category-blocks", body)

    reset_db()
    a_status, a_body = _fastapi_call(fastapi_client, "POST", "/api/category-blocks", body)

    assert f_status == a_status == 201
    assert f_body == a_body == {"ok": True}


def test_set_category_parity(reset_db, flask_client, fastapi_client):
    body = {"app_name": "Slack", "category": "Productivity"}

    reset_db()
    f_status, f_body = _flask_call(flask_client, "POST", "/api/categories", body)

    reset_db()
    a_status, a_body = _fastapi_call(fastapi_client, "POST", "/api/categories", body)

    assert f_status == a_status == 200
    assert f_body == a_body == {"ok": True}


def test_set_settings_parity(reset_db, flask_client, fastapi_client):
    body = {"idle_timeout_minutes": "10"}

    reset_db()
    f_status, f_body = _flask_call(flask_client, "POST", "/api/settings", body)

    reset_db()
    a_status, a_body = _fastapi_call(fastapi_client, "POST", "/api/settings", body)

    assert f_status == a_status == 200
    assert f_body == a_body == {"ok": True}
