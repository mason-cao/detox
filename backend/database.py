import sqlite3
import time
from datetime import datetime, timedelta
from contextlib import contextmanager
from backend.config import (
    DB_PATH,
    DEFAULT_CATEGORIES,
    DEFAULT_SETTINGS,
    FOCUS_MODE_RECOVERY_APPS,
    POLL_INTERVAL,
    SESSION_GAP_THRESHOLD,
)


USAGE_MINUTES_SQL = f"COUNT(*) * {float(POLL_INTERVAL)} / 60.0"


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
