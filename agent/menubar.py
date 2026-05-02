"""rumps menu-bar app for local Detox monitoring."""

import os
import subprocess
import sys
import threading
import time
import webbrowser

import rumps

from agent import database as db
from agent.config import APP_VERSION, LOG_PATH, PID_FILE, SERVER_PORT
from agent.monitor import Monitor


GLYPH_ACTIVE = "🔆"
GLYPH_PAUSED = "🌙"
GLYPH_STALLED = "⚠"
GLYPH_DENIED = "🚫"


def _format_minutes(total_minutes):
    hours, minutes = divmod(int(total_minutes), 60)
    if hours:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def _sparkle_framework_path(executable_path=None, source_file=None):
    executable_path = executable_path or sys.executable
    source_file = source_file or __file__
    candidates = [
        os.path.abspath(
            os.path.join(
                os.path.dirname(executable_path),
                "..",
                "Frameworks",
                "Sparkle.framework",
            )
        ),
        os.path.abspath(
            os.path.join(
                os.path.dirname(source_file),
                "..",
                "Frameworks",
                "Sparkle.framework",
            )
        ),
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return candidates[0]


class DetoxApp(rumps.App):
    def __init__(self):
        super().__init__(
            name="Detox",
            title=GLYPH_ACTIVE,
            icon=None,
            quit_button=None,
        )

        self._monitor = None
        self._monitor_thread = None
        self._flask_thread = None
        self._paused = False

        self.status_label = rumps.MenuItem("Detox - starting...")
        self.today_label = rumps.MenuItem("Today: -")
        self.pause_item = rumps.MenuItem(
            "Pause tracking",
            callback=self.on_pause,
            key="p",
        )
        self.launch_at_login_item = rumps.MenuItem(
            "Launch at Login",
            callback=self.on_toggle_launch_at_login,
        )
        self.menu = [
            self.status_label,
            self.today_label,
            None,
            self.pause_item,
            rumps.MenuItem("Open Dashboard", callback=self.on_dashboard, key="d"),
            rumps.MenuItem("Open Logs", callback=self.on_logs),
            None,
            self.launch_at_login_item,
            rumps.MenuItem("Check for Updates...", callback=self.on_check_updates),
            None,
            rumps.MenuItem("Quit Detox", callback=self.on_quit, key="q"),
        ]

        from agent.launch_agent import is_installed

        self.launch_at_login_item.state = 1 if is_installed() else 0

        self._write_pid()
        self._start_monitor()
        self._start_flask()

        self.status_timer = rumps.Timer(self.tick, 5)
        self.status_timer.start()
        self.tick(None)

    def _write_pid(self):
        with open(PID_FILE, "w") as f:
            f.write(str(os.getpid()))

    def _start_monitor(self):
        db.init_db()
        self._monitor = Monitor()
        self._monitor_thread = self._monitor.start_in_thread()

    def _stop_monitor(self):
        if self._monitor:
            self._monitor.stop()
        if self._monitor_thread:
            self._monitor_thread.join(timeout=5)
        self._monitor = None
        self._monitor_thread = None

    def _start_flask(self):
        from agent.server import app as flask_app

        def serve():
            flask_app.run(
                host="127.0.0.1",
                port=SERVER_PORT,
                debug=False,
                use_reloader=False,
            )

        self._flask_thread = threading.Thread(
            target=serve,
            daemon=True,
            name="detox-flask",
        )
        self._flask_thread.start()

    def on_pause(self, _sender):
        if self._paused:
            self._start_monitor()
            self._paused = False
            self.pause_item.title = "Pause tracking"
        else:
            self._stop_monitor()
            self._paused = True
            self.pause_item.title = "Resume tracking"
        self.tick(None)

    def on_dashboard(self, _sender):
        webbrowser.open(f"http://localhost:{SERVER_PORT}")

    def on_logs(self, _sender):
        open(LOG_PATH, "a").close()
        subprocess.run(["open", "-R", LOG_PATH], check=False)

    def on_toggle_launch_at_login(self, sender):
        from agent.launch_agent import install, is_installed, uninstall

        if is_installed():
            uninstall()
            sender.state = 0
        else:
            install()
            sender.state = 1

    def on_check_updates(self, _sender):
        try:
            from Foundation import NSBundle

            framework_path = _sparkle_framework_path()
            if not os.path.exists(framework_path):
                raise RuntimeError(f"Sparkle.framework not found at {framework_path}")

            bundle = NSBundle.bundleWithPath_(framework_path)
            if bundle is None or not bundle.load():
                raise RuntimeError("Sparkle.framework not loaded")

            SUUpdater = bundle.classNamed_("SUUpdater")
            if SUUpdater is None:
                raise RuntimeError("SUUpdater class not available")
            SUUpdater.sharedUpdater().checkForUpdates_(None)
        except Exception as exc:
            rumps.notification("Detox", "Updates", f"Update check failed: {exc}")

    def on_quit(self, _sender):
        self._stop_monitor()
        if os.path.exists(PID_FILE):
            try:
                os.remove(PID_FILE)
            except OSError:
                pass
        rumps.quit_application()

    def tick(self, _sender):
        today = time.strftime("%Y-%m-%d")
        try:
            minutes = db.get_daily_total(today) or 0
        except Exception:
            minutes = 0
        self.today_label.title = f"Today: {_format_minutes(minutes)}"

        if self._paused:
            self.title = GLYPH_PAUSED
            self.status_label.title = "Detox - Paused"
            return

        if self._monitor and self._monitor.permission_denied:
            self.title = GLYPH_DENIED
            self.status_label.title = "Detox - Needs Accessibility"
            return

        if self._monitor and self._monitor.is_alive():
            self.title = GLYPH_ACTIVE
            self.status_label.title = "Detox - Active"
            return

        self.title = GLYPH_STALLED
        last = self._monitor.last_poll_at if self._monitor else None
        age = int(time.time() - last) if last else None
        detail = f" (last poll {age}s ago)" if age is not None else ""
        self.status_label.title = f"Detox - Stalled{detail}"


def main():
    DetoxApp().run()


if __name__ == "__main__":
    main()
