import sqlite3
import time
from datetime import datetime, timedelta
from contextlib import contextmanager
from backend.config import DB_PATH, DEFAULT_CATEGORIES


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
            """SELECT u.app_name, COUNT(*) * 2.0 / 60.0 as minutes,
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
            """SELECT CAST(strftime('%H', timestamp, 'unixepoch', 'localtime') AS INTEGER) as hour,
                      COUNT(*) * 2.0 / 60.0 as minutes
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
            "SELECT COUNT(*) * 2.0 / 60.0 as minutes FROM app_usage WHERE date = ?",
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
    totals = [d["minutes"] for d in days if d["minutes"] > 0]
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
            """SELECT COALESCE(c.category, 'Uncategorized') as category,
                      COUNT(*) * 2.0 / 60.0 as minutes
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

        # Sessions for detox / continuous use
        sessions = conn.execute(
            """SELECT start_time, end_time, duration_seconds, app_name
               FROM sessions WHERE date = ?
               ORDER BY start_time""",
            (date,),
        ).fetchall()

        longest_session = 0
        longest_detox = 0
        most_used = {}

        for i, s in enumerate(sessions):
            dur = s["duration_seconds"]
            if dur > longest_session:
                longest_session = dur

            app = s["app_name"]
            most_used[app] = most_used.get(app, 0) + dur

            if i > 0:
                gap = s["start_time"] - sessions[i - 1]["end_time"]
                if gap > longest_detox:
                    longest_detox = gap

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
            """SELECT u.app_name,
                      COALESCE(c.category, 'Uncategorized') as category,
                      COUNT(*) * 2.0 / 60.0 as total_minutes
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
            """SELECT CAST(strftime('%H', timestamp, 'unixepoch', 'localtime') AS INTEGER) as hour,
                      COUNT(*) * 2.0 / 60.0 as minutes
               FROM app_usage WHERE app_name = ? AND date = ?
               GROUP BY hour ORDER BY hour""",
            (app_name, date),
        ).fetchall()
        result = {i: 0 for i in range(24)}
        for r in rows:
            result[r["hour"]] = round(r["minutes"], 1)
        return result


def get_app_daily_totals(app_name, days=7):
    """Get daily totals for an app over the last N days."""
    with get_db() as conn:
        today = datetime.now()
        result = []
        for i in range(days - 1, -1, -1):
            d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            row = conn.execute(
                "SELECT COUNT(*) * 2.0 / 60.0 as minutes FROM app_usage WHERE app_name = ? AND date = ?",
                (app_name, d),
            ).fetchone()
            result.append({"date": d, "minutes": round(row["minutes"], 1)})
        return result


def get_app_total_today(app_name):
    """Get today's total usage for an app in minutes."""
    today = datetime.now().strftime("%Y-%m-%d")
    with get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) * 2.0 / 60.0 as minutes FROM app_usage WHERE app_name = ? AND date = ?",
            (app_name, today),
        ).fetchone()
        return round(row["minutes"], 1) if row else 0


# ── Goals ────────────────────────────────────────────────────────────────

def get_goals():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM goals WHERE active = 1").fetchall()
        return [dict(r) for r in rows]


def create_goal(goal_type, target_minutes=None, app_name=None, bedtime_hour=None, bedtime_minute=None):
    with get_db() as conn:
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
        # Check whitelist mode
        whitelist_mode = conn.execute(
            "SELECT value FROM settings WHERE key = 'whitelist_mode'"
        ).fetchone()
        if whitelist_mode and whitelist_mode["value"] == "1":
            whitelisted = conn.execute(
                "SELECT 1 FROM app_blocks WHERE app_name = ? AND block_type = 'whitelisted'",
                (app_name,),
            ).fetchone()
            return whitelisted is None

        block = conn.execute(
            "SELECT * FROM app_blocks WHERE app_name = ?", (app_name,)
        ).fetchone()
        if not block:
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

        if block["block_type"] == "whitelisted":
            return False

        if block["daily_limit_minutes"] is not None:
            today_usage = get_app_total_today(app_name)
            return today_usage >= block["daily_limit_minutes"]

        return True


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
