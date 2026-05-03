# Detox — Screen Time Tracker for macOS

Detox is a macOS screen time tracker that monitors your app usage in real time, visualizes your habits with interactive charts, and helps you stay focused by blocking distracting apps. With the average person spending over 7 hours daily on screens and losing an estimated 2.5 hours of productivity to digital distraction, protecting focus is a critical challenge. This widespread issue persists because desktop work environments lack native screen time tools. Attention is easily hijacked by constant context switching and mindless browsing, with no immediate feedback loop or active friction to help users maintain their focus.

![Python](https://img.shields.io/badge/Python-3.9+-3776ab?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-2.0+-000000?logo=flask)
![macOS](https://img.shields.io/badge/macOS-compatible-999999?logo=apple)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### Detox Isle
- A real isometric SVG world replaces the dashboard grid. Every tracked app is a resident, every restriction is a law, every building is a destination.
- The frontmost application's resident glows in real time (3 s frontend poll, 2 s server cache; ~5 s worst-case staleness).
- Residents walk slow 3-waypoint loops between buildings on a 6 fps walk-cycle ticker; banished apps sit offshore.
- Day / night light pass driven by the system clock, with a soft dim and lantern glow above each building at dusk and night.
- Navigation is the world: click a building to enter its tab. A small compass HUD top-right lists the eight destinations and highlights the current room.
- Sub-tabs gain a diegetic "ISLE" door icon and `Esc` returns to the Isle from anywhere.

### Tab signature animations
- **Charter** — wax seal stamps onto the scroll on goal save.
- **Rule Board** — chalk write left-to-right when a rule is added (with a dust burst), chalk wipe right-to-left when one is lifted.
- **Postcards** — preview slides in with overshoot, wax seal stamps the corner.
- **Market** — coin floats from the bought stall card up to the HUD currency badge.
- **Registry** — parchment page-turn between filter views (entering / leaving search).
- **Chronicle** — quill sweeps across the bar chart in sync with Chart.js bar growth.
- **Mayor's Study** — candle flame flickers on dark-mode toggle, smoke puff when going dark.
- Every animation has a no-motion equivalent, gated on `prefers-reduced-motion: reduce`.

### Residents Registry
- Every tracked app you've used and how long, by day.
- Search and filter; quick controls to limit, block, or categorize an app inline.
- Autocomplete from tracked apps and installed macOS apps.
- Click any resident for a detailed view with hourly and daily charts.

### Chronicle (Statistics)
**Daily:** pickups count, checking frequency, longest detox, longest continuous use, first / last pickup, most used app.
**Weekly:** daily average, weekly total, shortest / longest day, daily breakdown chart with average line.

### Rule Board (App Blocker)
- Block individual apps always or after a daily time limit.
- Block by category (Social, Entertainment, etc.).
- Focus Mode — block everything except whitelisted apps. A Full Lockdown banner stays visible while Focus Mode is active.
- Blocked apps are force-quit (`pkill -x`) with a macOS notification explaining why.

### Charter (Goals)
- Daily screen-time decree with notification when you hit it.
- Per-resident decrees (e.g. max 30 min of Instagram / day).
- Bedtime bell with reminder notification.

### Market (Rewards Ledger)
- Closed-economy reward loop. Detoxed minutes earn ☀ Sunlight; streaks and milestones earn ✦ Starshards.
- Stalls let you spend what you've earned. 100% refund within 24 h, 50% after.
- Hall of Honor records milestones by month.

### Postcards
- Generate a personalized PNG postcard with the day's stats.
- Instagram-story format (1080×1920). Download to share.

### Mayor's Study (Settings)
- Toggle theme (with the candle flicker), tracking idle timeout, data export (CSV / JSON), categories, keyboard shortcuts, about.

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `1`–`8` | Jump to tab (Isle, Residents, Chronicle, Charter, Rule Board, Market, Postcards, Study) |
| `← →` | Navigate dates |
| `D` | Toggle theme |
| `/` | Search residents |
| `?` | Open help / tour |
| `Esc` | Back to the Isle (or close the open overlay) |

---

## Install (DMG)

Download the latest macOS build:

[Download Detox 1.0.0](https://detox.app/releases/Detox-1.0.0.dmg)

Open the DMG, then drag `Detox.app` into `/Applications`.

On first launch, macOS needs Accessibility permission so Detox can read the frontmost app:

**System Settings -> Privacy & Security -> Accessibility -> enable Detox**

After launch:

1. Click the Detox lantern in the menu bar.
2. Toggle **Launch at Login** if you want Detox to start automatically.
3. Choose **Open Dashboard** to view [http://localhost:5050](http://localhost:5050).

Sparkle keeps the app patched in place, so manual update downloads are not needed after installation.

### Install (Homebrew)

```bash
brew tap mason-cao/detox
brew install --cask detox
```

The cask formula is a follow-up to the DMG release path. Until it lands, use the DMG or the source install below.

---

## Dev (from source)

### Requirements
- macOS (Apple Silicon or Intel)
- Python 3.9+

Install dependencies once from the repo root:

```bash
python3 -m pip install -r requirements.txt
```

### Menu-Bar App

```bash
python3 -m agent
```

This starts the Detox menu-bar app, monitor, and local dashboard server.

### Headless Run

```bash
./start.sh
```

That's it. The script handles everything:
1. Installs dependencies from `requirements.txt`
2. Initializes the database
3. Starts the background monitor
4. Launches the dashboard at [http://localhost:5050](http://localhost:5050)
5. Opens your browser automatically

### First Run — Accessibility Permission

The monitor needs to detect which app is in the foreground. macOS will prompt you to grant Accessibility access:

**System Settings -> Privacy & Security -> Accessibility -> Toggle on Terminal** (or whichever terminal app you use)

### Stop

Press `Ctrl+C` in the terminal, or run:

```bash
./stop.sh
```

---

## How It Works

```
┌─────────────┐     osascript      ┌──────────────┐
│   macOS      │ ◄──(every 2s)───  │   Monitor    │
│  (frontmost  │                   │  (daemon)    │
│    app)      │                   └──────┬───────┘
└─────────────┘                          │
                                         │ writes
                                         ▼
                                  ┌──────────────┐
                                  │   SQLite DB  │
                                  │  (WAL mode)  │
                                  └──────┬───────┘
                                         │ reads
                                         ▼
┌─────────────┐    REST API       ┌──────────────┐
│  Browser     │ ◄──────────────  │  Flask       │
│  Dashboard   │                  │  Server      │
└─────────────┘                   └──────────────┘
```

- **Monitor** — A background Python process polls the frontmost app every 2 seconds using `osascript`. It records usage, tracks sessions, detects pickups (screen unlock → app use), ignores idle periods when configured, enforces blocks, and checks goals.
- **Database** — SQLite with WAL mode for safe concurrent reads/writes. Stores raw usage observations, aggregated sessions, pickups, goals, blocks, and settings.
- **Server** — Flask serves the REST API and the static `web/` bundle. All API routes are wrapped by `@api_route` for 500-on-exception + 400-on-invalid-date. `GET /api/dashboard/now` returns the latest frontmost app, cached 2 s in module memory and polled every 3 s by the Isle.
- **Web** — Vanilla HTML / CSS / JS, no build step, no Node. Inline SVG runs the iso world (sky, weather, ground, buildings, residents, effects). Chart.js 4.4.1 from CDN powers Chronicle. Press Start 2P / VT323 / Inter from Google Fonts. Resident sprites are 32×32 CC0 Kenney 1-Bit Pack atlases at `web/assets/sprites/residents/` (≤ 64 KB total).

---

## Project Structure

```
detox/
├── start.sh              # One-command launcher
├── stop.sh               # Clean shutdown
├── requirements.txt      # Flask, Pillow, rumps, PyObjC
├── agent/                # On-device macOS daemon (osascript, pkill)
│   ├── server.py         # Flask API + static file serving + error handling
│   ├── monitor.py        # Background app tracking daemon
│   ├── database.py       # SQLite schema + query helpers + data export
│   ├── blocker.py        # Force-quit blocked apps
│   ├── notifier.py       # macOS notification wrapper
│   ├── cards.py          # Shareable card PNG generation
│   └── config.py         # Paths, defaults, categories
├── web/                  # Static dashboard (vanilla HTML/CSS/JS, no build)
│   ├── index.html        # SPA shell with HUD, help overlay, toast container
│   ├── assets/sprites/   # CC0 resident atlases (32×32 walk strips)
│   ├── css/
│   │   ├── tokens.css    # Dawn Cove palette + spacing scale
│   │   ├── pixel-ui.css  # Pixel buttons, panels, modals
│   │   ├── style.css     # Base + legacy view styles
│   │   ├── hud.css       # Top HUD bar (currencies, theme, help)
│   │   ├── isle.css      # Iso world stage, day/night dim, lanterns
│   │   ├── compass.css   # Compass HUD (top-right room list)
│   │   ├── residents.css # Sprite layer + glow halo
│   │   ├── effects.css   # Tab signature keyframes (seal, chalk, coin, page-turn, postcard, quill, candle)
│   │   └── views.css     # Per-tab page styles
│   └── js/
│       ├── app.js        # Router, API client, theme, toasts, keyboard shortcuts, back-to-Isle helper
│       ├── hud.js        # Top HUD logic + help / tour overlay
│       ├── iso.js        # Tile projection (tileToScreen / screenToTile, world bounds)
│       ├── world.js      # SVG scaffold, sky, weather, ground tiles, day/night, lanterns
│       ├── buildings.js  # Programmatic SVG generators for the 8 buildings
│       ├── compass.js    # Compass HUD (8 destinations, current-room highlight)
│       ├── effects.js    # Reusable primitives — glowHalo, waxSeal, chalkDust, currencyFloat, pageTurn, slamIn
│       ├── residents.js  # Sprite atlases, archetype mapping, walk ticker, frontmost-glow poll
│       ├── isle.js       # Isle dashboard orchestration (mounts world + residents)
│       ├── dashboard.js  # Daily / weekly summary tiles
│       ├── apps.js       # Residents Registry — search, filter, detail view, page-turn
│       ├── stats.js      # Chronicle — daily + weekly stats, Chart.js + quill sweep
│       ├── goals.js      # Charter — goal management + wax-seal save
│       ├── blocker.js    # Rule Board — block / whitelist + chalk write/erase
│       ├── market.js     # Market — stalls, inventory, refunds, coin float
│       ├── cards.js      # Postcards — slide-in preview + stamp
│       └── settings.js   # Mayor's Study — theme, tracking, export, categories, shortcuts
├── api/                  # Reserved for hosted FastAPI tier (Phase 2+)
├── infra/                # docker-compose.dev.yml + future deploy configs
├── docs/
│   ├── specs/            # Design specs
│   ├── plans/            # Implementation plans (one per phase)
│   └── adr/              # Architecture decision records
└── data/                 # Created at runtime (gitignored)
    ├── screentime.db
    └── cards/
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Agent | Python 3.9+, Flask, rumps |
| Database | SQLite (WAL mode) |
| Web | Vanilla HTML / CSS / JS — no bundler, no Node |
| Charts | Chart.js 4.4.1 (CDN) |
| Fonts | Press Start 2P, VT323, Inter (Google Fonts) |
| Sprites | CC0 Kenney 1-Bit Pack atlases (≤ 64 KB) |
| App Detection | `osascript` (AppleScript) |
| Notifications | macOS Notification Center |
| Card Generation | Pillow (PIL) |
| App Blocking | `pkill -x` |

**Local data.** The tracker, database, API, and blocking logic run locally, and your screen-time data never leaves your machine. The dashboard currently loads Chart.js and Inter font assets from public CDNs unless you vendor those files locally.

---

## License

MIT
