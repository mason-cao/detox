import sqlite3
import time
import calendar
from datetime import datetime, timedelta
from contextlib import contextmanager
from agent.config import (
    DB_PATH,
    DAILY_CAP_SUNLIGHT,
    DEFAULT_CATEGORIES,
    DEFAULT_SETTINGS,
    FOCUS_MODE_RECOVERY_APPS,
    MARKET_CATALOG,
    POLL_INTERVAL,
    SESSION_GAP_THRESHOLD,
)


USAGE_MINUTES_SQL = f"COUNT(*) * {float(POLL_INTERVAL)} / 60.0"


class RewardError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS app_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_name TEXT NOT NULL,
                timestamp REAL NOT NULL,
                date TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_app_usage_date ON app_usage(date);
            CREATE INDEX IF NOT EXISTS idx_app_usage_app_date ON app_usage(app_name, date);

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_name TEXT NOT NULL,
                start_time REAL NOT NULL,
                end_time REAL NOT NULL,
                duration_seconds REAL NOT NULL,
                date TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
            CREATE INDEX IF NOT EXISTS idx_sessions_app_date ON sessions(app_name, date);

            CREATE TABLE IF NOT EXISTS pickups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                date TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_pickups_date ON pickups(date);

            CREATE TABLE IF NOT EXISTS app_categories (
                app_name TEXT PRIMARY KEY,
                category TEXT NOT NULL DEFAULT 'Uncategorized'
            );

            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                target_minutes INTEGER,
                app_name TEXT,
                bedtime_hour INTEGER,
                bedtime_minute INTEGER,
                active INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS app_blocks (
                app_name TEXT PRIMARY KEY,
                block_type TEXT NOT NULL DEFAULT 'blocked',
                daily_limit_minutes INTEGER
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS rewards_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL CHECK (kind IN ('spend', 'refund')),
                currency TEXT NOT NULL CHECK (currency IN ('sunlight', 'starshard')),
                amount INTEGER NOT NULL,
                item_key TEXT NOT NULL,
                spend_id INTEGER,
                created_at REAL NOT NULL,
                FOREIGN KEY (spend_id) REFERENCES rewards_ledger(id)
            );

            CREATE INDEX IF NOT EXISTS idx_rewards_ledger_kind ON rewards_ledger(kind);
            CREATE INDEX IF NOT EXISTS idx_rewards_ledger_item ON rewards_ledger(item_key);

            CREATE TABLE IF NOT EXISTS rewards_awards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL CHECK (kind IN ('streak_day', 'clean_week', 'milestone')),
                detail TEXT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'starshard',
                amount INTEGER NOT NULL,
                awarded_for_date TEXT NOT NULL,
                awarded_at REAL NOT NULL,
                UNIQUE (kind, detail, awarded_for_date)
            );

            CREATE INDEX IF NOT EXISTS idx_rewards_awards_date ON rewards_awards(awarded_for_date);
        """)

        # Seed default categories
        for app_name, category in DEFAULT_CATEGORIES.items():
            conn.execute(
                "INSERT OR IGNORE INTO app_categories (app_name, category) VALUES (?, ?)",
                (app_name, category),
            )

        # Seed default settings without overwriting user preferences.
        for key, value in DEFAULT_SETTINGS.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (key, value),
            )


# ── Usage recording ──────────────────────────────────────────────────────

def record_usage(app_name, timestamp=None):
    if timestamp is None:
        timestamp = time.time()
    date = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")
    with get_db() as conn:
        conn.execute(
            "INSERT INTO app_usage (app_name, timestamp, date) VALUES (?, ?, ?)",
            (app_name, timestamp, date),
        )


def record_session(app_name, start_time, end_time):
    duration = end_time - start_time
    if duration < 1:
        return
    date = datetime.fromtimestamp(start_time).strftime("%Y-%m-%d")
    with get_db() as conn:
        conn.execute(
            "INSERT INTO sessions (app_name, start_time, end_time, duration_seconds, date) VALUES (?, ?, ?, ?, ?)",
            (app_name, start_time, end_time, duration, date),
        )


def record_pickup(timestamp=None):
    if timestamp is None:
        timestamp = time.time()
    date = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")
    with get_db() as conn:
        conn.execute(
            "INSERT INTO pickups (timestamp, date) VALUES (?, ?)",
            (timestamp, date),
        )


# ── Dashboard queries ────────────────────────────────────────────────────

def get_daily_usage(date):
    """Get total usage per app for a given date in minutes."""
    with get_db() as conn:
        rows = conn.execute(
            f"""SELECT u.app_name, {USAGE_MINUTES_SQL} as minutes,
                      COALESCE(c.category, 'Uncategorized') as category
               FROM app_usage u
               LEFT JOIN app_categories c ON u.app_name = c.app_name
               WHERE u.date = ?
               GROUP BY u.app_name ORDER BY minutes DESC""",
            (date,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_hourly_breakdown(date):
    """Get usage per hour for a given date."""
    with get_db() as conn:
        rows = conn.execute(
            f"""SELECT CAST(strftime('%H', timestamp, 'unixepoch', 'localtime') AS INTEGER) as hour,
                      {USAGE_MINUTES_SQL} as minutes
               FROM app_usage WHERE date = ?
               GROUP BY hour ORDER BY hour""",
            (date,),
        ).fetchall()
        result = {i: 0 for i in range(24)}
        for r in rows:
            result[r["hour"]] = round(r["minutes"], 1)
        return result


def get_daily_total(date):
    """Get total screen time in minutes for a date."""
    with get_db() as conn:
        row = conn.execute(
            f"SELECT {USAGE_MINUTES_SQL} as minutes FROM app_usage WHERE date = ?",
            (date,),
        ).fetchone()
        return round(row["minutes"], 1) if row else 0


def get_weekly_data(week_start):
    """Get daily totals for a 7-day week starting from week_start."""
    start = datetime.strptime(week_start, "%Y-%m-%d")
    days = []
    for i in range(7):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        total = get_daily_total(d)
        days.append({"date": d, "minutes": total})
    totals = [d["minutes"] for d in days]
    return {
        "days": days,
        "weekly_total": round(sum(d["minutes"] for d in days), 1),
        "daily_average": round(sum(totals) / len(totals), 1) if totals else 0,
        "shortest_day": round(min(totals), 1) if totals else 0,
        "longest_day": round(max(totals), 1) if totals else 0,
    }


def get_category_breakdown(date):
    """Get usage per category for a given date."""
    with get_db() as conn:
        rows = conn.execute(
            f"""SELECT COALESCE(c.category, 'Uncategorized') as category,
                      {USAGE_MINUTES_SQL} as minutes
               FROM app_usage u
               LEFT JOIN app_categories c ON u.app_name = c.app_name
               WHERE u.date = ?
               GROUP BY category ORDER BY minutes DESC""",
            (date,),
        ).fetchall()
        return [dict(r) for r in rows]


# ── Statistics queries ───────────────────────────────────────────────────

def get_daily_stats(date):
    """Get detailed daily statistics."""
    with get_db() as conn:
        # Pickups
        pickups = conn.execute(
            "SELECT COUNT(*) as count FROM pickups WHERE date = ?", (date,)
        ).fetchone()["count"]

        # Pickup times
        pickup_rows = conn.execute(
            "SELECT timestamp FROM pickups WHERE date = ? ORDER BY timestamp",
            (date,),
        ).fetchall()

        first_pickup = None
        last_pickup = None
        if pickup_rows:
            first_pickup = datetime.fromtimestamp(pickup_rows[0]["timestamp"]).strftime("%I:%M %p")
            last_pickup = datetime.fromtimestamp(pickup_rows[-1]["timestamp"]).strftime("%I:%M %p")

        # Total usage
        total_minutes = get_daily_total(date)

        # Checking frequency
        checking_every = 0
        if pickups > 0 and total_minutes > 0:
            checking_every = round(total_minutes / pickups, 0)

        # Raw usage samples include the currently active session, unlike
        # closed session rows which are only written on app changes/shutdown.
        usage_rows = conn.execute(
            """SELECT timestamp, app_name
               FROM app_usage WHERE date = ?
               ORDER BY timestamp""",
            (date,),
        ).fetchall()

        longest_session = 0
        longest_detox = 0
        most_used = {}
        run_start = None
        previous_timestamp = None

        for row in usage_rows:
            timestamp = row["timestamp"]
            app = row["app_name"]
            most_used[app] = most_used.get(app, 0) + POLL_INTERVAL

            if run_start is None:
                run_start = timestamp
            elif previous_timestamp is not None:
                gap = timestamp - previous_timestamp
                if gap > SESSION_GAP_THRESHOLD:
                    longest_session = max(
                        longest_session,
                        previous_timestamp - run_start + POLL_INTERVAL,
                    )
                    run_start = timestamp
                    if gap > longest_detox:
                        longest_detox = gap

            previous_timestamp = timestamp

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


def get_weekly_stats(week_start):
    """Get weekly statistics."""
    return get_weekly_data(week_start)


# ── Rewards and market ─────────────────────────────────────────────────

REFUND_FULL_WINDOW_SECONDS = 24 * 60 * 60
MILESTONE_AWARDS = {
    7: ("first_7_streak", 1),
    14: ("first_14_streak", 2),
    30: ("first_30_streak", 5),
}


def _today_str():
    return datetime.now().strftime("%Y-%m-%d")


def _date_from_str(value):
    return datetime.strptime(value, "%Y-%m-%d").date()


def _date_range(start, end):
    current = _date_from_str(start)
    end_date = _date_from_str(end)
    while current <= end_date:
        yield current.strftime("%Y-%m-%d")
        current += timedelta(days=1)


def _catalog_by_key():
    return {item["key"]: dict(item) for item in MARKET_CATALOG}


def get_market_catalog():
    return [dict(item) for item in MARKET_CATALOG]


def _get_active_daily_total_goal(conn):
    row = conn.execute(
        """SELECT target_minutes FROM goals
           WHERE active = 1
             AND type = 'daily_total'
             AND target_minutes IS NOT NULL
           ORDER BY id DESC
           LIMIT 1"""
    ).fetchone()
    return int(row["target_minutes"]) if row else None


def _get_active_app_limits(conn):
    rows = conn.execute(
        """SELECT app_name, MIN(target_minutes) as target_minutes
           FROM goals
           WHERE active = 1
             AND type = 'app_limit'
             AND app_name IS NOT NULL
             AND target_minutes IS NOT NULL
           GROUP BY app_name"""
    ).fetchall()
    return {r["app_name"]: int(r["target_minutes"]) for r in rows}


def _usage_bounds(conn):
    row = conn.execute(
        "SELECT MIN(date) as first_date, MAX(date) as last_date FROM app_usage"
    ).fetchone()
    return row["first_date"], row["last_date"]


def _daily_usage_totals(conn):
    rows = conn.execute(
        f"""SELECT date, {USAGE_MINUTES_SQL} as minutes
           FROM app_usage
           GROUP BY date"""
    ).fetchall()
    return {r["date"]: float(r["minutes"] or 0) for r in rows}


def _app_usage_totals(conn, app_names):
    if not app_names:
        return {}
    placeholders = ", ".join("?" for _ in app_names)
    rows = conn.execute(
        f"""SELECT date, app_name, {USAGE_MINUTES_SQL} as minutes
           FROM app_usage
           WHERE app_name IN ({placeholders})
           GROUP BY date, app_name""",
        tuple(app_names),
    ).fetchall()
    result = {}
    for row in rows:
        result.setdefault(row["date"], {})[row["app_name"]] = float(row["minutes"] or 0)
    return result


def _sunlight_for_date(date, daily_goal, app_limits, daily_usage, app_usage):
    earned = 0
    if daily_goal is not None:
        earned += max(0, int(daily_goal - daily_usage.get(date, 0)))

    per_app_usage = app_usage.get(date, {})
    for app_name, target_minutes in app_limits.items():
        earned += max(0, int(target_minutes - per_app_usage.get(app_name, 0)))

    return min(earned, DAILY_CAP_SUNLIGHT)


def _sunlight_earnings(conn):
    daily_goal = _get_active_daily_total_goal(conn)
    app_limits = _get_active_app_limits(conn)
    if daily_goal is None and not app_limits:
        return 0, 0

    today = _today_str()
    first_usage_date, _ = _usage_bounds(conn)
    start_date = first_usage_date or today
    if start_date > today:
        start_date = today

    daily_usage = _daily_usage_totals(conn)
    app_usage = _app_usage_totals(conn, app_limits.keys())
    earned_by_day = [
        _sunlight_for_date(date, daily_goal, app_limits, daily_usage, app_usage)
        for date in _date_range(start_date, today)
    ]
    sunlight_today = _sunlight_for_date(today, daily_goal, app_limits, daily_usage, app_usage)
    return sunlight_today, sum(earned_by_day)


def _ledger_totals(conn):
    totals = {
        ("spend", "sunlight"): 0,
        ("refund", "sunlight"): 0,
        ("spend", "starshard"): 0,
        ("refund", "starshard"): 0,
    }
    rows = conn.execute(
        """SELECT kind, currency, COALESCE(SUM(amount), 0) as amount
           FROM rewards_ledger
           GROUP BY kind, currency"""
    ).fetchall()
    for row in rows:
        totals[(row["kind"], row["currency"])] = int(row["amount"] or 0)
    return totals


def _rewards_balance(conn):
    sunlight_today, sunlight_lifetime = _sunlight_earnings(conn)
    ledger = _ledger_totals(conn)
    award_row = conn.execute(
        """SELECT COALESCE(SUM(amount), 0) as amount
           FROM rewards_awards
           WHERE currency = 'starshard'"""
    ).fetchone()
    starshards_earned = int(award_row["amount"] or 0)

    return {
        "sunlight": int(
            sunlight_lifetime
            - ledger[("spend", "sunlight")]
            + ledger[("refund", "sunlight")]
        ),
        "sunlight_today": int(sunlight_today),
        "sunlight_cap": DAILY_CAP_SUNLIGHT,
        "starshards": int(
            starshards_earned
            - ledger[("spend", "starshard")]
            + ledger[("refund", "starshard")]
        ),
    }


def get_rewards_balance():
    with get_db() as conn:
        return _rewards_balance(conn)


def _is_streak_day(date, daily_goal, daily_usage):
    if daily_goal is None:
        return None
    return daily_usage.get(date, 0) <= daily_goal


def _insert_award(conn, kind, detail, amount, awarded_for_date):
    conn.execute(
        """INSERT OR IGNORE INTO rewards_awards
           (kind, detail, currency, amount, awarded_for_date, awarded_at)
           VALUES (?, ?, 'starshard', ?, ?, ?)""",
        (kind, detail, amount, awarded_for_date, time.time()),
    )


def _milestone_awarded(conn, detail):
    row = conn.execute(
        "SELECT 1 FROM rewards_awards WHERE kind = 'milestone' AND detail = ? LIMIT 1",
        (detail,),
    ).fetchone()
    return row is not None


def _streak_award_dates(conn):
    rows = conn.execute(
        "SELECT awarded_for_date FROM rewards_awards WHERE kind = 'streak_day'"
    ).fetchall()
    return {row["awarded_for_date"] for row in rows}


def _baseline_streak_length(first_date, day_before_start, daily_goal, daily_usage):
    if not first_date or first_date > day_before_start:
        return 0

    streak_length = 0
    for date in _date_range(first_date, day_before_start):
        status = _is_streak_day(date, daily_goal, daily_usage)
        if status is True:
            streak_length += 1
        elif status is False:
            streak_length = 0
    return streak_length


def _is_clean_week(week_start, streak_dates):
    start = _date_from_str(week_start)
    return all(
        (start + timedelta(days=i)).strftime("%Y-%m-%d") in streak_dates
        for i in range(7)
    )


def _is_clean_month(date_obj, streak_dates):
    days_in_month = calendar.monthrange(date_obj.year, date_obj.month)[1]
    return all(
        date_obj.replace(day=day).strftime("%Y-%m-%d") in streak_dates
        for day in range(1, days_in_month + 1)
    )


def run_rollup_if_needed():
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    with get_db() as conn:
        last_row = conn.execute(
            "SELECT value FROM settings WHERE key = 'last_rollup_date'"
        ).fetchone()
        first_usage_date, _ = _usage_bounds(conn)

        if last_row and last_row["value"]:
            start_date = (
                _date_from_str(last_row["value"]) + timedelta(days=1)
            ).strftime("%Y-%m-%d")
        else:
            if not first_usage_date:
                conn.execute(
                    "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_rollup_date', ?)",
                    (yesterday,),
                )
                return
            start_date = first_usage_date

        if start_date > yesterday:
            return

        daily_goal = _get_active_daily_total_goal(conn)
        if daily_goal is None:
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_rollup_date', ?)",
                (yesterday,),
            )
            return

        daily_usage = _daily_usage_totals(conn)
        streak_dates = _streak_award_dates(conn)
        day_before_start = (
            _date_from_str(start_date) - timedelta(days=1)
        ).strftime("%Y-%m-%d")
        streak_length = _baseline_streak_length(
            first_usage_date,
            day_before_start,
            daily_goal,
            daily_usage,
        )

        for current_date in _date_range(start_date, yesterday):
            status = _is_streak_day(current_date, daily_goal, daily_usage)
            if status is True:
                streak_length += 1
                detail = f"Day {streak_length} of streak"
                _insert_award(conn, "streak_day", detail, 1, current_date)
                streak_dates.add(current_date)

                for threshold, (detail_key, amount) in MILESTONE_AWARDS.items():
                    if streak_length >= threshold and not _milestone_awarded(conn, detail_key):
                        _insert_award(conn, "milestone", detail_key, amount, current_date)
            elif status is False:
                streak_length = 0

            current_obj = _date_from_str(current_date)
            if current_obj.weekday() == 6:
                week_start = (current_obj - timedelta(days=6)).strftime("%Y-%m-%d")
                if _is_clean_week(week_start, streak_dates):
                    _insert_award(
                        conn,
                        "clean_week",
                        f"Week of {week_start}",
                        3,
                        current_date,
                    )

            if current_obj.day == calendar.monthrange(current_obj.year, current_obj.month)[1]:
                detail_key = "first_clean_month"
                if (
                    not _milestone_awarded(conn, detail_key)
                    and _is_clean_month(current_obj, streak_dates)
                ):
                    _insert_award(conn, "milestone", detail_key, 5, current_date)

        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_rollup_date', ?)",
            (yesterday,),
        )


def get_rewards_awards():
    with get_db() as conn:
        rows = conn.execute(
            """SELECT id, kind, detail, currency, amount, awarded_for_date, awarded_at
               FROM rewards_awards
               ORDER BY awarded_at DESC, id DESC"""
        ).fetchall()
        return [dict(row) for row in rows]


def _unrefunded_spend_for_item(conn, item_key):
    return conn.execute(
        """SELECT s.id
           FROM rewards_ledger s
           WHERE s.kind = 'spend'
             AND s.item_key = ?
             AND NOT EXISTS (
                 SELECT 1 FROM rewards_ledger r
                 WHERE r.kind = 'refund' AND r.spend_id = s.id
             )
           LIMIT 1""",
        (item_key,),
    ).fetchone()


def buy_market_item(item_key):
    catalog = _catalog_by_key()
    item = catalog.get(item_key)
    if not item:
        raise RewardError("unknown_item")

    with get_db() as conn:
        if _unrefunded_spend_for_item(conn, item_key):
            raise RewardError("already_owned")

        balance = _rewards_balance(conn)
        balance_key = "sunlight" if item["currency"] == "sunlight" else "starshards"
        if balance[balance_key] < item["price"]:
            raise RewardError("insufficient_funds")

        conn.execute(
            """INSERT INTO rewards_ledger
               (kind, currency, amount, item_key, spend_id, created_at)
               VALUES ('spend', ?, ?, ?, NULL, ?)""",
            (item["currency"], item["price"], item_key, time.time()),
        )
        return _rewards_balance(conn)


def _refund_details(spend_created_at, original_amount):
    if time.time() - float(spend_created_at) <= REFUND_FULL_WINDOW_SECONDS:
        return int(original_amount), 100
    return int(original_amount) // 2, 50


def get_market_inventory():
    catalog = _catalog_by_key()
    with get_db() as conn:
        rows = conn.execute(
            """SELECT s.id, s.item_key, s.currency, s.amount, s.created_at
               FROM rewards_ledger s
               WHERE s.kind = 'spend'
                 AND NOT EXISTS (
                     SELECT 1 FROM rewards_ledger r
                     WHERE r.kind = 'refund' AND r.spend_id = s.id
                 )
               ORDER BY s.created_at DESC, s.id DESC"""
        ).fetchall()

        inventory = []
        for row in rows:
            item = catalog.get(row["item_key"], {})
            refund_amount, refund_pct = _refund_details(row["created_at"], row["amount"])
            inventory.append({
                "spend_id": row["id"],
                "item_key": row["item_key"],
                "name": item.get("name", row["item_key"]),
                "currency": row["currency"],
                "price": int(row["amount"]),
                "purchased_at": row["created_at"],
                "refund_amount": refund_amount,
                "refund_pct": refund_pct,
            })
        return inventory


def refund_market_item(spend_id):
    with get_db() as conn:
        spend = conn.execute(
            """SELECT id, item_key, currency, amount, created_at
               FROM rewards_ledger
               WHERE id = ? AND kind = 'spend'""",
            (spend_id,),
        ).fetchone()
        if not spend:
            raise RewardError("unknown_spend")

        refunded = conn.execute(
            "SELECT 1 FROM rewards_ledger WHERE kind = 'refund' AND spend_id = ? LIMIT 1",
            (spend_id,),
        ).fetchone()
        if refunded:
            raise RewardError("already_refunded")

        refund_amount, _ = _refund_details(spend["created_at"], spend["amount"])
        conn.execute(
            """INSERT INTO rewards_ledger
               (kind, currency, amount, item_key, spend_id, created_at)
               VALUES ('refund', ?, ?, ?, ?, ?)""",
            (
                spend["currency"],
                refund_amount,
                spend["item_key"],
                spend["id"],
                time.time(),
            ),
        )
        return {
            "refunded": refund_amount,
            "currency": spend["currency"],
            "balance": _rewards_balance(conn),
        }


# ── App queries ──────────────────────────────────────────────────────────

def get_all_apps():
    """Get all tracked apps with total usage and categories."""
    with get_db() as conn:
        rows = conn.execute(
            f"""SELECT u.app_name,
                      COALESCE(c.category, 'Uncategorized') as category,
                      {USAGE_MINUTES_SQL} as total_minutes
               FROM app_usage u
               LEFT JOIN app_categories c ON u.app_name = c.app_name
               GROUP BY u.app_name
               ORDER BY total_minutes DESC"""
        ).fetchall()
        return [dict(r) for r in rows]


def get_app_usage(app_name, date):
    """Get hourly breakdown for a specific app on a date."""
    with get_db() as conn:
        rows = conn.execute(
            f"""SELECT CAST(strftime('%H', timestamp, 'unixepoch', 'localtime') AS INTEGER) as hour,
                      {USAGE_MINUTES_SQL} as minutes
               FROM app_usage WHERE app_name = ? AND date = ?
               GROUP BY hour ORDER BY hour""",
            (app_name, date),
        ).fetchall()
        result = {i: 0 for i in range(24)}
        for r in rows:
            result[r["hour"]] = round(r["minutes"], 1)
        return result


def get_app_total(app_name, date):
    """Get total usage for an app on a specific date in minutes."""
    with get_db() as conn:
        row = conn.execute(
            f"SELECT {USAGE_MINUTES_SQL} as minutes FROM app_usage WHERE app_name = ? AND date = ?",
            (app_name, date),
        ).fetchone()
        return round(row["minutes"], 1) if row else 0


def get_app_daily_totals(app_name, days=7, end_date=None):
    """Get daily totals for an app over the N days ending on end_date."""
    with get_db() as conn:
        end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else datetime.now()
        result = []
        for i in range(days - 1, -1, -1):
            d = (end - timedelta(days=i)).strftime("%Y-%m-%d")
            row = conn.execute(
                f"SELECT {USAGE_MINUTES_SQL} as minutes FROM app_usage WHERE app_name = ? AND date = ?",
                (app_name, d),
            ).fetchone()
            result.append({"date": d, "minutes": round(row["minutes"], 1)})
        return result


def get_app_total_today(app_name):
    """Get today's total usage for an app in minutes."""
    today = datetime.now().strftime("%Y-%m-%d")
    return get_app_total(app_name, today)


# ── Goals ────────────────────────────────────────────────────────────────

def get_goals():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM goals WHERE active = 1").fetchall()
        return [dict(r) for r in rows]


def create_goal(goal_type, target_minutes=None, app_name=None, bedtime_hour=None, bedtime_minute=None):
    with get_db() as conn:
        if goal_type == "daily_total":
            conn.execute(
                "UPDATE goals SET active = 0 WHERE active = 1 AND type = 'daily_total'"
            )
        elif goal_type == "app_limit" and app_name:
            conn.execute(
                """UPDATE goals SET active = 0
                   WHERE active = 1 AND type = 'app_limit' AND app_name = ?""",
                (app_name,),
            )
        elif goal_type == "bedtime":
            conn.execute(
                "UPDATE goals SET active = 0 WHERE active = 1 AND type = 'bedtime'"
            )
        conn.execute(
            "INSERT INTO goals (type, target_minutes, app_name, bedtime_hour, bedtime_minute) VALUES (?, ?, ?, ?, ?)",
            (goal_type, target_minutes, app_name, bedtime_hour, bedtime_minute),
        )
        return conn.execute("SELECT last_insert_rowid()").fetchone()[0]


def delete_goal(goal_id):
    with get_db() as conn:
        conn.execute("UPDATE goals SET active = 0 WHERE id = ?", (goal_id,))


# ── Blocks ───────────────────────────────────────────────────────────────

def get_blocks():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM app_blocks").fetchall()
        return [dict(r) for r in rows]


def add_block(app_name, block_type="blocked", daily_limit_minutes=None):
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO app_blocks (app_name, block_type, daily_limit_minutes) VALUES (?, ?, ?)",
            (app_name, block_type, daily_limit_minutes),
        )


def remove_block(app_name):
    with get_db() as conn:
        conn.execute("DELETE FROM app_blocks WHERE app_name = ?", (app_name,))


def is_app_blocked(app_name):
    """Check if an app should be blocked right now."""
    with get_db() as conn:
        today_usage_value = None

        def today_usage():
            nonlocal today_usage_value
            if today_usage_value is None:
                today = datetime.now().strftime("%Y-%m-%d")
                row = conn.execute(
                    f"SELECT {USAGE_MINUTES_SQL} as minutes FROM app_usage WHERE app_name = ? AND date = ?",
                    (app_name, today),
                ).fetchone()
                today_usage_value = round(row["minutes"], 1) if row else 0
            return today_usage_value

        def over_goal_limit():
            goal_limit = conn.execute(
                """SELECT target_minutes FROM goals
                   WHERE active = 1
                     AND type = 'app_limit'
                     AND app_name = ?
                     AND target_minutes IS NOT NULL
                   ORDER BY target_minutes ASC
                   LIMIT 1""",
                (app_name,),
            ).fetchone()
            return bool(
                goal_limit
                and today_usage() >= goal_limit["target_minutes"]
            )

        # Check whitelist mode
        whitelist_mode = conn.execute(
            "SELECT value FROM settings WHERE key = 'whitelist_mode'"
        ).fetchone()
        if whitelist_mode and whitelist_mode["value"] == "1":
            if app_name in FOCUS_MODE_RECOVERY_APPS:
                return False
            whitelisted = conn.execute(
                "SELECT 1 FROM app_blocks WHERE app_name = ? AND block_type = 'whitelisted'",
                (app_name,),
            ).fetchone()
            return whitelisted is None

        block = conn.execute(
            "SELECT * FROM app_blocks WHERE app_name = ?", (app_name,)
        ).fetchone()
        if block:
            if block["block_type"] == "whitelisted":
                return False

            if block["daily_limit_minutes"] is not None:
                return today_usage() >= block["daily_limit_minutes"] or over_goal_limit()

            return True

        if over_goal_limit():
            return True

        # Check category block
        cat = conn.execute(
            "SELECT category FROM app_categories WHERE app_name = ?", (app_name,)
        ).fetchone()
        if cat:
            cat_block = conn.execute(
                "SELECT 1 FROM app_blocks WHERE app_name = ? AND block_type = 'blocked'",
                (f"__category__{cat['category']}",),
            ).fetchone()
            if cat_block:
                return True

        return False


# ── Categories ───────────────────────────────────────────────────────────

def get_categories():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM app_categories ORDER BY category, app_name").fetchall()
        return [dict(r) for r in rows]


def set_category(app_name, category):
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO app_categories (app_name, category) VALUES (?, ?)",
            (app_name, category),
        )


# ── Export ────────────────────────────────────────────────────────────

def get_export_data(start_date, end_date):
    """Get usage totals between two dates for export."""
    with get_db() as conn:
        rows = conn.execute(
            f"""SELECT app_name, date,
                      ROUND({USAGE_MINUTES_SQL}, 1) as minutes
               FROM app_usage
               WHERE date >= ? AND date <= ?
               GROUP BY app_name, date
               ORDER BY date, minutes DESC""",
            (start_date, end_date)
        ).fetchall()
        return [dict(r) for r in rows]


# ── Settings ─────────────────────────────────────────────────────────────

def get_settings():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM settings").fetchall()
        return {r["key"]: r["value"] for r in rows}


def set_setting(key, value):
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, str(value)),
        )


def get_setting(key, default=None):
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else default
