"""Apps read-model service.

Wraps the local SQLite layer until the Postgres port lands. Includes a small
amount of OS-side discovery (frontmost app + ``/Applications`` walk) so the
suggestion endpoint stays at parity with the Flask implementation.
"""

from __future__ import annotations

import os
import subprocess

from agent import database as db


def _frontmost_app_name() -> str | None:
    try:
        result = subprocess.run(
            [
                "osascript",
                "-e",
                'tell application "System Events" to get name of first process whose frontmost is true',
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (subprocess.TimeoutExpired, OSError):
        return None
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return None


def _installed_app_names() -> list[str]:
    app_dirs = [
        "/Applications",
        os.path.expanduser("~/Applications"),
        "/System/Applications",
        "/System/Applications/Utilities",
    ]
    names: set[str] = set()
    for app_dir in app_dirs:
        if not os.path.isdir(app_dir):
            continue
        try:
            entries = os.listdir(app_dir)
        except OSError:
            continue
        for entry in entries:
            if entry.endswith(".app"):
                names.add(entry[:-4])
    return sorted(names, key=str.casefold)


def list_apps() -> list[dict]:
    return db.get_all_apps()


def app_suggestions() -> list[str]:
    names: set[str] = {app["app_name"] for app in db.get_all_apps()}
    names.update(category["app_name"] for category in db.get_categories())
    names.update(goal["app_name"] for goal in db.get_goals() if goal.get("app_name"))
    names.update(block["app_name"] for block in db.get_blocks())
    names.update(_installed_app_names())
    frontmost = _frontmost_app_name()
    if frontmost:
        names.add(frontmost)
    return sorted(names, key=str.casefold)


def app_detail(app_name: str, date: str, period: str) -> dict:
    days = 7 if period == "week" else 30
    return {
        "app_name": app_name,
        "date": date,
        "selected_total": db.get_app_total(app_name, date),
        "hourly": db.get_app_usage(app_name, date),
        "daily_totals": db.get_app_daily_totals(app_name, days, end_date=date),
    }


def list_categories() -> list[dict]:
    return db.get_categories()


def set_category(app_name: str, category: str) -> None:
    db.set_category(app_name, category)
