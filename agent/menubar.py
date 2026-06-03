"""rumps menu-bar app for local Detox monitoring."""

import os
import shlex
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime

import rumps

from agent import cloud, database as db, keychain, rules, sync
from agent.config import APP_VERSION, LOG_PATH, SERVER_PORT
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


def _source_root(source_file=None):
    source_file = source_file or __file__
    return os.path.dirname(os.path.dirname(os.path.abspath(source_file)))


def _pair_shell_command(executable_path=None, source_file=None, frozen=None):
    if frozen is None:
        frozen = bool(getattr(sys, "frozen", False))
    if frozen:
        from agent.launch_agent import _bundle_executable_path

        return " ".join(
            shlex.quote(part)
            for part in (_bundle_executable_path(executable_path), "--pair")
        )

    python_exe = executable_path or sys.executable
    return (
        f"cd {shlex.quote(_source_root(source_file))} && "
        f"{shlex.quote(python_exe)} -m agent.cli.pair"
    )


def _pair_terminal_script(executable_path=None, source_file=None, frozen=None):
    command = _pair_shell_command(
        executable_path=executable_path,
        source_file=source_file,
        frozen=frozen,
    )
    escaped = command.replace("\\", "\\\\").replace('"', '\\"')
    return f'tell application "Terminal" to do script "{escaped}"'


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
        self._rules_puller = None
        self._sync_pusher = None

        self.status_label = rumps.MenuItem("Detox - starting...")
        self.today_label = rumps.MenuItem("Today: -")
        self.pairing_label = rumps.MenuItem("Cloud: not paired")
        self.last_sync_label = rumps.MenuItem("Last sync: never")
        self.pair_item = rumps.MenuItem(
            "Pair this device…",
            callback=self.on_pair,
        )
        self.sync_now_item = rumps.MenuItem(
            "Sync now",
            callback=self.on_sync_now,
        )
        self.sign_out_item = rumps.MenuItem(
            "Sign out",
            callback=self.on_sign_out,
        )
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
            self.pairing_label,
            self.last_sync_label,
            self.pair_item,
            self.sync_now_item,
            self.sign_out_item,
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

        self._start_monitor()
        self._start_flask()
        self._start_cloud_pullers()

        self.status_timer = rumps.Timer(self.tick, 5)
        self.status_timer.start()
        self.tick(None)

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
        from agent import server as server_module

        server_module.set_monitor_status_provider(self._monitor_is_running)
        flask_app = server_module.app

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

    def _monitor_is_running(self):
        return (
            self._monitor is not None
            and self._monitor_thread is not None
            and self._monitor_thread.is_alive()
            and not self._paused
        )

    def _start_cloud_pullers(self):
        """Start the rules puller + sync pusher unconditionally.

        Each thread short-circuits to ``unpaired`` when no JWT is present,
        so we don't have to restart anything when the user pairs/unpairs —
        the next tick simply sees a different ``cloud.is_paired()`` state.
        """
        if self._rules_puller is None:
            self._rules_puller = rules.RulesPuller()
            self._rules_puller.start()
        if self._sync_pusher is None:
            self._sync_pusher = sync.SyncPusher()
            self._sync_pusher.start()

    def on_pair(self, _sender):
        subprocess.run(["osascript", "-e", _pair_terminal_script()], check=False)

    def on_sync_now(self, _sender):
        if not cloud.is_paired():
            rumps.notification("Detox", "Sync", "Pair this device first.")
            return
        result = sync.flush()
        status = result.get("status", "?")
        posted = result.get("posted", 0)
        pending = result.get("pending", 0)
        rumps.notification(
            "Detox",
            "Sync",
            f"{status}: {posted} posted, {pending} pending",
        )
        self.tick(None)

    def on_sign_out(self, _sender):
        if not cloud.is_paired():
            return
        keychain.clear_jwt()
        db.clear_rules_mirror()
        rumps.notification(
            "Detox",
            "Cloud",
            "Signed out. Re-pair to sync again.",
        )
        self.tick(None)

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
        from agent import server as server_module

        server_module.set_monitor_status_provider(None)
        self._stop_monitor()
        if self._rules_puller:
            self._rules_puller.stop()
        if self._sync_pusher:
            self._sync_pusher.stop()
        rumps.quit_application()

    def _refresh_cloud_labels(self):
        paired = cloud.is_paired()
        if paired:
            self.pairing_label.title = "Cloud: paired"
            self.pair_item.set_callback(None)
            self.pair_item.title = "Pair this device… (paired)"
            self.sync_now_item.set_callback(self.on_sync_now)
            self.sign_out_item.set_callback(self.on_sign_out)
        else:
            self.pairing_label.title = "Cloud: not paired"
            self.pair_item.set_callback(self.on_pair)
            self.pair_item.title = "Pair this device…"
            self.sync_now_item.set_callback(None)
            self.sign_out_item.set_callback(None)

        try:
            status = sync.last_push_status()
        except Exception:
            status = {}
        last_at = status.get("last_success_at") if status else None
        try:
            ts = float(last_at) if last_at else None
        except (TypeError, ValueError):
            ts = None
        if ts:
            stamp = datetime.fromtimestamp(ts).strftime("%H:%M")
            pending = status.get("pending", 0) if status else 0
            extra = f" ({pending} pending)" if pending else ""
            self.last_sync_label.title = f"Last sync: {stamp}{extra}"
        elif paired:
            self.last_sync_label.title = "Last sync: pending…"
        else:
            self.last_sync_label.title = "Last sync: never"

    def tick(self, _sender):
        self._refresh_cloud_labels()

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
