"""Coverage for /v1/rules.

Unit tests for ``compute_etag`` run anywhere; the round-trip integration
tests gate on ``DETOX_TEST_DATABASE_URL`` and exercise the full FastAPI
stack against a real Postgres so RLS and ON CONFLICT behavior is real.
"""

from sqlalchemy import create_engine, text

from api.app.services.rules import compute_etag


def test_compute_etag_is_deterministic():
    payload = {
        "blocks": [{"app_name": "Slack", "block_type": "blocked"}],
        "category_blocks": [],
        "goals": [],
        "settings": {"idle_timeout_minutes": "5"},
    }
    assert compute_etag(payload) == compute_etag(payload)


def test_compute_etag_changes_with_content():
    base = {"blocks": [], "category_blocks": [], "goals": [], "settings": {}}
    other = {**base, "blocks": [{"app_name": "Slack"}]}
    assert compute_etag(base) != compute_etag(other)


def test_compute_etag_canonicalises_key_order():
    a = {"a": 1, "b": 2}
    b = {"b": 2, "a": 1}
    assert compute_etag(a) == compute_etag(b)


def test_compute_etag_format_weak_with_short_hex():
    payload = {"x": 1}
    etag = compute_etag(payload)
    assert etag.startswith('W/"')
    assert etag.endswith('"')
    # 16 hex chars between the quotes.
    inner = etag[3:-1]
    assert len(inner) == 16
    int(inner, 16)


# ── Integration ─────────────────────────────────────────────────────────


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


def _seed_block(user_id: str, app_name: str = "Slack") -> None:
    import os

    engine = create_engine(os.environ["DETOX_TEST_DATABASE_URL"], future=True)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO app_blocks (user_id, app_name, block_type) "
                "VALUES (:u, :a, 'blocked') "
                "ON CONFLICT (user_id, app_name) DO UPDATE "
                "SET block_type = EXCLUDED.block_type"
            ),
            {"u": user_id, "a": app_name},
        )
    engine.dispose()


def _delete_block(user_id: str, app_name: str = "Slack") -> None:
    import os

    engine = create_engine(os.environ["DETOX_TEST_DATABASE_URL"], future=True)
    with engine.begin() as conn:
        conn.execute(
            text(
                "DELETE FROM app_blocks WHERE user_id = :u AND app_name = :a"
            ),
            {"u": user_id, "a": app_name},
        )
    engine.dispose()


def test_rules_returns_empty_payload_for_new_user(pg_client):
    claim = _pair(pg_client)
    resp = pg_client.get("/v1/rules", headers=_device_headers(claim))
    assert resp.status_code == 200
    body = resp.json()
    assert body["blocks"] == []
    assert body["category_blocks"] == []
    assert body["goals"] == []
    assert body["settings"] == {}
    assert body["etag"].startswith('W/"')


def test_rules_304_on_matching_if_none_match(pg_client):
    claim = _pair(pg_client)
    first = pg_client.get("/v1/rules", headers=_device_headers(claim))
    etag = first.json()["etag"]

    second = pg_client.get(
        "/v1/rules",
        headers={**_device_headers(claim), "If-None-Match": etag},
    )
    assert second.status_code == 304
    assert second.headers.get("etag") == etag
    assert second.content == b""


def test_rules_etag_changes_after_block_added(pg_client):
    claim = _pair(pg_client)
    first = pg_client.get("/v1/rules", headers=_device_headers(claim))
    etag_before = first.json()["etag"]

    _seed_block(pg_client.user_id, "Slack")
    try:
        second = pg_client.get(
            "/v1/rules",
            headers={**_device_headers(claim), "If-None-Match": etag_before},
        )
        assert second.status_code == 200
        body = second.json()
        assert body["etag"] != etag_before
        assert any(b["app_name"] == "Slack" for b in body["blocks"])
    finally:
        _delete_block(pg_client.user_id, "Slack")


def test_rules_requires_device_jwt(pg_client):
    resp = pg_client.get(
        "/v1/rules", headers=_user_headers(pg_client)
    )
    # User token (HS256 dev shim is treated as non-device) → 401 from device verifier.
    assert resp.status_code in (401, 403)


def test_rules_isolated_per_user(pg_client, monkeypatch):
    """A second tenant's blocks must never appear in /v1/rules."""
    import os
    import uuid

    other_user = str(uuid.uuid4())
    engine = create_engine(os.environ["DETOX_TEST_DATABASE_URL"], future=True)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO users (id, email, auth_provider) "
                "VALUES (:id, :email, 'test') ON CONFLICT (id) DO NOTHING"
            ),
            {"id": other_user, "email": f"{other_user}@example.com"},
        )
        conn.execute(
            text(
                "INSERT INTO app_blocks (user_id, app_name, block_type) "
                "VALUES (:u, 'Twitter', 'blocked') "
                "ON CONFLICT DO NOTHING"
            ),
            {"u": other_user},
        )

    try:
        claim = _pair(pg_client)
        resp = pg_client.get("/v1/rules", headers=_device_headers(claim))
        body = resp.json()
        assert all(b["app_name"] != "Twitter" for b in body["blocks"])
    finally:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": other_user})
        engine.dispose()
