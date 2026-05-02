# Phase 3 — Agent Packaging

**Goal:** Turn the agent from `python3 -m agent.monitor` into a signed, notarized `Detox.app` bundle: menu-bar lantern, login launch, py2app build pipeline, Sparkle in-place updates, and an idempotent local sync queue ready for Phase 4 to drain.

**Architecture:** A single `rumps.App` process owns three loops — main thread runs the menu-bar event loop, one daemon thread runs `Monitor.run()`, a second daemon thread runs the existing Flask server. The library refactor (28946c3) already moved `Monitor` out of the CLI; this plan layers the GUI surface, the packaging pipeline, and the sync queue on top. Flask routes, SQLite schema (existing tables), and the dashboard JS are unchanged.

**Tech stack:** Python 3.11. New runtime deps: `rumps>=0.4`, `pyobjc>=10.0` (only Sparkle bridging requires it; `rumps` already pulls a minimal subset). Build deps: `py2app>=0.28`. Vendored: `Sparkle.framework` 2.x. No frontend changes.

**Source of truth:** `docs/specs/2026-04-29-phase-3-agent-packaging.md`. Where this plan and the spec disagree, the spec wins.

**Non-goals (deferred):**

- **Phase 4 cloud ingest.** `agent/sync.py` ships as a no-op `flush()`; no HTTP, no JWT, no pairing. The queue accumulates locally.
- **Cert procurement.** Apple Developer ID + EdDSA keys are user-side blockers (spec §13). Code-bearing tasks land first; the build/sign/notarize/Sparkle wiring lands once certs exist.
- **App Store sandbox.** `pkill -x` and `osascript` need an unsandboxed binary — Direct/DMG only.
- **`SMAppService` migration.** Phase 3 ships the LaunchAgent-plist fallback; modern API is a follow-up.
- **CI for notarization.** Manual until release cadence justifies a runner.
- **Per-app pause from the menu-bar / SwiftUI rewrite / telemetry.** Spec §12 sketches.

---

## File structure

- **Create:** `agent/menubar.py` — `rumps.App` subclass owning monitor + Flask threads.
- **Create:** `agent/launch_agent.py` — write/remove `~/Library/LaunchAgents/com.detox.agent.plist`.
- **Create:** `agent/sync.py` — queue helpers (`enqueue_*`, `pending_count`, no-op `flush`).
- **Create:** `agent/__main__.py` — `python3 -m agent` → `menubar.main()`. Keeps `python3 -m agent.monitor` for headless dev.
- **Create:** `agent/tests/__init__.py`, `agent/tests/test_monitor_lifecycle.py`, `agent/tests/test_sync_queue.py`.
- **Modify:** `agent/database.py` — schema bump (sync tables + `device_id`); `record_usage` / `record_session` / `record_pickup` enqueue inside the same transaction.
- **Modify:** `agent/monitor.py` — add `start_in_thread()` + `is_alive()`; expose `last_poll_at` for the menu-bar status check.
- **Modify:** `agent/config.py` — add `LAUNCH_AGENT_PATH`, `LOG_PATH`, `BUNDLE_IDENTIFIER`, `APP_VERSION`.
- **Modify:** `requirements.txt` — append `rumps>=0.4`, `pyobjc>=10.0`.
- **Modify:** `start.sh` — note that `Detox.app` is now the user-facing path; dev path unchanged.
- **Modify:** `README.md` — DMG install + Accessibility + Launch-at-Login section.
- **Create:** `infra/build/setup.py` — py2app config.
- **Create:** `infra/build/build.sh`, `infra/build/notarize.sh`, `infra/build/sparkle_sign.sh`.
- **Create:** `infra/build/Info.plist.tmpl` — `LSUIElement`, `SUFeedURL`, etc.
- **Create:** `infra/build/icon.icns` (placeholder; final art arrives later).
- **Create:** `infra/build/README.md` — cert prerequisites, key storage, release runbook.

---

## Task 1 — Menu-bar app

**Files:**

- Create: `agent/menubar.py`, `agent/__main__.py`
- Modify: `agent/monitor.py`, `agent/config.py`, `requirements.txt`

**Steps:**

1. Append to `agent/config.py`:

   ```python
   APP_VERSION = "1.0.0"
   BUNDLE_IDENTIFIER = "com.detox.agent"
   LOG_PATH = os.path.join(DATA_DIR, "monitor.log")
   LAUNCH_AGENT_PATH = os.path.expanduser(
       "~/Library/LaunchAgents/com.detox.agent.plist"
   )
   STALL_THRESHOLD_SECONDS = 30
   ```

2. Add to `agent/monitor.py`:

   - In `__init__`: `self.last_poll_at = None`.
   - In `run()` loop: `self.last_poll_at = now` after each poll iteration.
   - New method `is_alive(self) -> bool`: returns `self.running and self.last_poll_at is not None and (time.time() - self.last_poll_at) < STALL_THRESHOLD_SECONDS`.
   - New helper `start_in_thread(self) -> threading.Thread`: spawns a daemon thread running `self.run`, returns the thread. Pure convenience for the menu-bar app.

3. Append `rumps>=0.4` and `pyobjc>=10.0` to `requirements.txt`.

4. Create `agent/menubar.py`:

   ```python
   """rumps menu-bar app: status + pause + dashboard + quit."""

   import os
   import threading
   import time
   import webbrowser
   import subprocess

   import rumps

   from agent import database as db
   from agent.config import APP_VERSION, LOG_PATH, PID_FILE
   from agent.monitor import Monitor


   GLYPH_ACTIVE = "🔆"
   GLYPH_PAUSED = "🌙"
   GLYPH_STALLED = "⚠"
   GLYPH_DENIED = "🚫"


   def _format_minutes(total_minutes: float) -> str:
       hours, minutes = divmod(int(total_minutes), 60)
       if hours:
           return f"{hours}h {minutes}m"
       return f"{minutes}m"


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
           self._permission_denied = False

           self.status_label = rumps.MenuItem("Detox — starting…")
           self.today_label = rumps.MenuItem("Today: —")
           self.pause_item = rumps.MenuItem(
               "Pause tracking", callback=self.on_pause, key="p"
           )
           self.menu = [
               self.status_label,
               self.today_label,
               None,
               self.pause_item,
               rumps.MenuItem("Open Dashboard", callback=self.on_dashboard, key="d"),
               rumps.MenuItem("Open Logs", callback=self.on_logs),
               None,
               rumps.MenuItem(
                   "Launch at Login",
                   callback=self.on_toggle_launch_at_login,
               ),
               rumps.MenuItem("Check for Updates…", callback=self.on_check_updates),
               None,
               rumps.MenuItem("Quit Detox", callback=self.on_quit, key="q"),
           ]

           # Reflect persisted launch-at-login state.
           from agent.launch_agent import is_installed
           self.menu["Launch at Login"].state = 1 if is_installed() else 0

           self._start_monitor()
           self._start_flask()

           self.status_timer = rumps.Timer(self.tick, 5)
           self.status_timer.start()

       # ── lifecycle ────────────────────────────────────────────────
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
               flask_app.run(host="127.0.0.1", port=5050, use_reloader=False)

           self._flask_thread = threading.Thread(
               target=serve, daemon=True, name="detox-flask"
           )
           self._flask_thread.start()

       # ── menu callbacks ───────────────────────────────────────────
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
           webbrowser.open("http://localhost:5050")

       def on_logs(self, _sender):
           subprocess.run(["open", "-R", LOG_PATH], check=False)

       def on_toggle_launch_at_login(self, sender):
           from agent.launch_agent import install, uninstall, is_installed
           if is_installed():
               uninstall()
               sender.state = 0
           else:
               install()
               sender.state = 1

       def on_check_updates(self, _sender):
           # Sparkle bridge wired in Task 6. Until then, disabled-style toast.
           rumps.notification(
               "Detox", "Updates", "Update channel arrives in a future build."
           )

       def on_quit(self, _sender):
           self._stop_monitor()
           if os.path.exists(PID_FILE):
               try:
                   os.remove(PID_FILE)
               except OSError:
                   pass
           rumps.quit_application()

       # ── periodic refresh ─────────────────────────────────────────
       def tick(self, _sender):
           today = time.strftime("%Y-%m-%d")
           try:
               minutes = db.get_daily_total(today) or 0
           except Exception:
               minutes = 0
           self.today_label.title = f"Today: {_format_minutes(minutes)}"

           if self._paused:
               self.title = GLYPH_PAUSED
               self.status_label.title = "Detox — Paused"
               return

           if self._permission_denied:
               self.title = GLYPH_DENIED
               self.status_label.title = "Detox — Needs Accessibility"
               return

           if self._monitor and self._monitor.is_alive():
               self.title = GLYPH_ACTIVE
               self.status_label.title = "Detox — Active"
           else:
               self.title = GLYPH_STALLED
               last = self._monitor.last_poll_at if self._monitor else None
               age = int(time.time() - last) if last else None
               detail = f" (last poll {age}s ago)" if age is not None else ""
               self.status_label.title = f"Detox — Stalled{detail}"


   def main():
       DetoxApp().run()


   if __name__ == "__main__":
       main()
   ```

5. Create `agent/__main__.py`:

   ```python
   from agent.menubar import main

   if __name__ == "__main__":
       main()
   ```

6. Smoke (dev, unsigned): `pip3 install -r requirements.txt && python3 -m agent`. Expect a `🔆` glyph in the menu bar; menu shows "Detox — Active", `Today: …`, Open Dashboard opens `localhost:5050`, Pause toggles to `🌙` and freezes the daily total. Quit removes `data/monitor.pid`.

7. Commit:

   ```
   git add agent/menubar.py agent/__main__.py agent/monitor.py agent/config.py requirements.txt
   git commit -m "feat(agent): rumps menu-bar app with status + pause + dashboard + quit"
   ```

---

## Task 2 — Launch-at-Login plist

**Files:**

- Create: `agent/launch_agent.py`

**Steps:**

1. Create `agent/launch_agent.py`:

   ```python
   """Manage the LaunchAgent plist that auto-starts Detox at login."""

   import os
   import plistlib
   import subprocess
   import sys

   from agent.config import BUNDLE_IDENTIFIER, LAUNCH_AGENT_PATH, LOG_PATH


   def _program_arguments() -> list[str]:
       """Resolve which binary the LaunchAgent should invoke.

       Inside Detox.app the bundle's executable is the entrypoint.
       In dev (running from a checkout) we point at the current Python.
       """
       bundle_exe = os.environ.get("DETOX_BUNDLE_EXEC")
       if bundle_exe and os.path.exists(bundle_exe):
           return [bundle_exe]
       return [sys.executable, "-m", "agent"]


   def _plist_payload() -> dict:
       return {
           "Label": BUNDLE_IDENTIFIER,
           "ProgramArguments": _program_arguments(),
           "RunAtLoad": True,
           "KeepAlive": False,
           "StandardOutPath": LOG_PATH,
           "StandardErrorPath": LOG_PATH,
           "ProcessType": "Interactive",
       }


   def is_installed() -> bool:
       return os.path.exists(LAUNCH_AGENT_PATH)


   def install() -> None:
       os.makedirs(os.path.dirname(LAUNCH_AGENT_PATH), exist_ok=True)
       with open(LAUNCH_AGENT_PATH, "wb") as f:
           plistlib.dump(_plist_payload(), f)
       subprocess.run(
           ["launchctl", "load", "-w", LAUNCH_AGENT_PATH],
           check=False,
       )


   def uninstall() -> None:
       if not is_installed():
           return
       subprocess.run(
           ["launchctl", "unload", "-w", LAUNCH_AGENT_PATH],
           check=False,
       )
       try:
           os.remove(LAUNCH_AGENT_PATH)
       except OSError:
           pass
   ```

2. Smoke: from the running app, click **Launch at Login** — the menu item gains a checkmark and `~/Library/LaunchAgents/com.detox.agent.plist` exists. Click again, plist removed. `launchctl list | grep com.detox.agent` reflects the toggle.

3. Commit:

   ```
   git add agent/launch_agent.py
   git commit -m "feat(agent): launch-at-login toggle via LaunchAgent plist"
   ```

---

## Task 3 — Local sync queue

**Files:**

- Modify: `agent/database.py`
- Create: `agent/sync.py`

**Steps:**

1. In `agent/database.py`'s `init_db()`, add the spec §7 schema:

   ```python
   conn.execute("""
       CREATE TABLE IF NOT EXISTS sync_queue (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           kind TEXT NOT NULL CHECK (kind IN ('app_usage', 'session', 'pickup')),
           row_id INTEGER NOT NULL,
           payload_json TEXT NOT NULL,
           queued_at REAL NOT NULL,
           UNIQUE (kind, row_id)
       )
   """)
   conn.execute(
       "CREATE INDEX IF NOT EXISTS idx_sync_queue_queued_at "
       "ON sync_queue(queued_at)"
   )
   conn.execute("""
       CREATE TABLE IF NOT EXISTS sync_state (
           key TEXT PRIMARY KEY,
           value TEXT
       )
   """)
   ```

   Then, before any other seeding, ensure `device_id` exists:

   ```python
   import uuid
   conn.execute(
       "INSERT OR IGNORE INTO sync_state (key, value) VALUES ('device_id', ?)",
       (str(uuid.uuid4()),),
   )
   ```

2. Modify `record_usage`, `record_session`, `record_pickup` so the source-row insert and the `sync_queue` insert share one transaction. Use the existing `with get_db() as conn:` block; both `INSERT`s share `conn`. Idempotent shape:

   ```python
   cur = conn.execute(
       "INSERT INTO app_usage (app_name, timestamp) VALUES (?, ?)",
       (app_name, ts),
   )
   row_id = cur.lastrowid
   conn.execute(
       "INSERT OR IGNORE INTO sync_queue "
       "(kind, row_id, payload_json, queued_at) VALUES (?, ?, ?, ?)",
       ("app_usage", row_id,
        json.dumps({"app_name": app_name, "timestamp": ts}), ts),
   )
   ```

   Apply the same pattern to `record_session` (`payload` includes `start_time`, `end_time`) and `record_pickup` (`timestamp` only).

3. Create `agent/sync.py`:

   ```python
   """Local sync queue helpers. Phase 4 will add HTTP transport."""

   from agent import database as db


   def device_id() -> str:
       with db.get_db() as conn:
           row = conn.execute(
               "SELECT value FROM sync_state WHERE key = 'device_id'"
           ).fetchone()
           return row["value"] if row else ""


   def pending_count() -> int:
       with db.get_db() as conn:
           row = conn.execute("SELECT COUNT(*) AS n FROM sync_queue").fetchone()
           return row["n"] if row else 0


   def flush() -> dict:
       """No-op until Phase 4. Returns a status dict for the menu-bar."""
       return {"posted": 0, "pending": pending_count(), "status": "offline"}
   ```

4. Smoke: `python3 -c "from agent.database import init_db; init_db()"`, run the menu-bar app for ~30 s, then `sqlite3 data/screentime.db "SELECT kind, COUNT(*) FROM sync_queue GROUP BY kind"`. Expect non-zero `app_usage` rows; pickups appear after the next launch event. `sqlite3 data/screentime.db "SELECT value FROM sync_state WHERE key='device_id'"` returns a UUID v4.

5. Commit:

   ```
   git add agent/database.py agent/sync.py
   git commit -m "feat(agent): local sync queue (sync_queue + sync_state) wired into record_*"
   ```

---

## Task 4 — py2app config + bundle layout

**Files:**

- Create: `infra/build/setup.py`, `infra/build/Info.plist.tmpl`, `infra/build/icon.icns`
- Create: `infra/build/README.md`

**Steps:**

1. Create `infra/build/setup.py`:

   ```python
   """py2app build for Detox.app. Run from repo root via infra/build/build.sh."""

   from setuptools import setup
   import pathlib

   ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
   APP = [str(ROOT / "agent" / "__main__.py")]

   DATA_FILES = [
       ("web", [str(p) for p in (ROOT / "web").rglob("*") if p.is_file()]),
   ]

   OPTIONS = {
       "argv_emulation": False,
       "iconfile": "icon.icns",
       "plist": "Info.plist.tmpl",
       "packages": ["agent", "flask", "rumps"],
       "includes": ["pkg_resources"],
       "frameworks": [],  # Sparkle.framework added in Task 6
       "resources": [],
       "strip": True,
   }

   setup(
       app=APP,
       name="Detox",
       data_files=DATA_FILES,
       options={"py2app": OPTIONS},
       setup_requires=["py2app>=0.28"],
   )
   ```

2. Create `infra/build/Info.plist.tmpl` per spec §4:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
     <dict>
       <key>CFBundleIdentifier</key><string>com.detox.agent</string>
       <key>CFBundleName</key><string>Detox</string>
       <key>CFBundleDisplayName</key><string>Detox</string>
       <key>CFBundleShortVersionString</key><string>1.0.0</string>
       <key>CFBundleVersion</key><string>100</string>
       <key>LSUIElement</key><true/>
       <key>LSMinimumSystemVersion</key><string>12.0</string>
       <key>NSHumanReadableCopyright</key><string>© 2026 Mason Cao</string>
       <key>NSAppleEventsUsageDescription</key>
       <string>Detox needs to read the frontmost application to track screen time.</string>
       <key>SUFeedURL</key><string>https://detox.app/appcast.xml</string>
       <key>SUPublicEDKey</key><string>__SPARKLE_PUB_KEY__</string>
     </dict>
   </plist>
   ```

   Real EdDSA public key is substituted in Task 6's `sparkle_sign.sh` setup. Keep the placeholder so unsigned dev builds still bundle.

3. Drop a placeholder `infra/build/icon.icns` (256×256, generic Detox lighthouse glyph). Final art is a follow-up.

4. Create `infra/build/README.md` covering:

   - Cert prerequisites: Apple Developer ID Application certificate installed; `notarytool` keychain profile `detox-notary`; Sparkle EdDSA key pair generated and private key stored in 1Password.
   - One-line dev build: `cd infra/build && python3 setup.py py2app -A` (alias mode — no signing, no notarization, fast).
   - Release build: `./build.sh 1.0.0`.
   - How to update `SUPublicEDKey` and where the appcast lives.

5. Smoke: `cd infra/build && python3 setup.py py2app -A`. Expect `dist/Detox.app/Contents/MacOS/Detox` to exist and to launch a working menu-bar app from the alias bundle. Quit, confirm `data/monitor.pid` is removed.

6. Commit:

   ```
   git add infra/build/setup.py infra/build/Info.plist.tmpl infra/build/icon.icns infra/build/README.md
   git commit -m "build(agent): py2app config + Info.plist + bundle layout"
   ```

---

## Task 5 — Sign + notarize + DMG pipeline

**Files:**

- Create: `infra/build/build.sh`, `infra/build/notarize.sh`

**Steps:**

1. Create `infra/build/build.sh`:

   ```bash
   #!/bin/bash
   set -euo pipefail

   VERSION="${1:?version required, e.g. ./build.sh 1.0.0}"
   DEVELOPER_ID="Developer ID Application: Mason Cao (TEAMID)"
   KEYCHAIN_PROFILE="detox-notary"

   DIR="$(cd "$(dirname "$0")" && pwd)"
   ROOT="$(cd "$DIR/../.." && pwd)"
   cd "$DIR"

   echo "[1/6] py2app build…"
   rm -rf build dist
   python3 setup.py py2app

   APP="dist/Detox.app"
   DMG="dist/Detox-${VERSION}.dmg"

   echo "[2/6] codesign (hardened runtime)…"
   codesign --deep --force --options runtime \
     --entitlements entitlements.plist \
     --sign "$DEVELOPER_ID" "$APP"

   echo "[3/6] notarize…"
   ditto -c -k --keepParent "$APP" dist/Detox.app.zip
   xcrun notarytool submit dist/Detox.app.zip \
     --keychain-profile "$KEYCHAIN_PROFILE" --wait

   echo "[4/6] staple…"
   xcrun stapler staple "$APP"

   echo "[5/6] DMG…"
   hdiutil create -volname "Detox" -srcfolder "$APP" \
     -ov -format UDZO "$DMG"
   codesign --sign "$DEVELOPER_ID" "$DMG"

   echo "[6/6] verify…"
   spctl --assess --type execute -vv "$APP"
   shasum -a 256 "$DMG"
   ```

   Mark `chmod +x build.sh`. Reference `entitlements.plist` is a one-line file granting `com.apple.security.cs.allow-unsigned-executable-memory` (required for `pyobjc`); add it next to `setup.py`.

2. Create `infra/build/notarize.sh` — split out so re-notarization after cert rotation is one command. Calls steps 3–4 only.

3. Smoke (cert-blocked): `./build.sh 1.0.0` should fail at step 2 with a clear "cert not found" message until certs land. Document this in `infra/build/README.md`.

4. Commit:

   ```
   git add infra/build/build.sh infra/build/notarize.sh infra/build/entitlements.plist
   git commit -m "build(agent): codesign + notarytool + DMG packaging script"
   ```

---

## Task 6 — Sparkle framework + appcast + EdDSA signing

**Files:**

- Create: `infra/build/sparkle_sign.sh`, `infra/build/appcast.xml.tmpl`
- Modify: `infra/build/setup.py` (add `Sparkle.framework` to `frameworks`)
- Modify: `agent/menubar.py` (`on_check_updates` → bridge to `SUUpdater`)

**Steps:**

1. Vendor Sparkle 2.x: download the official release, place `Sparkle.framework` under `infra/build/Sparkle.framework`, gitignore the binary blobs but commit the directory README pointing at the pinned version.

2. In `infra/build/setup.py`, set:

   ```python
   "frameworks": ["Sparkle.framework"],
   ```

   so py2app copies it into `Detox.app/Contents/Frameworks/`.

3. Replace the `on_check_updates` stub in `agent/menubar.py` with a `pyobjc` bridge:

   ```python
   def on_check_updates(self, _sender):
       try:
           from Foundation import NSBundle
           bundle = NSBundle.bundleWithPath_(
               os.path.join(os.path.dirname(__file__), "..", "Frameworks", "Sparkle.framework")
           )
           if bundle is None or not bundle.load():
               raise RuntimeError("Sparkle.framework not loaded")
           SUUpdater = bundle.classNamed_("SUUpdater")
           SUUpdater.sharedUpdater().checkForUpdates_(None)
       except Exception as exc:
           rumps.notification("Detox", "Updates", f"Update check failed: {exc}")
   ```

4. Create `infra/build/sparkle_sign.sh`:

   ```bash
   #!/bin/bash
   set -euo pipefail
   DMG="${1:?path to .dmg required}"
   PRIV_KEY="${SPARKLE_PRIV_KEY:?Set SPARKLE_PRIV_KEY to private key path}"
   ./Sparkle.framework/Resources/sign_update -f "$PRIV_KEY" "$DMG"
   ```

5. Create `infra/build/appcast.xml.tmpl` matching spec §6, with `__VERSION__`, `__BUILD__`, `__URL__`, `__LENGTH__`, `__SIGNATURE__` placeholders. The release runbook in `infra/build/README.md` documents the substitution flow.

6. Update `Info.plist.tmpl` so `SUPublicEDKey` is replaced from `infra/build/sparkle.pub` (a one-line file produced by `Sparkle/bin/generate_keys`; private key stays off-repo). `build.sh` runs `sed -i '' "s|__SPARKLE_PUB_KEY__|$(cat sparkle.pub)|" Info.plist.tmpl` before py2app copies it.

7. Smoke (cert-blocked): once certs are in hand, point `SUFeedURL` at a test appcast publishing 1.0.0 → 1.0.1. **Check for Updates…** prompts, downloads, relaunches, version reads `1.0.1`. Until certs exist, the bridge no-ops with a Sparkle-not-loaded notification (acceptable in dev).

8. Commit:

   ```
   git add infra/build/setup.py infra/build/sparkle_sign.sh infra/build/appcast.xml.tmpl infra/build/Sparkle.framework agent/menubar.py
   git commit -m "feat(agent): Sparkle framework + appcast + EdDSA signing"
   ```

---

## Task 7 — Tests: monitor lifecycle + sync-queue idempotency

**Files:**

- Create: `agent/tests/__init__.py`, `agent/tests/test_monitor_lifecycle.py`, `agent/tests/test_sync_queue.py`
- Modify: `agent/monitor.py` (only if mocking surface needs minor seams)

**Steps:**

1. `agent/tests/test_monitor_lifecycle.py` covers:

   - `Monitor.start_in_thread()` returns a live thread; `is_alive()` is True after one tick.
   - `Monitor.stop()` ends the loop within `2 * POLL_INTERVAL`.
   - Double-stop is idempotent.
   - In-flight session gets closed in the `finally` (mock `record_session` and assert it's called once with start ≤ end).
   - `osascript` and `ioreg` are mocked via `monkeypatch.setattr(subprocess, "run", ...)` so the test runs cross-platform once CI exists.

2. `agent/tests/test_sync_queue.py` covers:

   - After `init_db`, `sync_state.device_id` is a UUID v4.
   - `record_usage`, `record_session`, `record_pickup` each enqueue exactly one matching `sync_queue` row in the same transaction.
   - Calling `record_*` with the same `(kind, row_id)` twice is a no-op via `INSERT OR IGNORE`.
   - `sync.pending_count()` reflects the row count.
   - Use a tmp-path SQLite: `monkeypatch.setattr(config, "DB_PATH", str(tmp_path / "test.db"))` and re-import `database` if needed.

3. Add a tiny `conftest.py` if both tests share fixtures. Otherwise inline.

4. Smoke: `pytest agent/tests/`. Both files green; total runtime under 5 s.

5. Commit:

   ```
   git add agent/tests/
   git commit -m "test(agent): monitor lifecycle and sync-queue idempotency"
   ```

---

## Task 8 — Install docs

**Files:**

- Modify: `README.md`

**Steps:**

1. Add an **Install (DMG)** section above the existing dev-mode section:

   - Link to `https://detox.app/releases/Detox-1.0.0.dmg`.
   - Drag-to-Applications instructions.
   - Grant Accessibility on first run (System Settings → Privacy & Security → Accessibility → enable Detox).
   - Click the menu-bar lantern, toggle **Launch at Login**.
   - Open Dashboard → `localhost:5050`.
   - Note: Sparkle keeps it patched; no manual updates needed.

2. Add an **Install (Homebrew)** subsection: `brew tap mason-cao/detox && brew install --cask detox` (cask formula PR is a follow-up; tap-only initially per spec §8).

3. Keep the existing **Dev (from source)** section — `./start.sh` for the headless path, `python3 -m agent` for the menu-bar path.

4. Commit:

   ```
   git add README.md
   git commit -m "docs: README install instructions for the DMG path"
   ```

---

## Task 9 — Full smoke + PR + tag

**Steps:**

1. `pytest agent/tests/` — green.

2. `python3 -m agent` from a clean checkout:

   - Menu-bar lantern appears (`🔆`).
   - **Open Dashboard** → `localhost:5050`, every tab renders, Total time today increments.
   - **Pause tracking** → glyph `🌙`, today counter freezes; **Resume tracking** → counter resumes.
   - **Launch at Login** toggle creates/removes `~/Library/LaunchAgents/com.detox.agent.plist`; `launchctl list | grep com.detox.agent` reflects it.
   - **Open Logs** reveals `data/monitor.log` in Finder.
   - **Quit Detox** removes `data/monitor.pid`.

3. `sqlite3 data/screentime.db "SELECT COUNT(*) FROM sync_queue"` non-zero after a minute. `device_id` is a UUID.

4. (Cert-blocked path, run only once certs exist):

   - `infra/build/build.sh 1.0.0` produces a notarized `Detox.app` and signed `Detox-1.0.0.dmg`.
   - `spctl --assess --type execute -vv dist/Detox.app` → `accepted, source=Notarized Developer ID`.
   - Drag `Detox.app` to `/Applications`, double-click, grant Accessibility, full smoke from step 2 against the bundled binary.
   - Point `SUFeedURL` at a test 1.0.0 → 1.0.1 appcast; **Check for Updates…** prompts, downloads, relaunches, version reads `1.0.1`.

5. Push + PR:

   ```bash
   git push -u origin feat/phase-3-agent-packaging
   gh pr create --title "feat(agent): Phase 3 — packaging, menu-bar, sync queue" --body "$(cat <<'EOF'
   ## Summary
   - rumps menu-bar app owns Monitor + Flask threads; status glyph, pause, dashboard, quit, launch-at-login, update check.
   - `sync_queue` + `sync_state` tables and `agent/sync.py` ready for Phase 4 to drain.
   - py2app build + Info.plist + DMG/codesign/notarize pipeline (cert-gated steps land when Apple Developer ID is in hand).
   - Sparkle 2.x framework vendored; appcast template + EdDSA signing helper.
   - First pytest coverage: monitor lifecycle + sync-queue idempotency.
   - README documents the DMG install path.

   ## Out of scope
   - Phase 4 cloud ingest — `flush()` is a no-op.
   - SMAppService migration — LaunchAgent plist for now.
   - Notarization CI — manual until release cadence justifies it.
   - Final icon art — placeholder icns until art lands.

   ## Verification
   - [ ] `pytest agent/tests/` green.
   - [ ] `python3 -m agent` shows the menu-bar lantern; Pause / Resume flips the glyph.
   - [ ] Open Dashboard / Open Logs / Launch at Login work.
   - [ ] `sync_queue` accumulates rows; `device_id` is a UUID.
   - [ ] (Once certs exist) `infra/build/build.sh 1.0.0` produces a notarized DMG; Sparkle 1.0.0 → 1.0.1 update applies.
   EOF
   )"
   ```

6. After merge: `git checkout main && git pull && git tag phase-3-complete && git push origin phase-3-complete`.

---

## Risks & follow-ups

- **Cert procurement is on the critical path.** Tasks 1–4 + 7–8 ship without certs. Tasks 5–6 land once Apple Developer ID + Sparkle keys exist. Spec §13.
- **Two-thread Python process.** `rumps` (NSRunLoop) plus Flask plus a polling thread is unusual. If signal handling or event-loop interactions misbehave, fall back to a two-process model coordinated by `data/monitor.pid` (the menu-bar app spawns `python3 -m agent.monitor` as a subprocess).
- **`pyobjc` ↔ Sparkle indirection.** Pin Sparkle to a tested minor version; bumping Sparkle without a smoke test risks silent breakage of **Check for Updates…**.
- **First notarization round commonly fails** on hardened-runtime entitlements. Plan a debug round before the first public release. `pyobjc` typically needs `com.apple.security.cs.allow-unsigned-executable-memory`.
- **Permission revocation mid-session.** `osascript` returns `None` silently when Accessibility is revoked; the menu glyph should flip to `🚫` and surface a one-click Settings link. Wired in a follow-up — Task 1 stubs `_permission_denied = False`.
- **Offline queue retention.** The 100k-row cap (spec §7) is a guess. Revisit after Phase 4 sees real usage.
- **`SMAppService` deprecation pressure.** Apple wants `LaunchAgent` plists gone; the modern API requires the app to be in `/Applications` and signed. Migrate after the first signed release ships.
- **Final icon art.** `icon.icns` is a placeholder; commission art alongside Phase 1 sprite work.
- **Homebrew tap traction gate.** Spec §8 holds the `homebrew-cask` PR until ~100 active installs. Track install count from Sparkle telemetry (Phase 5).
