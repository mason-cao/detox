# Detox — Beta tester onboarding

**Effective:** 2026-05-07
**Audience:** Phase 5 invite cohort (10–20 testers), expected to be
comfortable with a terminal.

This doc is everything you need to install Detox from source, grant the
permissions it requires, optionally pair it to the cloud dashboard, and
file useful feedback.

If you read just one section, read **First-run permission**.

---

## What Detox is

Detox tracks your macOS screen time locally — a Python daemon polls the
frontmost application every 2 seconds via `osascript`, stores sessions
in SQLite, and serves a vanilla-JS dashboard (the "Isle") on
`localhost:5050`. Restrictions are enforced on-device with `pkill -x`.
Optionally you can pair the agent to a hosted Postgres + FastAPI tier
so any browser signed into your account sees the same data.

Read [`README.md`](../README.md) for the longer version. Read
[`docs/privacy.md`](privacy.md) and [`docs/terms.md`](terms.md) for the
privacy + license model.

---

## Prerequisites

- macOS 13+ (Intel or Apple Silicon).
- Python 3.9+ (`python3 --version`). 3.11 is what we run in CI.
- ~50 MB of disk for the local SQLite database to grow into.
- A terminal you can grant Accessibility permission to (System Settings
  prompts on first run).
- Optional: a Supabase magic-link account if you want to pair to the
  cloud dashboard.

---

## Install

```bash
git clone <repo-url> detox
cd detox
python3 -m pip install -r requirements.txt
./start.sh
```

`start.sh` initializes the SQLite schema, spawns the monitor in the
background, starts the Flask server, and opens
`http://localhost:5050` in your browser.

To stop: `./stop.sh` (or `Ctrl-C` if `start.sh` is running in the
foreground).

For the menu-bar app instead of the headless launcher:

```bash
python3 -m agent
```

This adds a 🔆 icon to your menu bar with Pause, Open Dashboard, Open
Logs, Launch at Login, Pair, Sync, Sign out.

---

## First-run permission

The monitor reads the frontmost application via AppleScript. macOS
gates this behind Accessibility:

**System Settings → Privacy & Security → Accessibility → enable
Terminal** (or whichever terminal app spawns the agent).

Without this, the agent runs but records no usage and the menubar icon
flips to 🚫. The dashboard will look empty even after several minutes.

If you grant it later, restart the agent (`./stop.sh && ./start.sh`).

---

## Pair to the cloud (optional)

Skip this section if you only want the local Mac dashboard.

```bash
./scripts/pair-cloud.sh
```

The script opens the agent's pair CLI against the bundled Railway
`DETOX_CLOUD_API_BASE`. From a browser, go to the deployed
`/pair.html`, sign in via Supabase magic link, and copy the 6-character
code into the CLI. The agent stores a long-lived JWT in your macOS
Keychain and starts pushing to `/v1/ingest` every 5 minutes.

If you're standing up your own Railway + Supabase instance, see
[`infra/railway/README.md`](../infra/railway/README.md).

---

## What to test

Please poke at all of these; they cover most of the surface. The first
two are mandatory; the others are nice-to-haves if you have time.

### Golden path (please do)

1. **Tracking** — leave Detox running for an hour of real work. Open
   Dashboard. Total time today should be non-zero. Apps you used
   should appear in the Residents Registry.
2. **Block enforcement** — go to **Rule Board** → add a block on an
   app you have installed (e.g. `Notes`). Try to launch that app.
   The agent should force-quit it within 2 seconds and a macOS
   notification should fire.

### Nice-to-haves

3. Set a daily-total **decree** (`Charter` tab) and intentionally go
   over it. Confirm Sunlight earnings stop and the weather glyph in the
   HUD turns overcast.
4. Spend Sunlight in the **Market**. Refund the item within 24h
   (should give 100%) and after toggling your system clock 2 days
   forward (should give 50%).
5. Toggle **Ghost Mode** in the Mayor's Study, sync once, and verify
   in your Postgres or Supabase project that recently-ingested rows
   carry `resident-XXXXXXXX` app names. Local SQLite should still
   show real names.
6. Mayor's Study → **Download Archive**. Confirm the JSON file
   contains every table and the row counts match what you expect.
7. Mayor's Study → **Delete Everything**. Confirm the modal requires
   typing `DELETE`, the wipe completes, and the dashboard reloads
   empty.

---

## Filing feedback

When you find something off, please file an issue with:

- **What you did** — exact steps, including which tab and which
  buttons.
- **What you expected** — one sentence.
- **What happened** — one sentence + a screenshot if visual.
- **Logs**, if relevant — `data/monitor.log` (last 50 lines is enough)
  and any browser DevTools console errors. Strip app names you'd
  rather not share before posting.
- **macOS + Python version** — `sw_vers -productVersion` and
  `python3 --version`.
- **Mode** — local-only, or paired (mention which Railway URL you
  paired against if it isn't the bundled one).

Where to file: open a GitHub issue on this repo. There is no triage
SLA during Phase 5; the maintainer reads and responds in batches.

For privacy or deletion requests email
[masoncao7@gmail.com](mailto:masoncao7@gmail.com) — see
[`docs/privacy.md`](privacy.md) §"Your rights".

---

## Reset / clean state

If you want to start over without uninstalling:

- **Wipe local data only:** Mayor's Study → Danger Zone → Delete
  Everything. Restart the agent so the schema reseeds.
- **Wipe everything including config:** `./stop.sh && rm -rf data/ &&
  ./start.sh`.
- **Unpair from cloud:** the menubar app's `Sign out` item, or just
  delete the JWT from Keychain (`com.detox.agent`) and remove the
  device from the cloud's `/api/data/delete`.

---

## Common issues

- **Empty dashboard after `./start.sh`** — probably Accessibility
  permission. Re-grant + restart.
- **Block doesn't kill the app** — `pkill -x` matches the process
  name, not the display name. Some apps differ (`Visual Studio Code`
  → `Code`). Add a mapping to `agent/config.py`'s default-categories
  table or file an issue noting the app and what `pgrep -l <name>`
  returns.
- **`./start.sh` says "Monitor already running"** — `./stop.sh` first,
  or `kill $(cat data/monitor.pid)` if `stop.sh` doesn't recognize
  it.
- **`./stop.sh` doesn't release the dashboard URL** — Flask was
  started in a separate shell. `lsof -i :5050` will tell you the PID
  to kill.
- **Pairing CLI hangs** — confirm `DETOX_CLOUD_API_BASE` resolves and
  responds at `<base>/v1/health`. The script defaults to a known
  Railway URL; override with `DETOX_CLOUD_API_BASE=...` if you've
  deployed your own.

---

## End of beta

When the Phase 5 cohort wraps up (target: 2 weeks from your invite
date), the maintainer will email a wrap-up survey and notes on what
changes for Phase 6. You can keep using Detox in the meantime — there
is no auto-expiring license.
