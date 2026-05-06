"""Tests for ``agent.rules.pull_once`` and the blocker mirror swap."""

from __future__ import annotations


def _use_temp_db(tmp_path, monkeypatch):
    from agent import config
    from agent import database

    db_path = tmp_path / "screentime.db"
    monkeypatch.setattr(config, "DB_PATH", str(db_path))
    monkeypatch.setattr(database, "DB_PATH", str(db_path))
    return database


class _StubResponse:
    def __init__(self, status_code, body=None, etag=None):
        self.status_code = status_code
        self._body = body
        self.headers = {"ETag": etag} if etag else {}
        self.content = b"x" if body is not None else b""

    def json(self):
        if self._body is None:
            raise ValueError("no body")
        return self._body


def _patch_cloud(monkeypatch, *, paired=True, response=None, error=None):
    from agent import cloud, rules

    def is_paired():
        return paired

    def get(path, headers=None, timeout=None):
        if error:
            raise error
        return response

    monkeypatch.setattr(cloud, "is_paired", is_paired)
    monkeypatch.setattr(cloud, "get", get)
    monkeypatch.setattr(rules.cloud, "is_paired", is_paired)
    monkeypatch.setattr(rules.cloud, "get", get)


def _seed_usage(database, app_name, count, base_ts=1_714_492_800.0):
    for i in range(count):
        database.record_usage(app_name, base_ts + i)


def test_pull_applies_payload_and_stores_etag(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()

    payload = {
        "etag": 'W/"abc123"',
        "blocks": [
            {"app_name": "Twitter", "block_type": "blocked", "daily_limit_minutes": None}
        ],
        "category_blocks": [{"category_name": "Social", "active": True}],
        "goals": [
            {
                "id": 1,
                "type": "daily_total",
                "target_minutes": 120,
                "app_name": None,
                "bedtime_hour": None,
                "bedtime_minute": None,
                "active": True,
            }
        ],
        "settings": {"whitelist_mode": "0"},
    }

    _patch_cloud(monkeypatch, response=_StubResponse(200, body=payload, etag='W/"abc123"'))

    from agent import rules

    assert rules.pull_once() == "applied"

    with database.get_db() as conn:
        blocks = conn.execute("SELECT app_name FROM cloud_app_blocks").fetchall()
        cats = conn.execute("SELECT category_name FROM cloud_category_blocks").fetchall()
        goals = conn.execute("SELECT type, target_minutes FROM cloud_goals").fetchall()
        etag = conn.execute(
            "SELECT value FROM sync_state WHERE key = 'rules_etag'"
        ).fetchone()
    assert [r["app_name"] for r in blocks] == ["Twitter"]
    assert [r["category_name"] for r in cats] == ["Social"]
    assert (goals[0]["type"], goals[0]["target_minutes"]) == ("daily_total", 120)
    assert etag["value"] == 'W/"abc123"'


def test_pull_304_leaves_mirror_untouched_and_updates_pulled_at(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()

    with database.get_db() as conn:
        conn.execute("INSERT INTO cloud_app_blocks (app_name, block_type) VALUES ('Twitter', 'blocked')")
        conn.execute(
            "INSERT INTO sync_state (key, value) VALUES ('rules_etag', 'W/\"old\"')"
        )

    _patch_cloud(monkeypatch, response=_StubResponse(304))

    from agent import rules

    assert rules.pull_once() == "unchanged"

    with database.get_db() as conn:
        rows = conn.execute("SELECT app_name FROM cloud_app_blocks").fetchall()
        pulled_at = conn.execute(
            "SELECT value FROM sync_state WHERE key = 'rules_pulled_at'"
        ).fetchone()
    assert [r["app_name"] for r in rows] == ["Twitter"]
    assert pulled_at is not None and pulled_at["value"]


def test_pull_when_unpaired_skips_http(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()

    calls = []

    def _fail_get(*_a, **_k):
        calls.append(1)
        raise AssertionError("network call while unpaired")

    from agent import cloud, rules

    monkeypatch.setattr(cloud, "is_paired", lambda: False)
    monkeypatch.setattr(rules.cloud, "is_paired", lambda: False)
    monkeypatch.setattr(cloud, "get", _fail_get)
    monkeypatch.setattr(rules.cloud, "get", _fail_get)

    assert rules.pull_once() == "unpaired"
    assert calls == []


def test_blocker_reads_from_mirror_when_paired(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()

    # Local user-facing tables say nothing is blocked.
    with database.get_db() as conn:
        conn.execute("DELETE FROM app_blocks")
        conn.execute("DELETE FROM category_blocks")

    # Pull a payload that blocks Twitter via the cloud mirror.
    payload = {
        "etag": 'W/"abc"',
        "blocks": [
            {"app_name": "Twitter", "block_type": "blocked", "daily_limit_minutes": None}
        ],
        "category_blocks": [],
        "goals": [],
        "settings": {"whitelist_mode": "0"},
    }
    _patch_cloud(monkeypatch, response=_StubResponse(200, body=payload, etag='W/"abc"'))

    from agent import cloud, rules

    rules.pull_once()

    # Force the blocker into "paired" mode so it consults the mirror.
    monkeypatch.setattr(cloud, "is_paired", lambda: True)
    monkeypatch.setattr(database, "_cloud_authoritative", lambda: True)

    assert database.is_app_blocked("Twitter") is True
    assert database.is_app_blocked("Notes") is False
