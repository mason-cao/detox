import json
import uuid
from datetime import datetime


def _use_temp_db(tmp_path, monkeypatch):
    from agent import config
    from agent import database

    db_path = tmp_path / "screentime.db"
    monkeypatch.setattr(config, "DB_PATH", str(db_path))
    monkeypatch.setattr(database, "DB_PATH", str(db_path))
    return database


def _sync_rows(database):
    with database.get_db() as conn:
        rows = conn.execute(
            "SELECT kind, row_id, payload_json, queued_at "
            "FROM sync_queue ORDER BY id"
        ).fetchall()
    return [dict(row) for row in rows]


def test_init_db_creates_stable_device_id(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)

    database.init_db()
    with database.get_db() as conn:
        first = conn.execute(
            "SELECT value FROM sync_state WHERE key = 'device_id'"
        ).fetchone()["value"]

    database.init_db()
    with database.get_db() as conn:
        second = conn.execute(
            "SELECT value FROM sync_state WHERE key = 'device_id'"
        ).fetchone()["value"]

    assert uuid.UUID(first).version == 4
    assert second == first


def test_record_functions_enqueue_matching_source_rows(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()

    usage_ts = 1_714_492_800.0
    session_start = 1_714_492_900.0
    session_end = 1_714_492_960.0
    pickup_ts = 1_714_493_000.0
    database.record_usage("Slack", usage_ts)
    database.record_session("Code", session_start, session_end)
    database.record_pickup(pickup_ts)

    rows = _sync_rows(database)

    assert [row["kind"] for row in rows] == ["app_usage", "session", "pickup"]
    assert [row["row_id"] for row in rows] == [1, 1, 1]
    assert json.loads(rows[0]["payload_json"]) == {
        "app_name": "Slack",
        "timestamp": usage_ts,
        "date": datetime.fromtimestamp(usage_ts).strftime("%Y-%m-%d"),
    }
    assert json.loads(rows[1]["payload_json"]) == {
        "app_name": "Code",
        "start_time": session_start,
        "end_time": session_end,
        "date": datetime.fromtimestamp(session_start).strftime("%Y-%m-%d"),
    }
    assert json.loads(rows[2]["payload_json"]) == {
        "timestamp": pickup_ts,
        "date": datetime.fromtimestamp(pickup_ts).strftime("%Y-%m-%d"),
    }


def test_enqueue_sync_ignores_duplicate_kind_row_id(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    database.record_usage("Slack", 1_714_492_800.0)

    with database.get_db() as conn:
        database._enqueue_sync(
            conn,
            "app_usage",
            1,
            {"app_name": "Slack", "timestamp": 1_714_492_800.0},
            1_714_492_800.0,
        )

    assert len(_sync_rows(database)) == 1


def test_sync_helpers_report_device_pending_and_unpaired_flush(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    database.record_pickup(1_714_493_000.0)

    from agent import sync, cloud

    monkeypatch.setattr(cloud, "is_paired", lambda: False)

    with database.get_db() as conn:
        expected_device_id = conn.execute(
            "SELECT value FROM sync_state WHERE key = 'device_id'"
        ).fetchone()["value"]

    assert sync.device_id() == expected_device_id
    assert sync.pending_count() == 1
    assert sync.flush() == {"posted": 0, "pending": 1, "status": "unpaired"}
