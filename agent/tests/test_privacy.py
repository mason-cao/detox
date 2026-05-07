"""Tests for Ghost Mode hashing on the egress path."""

from __future__ import annotations


def _use_temp_db(tmp_path, monkeypatch):
    from agent import config
    from agent import database

    db_path = tmp_path / "screentime.db"
    monkeypatch.setattr(config, "DB_PATH", str(db_path))
    monkeypatch.setattr(database, "DB_PATH", str(db_path))
    return database


class _StubCloud:
    def __init__(self):
        self.calls = []

    def is_paired(self):
        return True

    def post_json(self, path, body):
        self.calls.append((path, body))
        return {"accepted": {"sessions": 0, "app_usage": 0, "pickups": 0}}


def _patch_cloud(monkeypatch, stub):
    from agent import cloud, sync

    monkeypatch.setattr(cloud, "is_paired", stub.is_paired)
    monkeypatch.setattr(cloud, "post_json", stub.post_json)
    monkeypatch.setattr(sync.cloud, "is_paired", stub.is_paired)
    monkeypatch.setattr(sync.cloud, "post_json", stub.post_json)


def test_hash_app_name_is_deterministic_per_salt():
    from agent import privacy

    a = privacy.hash_app_name("Slack", salt="abc123")
    b = privacy.hash_app_name("Slack", salt="abc123")
    c = privacy.hash_app_name("Slack", salt="different")
    assert a == b
    assert a != c
    assert a.startswith(privacy.HASH_PREFIX)


def test_flush_passthrough_when_ghost_mode_off(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    database.record_usage("Slack", 1_714_492_800.0)

    stub = _StubCloud()
    _patch_cloud(monkeypatch, stub)

    from agent import sync

    sync.flush()
    _, body = stub.calls[0]
    assert body["app_usage"][0]["app_name"] == "Slack"


def test_flush_hashes_app_names_when_ghost_mode_on(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    database.record_usage("Slack", 1_714_492_800.0)
    database.record_session("YouTube", 1_714_492_900.0, 1_714_493_000.0)
    database.set_setting("ghost_mode", "1")

    stub = _StubCloud()
    _patch_cloud(monkeypatch, stub)

    from agent import privacy, sync

    sync.flush()
    _, body = stub.calls[0]
    salt = privacy.get_or_create_salt()
    assert body["app_usage"][0]["app_name"] == privacy.hash_app_name("Slack", salt=salt)
    assert body["sessions"][0]["app_name"] == privacy.hash_app_name("YouTube", salt=salt)
    for hashed in (body["app_usage"][0]["app_name"], body["sessions"][0]["app_name"]):
        assert hashed.startswith(privacy.HASH_PREFIX)
        assert "Slack" not in hashed
        assert "YouTube" not in hashed


def test_local_db_keeps_real_names_under_ghost_mode(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    database.set_setting("ghost_mode", "1")
    database.record_usage("Slack", 1_714_492_800.0)

    apps = database.get_all_apps()
    names = {row["app_name"] for row in apps}
    assert "Slack" in names
