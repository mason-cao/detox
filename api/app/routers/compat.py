"""Postgres-backed parity routes for the deployed dashboard.

These mirror the Flask agent's read-side endpoints that the local Isle
dashboard expects: ``/api/dashboard/now``, ``/api/changelog``,
``/api/stats/{daily,weekly}``, ``/api/status``, ``/api/rewards/*``, and
the market catalog. Writes that don't make sense on the cloud (focus
mode toggles, cards generation) return graceful no-ops or 501 stubs.
"""

from __future__ import annotations

import time
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from agent.config import (
    CHANGELOG_ENTRIES,
    MARKET_CATALOG,
    POLL_INTERVAL,
    SESSION_GAP_THRESHOLD,
)

from ..db import db_session
from ..dependencies import api_request_setup
from ..errors import ApiError
from ..services import rewards as rewards_service
from ..validation import (
    require_json_object,
    require_text,
    validate_date,
)


router = APIRouter(
    prefix="/api",
    tags=["compat"],
    dependencies=[Depends(api_request_setup)],
)


# ── Dashboard auxiliaries ────────────────────────────────────────────


@router.get("/dashboard/now", summary="Latest tracked app for the user")
async def dashboard_now(session: Session = Depends(db_session)) -> dict[str, object]:
    row = session.execute(
        text(
            "SELECT app_name, timestamp FROM app_usage "
            "ORDER BY timestamp DESC LIMIT 1"
        )
    ).one_or_none()
    if row is None:
        return {"app_name": None, "since_unix": None}
    return {"app_name": row.app_name, "since_unix": int(row.timestamp)}


@router.get("/changelog", summary="What's-new entries")
async def changelog() -> list[dict]:
    return [dict(entry) for entry in CHANGELOG_ENTRIES]


@router.get("/status", summary="Cloud agent status (always running)")
async def status() -> dict[str, object]:
    return {
        "running": True,
        "paused": False,
        "last_poll_at": int(time.time()),
        "permission_denied": False,
    }


# ── Statistics ───────────────────────────────────────────────────────


def _daily_total(session: Session, date: str) -> float:
    row = session.execute(
        text(
            f"SELECT COUNT(*) * {float(POLL_INTERVAL)} / 60.0 AS minutes "
            "FROM app_usage WHERE date = :d"
        ),
        {"d": date},
    ).one()
    return round(float(row[0] or 0), 1)


@router.get("/stats/daily", summary="Daily statistics")
async def stats_daily(
    date: str | None = Query(default=None),
    session: Session = Depends(db_session),
) -> dict[str, object]:
    selected = validate_date(date or datetime.now().strftime("%Y-%m-%d"))

    pickup_rows = session.execute(
        text("SELECT timestamp FROM pickups WHERE date = :d ORDER BY timestamp"),
        {"d": selected},
    ).all()
    pickups = len(pickup_rows)
    first_pickup = (
        datetime.fromtimestamp(pickup_rows[0].timestamp).strftime("%I:%M %p")
        if pickups
        else None
    )
    last_pickup = (
        datetime.fromtimestamp(pickup_rows[-1].timestamp).strftime("%I:%M %p")
        if pickups
        else None
    )

    total_minutes = _daily_total(session, selected)
    checking_every = (
        round(total_minutes / pickups, 0) if pickups and total_minutes else 0
    )

    usage_rows = session.execute(
        text(
            "SELECT timestamp, app_name FROM app_usage "
            "WHERE date = :d ORDER BY timestamp"
        ),
        {"d": selected},
    ).all()

    longest_session = 0.0
    longest_detox = 0.0
    most_used: dict[str, float] = {}
    run_start = None
    previous_timestamp = None

    for row in usage_rows:
        ts = float(row.timestamp)
        app = row.app_name
        most_used[app] = most_used.get(app, 0.0) + POLL_INTERVAL

        if run_start is None:
            run_start = ts
        elif previous_timestamp is not None:
            gap = ts - previous_timestamp
            if gap > SESSION_GAP_THRESHOLD:
                longest_session = max(
                    longest_session,
                    previous_timestamp - run_start + POLL_INTERVAL,
                )
                run_start = ts
                if gap > longest_detox:
                    longest_detox = gap
        previous_timestamp = ts

    if run_start is not None and previous_timestamp is not None:
        longest_session = max(
            longest_session,
            previous_timestamp - run_start + POLL_INTERVAL,
        )

    most_used_app = max(most_used, key=most_used.get) if most_used else None

    return {
        "pickups_count": pickups,
        "checking_every_minutes": int(checking_every),
        "longest_detox_minutes": round(longest_detox / 60, 0),
        "continuous_use_minutes": round(longest_session / 60, 0),
        "first_pickup": first_pickup,
        "last_pickup": last_pickup,
        "most_used_app": most_used_app,
        "total_minutes": total_minutes,
    }


@router.get("/stats/weekly", summary="Weekly statistics")
async def stats_weekly(
    week_start: str | None = Query(default=None),
    session: Session = Depends(db_session),
) -> dict[str, object]:
    from datetime import timedelta

    if week_start is None:
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        selected = monday.strftime("%Y-%m-%d")
    else:
        selected = validate_date(week_start, "week_start")

    start = datetime.strptime(selected, "%Y-%m-%d")
    days = []
    for i in range(7):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        days.append({"date": d, "minutes": _daily_total(session, d)})
    totals = [d["minutes"] for d in days]
    return {
        "days": days,
        "weekly_total": round(sum(totals), 1),
        "daily_average": round(sum(totals) / len(totals), 1) if totals else 0,
        "shortest_day": round(min(totals), 1) if totals else 0,
        "longest_day": round(max(totals), 1) if totals else 0,
    }


# ── Rewards (read) ───────────────────────────────────────────────────


@router.get("/rewards/balance", summary="Current sunlight + starshard balance")
async def rewards_balance(
    request: Request,
    session: Session = Depends(db_session),
) -> dict:
    balance = rewards_service.get_balances(session, user_id=request.state.user_id)
    return balance.as_dict()


@router.get("/rewards/awards", summary="Milestone history")
async def rewards_awards(
    request: Request,
    session: Session = Depends(db_session),
) -> list[dict]:
    return rewards_service.list_milestones(session, user_id=request.state.user_id)


# ── Market (catalog + inventory) ──────────────────────────────────────


@router.get("/market/catalog", summary="Static market catalog")
async def market_catalog() -> list[dict]:
    return [dict(item) for item in MARKET_CATALOG]


@router.get("/market/inventory", summary="Owned market items")
async def market_inventory(
    request: Request,
    session: Session = Depends(db_session),
) -> list[dict]:
    return rewards_service.list_inventory(
        session, user_id=request.state.user_id
    )


@router.post("/market/buy", summary="Spend on a market item")
async def market_buy(
    request: Request,
    session: Session = Depends(db_session),
) -> dict[str, object]:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)
    item_key = require_text(body, "item_key")
    balance = rewards_service.spend_item(
        session, user_id=request.state.user_id, item_key=item_key
    )
    return {"balance": balance.as_dict()}


@router.post("/market/refund", summary="Refund a previously-bought item")
async def market_refund(
    request: Request,
    session: Session = Depends(db_session),
) -> dict[str, object]:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)
    inventory_id = require_text(body, "inventory_id")
    balance = rewards_service.refund_inventory(
        session, user_id=request.state.user_id, inventory_id=inventory_id
    )
    return {"balance": balance.as_dict()}


# ── Focus mode + cards (cloud no-ops) ────────────────────────────────


@router.post("/focus-mode/enable", summary="Cloud no-op")
async def focus_mode_enable() -> dict[str, bool]:
    return {"ok": True}


@router.post("/focus-mode/disable", summary="Cloud no-op")
async def focus_mode_disable() -> dict[str, bool]:
    return {"ok": True}


@router.post("/cards/generate", summary="Card generation not available on cloud")
async def cards_generate() -> dict[str, str]:
    raise ApiError("card generation only runs on the local agent", status_code=501)
