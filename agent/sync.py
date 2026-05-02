"""Local sync queue helpers. Phase 4 will add HTTP transport."""

from agent import database as db


def device_id():
    with db.get_db() as conn:
        row = conn.execute(
            "SELECT value FROM sync_state WHERE key = 'device_id'"
        ).fetchone()
        return row["value"] if row else ""


def pending_count():
    with db.get_db() as conn:
        row = conn.execute("SELECT COUNT(*) AS n FROM sync_queue").fetchone()
        return row["n"] if row else 0


def flush():
    """No-op until Phase 4. Returns a status dict for the menu-bar."""
    return {"posted": 0, "pending": pending_count(), "status": "offline"}
