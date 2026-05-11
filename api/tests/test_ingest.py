"""Integration coverage for /v1/ingest against a real Postgres."""

import time

from sqlalchemy import create_engine, text

from api.app.services import ingest as ingest_service


class _FakeResult:
    rowcount = 1


class _FakeSession:
    def __init__(self):
        self.calls = []

    def execute(self, statement, params=None):
        self.calls.append((str(statement), params or {}))
        return _FakeResult()


def _user_headers(client) -> dict:
    return {"Authorization": f"Bearer {client.bearer}"}


def _pair(pg_client) -> dict:
    init = pg_client.post(
        "/v1/devices/pair-init", headers=_user_headers(pg_client)
    ).json()
    return pg_client.post(
        "/v1/devices/pair-claim",
        json={"code": init["code"], "device_name": "Mason MBP"},
    ).json()


def _device_headers(claim: dict) -> dict:
    return {"Authorization": f"Bearer {claim['api_token']}"}


def _build_sessions(device_offset: float = 0.0, count: int = 100) -> list[dict]:
    base = time.time() - 86400 + device_offset
    return [
        {
            "app_name": f"App{i % 5}",
            "start_time": base + i * 60,
            "end_time": base + i * 60 + 30,
        }
        for i in range(count)
    ]


def test_insert_app_usage_respects_agent_supplied_local_date():
    session = _FakeSession()

    ingest_service.insert_app_usage(
        session,
        user_id="00000000-0000-0000-0000-000000000001",
        device_id="11111111-1111-1111-1111-111111111111",
        rows=[
            {
                "app_name": "Slack",
                "timestamp": 0.0,
                "date": "1969-12-31",
            }
        ],
    )

    assert session.calls[0][1]["date"] == "1969-12-31"


def test_ingest_conflict_targets_match_partial_device_indexes():
    session = _FakeSession()
    user_id = "00000000-0000-0000-0000-000000000001"
    device_id = "11111111-1111-1111-1111-111111111111"

    ingest_service.insert_sessions(
        session,
        user_id=user_id,
        device_id=device_id,
        rows=[{"app_name": "Code", "start_time": 10.0, "end_time": 20.0}],
    )
    ingest_service.insert_app_usage(
        session,
        user_id=user_id,
        device_id=device_id,
        rows=[{"app_name": "Code", "timestamp": 10.0}],
    )
    ingest_service.insert_pickups(
        session,
        user_id=user_id,
        device_id=device_id,
        rows=[{"timestamp": 10.0}],
    )

    insert_sql = "\n".join(sql for sql, _params in session.calls)
    assert "ON CONFLICT (user_id, device_id, start_time, app_name)" in insert_sql
    assert "ON CONFLICT (user_id, device_id, timestamp, app_name)" in insert_sql
    assert "ON CONFLICT (user_id, device_id, timestamp)" in insert_sql
    assert insert_sql.count("WHERE device_id IS NOT NULL") == 3


def test_ingest_happy_path(pg_client):
    claim = _pair(pg_client)
    sessions = _build_sessions(count=10)
    resp = pg_client.post(
        "/v1/ingest",
        json={
            "device_id": claim["device_id"],
            "sessions": sessions,
            "app_usage": [],
            "pickups": [],
        },
        headers=_device_headers(claim),
    )
    assert resp.status_code == 200
    assert resp.json() == {
        "accepted": {"sessions": 10, "app_usage": 0, "pickups": 0}
    }


def test_ingest_replay_is_idempotent(pg_client):
    claim = _pair(pg_client)
    sessions = _build_sessions(count=10)

    first = pg_client.post(
        "/v1/ingest",
        json={
            "device_id": claim["device_id"],
            "sessions": sessions,
            "app_usage": [],
            "pickups": [],
        },
        headers=_device_headers(claim),
    )
    assert first.json()["accepted"]["sessions"] == 10

    second = pg_client.post(
        "/v1/ingest",
        json={
            "device_id": claim["device_id"],
            "sessions": sessions,
            "app_usage": [],
            "pickups": [],
        },
        headers=_device_headers(claim),
    )
    # Same rows replayed → ON CONFLICT DO NOTHING means accepted=0.
    assert second.json()["accepted"]["sessions"] == 0

    # And the database really has 10 rows, not 20.
    engine = create_engine(
        __import__("os").environ["DETOX_TEST_DATABASE_URL"], future=True
    )
    with engine.connect() as conn:
        count = conn.execute(
            text(
                "SELECT COUNT(*) FROM sessions WHERE user_id = :u AND device_id = :d"
            ),
            {"u": pg_client.user_id, "d": claim["device_id"]},
        ).scalar_one()
    engine.dispose()
    assert count == 10


def test_ingest_mismatched_device_id_403(pg_client):
    claim = _pair(pg_client)
    bogus_device = "22222222-2222-2222-2222-222222222222"
    resp = pg_client.post(
        "/v1/ingest",
        json={
            "device_id": bogus_device,
            "sessions": _build_sessions(count=1),
            "app_usage": [],
            "pickups": [],
        },
        headers=_device_headers(claim),
    )
    assert resp.status_code == 403


def test_ingest_oversize_batch_rejected(pg_client, monkeypatch):
    monkeypatch.setenv("DETOX_INGEST_MAX_BATCH_ROWS", "5")
    # The settings were built at lifespan-startup in pg_client fixture; rebuild.
    pg_client.app.state.settings = type(
        pg_client.app.state.settings
    ).from_env()

    claim = _pair(pg_client)
    resp = pg_client.post(
        "/v1/ingest",
        json={
            "device_id": claim["device_id"],
            "sessions": _build_sessions(count=10),
            "app_usage": [],
            "pickups": [],
        },
        headers=_device_headers(claim),
    )
    assert resp.status_code == 413


def test_ingest_app_usage_and_pickups_partitioned(pg_client):
    claim = _pair(pg_client)
    base = time.time() - 3600
    resp = pg_client.post(
        "/v1/ingest",
        json={
            "device_id": claim["device_id"],
            "sessions": [],
            "app_usage": [
                {"app_name": "Slack", "timestamp": base + i}
                for i in range(20)
            ],
            "pickups": [
                {"timestamp": base + 100 + i * 60} for i in range(3)
            ],
        },
        headers=_device_headers(claim),
    )
    assert resp.status_code == 200
    assert resp.json()["accepted"] == {
        "sessions": 0,
        "app_usage": 20,
        "pickups": 3,
    }
