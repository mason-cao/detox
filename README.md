# 🧘 Detox — Screen Time Tracker for macOS

Take control of your digital habits. Detox monitors your app usage in real time, visualizes your screen time with interactive charts, and helps you stay focused by blocking distracting apps.

![Python](https://img.shields.io/badge/Python-3.9+-3776ab?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-2.0+-000000?logo=flask)
![macOS](https://img.shields.io/badge/macOS-compatible-999999?logo=apple)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### 📊 Interactive Dashboard
- Total daily screen time with hourly breakdown chart
- Category-based doughnut chart (Productivity, Social, Entertainment, etc.)
- Weekly trend bar chart with highlighted current day
- Top apps ranked by usage with visual bars
- Daily goal progress ring

### 📱 Per-App Tracking
- See every app you've used and how long
- Click any app for a detailed view with hourly and daily charts
- Navigate between days to compare usage patterns

### 📈 Detailed Statistics
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

### 🔒 App Blocker
- **Block individual apps** — always, or after a daily time limit
- **Block by category** — block all Social or Entertainment apps at once
- **Focus Mode** — block everything except whitelisted apps (e.g., only allow Notes and Calendar)
- Blocked apps are force-quit with a notification explaining why

### 🎯 Goals & Limits
- Set a daily screen time goal and get notified when you hit it
- Set per-app time limits (e.g., max 30 minutes of Instagram per day)
- Bedtime reminder notifications

### 🃏 Shareable Progress Cards
- Generate a personalized PNG card with your screen time stats
- Instagram story format (1080×1920)
- Shows total time, top apps, pickups, and detox streaks
- Download and share with friends to encourage change

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

- **Monitor** — A background Python process polls the frontmost app every 2 seconds using `osascript`. It records usage, tracks sessions, detects pickups (screen unlock → app use), enforces blocks, and checks goals.
- **Database** — SQLite with WAL mode for safe concurrent reads/writes. Stores raw usage observations, aggregated sessions, pickups, goals, blocks, and settings.
- **Server** — Flask serves the REST API and static frontend files.
- **Frontend** — Vanilla HTML/CSS/JS with Chart.js for interactive graphs. No build step, no Node.js required.

---

## Project Structure

```
detox/
├── start.sh              # One-command launcher
├── stop.sh               # Clean shutdown
├── requirements.txt      # flask, pillow
├── backend/
│   ├── server.py         # Flask API + static file serving
│   ├── monitor.py        # Background app tracking daemon
│   ├── database.py       # SQLite schema + query helpers
│   ├── blocker.py        # Force-quit blocked apps
│   ├── notifier.py       # macOS notification wrapper
│   ├── cards.py          # Shareable card PNG generation
│   └── config.py         # Paths, defaults, categories
├── frontend/
│   ├── index.html        # Single-page app shell
│   ├── css/style.css     # Dark theme stylesheet
│   └── js/
│       ├── app.js        # Router, API client, state
│       ├── dashboard.js  # Daily/weekly overview
│       ├── apps.js       # App list + detail views
│       ├── stats.js      # Daily + weekly statistics
│       ├── goals.js      # Goal management UI
│       ├── blocker.js    # Block/whitelist UI
│       ├── cards.js      # Share card UI
│       └── settings.js   # Categories + preferences
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
| Frontend | Vanilla JS, Chart.js |
| App Detection | `osascript` (AppleScript) |
| Notifications | macOS Notification Center |
| Card Generation | Pillow (PIL) |
| App Blocking | `pkill` |

**Zero external services.** Everything runs locally. Your data never leaves your machine.

---

## License

MIT
