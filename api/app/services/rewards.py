"""Server-authoritative rewards ledger.

Phase 4 / spec §8 + §3.3. The agent stops trusting itself with currency:
the cloud computes Sunlight earned from ``app_usage`` + ``goals``, books
spends/refunds into ``rewards_ledger`` + ``inventory``, and rolls everything
up into ``rewards_balances`` so the agent's HUD reads a single row.

The rollup mirrors the algorithm that lived in ``agent/database.py``:

* 1 ☀ for every minute today's daily-total stayed under the active
  ``daily_total`` goal.
* 1 ☀ for every minute an app stayed under its active ``app_limit`` goal.
* Daily cap of ``DAILY_CAP_SUNLIGHT`` per date (spec §3.3).
* Streak-day, clean-week, and milestone awards land in ``milestones`` —
  the Hall of Honor — with one ✦ each (more for named milestones).

Atomicity: every write is one transaction with ``SELECT ... FOR UPDATE`` on
the balances row, so two concurrent ``/v1/rewards/spend`` calls cannot both
succeed on the same balance.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.orm import Session

from agent.config import DAILY_CAP_SUNLIGHT, MARKET_CATALOG, POLL_INTERVAL

from ..errors import ApiError


REFUND_FULL_WINDOW_SECONDS: int = 24 * 60 * 60
MILESTONE_AWARDS: dict[int, tuple[str, int]] = {
    7: ("first_7_streak", 1),
    14: ("first_14_streak", 2),
    30: ("first_30_streak", 5),
}
USAGE_MINUTES_EXPR = f"COUNT(*) * {float(POLL_INTERVAL)} / 60.0"


class RewardError(ApiError):
    """Domain-specific reward error mapped to a 4xx status."""

    def __init__(self, code: str, *, status_code: int = 400) -> None:
        super().__init__(code, status_code=status_code)
        self.code = code


@dataclass(frozen=True)
class Balance:
    sunlight: int
    starshards: int
    sunlight_today: int
    sunlight_cap: int = DAILY_CAP_SUNLIGHT

    def as_dict(self) -> dict[str, int]:
        return {
            "sunlight": self.sunlight,
            "starshards": self.starshards,
            "sunlight_today": self.sunlight_today,
            "sunlight_cap": self.sunlight_cap,
        }


# ── Catalog helpers ──────────────────────────────────────────────────────


def _catalog() -> dict[str, dict]:
    return {item["key"]: dict(item) for item in MARKET_CATALOG}


def market_catalog() -> list[dict]:
    return [dict(item) for item in MARKET_CATALOG]


# ── Sunlight rollup (ports agent/database.py) ────────────────────────────


def _today() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")


def _date_range(start: str, end: str) -> Iterable[str]:
    current = datetime.strptime(start, "%Y-%m-%d").date()
    last = datetime.strptime(end, "%Y-%m-%d").date()
    while current <= last:
        yield current.strftime("%Y-%m-%d")
        current += timedelta(days=1)


def _active_daily_total_goal(session: Session, *, user_id: str) -> int | None:
    row = session.execute(
        text(
            "SELECT target_minutes FROM goals "
            "WHERE user_id = :user_id AND active = 1 AND type = 'daily_total' "
            "AND target_minutes IS NOT NULL "
            "ORDER BY id DESC LIMIT 1"
        ),
        {"user_id": user_id},
    ).first()
    return int(row[0]) if row else None


def _active_app_limits(session: Session, *, user_id: str) -> dict[str, int]:
    rows = session.execute(
        text(
            "SELECT app_name, MIN(target_minutes) AS target_minutes "
            "FROM goals "
            "WHERE user_id = :user_id AND active = 1 AND type = 'app_limit' "
            "AND app_name IS NOT NULL AND target_minutes IS NOT NULL "
            "GROUP BY app_name"
        ),
        {"user_id": user_id},
    ).all()
    return {row[0]: int(row[1]) for row in rows}


def _daily_usage_totals(session: Session, *, user_id: str) -> dict[str, float]:
    rows = session.execute(
        text(
            f"SELECT date, {USAGE_MINUTES_EXPR} AS minutes "
            "FROM app_usage WHERE user_id = :user_id GROUP BY date"
        ),
        {"user_id": user_id},
    ).all()
    return {row[0]: float(row[1] or 0) for row in rows}


def _app_usage_totals(
    session: Session, *, user_id: str, app_names: Iterable[str]
) -> dict[str, dict[str, float]]:
    names = list(app_names)
    if not names:
        return {}
    rows = session.execute(
        text(
            f"SELECT date, app_name, {USAGE_MINUTES_EXPR} AS minutes "
            "FROM app_usage WHERE user_id = :user_id AND app_name = ANY(:names) "
            "GROUP BY date, app_name"
        ),
        {"user_id": user_id, "names": names},
    ).all()
    out: dict[str, dict[str, float]] = {}
    for row in rows:
        out.setdefault(row[0], {})[row[1]] = float(row[2] or 0)
    return out


def _usage_bounds(session: Session, *, user_id: str) -> tuple[str | None, str | None]:
    row = session.execute(
        text(
            "SELECT MIN(date) AS first_date, MAX(date) AS last_date "
            "FROM app_usage WHERE user_id = :user_id"
        ),
        {"user_id": user_id},
    ).first()
    return (row[0], row[1]) if row else (None, None)


def _sunlight_for_date(
    day: str,
    daily_goal: int | None,
    app_limits: dict[str, int],
    daily_usage: dict[str, float],
    app_usage: dict[str, dict[str, float]],
) -> int:
    earned = 0
    if daily_goal is not None:
        earned += max(0, int(daily_goal - daily_usage.get(day, 0)))
    per_app = app_usage.get(day, {})
    for app_name, target in app_limits.items():
        earned += max(0, int(target - per_app.get(app_name, 0)))
    return min(earned, DAILY_CAP_SUNLIGHT)


def _sunlight_earnings(session: Session, *, user_id: str) -> tuple[int, int]:
    daily_goal = _active_daily_total_goal(session, user_id=user_id)
    app_limits = _active_app_limits(session, user_id=user_id)
    if daily_goal is None and not app_limits:
        return 0, 0

    today = _today()
    first_usage_date, _ = _usage_bounds(session, user_id=user_id)
    start = first_usage_date or today
    if start > today:
        start = today

    daily_usage = _daily_usage_totals(session, user_id=user_id)
    app_usage = _app_usage_totals(
        session, user_id=user_id, app_names=app_limits.keys()
    )
    earned_total = sum(
        _sunlight_for_date(day, daily_goal, app_limits, daily_usage, app_usage)
        for day in _date_range(start, today)
    )
    today_earned = _sunlight_for_date(
        today, daily_goal, app_limits, daily_usage, app_usage
    )
    return today_earned, earned_total


# ── Streaks + milestones ─────────────────────────────────────────────────


def _is_streak_day(day: str, daily_goal: int | None, daily_usage: dict[str, float]):
    if daily_goal is None:
        return None
    return daily_usage.get(day, 0) <= daily_goal


def _existing_milestone_keys(session: Session, *, user_id: str) -> set[str]:
    rows = session.execute(
        text(
            "SELECT kind, detail, awarded_for_date "
            "FROM milestones WHERE user_id = :user_id"
        ),
        {"user_id": user_id},
    ).all()
    return {f"{r[0]}|{r[1]}|{r[2]}" for r in rows}


def _milestone_already(existing: set[str], detail: str) -> bool:
    return any(key.startswith(f"milestone|{detail}|") for key in existing)


def _insert_milestone(
    session: Session,
    *,
    user_id: str,
    kind: str,
    detail: str,
    amount: int,
    awarded_for_date: str,
) -> bool:
    result = session.execute(
        text(
            "INSERT INTO milestones "
            "(user_id, kind, detail, currency, amount, awarded_for_date) "
            "VALUES (:user_id, :kind, :detail, 'starshard', :amount, :date) "
            "ON CONFLICT ON CONSTRAINT uq_milestones_user_kind_detail_date "
            "DO NOTHING"
        ),
        {
            "user_id": user_id,
            "kind": kind,
            "detail": detail,
            "amount": amount,
            "date": awarded_for_date,
        },
    )
    return (result.rowcount or 0) > 0


def _is_clean_week(week_start: str, streak_dates: set[str]) -> bool:
    start = datetime.strptime(week_start, "%Y-%m-%d").date()
    return all(
        (start + timedelta(days=i)).strftime("%Y-%m-%d") in streak_dates
        for i in range(7)
    )


def _is_clean_month(day: date, streak_dates: set[str]) -> bool:
    last_day = calendar.monthrange(day.year, day.month)[1]
    return all(
        day.replace(day=d).strftime("%Y-%m-%d") in streak_dates
        for d in range(1, last_day + 1)
    )


def run_milestone_rollup(session: Session, *, user_id: str) -> int:
    """Award streak/clean-week/milestone Starshards for finalized days.

    Returns the number of new milestone rows inserted. Idempotent: re-running
    on the same data writes zero rows because every milestone has a unique
    ``(user_id, kind, detail, awarded_for_date)`` constraint.
    """
    yesterday = (datetime.now(tz=timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    daily_goal = _active_daily_total_goal(session, user_id=user_id)
    if daily_goal is None:
        return 0
    first_usage_date, _ = _usage_bounds(session, user_id=user_id)
    if not first_usage_date:
        return 0
    if first_usage_date > yesterday:
        return 0

    daily_usage = _daily_usage_totals(session, user_id=user_id)
    existing = _existing_milestone_keys(session, user_id=user_id)
    streak_dates: set[str] = {
        key.split("|", 2)[1]  # detail field doubles as the date for streak_day
        for key in existing
        if key.startswith("streak_day|")
    }

    streak_length = 0
    inserts = 0
    for day in _date_range(first_usage_date, yesterday):
        status = _is_streak_day(day, daily_goal, daily_usage)
        if status is True:
            streak_length += 1
            if _insert_milestone(
                session,
                user_id=user_id,
                kind="streak_day",
                detail=day,
                amount=1,
                awarded_for_date=day,
            ):
                inserts += 1
                streak_dates.add(day)

            for threshold, (key, amount) in MILESTONE_AWARDS.items():
                if streak_length >= threshold and not _milestone_already(existing, key):
                    if _insert_milestone(
                        session,
                        user_id=user_id,
                        kind="milestone",
                        detail=key,
                        amount=amount,
                        awarded_for_date=day,
                    ):
                        inserts += 1
                        existing.add(f"milestone|{key}|{day}")
        elif status is False:
            streak_length = 0

        day_obj = datetime.strptime(day, "%Y-%m-%d").date()
        if day_obj.weekday() == 6:
            week_start = (day_obj - timedelta(days=6)).strftime("%Y-%m-%d")
            if _is_clean_week(week_start, streak_dates):
                if _insert_milestone(
                    session,
                    user_id=user_id,
                    kind="clean_week",
                    detail=f"Week of {week_start}",
                    amount=3,
                    awarded_for_date=day,
                ):
                    inserts += 1

        if day_obj.day == calendar.monthrange(day_obj.year, day_obj.month)[1]:
            if not _milestone_already(existing, "first_clean_month") and _is_clean_month(
                day_obj, streak_dates
            ):
                if _insert_milestone(
                    session,
                    user_id=user_id,
                    kind="milestone",
                    detail="first_clean_month",
                    amount=5,
                    awarded_for_date=day,
                ):
                    inserts += 1
                    existing.add(f"milestone|first_clean_month|{day}")

    return inserts


# ── Ledger / balance rollup ──────────────────────────────────────────────


def _ledger_totals(session: Session, *, user_id: str) -> dict[tuple[str, str], int]:
    totals = {
        ("spend", "sunlight"): 0,
        ("refund", "sunlight"): 0,
        ("spend", "starshard"): 0,
        ("refund", "starshard"): 0,
    }
    rows = session.execute(
        text(
            "SELECT kind, currency, COALESCE(SUM(amount), 0) AS amount "
            "FROM rewards_ledger WHERE user_id = :user_id GROUP BY kind, currency"
        ),
        {"user_id": user_id},
    ).all()
    for row in rows:
        totals[(row[0], row[1])] = int(row[2] or 0)
    return totals


def _starshards_earned(session: Session, *, user_id: str) -> int:
    row = session.execute(
        text(
            "SELECT COALESCE(SUM(amount), 0) FROM milestones "
            "WHERE user_id = :user_id AND currency = 'starshard'"
        ),
        {"user_id": user_id},
    ).first()
    return int(row[0] or 0) if row else 0


def recompute_balances(session: Session, *, user_id: str) -> Balance:
    """Recompute and persist the balance snapshot.

    Called from ``/v1/ingest`` (day boundary), the daily cron, and lazily
    by ``/v1/rewards/balances``. Holds a row lock on ``rewards_balances`` so
    a concurrent spend can't race the recompute.
    """
    sunlight_today, sunlight_lifetime = _sunlight_earnings(session, user_id=user_id)
    ledger = _ledger_totals(session, user_id=user_id)
    starshards_earned = _starshards_earned(session, user_id=user_id)

    sunlight_balance = max(
        0,
        sunlight_lifetime
        - ledger[("spend", "sunlight")]
        + ledger[("refund", "sunlight")],
    )
    starshards_balance = max(
        0,
        starshards_earned
        - ledger[("spend", "starshard")]
        + ledger[("refund", "starshard")],
    )

    today = _today()
    session.execute(
        text(
            "INSERT INTO rewards_balances "
            "(user_id, sunlight_total, starshards_total, daily_earned, "
            " daily_earn_date, last_earn_at, updated_at) "
            "VALUES (:uid, :sun, :star, :daily, :date, now(), now()) "
            "ON CONFLICT (user_id) DO UPDATE SET "
            "  sunlight_total = EXCLUDED.sunlight_total, "
            "  starshards_total = EXCLUDED.starshards_total, "
            "  daily_earned = EXCLUDED.daily_earned, "
            "  daily_earn_date = EXCLUDED.daily_earn_date, "
            "  last_earn_at = EXCLUDED.last_earn_at, "
            "  updated_at = now()"
        ),
        {
            "uid": user_id,
            "sun": int(sunlight_balance),
            "star": int(starshards_balance),
            "daily": int(sunlight_today),
            "date": today,
        },
    )

    return Balance(
        sunlight=int(sunlight_balance),
        starshards=int(starshards_balance),
        sunlight_today=int(sunlight_today),
    )


def _lock_balance_row(session: Session, *, user_id: str) -> None:
    """Acquire a row lock on the user's balance row, creating it if absent.

    All spend/refund paths call this first so two concurrent transactions
    serialize on the balance update.
    """
    session.execute(
        text(
            "INSERT INTO rewards_balances (user_id) VALUES (:uid) "
            "ON CONFLICT (user_id) DO NOTHING"
        ),
        {"uid": user_id},
    )
    session.execute(
        text("SELECT user_id FROM rewards_balances WHERE user_id = :uid FOR UPDATE"),
        {"uid": user_id},
    )


def get_balances(session: Session, *, user_id: str) -> Balance:
    return recompute_balances(session, user_id=user_id)


# ── Spend / refund ───────────────────────────────────────────────────────


def _user_owns_active(session: Session, *, user_id: str, item_key: str) -> bool:
    row = session.execute(
        text(
            "SELECT 1 FROM inventory "
            "WHERE user_id = :uid AND item_key = :key AND refunded = false "
            "LIMIT 1"
        ),
        {"uid": user_id, "key": item_key},
    ).first()
    return row is not None


def spend_item(session: Session, *, user_id: str, item_key: str) -> Balance:
    catalog = _catalog()
    item = catalog.get(item_key)
    if not item:
        raise RewardError("unknown_item", status_code=404)

    _lock_balance_row(session, user_id=user_id)

    if _user_owns_active(session, user_id=user_id, item_key=item_key):
        raise RewardError("already_owned", status_code=409)

    balance = recompute_balances(session, user_id=user_id)
    balance_field = "sunlight" if item["currency"] == "sunlight" else "starshards"
    have = getattr(balance, balance_field)
    if have < int(item["price"]):
        raise RewardError("insufficient_funds", status_code=409)

    now = datetime.now(tz=timezone.utc).timestamp()
    session.execute(
        text(
            "INSERT INTO rewards_ledger "
            "(user_id, kind, currency, amount, item_key, spend_id, created_at) "
            "VALUES (:uid, 'spend', :cur, :amt, :key, NULL, :ts)"
        ),
        {
            "uid": user_id,
            "cur": item["currency"],
            "amt": int(item["price"]),
            "key": item_key,
            "ts": now,
        },
    )
    session.execute(
        text(
            "INSERT INTO inventory "
            "(user_id, item_key, currency, price, acquired_at) "
            "VALUES (:uid, :key, :cur, :price, now())"
        ),
        {
            "uid": user_id,
            "key": item_key,
            "cur": item["currency"],
            "price": int(item["price"]),
        },
    )
    return recompute_balances(session, user_id=user_id)


def _refund_amount(
    acquired_at: datetime, original_price: int, *, now: datetime | None = None
) -> tuple[int, int]:
    now = now or datetime.now(tz=timezone.utc)
    elapsed = (now - acquired_at).total_seconds()
    if elapsed <= REFUND_FULL_WINDOW_SECONDS:
        return int(original_price), 100
    return int(original_price) // 2, 50


def refund_inventory(
    session: Session,
    *,
    user_id: str,
    inventory_id: str,
) -> Balance:
    _lock_balance_row(session, user_id=user_id)

    row = session.execute(
        text(
            "SELECT id, item_key, currency, price, acquired_at, refunded "
            "FROM inventory "
            "WHERE id = :iid AND user_id = :uid "
            "FOR UPDATE"
        ),
        {"iid": inventory_id, "uid": user_id},
    ).first()
    if not row:
        raise RewardError("unknown_inventory", status_code=404)
    if row[5]:
        raise RewardError("already_refunded", status_code=409)

    refund, _pct = _refund_amount(row[4], int(row[3]))
    now_ts = datetime.now(tz=timezone.utc).timestamp()

    session.execute(
        text(
            "INSERT INTO rewards_ledger "
            "(user_id, kind, currency, amount, item_key, spend_id, created_at) "
            "VALUES (:uid, 'refund', :cur, :amt, :key, NULL, :ts)"
        ),
        {
            "uid": user_id,
            "cur": row[2],
            "amt": refund,
            "key": row[1],
            "ts": now_ts,
        },
    )
    session.execute(
        text(
            "UPDATE inventory "
            "SET refunded = true, refunded_at = now(), refund_amount = :amt "
            "WHERE id = :iid AND user_id = :uid"
        ),
        {"iid": inventory_id, "uid": user_id, "amt": refund},
    )
    return recompute_balances(session, user_id=user_id)


# ── Read models ──────────────────────────────────────────────────────────


def list_inventory(session: Session, *, user_id: str) -> list[dict]:
    catalog = _catalog()
    rows = session.execute(
        text(
            "SELECT id, item_key, currency, price, acquired_at, refunded, "
            "       refunded_at, refund_amount "
            "FROM inventory "
            "WHERE user_id = :uid AND refunded = false "
            "ORDER BY acquired_at DESC"
        ),
        {"uid": user_id},
    ).all()
    out = []
    for row in rows:
        meta = catalog.get(row[1], {})
        refund, pct = _refund_amount(row[4], int(row[3]))
        out.append(
            {
                "inventory_id": str(row[0]),
                "item_key": row[1],
                "name": meta.get("name", row[1]),
                "currency": row[2],
                "price": int(row[3]),
                "acquired_at": row[4].isoformat() if row[4] else None,
                "refund_amount": refund,
                "refund_pct": pct,
            }
        )
    return out


def list_milestones(session: Session, *, user_id: str) -> list[dict]:
    rows = session.execute(
        text(
            "SELECT id, kind, detail, currency, amount, awarded_for_date, awarded_at "
            "FROM milestones WHERE user_id = :user_id "
            "ORDER BY awarded_at DESC, id DESC"
        ),
        {"user_id": user_id},
    ).all()
    return [
        {
            "id": str(row[0]),
            "kind": row[1],
            "detail": row[2],
            "currency": row[3],
            "amount": int(row[4]),
            "awarded_for_date": row[5],
            "awarded_at": row[6].isoformat() if row[6] else None,
        }
        for row in rows
    ]


def get_catalog() -> list[dict]:
    return market_catalog()
