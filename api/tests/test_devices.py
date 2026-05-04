"""Integration coverage for /v1/devices/* against a real Postgres."""

import jwt


def _user_headers(client) -> dict:
    return {"Authorization": f"Bearer {client.bearer}"}


def test_pair_init_requires_user_token(pg_client):
    resp = pg_client.post("/v1/devices/pair-init")
    assert resp.status_code == 401


def test_pair_init_returns_six_char_code(pg_client):
    resp = pg_client.post("/v1/devices/pair-init", headers=_user_headers(pg_client))
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["code"]) == 6
    assert body["code"].isupper()
    assert body["expires_at"]


def test_pair_claim_with_unknown_code_404(pg_client):
    resp = pg_client.post(
        "/v1/devices/pair-claim",
        json={"code": "ZZZZZZ", "device_name": "Mason MBP"},
    )
    assert resp.status_code == 404


def test_pair_claim_issues_device_jwt(pg_client):
    init = pg_client.post(
        "/v1/devices/pair-init", headers=_user_headers(pg_client)
    ).json()
    claim = pg_client.post(
        "/v1/devices/pair-claim",
        json={
            "code": init["code"],
            "device_name": "Mason MBP",
            "agent_version": "1.0.0",
        },
    )
    assert claim.status_code == 200
    body = claim.json()
    assert body["device_id"]

    decoded = jwt.decode(
        body["api_token"],
        key="pg-test-secret-32-bytes-long!!",
        algorithms=["HS256"],
        audience="detox-device",
    )
    assert decoded["sub"] == pg_client.user_id
    assert decoded["device_id"] == body["device_id"]


def test_pair_claim_consumes_code_single_use(pg_client):
    init = pg_client.post(
        "/v1/devices/pair-init", headers=_user_headers(pg_client)
    ).json()
    first = pg_client.post(
        "/v1/devices/pair-claim",
        json={"code": init["code"], "device_name": "Mason MBP"},
    )
    assert first.status_code == 200
    second = pg_client.post(
        "/v1/devices/pair-claim",
        json={"code": init["code"], "device_name": "Mason MBP"},
    )
    assert second.status_code == 410


def test_list_devices_returns_paired_devices(pg_client):
    init = pg_client.post(
        "/v1/devices/pair-init", headers=_user_headers(pg_client)
    ).json()
    pg_client.post(
        "/v1/devices/pair-claim",
        json={"code": init["code"], "device_name": "Mason MBP"},
    )
    resp = pg_client.get("/v1/devices", headers=_user_headers(pg_client))
    assert resp.status_code == 200
    devices = resp.json()
    assert any(d["device_name"] == "Mason MBP" for d in devices)


def test_heartbeat_with_mismatched_device_id_403(pg_client):
    init = pg_client.post(
        "/v1/devices/pair-init", headers=_user_headers(pg_client)
    ).json()
    claim = pg_client.post(
        "/v1/devices/pair-claim",
        json={"code": init["code"], "device_name": "Mason MBP"},
    ).json()
    bogus_id = "11111111-1111-1111-1111-111111111111"
    resp = pg_client.post(
        f"/v1/devices/{bogus_id}/heartbeat",
        json={"agent_version": "1.0.0"},
        headers={"Authorization": f"Bearer {claim['api_token']}"},
    )
    assert resp.status_code == 403


def test_heartbeat_updates_last_sync_at(pg_client):
    init = pg_client.post(
        "/v1/devices/pair-init", headers=_user_headers(pg_client)
    ).json()
    claim = pg_client.post(
        "/v1/devices/pair-claim",
        json={"code": init["code"], "device_name": "Mason MBP"},
    ).json()
    resp = pg_client.post(
        f"/v1/devices/{claim['device_id']}/heartbeat",
        json={"agent_version": "1.0.1"},
        headers={"Authorization": f"Bearer {claim['api_token']}"},
    )
    assert resp.status_code == 200

    listing = pg_client.get(
        "/v1/devices", headers=_user_headers(pg_client)
    ).json()
    matched = [d for d in listing if d["id"] == claim["device_id"]][0]
    assert matched["last_sync_at"] is not None
    assert matched["agent_version"] == "1.0.1"
