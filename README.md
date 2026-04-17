# Detox — Screen Time Tracker for macOS

Detox is a macOS screen time tracker that monitors your app usage in real time, visualizes your habits with interactive charts, and helps you stay focused by blocking distracting apps. With the average person spending over 7 hours daily on screens and losing an estimated 2.5 hours of productivity to digital distraction, protecting focus is a critical challenge. This widespread issue persists because desktop work environments lack native screen time tools. Attention is easily hijacked by constant context switching and mindless browsing, with no immediate feedback loop or active friction to help users maintain their focus.

![Python](https://img.shields.io/badge/Python-3.9+-3776ab?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-2.0+-000000?logo=flask)
![macOS](https://img.shields.io/badge/macOS-compatible-999999?logo=apple)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### Interactive Dashboard
- Total daily screen time with hourly breakdown chart
- Category-based doughnut chart (Productivity, Social, Entertainment, etc.)
- Weekly trend bar chart with highlighted current day
- Top apps ranked by usage with visual bars
- Daily goal progress ring with smooth animation

### Per-App Tracking
- See every app you've used and how long
- **Search and filter** apps by name
- Set limits, block apps, and categorize apps directly from the app list
- Autocomplete app names from tracked apps and installed macOS apps
- Click any app for a detailed view with hourly and daily charts
- Navigate between days to compare usage patterns

### Detailed Statistics
**Daily stats:**
- Pickups count (e.g., 80 times today)
- Checking frequency (every 8 minutes)
- Longest detox (2h 25m away from screen)
- Continuous use (longest uninterrupted session)
- First and last pickup times
- Most used app

**Weekly stats:**
- Daily average and weekly total
- Shortest and longest usage days
- Daily breakdown chart with average line

### App Blocker
- **Block individual apps** — always, or after a daily time limit
- **Block by category** — block all Social or Entertainment apps at once
- **Focus Mode** — block everything except whitelisted apps (e.g., only allow Notes and Calendar)
- Full Lockdown exit banner stays visible while Focus Mode is active
- Blocked apps are force-quit with a notification explaining why
- **Toast notifications** confirm every action

### Goals & Limits
- Set a daily screen time goal and get notified when you hit it
- Set per-app time limits (e.g., max 30 minutes of Instagram per day)
- Bedtime reminder notifications

### Shareable Progress Cards
- Generate a personalized PNG card with your screen time stats
- Instagram story format (1080x1920)
- Shows total time, top apps, pickups, and detox streaks
- Download and share with friends to encourage change

### Dark Mode
- Toggle between light and dark themes from the sidebar or Settings
- Respects system preference on first load
- Persists across sessions via localStorage
- Glassmorphism sidebar with backdrop blur in both modes

### Idle Detection
- Stop counting screen time after a configurable period with no keyboard or pointer activity
- Default idle timeout is 5 minutes
- Configure or disable idle detection from Settings

### Data Export
- Export screen time data as **CSV** or **JSON**
- Select custom date ranges
- Download directly from Settings

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `← →` | Navigate dates |
| `D` | Toggle dark mode |
| `/` | Search apps |
| `1`-`7` | Switch tabs |
| `Esc` | Close modals |

---

## Quick Start

### Requirements
- macOS (Apple Silicon or Intel)
- Python 3.9+

### Run

```bash
./start.sh
```

That's it. The script handles everything:
1. Installs dependencies (`flask`, `pillow`)
2. Initializes the database
3. Starts the background monitor
4. Launches the dashboard at [http://localhost:5050](http://localhost:5050)
5. Opens your browser automatically

### First Run — Accessibility Permission

The monitor needs to detect which app is in the foreground. macOS will prompt you to grant Accessibility access:

**System Settings → Privacy & Security → Accessibility → Toggle on Terminal** (or whichever terminal app you use)

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
- **Server** — Flask serves the REST API and static frontend files. All API routes include error handling with date validation.
- **Frontend** — Vanilla HTML/CSS/JS with Chart.js for interactive graphs. Inter font via Google Fonts. Dark mode support with system preference detection. No build step, no Node.js required. If Chart.js is unavailable, the app still renders and skips chart drawing.

---

## Project Structure

```
detox/
├── start.sh              # One-command launcher
├── stop.sh               # Clean shutdown
├── requirements.txt      # flask, pillow
├── backend/
│   ├── server.py         # Flask API + static file serving + error handling
│   ├── monitor.py        # Background app tracking daemon
│   ├── database.py       # SQLite schema + query helpers + data export
│   ├── blocker.py        # Force-quit blocked apps
│   ├── notifier.py       # macOS notification wrapper
│   ├── cards.py          # Shareable card PNG generation
│   └── config.py         # Paths, defaults, categories
├── frontend/
│   ├── index.html        # SPA shell with sidebar, toast container
│   ├── css/style.css     # Light + dark theme, glassmorphism, animations
│   └── js/
│       ├── app.js        # Router, API client, dark mode, toasts, keyboard shortcuts
│       ├── dashboard.js  # Daily/weekly overview with loading skeletons
│       ├── apps.js       # App list with search/filter + detail views
│       ├── stats.js      # Daily + weekly statistics
│       ├── goals.js      # Goal management UI with toast feedback
│       ├── blocker.js    # Block/whitelist UI with toast feedback
│       ├── cards.js      # Share card UI
│       └── settings.js   # Dark mode, data export, categories, keyboard shortcuts
└── data/                 # Created at runtime (gitignored)
    ├── screentime.db
    └── cards/
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python 3.9, Flask |
| Database | SQLite (WAL mode) |
| Frontend | Vanilla JS, Chart.js, Inter font |
| App Detection | `osascript` (AppleScript) |
| Notifications | macOS Notification Center |
| Card Generation | Pillow (PIL) |
| App Blocking | `pkill` |

**Local data.** The tracker, database, API, and blocking logic run locally, and your screen-time data never leaves your machine. The dashboard currently loads Chart.js and Inter font assets from public CDNs unless you vendor those files locally.

---

## License

MIT
