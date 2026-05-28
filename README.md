# Detox — local screen-time tracker, optional cloud dashboard

Detox is a macOS screen-time tracker that polls your frontmost app every 2 seconds, stores sessions locally, visualizes your habits as a pixel-art isle, and enforces blocks on-device with `pkill -x` + macOS notifications. It runs **entirely on your Mac** by default. Pair it to the optional hosted dashboard and you can also view your data from any browser, anywhere.

![Python](https://img.shields.io/badge/Python-3.9+-3776ab?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Flask](https://img.shields.io/badge/Flask-2.0+-000000?logo=flask)
![macOS](https://img.shields.io/badge/macOS-only-999999?logo=apple)
![License](https://img.shields.io/badge/License-MIT-green)

---

## What you get

### The Isle dashboard

- A real isometric SVG world replaces the dashboard grid. Every tracked app is a resident, every restriction is a law, every building is a destination.
- **Drag-to-pan** — click anywhere on the ground or sky and drag the camera. Touch works on mobile/iPad. Double-click re-centers.
- **Sophisticated terrain** — four green tile variants distributed by deterministic tile hash (no checkerboard), south-east shadow wedge per tile for fake elevation, scattered meadow decor (daisies, pebbles, grass tufts, bushes) on a hash-seeded distribution that skips building footprints.
- **Detailed buildings** — every building has iso depth (right-side wall panel + roof side slope), a base-shadow ellipse that fades when you hover, mullioned windows that light up at night, and ornaments that read its purpose: a clock + weather vane on Town Hall, ledger sign on Registry, full bazaar stall on Market, smoking chimney on Chronicle, scroll inset on Charter, complete rule hut with chalkboard, postcard + mailbox flag on Postcards, arched stained glass on Mayor's Study.
- **Day/night light pass** driven by the system clock. Soft dim and warm lantern glow above each building at dusk.
- **Live frontmost glow** on the resident marker representing your current app (3 s frontend poll, 2 s server cache).
- **Simple villager residents** keep app presence readable while gliding through eased routes. The active villager rises visually through glow and layer priority.
- **Visual compass map** stays available on the Isle as a small compass control with building pins; buildings remain the primary navigation surface.

### Tab signature animations

- **Charter** — wax seal stamps onto the scroll on goal save.
- **Rule Board** — chalk write left-to-right when a rule is added (with a dust burst), chalk wipe right-to-left when one is lifted.
- **Postcards** — preview slides in with overshoot, wax seal stamps the corner.
- **Market** — coin floats from the bought stall card up to the HUD currency badge.
- **Registry** — parchment page-turn between filter views.
- **Chronicle** — quill sweeps across the bar chart in sync with Chart.js bar growth.
- **Mayor's Study** — archive downloads and privacy controls stay in the wood-paneled settings room.
- Every animation has a no-motion equivalent gated on `prefers-reduced-motion: reduce`.

### Tracking + intervention

- **Residents Registry** (Apps tab) — every tracked app you've used and how long, by day. Search, filter, inline limit/block/categorize. Autocomplete pulls from tracked apps + installed `/Applications`.
- **Chronicle** (Statistics) — pickups count, checking frequency, longest detox, longest continuous use, first/last pickup, most-used app. Daily + weekly views with Chart.js.
- **Rule Board** (App Blocker) — block individual apps always or after a daily time limit, block by category, or run **Focus Mode** (whitelist-only). Blocked apps are force-quit (`pkill -x`) with a macOS notification.
- **Charter** (Goals) — daily total decree, per-app limits, bedtime bell.
- **Market** — closed-economy reward loop. Detoxed minutes earn ☀ Sunlight; streaks earn ✦ Starshards. Spend on 100 sectioned visual upgrades to the Isle. 100% refund within 24 h, 50% after. Hall of Honor records milestones.
- **Postcards** — generate a 1080×1920 PNG of the day's stats to share. (Local agent only — cloud renders the rest of the dashboard but card generation needs Pillow on the device.)
- **Mayor's Study** (Settings) — idle timeout, **Ghost Mode** toggle (hash app names before they leave the Mac), CSV/JSON range exports, **full archive** JSON download, **Delete Everything** with typed confirmation, categories, keyboard shortcuts. Links to the in-repo [privacy policy](docs/privacy.md) and [terms of service](docs/terms.md).

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1`–`8` | Jump to tab (Isle, Residents, Chronicle, Charter, Rule Board, Market, Postcards, Study) |
| `← →` | Navigate dates |
| `/` | Search residents |
| `?` | Open help / tour |
| `Esc` | Back to the Isle (or close the open overlay) |

---

## Install

### A. GitHub preview app (recommended)

Detox is available as a public GitHub preview while signed Developer ID builds are still pending.

1. Download `Detox-preview-<version>.dmg` from [GitHub Releases](https://github.com/mason-cao/detox/releases). This is the primary preview package.
2. Open the DMG and drag `Detox.app` into `/Applications`.
3. First launch: right-click `Detox.app`, choose **Open**, then confirm the macOS warning.
4. Grant Accessibility when macOS asks: **System Settings -> Privacy & Security -> Accessibility -> Detox**.
5. Click the Detox lantern in the menu bar and choose **Open Dashboard**.

This preview is unsigned. macOS will say the developer cannot be verified until Detox has an Apple Developer ID. If the DMG gives you trouble, download `Detox-preview-<version>.app.zip`, unzip it, move `Detox.app` into `/Applications`, then use the same right-click **Open** flow.

### B. Source install (fallback)

The agent + Flask dashboard can still run entirely from source. Data lives in `data/screentime.db` and never leaves the machine unless you pair the optional hosted dashboard.

```bash
git clone https://github.com/mason-cao/detox.git
cd detox
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r requirements.txt
python3 -m agent
```

This adds the Detox lantern (🔆) to your menu bar with **Pause tracking**, **Open Dashboard**, **Open Logs**, **Launch at Login**, **Pair this device**, **Sync now**, and **Sign out** items. If the menu-bar app does not start, `./start.sh` runs the headless local dashboard instead. Full source-install notes live in [`docs/source-install.md`](docs/source-install.md).

### C. Local agent + hosted dashboard (optional)

You can also pair the local agent to a hosted FastAPI service so any browser signed into your Supabase account sees the same data. The Mac still does all collection — the cloud is the storage + dashboard layer for **your** devices, not a multi-user product.

After pairing, every browser window signed into your account at `https://<your-railway-app>.up.railway.app` shows the live Isle, mirroring whatever your Mac is tracking. You still get Focus Mode and `pkill`-based enforcement on the Mac; the cloud is read-mostly (rule edits flow cloud → agent within 30 s via the rules puller).

To stand up your own cloud instance, see [`infra/railway/README.md`](infra/railway/README.md) and [`infra/phase-4-smoke.md`](infra/phase-4-smoke.md). The short version:

1. Create a Supabase project. Run the alembic migrations against its Postgres.
2. Create a Railway project, add a Redis add-on, set the Supabase + device-JWT env vars, `railway up`.
3. From the deployed web app, hit `/pair.html` to mint a 6-character code.
4. On your Mac, run `./scripts/pair-cloud.sh` and paste the code. The agent stores a long-lived JWT in the macOS Keychain and starts pushing to `/v1/ingest` every 5 min.

The agent's pairing CLI tells you the pair page URL based on the `DETOX_CLOUD_API_BASE` env var. The launcher script defaults to the bundled URL — edit it for your own deployment.

### First-run permissions

The monitor reads the frontmost app via `osascript`. macOS prompts on first run:

**System Settings -> Privacy & Security -> Accessibility -> enable Detox** for the app preview, or enable Terminal (or whichever terminal app spawns the agent) for the source install.

Without this, the agent runs but records nothing, and the menu-bar icon flips to 🚫.

---

## How it works

### Local stack

```
┌──────────────┐    osascript       ┌────────────────┐
│ macOS         │ ◄──(every 2s)──── │ Monitor daemon │
│ frontmost app │                   │ (agent/)       │
└──────────────┘                    └────────┬───────┘
                                             │ writes
                                             ▼
                                    ┌────────────────┐
                                    │ SQLite (WAL)   │
                                    │ data/          │
                                    └────────┬───────┘
                                             │ reads
                                             ▼
┌──────────────┐    same-origin     ┌────────────────┐
│ Browser      │ ◄──/api/* + web──  │ Flask          │
│ localhost    │                    │ (agent/server) │
└──────────────┘                    └────────────────┘
```

- **Monitor** polls `osascript` every 2 s, records usage, detects pickups (screen unlock → app use), enforces blocks, checks goals.
- **SQLite** in WAL mode — raw usage observations, sessions, pickups, goals, blocks, settings, sync queue, rewards ledger.
- **Flask** serves the REST API and the static `web/` bundle on `127.0.0.1:5050`. Every route is wrapped by `@api_route` (500-on-exception, 400-on-invalid-date).

### Hybrid + cloud (when paired)

```
USER'S MAC                              RAILWAY                 SUPABASE
┌───────────────────────────┐    ┌─────────────────────┐    ┌────────────┐
│ Monitor (2s poll)         │    │ FastAPI             │    │ Postgres   │
│ ├─ SQLite (sessions, q)   │    │ ├─ Supabase JWT vfy │    │ + Auth     │
│ ├─ sync.flush /5min       │ JWT├─ /v1/ingest         │ DB ├─ users    │
│ └─ rules.pull /30s        │◄──►│ ├─ /v1/rules (etag) │◄──►│ ├─ devices │
│                           │    │ ├─ /v1/rewards/*    │    │ ├─ usage   │
│ Local Flask still serves  │    │ ├─ /api/* (Postgres)│    │ ├─ rewards │
│ the same dashboard at     │    │ └─ web/ static      │    │ └─ ...     │
│ localhost:5050.           │    │                     │    └────────────┘
│                           │    │ Redis (rate limit + │
│                           │    │ rules etag cache)   │
└───────────────────────────┘    └─────────────────────┘
                                          ▲
                                          │  Supabase JWT
                                 ┌────────┴────────┐
                                 │ Browser at      │
                                 │ <railway-app>   │
                                 └─────────────────┘
```

- **Agent → cloud:** `agent.sync.SyncPusher` flushes `sync_queue` to `POST /v1/ingest` every 5 min. `agent.rules.RulesPuller` pulls `/v1/rules` every 30 s with `If-None-Match` (Redis-cached etag, busted on rule writes). The blocker reads from `cloud_*_mirror` SQLite tables seeded by the puller, so cloud rules become local restrictions.
- **JWT auth:** Supabase signs user JWTs (ES256). The api fetches the JWKS once per hour, caches it, and verifies locally. Device JWTs are HS256 with a server secret, issued by `POST /v1/devices/pair-claim` and stored in the macOS Keychain via `keyring`.
- **RLS:** every Postgres query runs inside a transaction that has executed `SET LOCAL app.current_user_id = '<uuid>'`. Tenants cannot read each other's rows even with a hand-crafted query.
- **Rate limit:** per-device 60 ingest req/min via `INCR rl:ingest:{device}:{minute}` on Redis with a 70 s expiry.

---

## Project layout

```
detox/
├── start.sh / stop.sh           # local-mode launchers (Flask + monitor + browser)
├── requirements.txt             # Flask, Pillow, rumps, PyObjC, keyring, requests
├── railway.toml                 # Railway service config (build from api/Dockerfile)
├── scripts/
│   └── pair-cloud.sh            # one-shot: run agent.cli.pair against Railway URL
├── agent/                       # On-device macOS daemon
│   ├── monitor.py               # 2s frontmost-app poll + pickups + bedtime + blocks
│   ├── server.py                # Flask: /api/* (SQLite) + serves web/ + /config.js
│   ├── database.py              # SQLite schema, queries, sync_queue, rewards rollup
│   ├── blocker.py               # `pkill -x` + notification on block
│   ├── notifier.py              # macOS Notification Center via osascript
│   ├── cards.py                 # Pillow PNG postcard generator (1080×1920)
│   ├── menubar.py               # rumps menu-bar app, pair/sync/sign-out
│   ├── launch_agent.py          # Launch-at-Login plist install/uninstall
│   ├── keychain.py              # macOS Keychain JWT storage (com.detox.agent)
│   ├── cloud.py                 # requests.Session w/ retry + bearer injection
│   ├── sync.py                  # SyncPusher: drains sync_queue → /v1/ingest
│   ├── rules.py                 # RulesPuller: /v1/rules with If-None-Match → mirror tables
│   ├── config.py                # paths, defaults, categories, market catalog
│   ├── cli/pair.py              # python3 -m agent.cli.pair
│   └── tests/                   # pytest sweep over the agent
├── api/                         # Hosted FastAPI service (Railway target)
│   ├── Dockerfile               # Two-stage Python 3.11-slim image
│   ├── alembic.ini + migrations/  # Postgres schema (4 migrations)
│   ├── pyproject.toml           # fastapi, uvicorn, sqlalchemy, alembic, psycopg, pyjwt, redis
│   ├── app/
│   │   ├── main.py              # FastAPI factory, mounts web/ at /, /config.js
│   │   ├── config.py            # Settings dataclass (env-driven)
│   │   ├── auth.py              # supabase + device JWT dispatch
│   │   ├── supabase_auth.py     # JWKS-cached verifier (ES256/RS256/EdDSA)
│   │   ├── device_auth.py       # HS256 issuer/verifier for paired devices
│   │   ├── db.py                # SQLAlchemy engine + per-request RLS GUC
│   │   ├── redis_client.py      # pool + rate-limit + etag cache helpers
│   │   ├── routers/             # /v1/* and Postgres-backed /api/*
│   │   │   ├── ingest.py        # /v1/ingest with idempotent inserts + rate limit
│   │   │   ├── rules.py         # /v1/rules with etag cache + 304
│   │   │   ├── devices.py       # /v1/devices/{pair-init, pair-claim, heartbeat}
│   │   │   ├── rewards.py       # /v1/rewards/* and /v1/milestones
│   │   │   ├── dashboard.py + apps.py + blocks.py + goals.py + settings.py
│   │   │   └── compat.py        # /api/dashboard/now, /api/changelog, /api/stats/*, /api/status, /api/market/*
│   │   └── services/            # business logic, all Postgres
│   └── tests/                   # pytest contract + auth + ingest + rules + rewards
├── web/                         # Vanilla HTML/CSS/JS — served by both Flask + FastAPI
│   ├── index.html               # SPA shell, loads /config.js + auth.js + cloud.js
│   ├── sign-in.html             # Supabase magic-link entry
│   ├── pair.html                # Generates pairing code, polls for claim
│   ├── css/
│   │   ├── tokens.css           # Dawn Cove palette + spacing scale
│   │   ├── pixel-ui.css         # Pixel buttons, panels, modals
│   │   ├── isle.css             # Iso world stage, tiles, decor, vignette, drag cursors
│   │   ├── compass.css          # Visual compass map HUD
│   │   ├── hud.css, residents.css, effects.css, views.css, style.css
│   ├── js/
│   │   ├── auth.js              # Supabase client + session manager (with local-dev shim)
│   │   ├── cloud.js             # auth-aware fetch wrapper
│   │   ├── pair.js              # pair page logic
│   │   ├── app.js               # router, API client, toasts, shortcuts
│   │   ├── iso.js               # tile projection + tile hash + shadow wedge
│   │   ├── world.js             # SVG scaffold, sky, weather, panZ, ground decor
│   │   ├── buildings.js         # 8 building generators with iso depth
│   │   ├── compass.js           # visual compass map HUD
│   │   ├── effects.js           # waxSeal, chalkDust, currencyFloat, pageTurn, slamIn
│   │   ├── residents.js         # smooth villager residents + frontmost glow
│   │   ├── isle.js              # mounts world + residents + signboards
│   │   └── dashboard.js + apps.js + stats.js + goals.js + blocker.js + market.js + cards.js + settings.js
├── infra/
│   ├── docker-compose.dev.yml   # Local Postgres + Redis for dev
│   ├── railway/README.md        # Runbook: project init, env wiring, deploy, alembic
│   ├── cloudflare/              # Optional Pages config (skipped in current deploy)
│   ├── phase-4-smoke.md         # First-deploy smoke checklist
│   └── build/                   # py2app + Sparkle scaffolding (Phase 3)
├── docs/
│   ├── specs/                   # Design specs (source of truth for the redesign)
│   ├── plans/                   # Implementation plans, one per phase
│   └── adr/                     # Architecture decision records
└── data/                        # Runtime, gitignored
    ├── screentime.db            # SQLite WAL
    ├── monitor.pid              # PID file (singleton guard)
    └── cards/                   # Generated postcard PNGs
```

---

## Tech stack

| Component | Technology |
|---|---|
| Local agent | Python 3.9+, Flask, rumps, Pillow |
| Local DB | SQLite (WAL mode) |
| Cloud api | FastAPI (Python 3.11), uvicorn, SQLAlchemy 2 |
| Cloud auth | Supabase Auth (magic-link + Google), JWKS-verified ES256 JWTs |
| Cloud DB | Supabase Postgres 17 with RLS scoped via `app.current_user_id` GUC |
| Cloud cache | Redis (Railway add-on) — rate limit + rules etag |
| Hosting | Railway (api + Redis), Supabase (Postgres + Auth) |
| Web | Vanilla HTML/CSS/JS — no bundler, no Node |
| Charts | Chart.js 4.4.1 (CDN) |
| Fonts | Press Start 2P, VT323, Inter (Google Fonts) |
| Resident markers | Programmatic SVG villagers, eased RAF movement, no sprite atlas dependency |
| App detection | `osascript` (AppleScript) — macOS only |
| App blocking | `pkill -x` (process executable name match) |
| Notifications | macOS Notification Center via `osascript` |
| Postcard PNGs | Pillow (PIL) — local agent only |

---

## Status (May 2026)

| Phase | What | State |
|---|---|---|
| 0 | Monorepo reorg (`agent/`, `api/`, `web/`, `infra/`) | ✅ shipped |
| 1 | Detox Isle redesign (HUD, residents, world, tab animations) | ✅ shipped |
| 2 | FastAPI port + Postgres scaffolding | ✅ shipped |
| 3 | py2app `.app` bundle + menu-bar + local sync queue + Sparkle/DMG scaffolding | ✅ shipped (signed release cert-gated) |
| 4 | Auth + cloud — Supabase, RLS, ingest, rules puller, server-authoritative rewards, Railway deploy | ✅ shipped |
| 5 | Privacy — Ghost Mode (hashed app names), full archive export, one-click delete, in-repo privacy/TOS docs | ✅ shipped |
| 5+ | Public launch — GitHub preview DMG/zip now, signed DMG later | 🚧 in progress |

The GitHub preview ships an unsigned `Detox.app` inside a DMG, with a zip fallback. Signed/notarized builds, Sparkle updates, and a Homebrew cask still wait on an Apple Developer ID and release signing keys.

**Cloud is single-tenant per deployment** — anyone signing in with a Supabase magic link gets routed to their own user row. There's no invite gate in the launch plan; if you stand up an instance and someone has the URL + a Supabase email, they get a separate account.

---

## Tests

```bash
python3 -m pytest agent/tests api/tests -q
```

The api tests skip Postgres- and Redis-marked cases unless `DETOX_TEST_DATABASE_URL` and `DETOX_TEST_REDIS_URL` point at reachable instances. The agent tests run pure-Python against a tmp SQLite file. Visual / restriction behavior (real `pkill`, real `osascript`, real browser drag) is verified manually.

---

## Local dev quick reference

```bash
# Agent (menu bar + Flask + monitor)
python3 -m agent

# Headless (Flask + monitor + browser)
./start.sh
./stop.sh

# Just the monitor (foreground)
python3 -m agent.monitor

# Just the Flask server (foreground)
python3 -m agent.server

# Re-init the SQLite schema
python3 -c "from agent.database import init_db; init_db()"

# Pair against a deployed cloud
./scripts/pair-cloud.sh

# Run the FastAPI cloud locally against docker-compose Postgres + Redis
docker compose -f infra/docker-compose.dev.yml up -d
DETOX_DATABASE_URL=postgresql+psycopg://detox:detox@localhost:5432/detox \
DETOX_REDIS_URL=redis://localhost:6379/0 \
DETOX_AUTH_MODE=local DETOX_DEV_TOKEN=dev DETOX_DEV_USER_ID=$(uuidgen) \
DETOX_DEVICE_JWT_SECRET=$(openssl rand -hex 32) \
  python3 -m uvicorn api.app.main:app --reload --port 8080
```

---

- **Local-only mode** — no network calls. App names, timestamps, pickups, sessions, rewards all stay in `data/screentime.db`. Nothing is sent anywhere.
- **Paired mode** — your local agent posts to your own Railway/Supabase project. The api never speaks to a third party except Supabase (for JWT JWKS, on a 1 h cache). CDN dependencies in the web bundle (Chart.js, Google Fonts) load directly from the public CDN; vendor them locally if you want zero third-party requests.
- **Ghost Mode** — opt-in toggle in Mayor's Study. With it on, the agent rewrites app names to `resident-XXXXXXXX` (SHA-256 of `salt + ":" + name`, truncated) before they leave the Mac. The salt is generated locally on first enable and never sent anywhere. The local SQLite still holds plaintext, so your dashboard is unchanged; only the cloud sees hashes. Known v1 limit: salt is per-device, so multi-device aggregation is broken under Ghost Mode.
- **One-click export** — Mayor's Study → Data Export → Download Archive ships every row in your account as a single JSON file. Works locally and against the paired cloud.
- **One-click delete** — Mayor's Study → Danger Zone → Delete Everything wipes every session, decree, reward, and milestone after a typed `DELETE` confirmation. The cloud version cascades from the `users` row, so a single statement empties your account.
- **No telemetry, no analytics, no error reporting service**. Errors surface in the local log (`data/monitor.log`) and Railway's deploy logs (api).
- Full policy: [`docs/privacy.md`](docs/privacy.md) · [`docs/terms.md`](docs/terms.md).

---

## License

MIT
