"""Tests for ``export_all`` and ``delete_all_data``."""

from __future__ import annotations


def _use_temp_db(tmp_path, monkeypatch):
    from agent import config
    from agent import database

    db_path = tmp_path / "screentime.db"
    monkeypatch.setattr(config, "DB_PATH", str(db_path))
    monkeypatch.setattr(database, "DB_PATH", str(db_path))
    return database


def test_export_all_includes_user_tables(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    database.record_usage("Slack", 1_714_492_800.0)
    database.record_pickup(1_714_492_900.0)
    database.add_block("YouTube", block_type="blocked")
    database.set_setting("ghost_mode", "1")

    payload = database.export_all()
    assert payload["version"] == 1
    tables = payload["tables"]
    assert any(row["app_name"] == "Slack" for row in tables["app_usage"])
    assert len(tables["pickups"]) == 1
    assert any(row["app_name"] == "YouTube" for row in tables["app_blocks"])
    assert any(
        row["key"] == "ghost_mode" and row["value"] == "1"
        for row in tables["settings"]
    )


def test_export_all_excludes_sync_queue_and_mirrors(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    database.record_usage("Slack", 1_714_492_800.0)

    payload = database.export_all()
    assert "sync_queue" not in payload["tables"]
    assert "cloud_app_blocks" not in payload["tables"]
    assert "sync_state" not in payload["tables"]


def test_delete_all_data_wipes_user_rows(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    database.record_usage("Slack", 1_714_492_800.0)
    database.record_pickup(1_714_492_900.0)
    database.add_block("YouTube")
    database.set_setting("idle_timeout_minutes", "10")
    assert len(database.get_all_apps()) == 1

    database.delete_all_data()

    assert database.get_all_apps() == []
    assert database.get_blocks() == []
    # Defaults are re-seeded by init_db
    settings = database.get_settings()
    assert settings.get("idle_timeout_minutes") == "5"
    assert settings.get("whitelist_mode") == "0"
    assert settings.get("ghost_mode") == "0"


def test_delete_all_data_preserves_device_id(tmp_path, monkeypatch):
    """A reset shouldn't force a re-pair — device_id is the agent's stable id."""
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    with database.get_db() as conn:
        before = conn.execute(
            "SELECT value FROM sync_state WHERE key = 'device_id'"
        ).fetchone()["value"]

    database.record_usage("Slack", 1_714_492_800.0)
    database.delete_all_data()

    with database.get_db() as conn:
        after = conn.execute(
            "SELECT value FROM sync_state WHERE key = 'device_id'"
        ).fetchone()["value"]
    assert before == after
