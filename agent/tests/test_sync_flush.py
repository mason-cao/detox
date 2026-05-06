"""Tests for ``agent.sync.flush`` against a mocked cloud client."""

from __future__ import annotations


def _use_temp_db(tmp_path, monkeypatch):
    from agent import config
    from agent import database

    db_path = tmp_path / "screentime.db"
    monkeypatch.setattr(config, "DB_PATH", str(db_path))
    monkeypatch.setattr(database, "DB_PATH", str(db_path))
    return database


class _StubCloud:
    def __init__(self, *, paired=True, response=None, error=None):
        self.paired = paired
        self.response = response or {"accepted": {"sessions": 0, "app_usage": 0, "pickups": 0}}
        self.error = error
        self.calls = []

    def is_paired(self):
        return self.paired

    def post_json(self, path, body):
        self.calls.append((path, body))
        if self.error:
            raise self.error
        return self.response


def _patch_cloud(monkeypatch, stub):
    from agent import cloud, sync

    monkeypatch.setattr(cloud, "is_paired", stub.is_paired)
    monkeypatch.setattr(cloud, "post_json", stub.post_json)
    monkeypatch.setattr(sync.cloud, "is_paired", stub.is_paired)
    monkeypatch.setattr(sync.cloud, "post_json", stub.post_json)


def test_unpaired_flush_makes_no_http_call(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    database.record_pickup(1_714_493_000.0)

    stub = _StubCloud(paired=False)
    _patch_cloud(monkeypatch, stub)

    from agent import sync

    result = sync.flush()
    assert result["status"] == "unpaired"
    assert result["pending"] == 1
    assert stub.calls == []


def test_paired_flush_drains_queue_and_deletes_rows(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    for i in range(50):
        database.record_usage("Slack", 1_714_492_800.0 + i)

    stub = _StubCloud(
        paired=True,
        response={"accepted": {"sessions": 0, "app_usage": 50, "pickups": 0}},
    )
    _patch_cloud(monkeypatch, stub)

    from agent import sync

    result = sync.flush()
    assert result["status"] == "ok"
    assert result["posted"] == 50
    assert result["pending"] == 0
    assert sync.pending_count() == 0
    assert len(stub.calls) == 1
    path, body = stub.calls[0]
    assert path == "/v1/ingest"
    assert len(body["app_usage"]) == 50


def test_flush_preserves_rows_when_api_errors(tmp_path, monkeypatch):
    database = _use_temp_db(tmp_path, monkeypatch)
    database.init_db()
    database.record_usage("Slack", 1_714_492_800.0)

    from agent import cloud as cloud_mod

    stub = _StubCloud(
        paired=True,
        error=cloud_mod.HTTPError("server error 500", status_code=500),
    )
    _patch_cloud(monkeypatch, stub)

    from agent import sync

    result = sync.flush()
    assert result["status"] == "error"
    assert result["pending"] == 1
    assert sync.pending_count() == 1
