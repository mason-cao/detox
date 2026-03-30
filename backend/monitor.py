"""
Background monitor daemon that polls the frontmost application every 2 seconds,
records usage data, detects pickups, enforces app blocks, and checks goals.
"""

import os
import sys
import time
import signal
import subprocess
from datetime import datetime

from backend.config import POLL_INTERVAL, PID_FILE
from backend import database as db
from backend.blocker import kill_app
from backend.notifier import notify


class Monitor:
    def __init__(self):
        self.running = True
        self.current_app = None
        self.session_start = None
        self.was_locked = True  # Assume starts locked
        self.daily_goal_notified = False
        self.bedtime_notified = False
        self.last_date = None

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

    def run(self):
        """Main monitoring loop."""
        print(f"[Monitor] Starting (PID {os.getpid()})...")

        # Write PID file
        with open(PID_FILE, "w") as f:
            f.write(str(os.getpid()))

        # Handle shutdown signals
        def shutdown(signum, frame):
            print("\n[Monitor] Shutting down...")
            self.running = False
            # Close current session
            if self.current_app and self.session_start:
                db.record_session(self.current_app, self.session_start, time.time())
            # Remove PID file
            if os.path.exists(PID_FILE):
                os.remove(PID_FILE)
            sys.exit(0)

        signal.signal(signal.SIGTERM, shutdown)
        signal.signal(signal.SIGINT, shutdown)

        goal_check_counter = 0

        while self.running:
            now = time.time()
            app_name = self.get_frontmost_app()

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


def main():
    # Initialize database
    db.init_db()
    monitor = Monitor()
    monitor.run()


if __name__ == "__main__":
    main()
