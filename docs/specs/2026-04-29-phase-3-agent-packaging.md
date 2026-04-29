# Phase 3 — Agent Packaging

Date: 2026-04-29
Status: Draft — pending implementation plan
Owner: Mason Cao

## 1. Summary

Phase 3 turns the agent from a `python3 -m agent.monitor` background process into a signed, notarized `.app` bundle that the user can drop into `/Applications`, launch at login, and quietly forget. It adds a menu-bar surface (status + pause + open dashboard), a `py2app` build pipeline, an Apple-signed and notarized DMG, a Sparkle appcast for in-place updates, and a local SQLite buffer with an idempotent offline queue that Phase 4 will drain to the hosted ingest endpoint.

The Flask dashboard stays unchanged — it is still served by the agent on `localhost:5050`. What changes is how the user runs the agent: instead of an open terminal, they have a menu-bar lantern.

`feat(agent): extract monitor into library, keep CLI entrypoint` already shipped (28946c3) — `Monitor.run()` is now a pure poll loop with `Monitor.stop()`, and a `run_cli()` wrapper handles PID file + signal handling. The menu-bar app embeds `Monitor` directly via the same library surface.

## 2. Goals & non-goals

**Goals:**
- One-click install: drag `Detox.app` from a DMG into `/Applications`, run it, grant Accessibility, done.
- Menu-bar presence with the four controls a user actually wants: status glance, pause/resume, open dashboard, quit.
- Login launch via `LSUIElement` + a `LaunchAgent` plist registered on first run.
- Apple Developer ID signing + notarization so Gatekeeper does not warn.
- Sparkle EdDSA appcast so security patches roll out without a reinstall.
- Local SQLite buffer with an idempotent ingest queue, scoped so Phase 4 can swap the destination from "stay local" to "post to API".

**Non-goals:**
- Mac App Store distribution. Sandbox would forbid `pkill -x` and many `osascript` calls. We stay outside the store.
- Auto-launch of restricted apps when bedtime ends. Restrictions remain *enforced*, not *scheduled-restored*.
- Multi-Mac sync. The buffer is single-device; cross-device merging happens server-side in Phase 4.
- A SwiftUI menu-bar rewrite. `rumps` is fine for the four controls we need.
- An installer (`.pkg`). DMG-and-drag is the macOS convention; `.pkg` invites a custom-installer-trojan reputation.
- Auto-updates with privilege escalation. Sparkle runs in user space, never asks for admin.

## 3. Menu-bar app

A `rumps`-based `NSStatusItem` lives in the menu bar. Title is a single Unicode glyph that doubles as the lighthouse status pulled from `/api/status`:

| Glyph | State | Trigger |
| ----- | ----- | ------- |
| `🔆` | Active | Monitor thread alive, last poll within 6 s |
| `🌙` | Paused | User toggled pause; monitor thread `.stop()`-ed |
| `⚠` | Stalled | Last poll older than 30 s, or thread crashed |
| `🚫` | Permission denied | `osascript` returned an Accessibility-permission error |

Menu items, top to bottom:

1. **Detox — &lt;status word&gt;** — disabled label. "Active", "Paused", "Stalled (last poll 47s ago)", "Needs Accessibility".
2. **Today: 1h 47m** — disabled label, refreshed every 30 s from `db.get_daily_total(today)`.
3. *(separator)*
4. **Pause tracking** ⌘P / **Resume tracking** ⌘P — toggles `Monitor.stop()` ↔ `Monitor.start()`.
5. **Open Dashboard** ⌘D — `webbrowser.open("http://localhost:5050")`.
6. **Open Logs** — reveals `data/monitor.log` in Finder.
7. *(separator)*
8. **Launch at Login** — checkmark toggle, persists to `settings.launch_at_login`. On set, writes `~/Library/LaunchAgents/com.detox.agent.plist`; on unset, removes it.
9. **Check for Updates…** — Sparkle's update check (see §6).
10. **Quit Detox** ⌘Q — `monitor.stop()`, joins the thread, removes PID file, exits.

The app process owns:
- A `Monitor` instance running on a background thread (`threading.Thread(target=monitor.run, daemon=True)`).
- The Flask server on a second thread, replacing the separate process model.
- The `rumps.App` event loop on the main thread.

Pause behavior: `Monitor.stop()` flips `running = False` and the loop exits. Resume creates a fresh `Monitor` instance and starts a new thread. The session-close `try/finally` already ensures no in-flight session bleeds across the gap.

A11y: menu items are keyboard-reachable via the macOS menu-bar focus ring (`Ctrl+F8`). Status word is exposed verbatim so VoiceOver reads it without glyph soup.

## 4. Bundle layout

```
Detox.app/
  Contents/
    Info.plist
    MacOS/
      Detox                    # py2app stub binary, launches Python
    Resources/
      __boot__.py              # py2app bootstrap
      app/                     # frozen Python — agent/, web/, api/ readers
      web/                     # static files served by Flask
      icon.icns
      Sparkle.framework/
    Frameworks/
      Python.framework/
    _CodeSignature/
```

Key `Info.plist` keys:

- `CFBundleIdentifier`: `com.detox.agent`
- `LSUIElement`: `true` (no Dock icon, menu-bar only)
- `LSMinimumSystemVersion`: `12.0` (Monterey — earliest reasonable macOS for current `py2app` + Apple Silicon support)
- `NSAppleEventsUsageDescription`: "Detox needs to read the frontmost application to track screen time."
- `NSHumanReadableCopyright`: "© 2026 Mason Cao"
- `SUFeedURL`: appcast endpoint (see §6)
- `SUPublicEDKey`: Sparkle EdDSA public key

## 5. Build & signing

Build pipeline lives in `infra/build/`:

- `setup.py` — `py2app` config. `OPTIONS = {"argv_emulation": False, "iconfile": "icon.icns", "plist": {...}, "packages": ["agent", "api", "flask", "rumps"], "frameworks": ["Sparkle.framework"]}`.
- `build.sh` — entrypoint:
  1. `python3 setup.py py2app` → produces `dist/Detox.app`.
  2. `codesign --deep --force --options runtime --sign "Developer ID Application: Mason Cao (TEAMID)" dist/Detox.app` — hardened runtime is required for notarization.
  3. `xcrun notarytool submit dist/Detox.app.zip --apple-id … --team-id … --keychain-profile detox-notary --wait` — blocks until Apple confirms notarization.
  4. `xcrun stapler staple dist/Detox.app` — embeds the notarization ticket so the bundle works offline.
  5. `hdiutil create -volname "Detox" -srcfolder dist/Detox.app -ov -format UDZO dist/Detox-${VERSION}.dmg` — DMG packaging.
  6. `codesign --sign "Developer ID Application: …" dist/Detox-${VERSION}.dmg` — the DMG itself is also signed.
- `notarize.sh` — split out so re-notarization (e.g. cert rotation) is one command.
- `sparkle_sign.sh` — runs `Sparkle/bin/sign_update Detox-${VERSION}.dmg` to produce the EdDSA signature for the appcast entry.

Signing inputs the project must own before this phase ships:

- Apple Developer ID Application certificate, installed in the macOS keychain on the build machine.
- App-specific password for `notarytool`, stored in a `keychain-profile` named `detox-notary`.
- Sparkle EdDSA key pair generated via `Sparkle/bin/generate_keys` — public key embedded in `Info.plist`, private key kept off-repo (1Password).

Signing & notarization are blockers (spec §13). Phase 3 work that does not depend on certificates — the menu-bar app, the offline buffer, the `py2app` config — can land first; the build/sign/notarize pipeline lands once the cert is in hand.

## 6. Sparkle update flow

Sparkle 2.x is vendored as a framework inside `Detox.app/Contents/Frameworks/`. The agent calls `Sparkle.SUUpdater` via `pyobjc` on launch and on the **Check for Updates…** menu item.

Appcast lives at `https://detox.app/appcast.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Detox</title>
    <item>
      <title>Detox 1.1.0</title>
      <pubDate>Mon, 12 May 2026 17:00:00 +0000</pubDate>
      <sparkle:version>110</sparkle:version>
      <sparkle:shortVersionString>1.1.0</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>
      <enclosure
        url="https://detox.app/releases/Detox-1.1.0.dmg"
        length="48374912"
        type="application/octet-stream"
        sparkle:edSignature="..." />
      <description><![CDATA[<ul><li>Bug fixes.</li></ul>]]></description>
    </item>
  </channel>
</rss>
```

Hosting:
- The appcast XML and the signed DMG live on a static bucket fronted by Cloudflare Pages (the same project that will host the dashboard in Phase 4 — DNS records added now).
- Each release is uploaded by hand by the maintainer; an automation lands later.
- `sparkle:edSignature` comes from `sparkle_sign.sh`. Sparkle refuses an update whose signature does not verify against the embedded `SUPublicEDKey`.

Update cadence: Sparkle checks every 24 h after launch by default; the **Check for Updates…** menu item forces an immediate check. Updates download in the background; the user is prompted to relaunch.

Rollback: there is no automatic downgrade. If a release ships broken, publish a new appcast entry with a higher version and the older binary, so users move forward off the bad build.

## 7. Offline buffer schema

The agent already writes to a local SQLite database. Phase 3 introduces a *queue* on top of it so the agent can post deltas to the hosted API in Phase 4 without re-uploading every row on every sync.

Two new tables:

```sql
CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('app_usage', 'session', 'pickup')),
    row_id INTEGER NOT NULL,                  -- FK back to app_usage.id / sessions.id / pickups.id
    payload_json TEXT NOT NULL,               -- denormalized snapshot; survives source-row deletion
    queued_at REAL NOT NULL,
    UNIQUE (kind, row_id)
);

CREATE INDEX idx_sync_queue_queued_at ON sync_queue(queued_at);

CREATE TABLE sync_state (
    key TEXT PRIMARY KEY,
    value TEXT
);
-- Keys: 'device_id' (UUID, generated on first run), 'last_sync_at' (epoch),
-- 'last_sync_status' ('ok' | 'offline' | 'error: …').
```

Triggers:

- `record_usage`, `record_session`, and `record_pickup` each `INSERT` a `sync_queue` row in the same transaction as the source-table insert. `INSERT OR IGNORE` on the unique constraint keeps it idempotent if a code path ever tries twice.
- A future `agent.sync.flush()` (Phase 4) reads `sync_queue` in `queued_at` order, batches into HTTP payloads, posts to `POST /v1/ingest`, and `DELETE`s rows that the server confirms via the idempotency key `(device_id, started_at, app_name)`.

`device_id` is a UUID v4 generated on first launch of the menu-bar app and stored once in `sync_state`. Phase 4's pairing flow reads it; the user never sees it.

The buffer is `app_usage`-shaped, not `sessions`-shaped, because Detox already aggregates usage on read (`COUNT(*) * 2.0 / 60.0`) — sending the raw 2-second polls is the only honest source of truth. Bandwidth concern: ~30 KB/day at typical use. Acceptable.

While Phase 4 is unimplemented, `flush()` is a no-op and the queue grows. A periodic `VACUUM`-on-rotate is out of scope for this phase; if the queue passes 100k rows before Phase 4 ships, we cap at the latest 90 days and discard older rows.

## 8. Distribution

Three channels, in priority order:

1. **Direct DMG** from `https://detox.app/releases/Detox-1.0.0.dmg`. Primary channel. Listed on the marketing landing page (Phase 6).
2. **Homebrew cask** — `brew install --cask detox`. The cask formula points at the same DMG and its SHA256. Lives in a maintainer-controlled tap (`mason-cao/homebrew-detox`) initially; a PR to `homebrew-cask` proper waits for ~100 active installs so reviewers see traction.
3. **Auto-update via Sparkle** — once installed, this is what almost every user experiences for new versions.

App Store distribution is rejected (§2 non-goals).

## 9. CLI behavior after packaging

`python3 -m agent.monitor` keeps working for development. `Detox.app` is what users get.

The shipped app's `MacOS/Detox` binary becomes the *only* supported entrypoint for end users; `start.sh` and `stop.sh` stay in-repo for development but are no longer the install path. Their `data/monitor.pid` semantics carry over unchanged (the menu-bar app uses the same path).

## 10. Testing & verification

There is now a pytest suite (`api/tests/`). Phase 3 adds:

- `agent/tests/test_monitor_lifecycle.py` — `Monitor.start_in_thread()`, `Monitor.stop()`, double-stop, in-flight-session close. Mocks `osascript` and `ioreg` so the test runs cross-platform during CI later.
- `agent/tests/test_sync_queue.py` — verifies that `record_usage` + `record_session` + `record_pickup` each enqueue a corresponding `sync_queue` row in the same transaction, and that `INSERT OR IGNORE` keeps the queue idempotent.

Manual verification path for the packaged app:

1. `infra/build/build.sh` produces `dist/Detox.app` and `dist/Detox-${VERSION}.dmg`.
2. `spctl --assess --type execute -vv dist/Detox.app` → "accepted, source=Notarized Developer ID".
3. Drag `Detox.app` to `/Applications`, double-click. Menu-bar lantern appears. Grant Accessibility when prompted.
4. Toggle **Pause tracking** → status glyph switches to `🌙`, `Today` counter freezes. Toggle back.
5. **Open Dashboard** → `localhost:5050` opens; data flows.
6. **Check for Updates…** with appcast pointed at a `1.0.0 → 1.0.1` test feed → Sparkle prompts, downloads, relaunches, version reads `1.0.1`.
7. Toggle **Launch at Login**, log out and back in → app launches automatically.
8. `sqlite3 data/screentime.db "select count(*) from sync_queue"` is non-zero after a minute.

## 11. Risks & follow-ups

- **Apple Developer cert procurement is on the critical path.** Until it lands, the build/sign/notarize/Sparkle work is blocked. Menu-bar app, library refactor, and offline buffer are not blocked and ship first.
- **`rumps` plus a Flask server in one process.** Two thread loops in one Python process is unusual and slightly fragile. If `rumps` and Flask interact badly (e.g. signal handling), fall back to two processes coordinated by the existing PID file.
- **`pyobjc` ↔ Sparkle bridging.** Sparkle is Objective-C; calling it from Python via `pyobjc` works but adds a layer of indirection per Sparkle release. Pin Sparkle to a tested minor version.
- **Notarization rejection.** The first notarization round commonly fails on hardened-runtime entitlements. Plan for a debug round before any release.
- **Offline queue retention.** The 100k-row cap (§7) is a guess; revisit after Phase 4 has real usage data.
- **Login-item entitlement.** `SMAppService` (the modern login-item API) requires the app to be in `/Applications` and signed. The fallback `LaunchAgent` plist works for unsigned dev builds but is what Apple wants to deprecate.
- **Permission resilience.** If the user revokes Accessibility mid-session, the monitor silently returns `None` from `osascript`. The status glyph should flip to `🚫` and the menu should surface a one-click Settings link.

## 12. Out-of-scope sketches

Mentioned for completeness, deferred:

- Per-app pause from the menu-bar (e.g. "Pause tracking Slack for 30 min"). Ergonomic but scope-creep on this phase.
- A native SwiftUI rewrite. Worth it only if/when `rumps` shows hard limits.
- Telemetry on update success/failure rates. Lands with the Phase 5 observability slice (Sentry + Plausible).
- A signed `.pkg` installer. We stay DMG-and-drag.
- Notarization automation in CI. Manual until release cadence justifies a runner.

## 13. Commit plan

Each commit is one atomic change. Ordering matches dependency, not value.

- `refactor(agent): extract monitor into library, keep CLI entrypoint` ✓ (28946c3)
- `feat(agent): rumps menu-bar app with status + pause + dashboard + quit`
- `feat(agent): launch-at-login toggle via LaunchAgent plist`
- `feat(agent): local sync queue (sync_queue + sync_state) wired into record_*`
- `build(agent): py2app config + Info.plist + bundle layout`
- `build(agent): codesign + notarytool + DMG packaging script`
- `feat(agent): Sparkle framework + appcast + EdDSA signing`
- `test(agent): monitor lifecycle and sync-queue idempotency`
- `docs: README install instructions for the DMG path`
