"""
Background monitor daemon that polls the frontmost application every 2 seconds,
records usage data, detects pickups, enforces app blocks, and checks goals.
"""

import os
import time
import signal
import subprocess
import re
from datetime import datetime

from agent.config import (
    DEFAULT_IDLE_TIMEOUT_MINUTES,
    MAX_IDLE_TIMEOUT_MINUTES,
    PID_FILE,
    POLL_INTERVAL,
)
from agent import database as db
from agent.blocker import kill_app
from agent.notifier import notify


class Monitor:
    def __init__(self):
        self.running = True
        self.current_app = None
        self.session_start = None
        self.was_locked = True  # Assume starts locked
        self.daily_goal_notified = False
        self.bedtime_notified = False
        self.last_date = None
        self.idle_timeout_minutes = DEFAULT_IDLE_TIMEOUT_MINUTES

    def refresh_tracking_settings(self):
        """Refresh monitor settings that can change while the daemon runs."""
        value = db.get_setting("idle_timeout_minutes", str(DEFAULT_IDLE_TIMEOUT_MINUTES))
        try:
            self.idle_timeout_minutes = min(MAX_IDLE_TIMEOUT_MINUTES, max(0, int(value)))
        except (TypeError, ValueError):
            self.idle_timeout_minutes = DEFAULT_IDLE_TIMEOUT_MINUTES

    def get_idle_seconds(self):
        """Return macOS user idle time in seconds, or None if unavailable."""
        try:
            result = subprocess.run(
                ["ioreg", "-c", "IOHIDSystem"],
                capture_output=True,
                text=True,
                timeout=3,
            )
        except (subprocess.TimeoutExpired, OSError):
            return None
        if result.returncode != 0:
            return None
        match = re.search(r'"HIDIdleTime"\s*=\s*(\d+)', result.stdout)
        if not match:
            return None
        return int(match.group(1)) / 1_000_000_000

    def apply_idle_filter(self, app_name):
        """Treat the user as inactive when idle past the configured threshold."""
        if not app_name or self.idle_timeout_minutes <= 0:
            return app_name
        idle_seconds = self.get_idle_seconds()
        if idle_seconds is None:
            return app_name
        if idle_seconds >= self.idle_timeout_minutes * 60:
            return None
        return app_name

    def get_frontmost_app(self):
        """Get the name of the frontmost application via osascript."""
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
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except (subprocess.TimeoutExpired, Exception):
            pass
        return None

    def handle_app_change(self, new_app, now):
        """Handle when the frontmost app changes."""
        # Close previous session
        if self.current_app and self.session_start:
            db.record_session(self.current_app, self.session_start, now)

        # Start new session
        self.current_app = new_app
        self.session_start = now

    def check_pickup(self, app_name, now):
        """Detect a pickup (screen was locked, now active)."""
        if self.was_locked and app_name:
            db.record_pickup(now)
            self.was_locked = False
        elif not app_name:
            # Close session if screen locks
            if self.current_app and self.session_start:
                db.record_session(self.current_app, self.session_start, now)
                self.current_app = None
                self.session_start = None
            self.was_locked = True

    def check_blocks(self, app_name):
        """Check if the current app should be blocked."""
        if not app_name:
            return
        if db.is_app_blocked(app_name):
            kill_app(app_name)
            # Reset current app since we killed it
            self.current_app = None
            self.session_start = None

    def check_goals(self, now):
        """Check daily goals and bedtime reminders."""
        today = datetime.fromtimestamp(now).strftime("%Y-%m-%d")

        # Reset notifications on new day
        if today != self.last_date:
            self.daily_goal_notified = False
            self.bedtime_notified = False
            self.last_date = today

        # Daily total goal
        if not self.daily_goal_notified:
            goals = db.get_goals()
            for goal in goals:
                if goal["type"] == "daily_total" and goal["target_minutes"]:
                    total = db.get_daily_total(today)
                    if total >= goal["target_minutes"]:
                        hours = int(goal["target_minutes"] // 60)
                        mins = int(goal["target_minutes"] % 60)
                        time_str = f"{hours}h {mins}m" if hours else f"{mins}m"
                        notify(
                            "Detox - Daily Goal Reached",
                            f"You've hit your {time_str} screen time goal. Consider taking a break!",
                        )
                        self.daily_goal_notified = True

        # Per-app goals
        goals = db.get_goals()
        for goal in goals:
            if goal["type"] == "app_limit" and goal["app_name"] and goal["target_minutes"]:
                app_total = db.get_app_total_today(goal["app_name"])
                if app_total >= goal["target_minutes"]:
                    # Notification handled by blocker, but we can also notify
                    pass

        # Bedtime
        current_time = datetime.fromtimestamp(now)
        for goal in goals:
            if self.bedtime_notified:
                break
            if goal["type"] == "bedtime" and goal["bedtime_hour"] is not None:
                bedtime_hour = goal["bedtime_hour"]
                bedtime_minute = goal["bedtime_minute"] or 0
                if (
                    current_time.hour > bedtime_hour
                    or (current_time.hour == bedtime_hour and current_time.minute >= bedtime_minute)
                ):
                    self.bedtime_notified = True
                    notify(
                        "Detox - Bedtime Reminder",
                        "It's past your bedtime! Time to put the screen away and rest.",
                    )

    def stop(self):
        """Signal the polling loop to exit on its next iteration."""
        self.running = False

    def run(self):
        """Main monitoring loop. Returns when ``self.running`` is False."""
        goal_check_counter = 0
        settings_check_counter = 0
        self.refresh_tracking_settings()

        try:
            while self.running:
                now = time.time()
                settings_check_counter += 1
                if settings_check_counter >= 15:
                    self.refresh_tracking_settings()
                    settings_check_counter = 0

                app_name = self.apply_idle_filter(self.get_frontmost_app())

                # Check pickup
                self.check_pickup(app_name, now)

                if app_name:
                    # Record raw usage
                    db.record_usage(app_name, now)

                    # Check for app change
                    if app_name != self.current_app:
                        self.handle_app_change(app_name, now)

                    # Check blocks
                    self.check_blocks(app_name)

                # Check goals every 30 seconds (15 polls)
                goal_check_counter += 1
                if goal_check_counter >= 15:
                    self.check_goals(now)
                    goal_check_counter = 0

                time.sleep(POLL_INTERVAL)
        finally:
            if self.current_app and self.session_start:
                db.record_session(self.current_app, self.session_start, time.time())
                self.current_app = None
                self.session_start = None


def run_cli():
    """CLI entrypoint: PID file + signal handlers around ``Monitor.run``."""
    print(f"[Monitor] Starting (PID {os.getpid()})...")

    with open(PID_FILE, "w") as f:
        f.write(str(os.getpid()))

    monitor = Monitor()

    def shutdown(_signum, _frame):
        print("\n[Monitor] Shutting down...")
        monitor.stop()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    try:
        monitor.run()
    finally:
        if os.path.exists(PID_FILE):
            os.remove(PID_FILE)


def main():
    db.init_db()
    run_cli()


if __name__ == "__main__":
    main()
