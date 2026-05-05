"""Coverage for /v1/rewards.

Pure unit coverage for the daily-cap rollup runs anywhere; everything else
gates on ``DETOX_TEST_DATABASE_URL`` so the row lock + RLS behavior gets
exercised against a real Postgres.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, text

from api.app.services import rewards as rewards_service
from api.app.services.rewards import (
    DAILY_CAP_SUNLIGHT,
    REFUND_FULL_WINDOW_SECONDS,
    _refund_amount,
    _sunlight_for_date,
)


# ── Pure unit tests ──────────────────────────────────────────────────────


def test_sunlight_caps_at_daily_limit():
    daily_goal = 600  # absurdly high goal so unused minutes ≫ cap
    earned = _sunlight_for_date(
        "2026-05-05",
        daily_goal=daily_goal,
        app_limits={"Slack": 200},
        daily_usage={"2026-05-05": 0.0},
        app_usage={"2026-05-05": {"Slack": 0.0}},
    )
    assert earned == DAILY_CAP_SUNLIGHT


def test_sunlight_zero_when_over_goal():
    earned = _sunlight_for_date(
        "2026-05-05",
        daily_goal=60,
        app_limits={},
        daily_usage={"2026-05-05": 90.0},
        app_usage={},
    )
    assert earned == 0


def test_sunlight_combines_daily_total_and_app_limits():
    earned = _sunlight_for_date(
        "2026-05-05",
        daily_goal=100,
        app_limits={"Slack": 30},
        daily_usage={"2026-05-05": 40.0},  # 60 ☀ from daily total
        app_usage={"2026-05-05": {"Slack": 10.0}},  # 20 ☀ from app limit
    )
    assert earned == 80


def test_refund_amount_full_within_24h():
    acquired = datetime.now(tz=timezone.utc) - timedelta(hours=12)
    amount, pct = _refund_amount(acquired, 60)
    assert amount == 60
    assert pct == 100


def test_refund_amount_half_after_24h():
    acquired = datetime.now(tz=timezone.utc) - timedelta(
        seconds=REFUND_FULL_WINDOW_SECONDS + 60
    )
    amount, pct = _refund_amount(acquired, 60)
    assert amount == 30
    assert pct == 50


# ── Integration ─────────────────────────────────────────────────────────


def _user_headers(client) -> dict:
    return {"Authorization": f"Bearer {client.bearer}"}


def _seed_daily_goal(user_id: str, target_minutes: int = 60) -> None:
    engine = create_engine(os.environ["DETOX_TEST_DATABASE_URL"], future=True)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO goals (user_id, type, target_minutes, active) "
                "VALUES (:u, 'daily_total', :t, 1)"
            ),
            {"u": user_id, "t": target_minutes},
        )
    engine.dispose()


def _seed_app_usage(
    user_id: str, *, app_name: str, day: str, samples: int
) -> None:
    """Insert ``samples`` 2-second poll rows on ``day`` for ``app_name``."""
    base = datetime.strptime(day + " 09:00:00", "%Y-%m-%d %H:%M:%S").timestamp()
    engine = create_engine(os.environ["DETOX_TEST_DATABASE_URL"], future=True)
    with engine.begin() as conn:
        for i in range(samples):
            conn.execute(
                text(
                    "INSERT INTO app_usage (user_id, app_name, timestamp, date) "
                    "VALUES (:u, :a, :ts, :d)"
                ),
                {"u": user_id, "a": app_name, "ts": base + i, "d": day},
            )
    engine.dispose()


def _delete_user_state(user_id: str) -> None:
    engine = create_engine(os.environ["DETOX_TEST_DATABASE_URL"], future=True)
    with engine.begin() as conn:
        for table in (
            "rewards_balances",
            "inventory",
            "milestones",
            "rewards_ledger",
            "rewards_awards",
            "app_usage",
            "goals",
        ):
            conn.execute(
                text(f"DELETE FROM {table} WHERE user_id = :u"),
                {"u": user_id},
            )
    engine.dispose()


def test_balances_returns_zero_for_new_user(pg_client):
    resp = pg_client.get("/v1/rewards/balances", headers=_user_headers(pg_client))
    assert resp.status_code == 200
    body = resp.json()
    assert body["sunlight"] == 0
    assert body["starshards"] == 0
    assert body["sunlight_today"] == 0
    assert body["sunlight_cap"] == DAILY_CAP_SUNLIGHT


def test_balances_caps_today_at_daily_limit(pg_client):
    """Even with a huge goal and zero usage, today's earn must cap."""
    _seed_daily_goal(pg_client.user_id, target_minutes=600)
    try:
        resp = pg_client.get(
            "/v1/rewards/balances", headers=_user_headers(pg_client)
        )
        assert resp.json()["sunlight_today"] == DAILY_CAP_SUNLIGHT
    finally:
        _delete_user_state(pg_client.user_id)


def test_spend_deducts_balance_and_lists_inventory(pg_client):
    today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    _seed_daily_goal(pg_client.user_id, target_minutes=200)
    _seed_app_usage(
        pg_client.user_id, app_name="Other", day=today, samples=0
    )
    try:
        before = pg_client.get(
            "/v1/rewards/balances", headers=_user_headers(pg_client)
        ).json()
        assert before["sunlight"] >= 30, before

        resp = pg_client.post(
            "/v1/rewards/spend",
            json={"item_key": "lantern_path"},
            headers=_user_headers(pg_client),
        )
        assert resp.status_code == 200, resp.text
        after = resp.json()["balance"]
        assert after["sunlight"] == before["sunlight"] - 30

        inv = pg_client.get(
            "/v1/rewards/inventory", headers=_user_headers(pg_client)
        ).json()
        assert any(item["item_key"] == "lantern_path" for item in inv)
    finally:
        _delete_user_state(pg_client.user_id)


def test_spend_rejects_insufficient_funds(pg_client):
    # No goal → no Sunlight earned → 30 ☀ purchase fails.
    resp = pg_client.post(
        "/v1/rewards/spend",
        json={"item_key": "lantern_path"},
        headers=_user_headers(pg_client),
    )
    assert resp.status_code == 409
    assert resp.json()["error"] == "insufficient_funds"


def test_spend_rejects_already_owned(pg_client):
    _seed_daily_goal(pg_client.user_id, target_minutes=600)
    try:
        first = pg_client.post(
            "/v1/rewards/spend",
            json={"item_key": "lantern_path"},
            headers=_user_headers(pg_client),
        )
        assert first.status_code == 200, first.text

        second = pg_client.post(
            "/v1/rewards/spend",
            json={"item_key": "lantern_path"},
            headers=_user_headers(pg_client),
        )
        assert second.status_code == 409
        assert second.json()["error"] == "already_owned"
    finally:
        _delete_user_state(pg_client.user_id)


def test_spend_unknown_item_returns_404(pg_client):
    resp = pg_client.post(
        "/v1/rewards/spend",
        json={"item_key": "no_such_item"},
        headers=_user_headers(pg_client),
    )
    assert resp.status_code == 404
    assert resp.json()["error"] == "unknown_item"


def test_refund_within_24h_returns_full_amount(pg_client):
    _seed_daily_goal(pg_client.user_id, target_minutes=600)
    try:
        balance_before = pg_client.get(
            "/v1/rewards/balances", headers=_user_headers(pg_client)
        ).json()["sunlight"]

        spend_resp = pg_client.post(
            "/v1/rewards/spend",
            json={"item_key": "lantern_path"},
            headers=_user_headers(pg_client),
        )
        assert spend_resp.status_code == 200

        inv = pg_client.get(
            "/v1/rewards/inventory", headers=_user_headers(pg_client)
        ).json()
        item = next(i for i in inv if i["item_key"] == "lantern_path")
        assert item["refund_pct"] == 100

        refund_resp = pg_client.post(
            "/v1/rewards/refund",
            json={"inventory_id": item["inventory_id"]},
            headers=_user_headers(pg_client),
        )
        assert refund_resp.status_code == 200
        assert refund_resp.json()["balance"]["sunlight"] == balance_before
    finally:
        _delete_user_state(pg_client.user_id)


def test_refund_after_24h_returns_half(pg_client):
    _seed_daily_goal(pg_client.user_id, target_minutes=600)
    try:
        spend_resp = pg_client.post(
            "/v1/rewards/spend",
            json={"item_key": "lantern_path"},
            headers=_user_headers(pg_client),
        )
        assert spend_resp.status_code == 200

        # Backdate the inventory row so the refund is in the half-back window.
        engine = create_engine(
            os.environ["DETOX_TEST_DATABASE_URL"], future=True
        )
        with engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE inventory SET acquired_at = now() - interval '2 days' "
                    "WHERE user_id = :u"
                ),
                {"u": pg_client.user_id},
            )
        engine.dispose()

        inv = pg_client.get(
            "/v1/rewards/inventory", headers=_user_headers(pg_client)
        ).json()
        item = next(i for i in inv if i["item_key"] == "lantern_path")
        assert item["refund_pct"] == 50
        assert item["refund_amount"] == 15

        refund_resp = pg_client.post(
            "/v1/rewards/refund",
            json={"inventory_id": item["inventory_id"]},
            headers=_user_headers(pg_client),
        )
        assert refund_resp.status_code == 200
    finally:
        _delete_user_state(pg_client.user_id)


def test_refund_rejects_double_refund(pg_client):
    _seed_daily_goal(pg_client.user_id, target_minutes=600)
    try:
        pg_client.post(
            "/v1/rewards/spend",
            json={"item_key": "lantern_path"},
            headers=_user_headers(pg_client),
        )
        inv = pg_client.get(
            "/v1/rewards/inventory", headers=_user_headers(pg_client)
        ).json()
        inventory_id = inv[0]["inventory_id"]

        first = pg_client.post(
            "/v1/rewards/refund",
            json={"inventory_id": inventory_id},
            headers=_user_headers(pg_client),
        )
        assert first.status_code == 200

        second = pg_client.post(
            "/v1/rewards/refund",
            json={"inventory_id": inventory_id},
            headers=_user_headers(pg_client),
        )
        assert second.status_code in (404, 409)
    finally:
        _delete_user_state(pg_client.user_id)


def test_inventory_hides_refunded_items(pg_client):
    _seed_daily_goal(pg_client.user_id, target_minutes=600)
    try:
        pg_client.post(
            "/v1/rewards/spend",
            json={"item_key": "lantern_path"},
            headers=_user_headers(pg_client),
        )
        inv = pg_client.get(
            "/v1/rewards/inventory", headers=_user_headers(pg_client)
        ).json()
        inventory_id = inv[0]["inventory_id"]

        pg_client.post(
            "/v1/rewards/refund",
            json={"inventory_id": inventory_id},
            headers=_user_headers(pg_client),
        )

        after = pg_client.get(
            "/v1/rewards/inventory", headers=_user_headers(pg_client)
        ).json()
        assert all(item["item_key"] != "lantern_path" for item in after)
    finally:
        _delete_user_state(pg_client.user_id)


def test_concurrent_spend_only_one_succeeds(pg_client):
    """Two parallel spends from the same user must not both succeed.

    The row lock on ``rewards_balances`` plus the ``inventory`` partial unique
    index together guarantee only one transaction wins.
    """
    import threading

    _seed_daily_goal(pg_client.user_id, target_minutes=600)
    try:
        results: list[int] = []
        barrier = threading.Barrier(2)

        def attempt() -> None:
            barrier.wait()
            resp = pg_client.post(
                "/v1/rewards/spend",
                json={"item_key": "lantern_path"},
                headers=_user_headers(pg_client),
            )
            results.append(resp.status_code)

        threads = [threading.Thread(target=attempt) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert sorted(results) == [200, 409], results
    finally:
        _delete_user_state(pg_client.user_id)


def test_milestone_rollup_awards_streak_days(pg_client):
    """Three consecutive under-goal days → three streak_day milestones."""
    _seed_daily_goal(pg_client.user_id, target_minutes=120)
    today = datetime.now(tz=timezone.utc).date()
    days = [
        (today - timedelta(days=offset)).strftime("%Y-%m-%d")
        for offset in (3, 2, 1)
    ]
    for day in days:
        _seed_app_usage(
            pg_client.user_id, app_name="Slack", day=day, samples=600
        )  # 20 min — under 120 min goal

    try:
        # The agent posts an ingest; the rollup runs server-side.
        # Here we drive the service directly because no real device is paired.
        from sqlalchemy.orm import sessionmaker

        engine = create_engine(
            os.environ["DETOX_TEST_DATABASE_URL"], future=True
        )
        Session = sessionmaker(bind=engine, future=True)
        with Session() as session:
            session.execute(
                text(
                    f"SET LOCAL app.current_user_id = '{pg_client.user_id}'"
                )
            )
            inserts = rewards_service.run_milestone_rollup(
                session, user_id=pg_client.user_id
            )
            session.commit()
        engine.dispose()

        assert inserts >= 3

        body = pg_client.get(
            "/v1/milestones", headers=_user_headers(pg_client)
        ).json()
        kinds = [row["kind"] for row in body]
        assert kinds.count("streak_day") >= 3
    finally:
        _delete_user_state(pg_client.user_id)
