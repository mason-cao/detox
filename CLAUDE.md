# Detox - Screen Time Tracker for macOS

Local-only macOS screen time tracker. Polls the frontmost app every 2 seconds via `osascript`, stores data in SQLite, and serves a dashboard through Flask + vanilla JS.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.9+, Flask (port 5050) |
| Database | SQLite (WAL mode) at `data/screentime.db` |
| Frontend | Vanilla HTML/CSS/JS, Chart.js 4.4.1 (CDN), Inter font (Google Fonts) |
| App detection | `osascript` (AppleScript → System Events) |
| Notifications | macOS Notification Center via `osascript` |
| Card generation | Pillow (PIL), 1080x1920 PNG |
| App blocking | `pkill -x` |

No build step, no Node.js, no external services.

## Architecture

```
monitor.py (daemon, 2s poll) → SQLite ← server.py (Flask API) → browser
                                 ↑
                blocker.py / notifier.py (called by monitor)
```

- **monitor.py** — Background daemon. Tracks frontmost app, detects pickups (screen unlock), enforces blocks, checks goals every 30s. Writes PID to `data/monitor.pid`.
- **server.py** — Flask server. Serves REST API + static frontend from `frontend/`. All API routes wrapped with `@api_route` decorator for error handling and date validation.
- **database.py** — Schema init, all queries. Context manager for connections. Usage calculated as `COUNT(*) * 2.0 / 60.0` minutes. Includes `get_export_data()` for CSV/JSON export.
- **blocker.py** — Force-quits blocked apps via `pkill -x`, sends notification.
- **notifier.py** — Fires macOS notifications via `osascript`. Fire-and-forget.
- **cards.py** — Generates shareable PNG cards (Instagram story format). Uses `.get()` with defaults for error safety. Font fallback: SF Pro → Helvetica → default.
- **config.py** — All paths, constants, 66 default app→category mappings.

## Running

```bash
./start.sh   # installs deps, inits DB, starts monitor + Flask, opens browser
./stop.sh    # kills monitor + Flask
```

Requires macOS Accessibility permission for Terminal.

## API Routes

All return JSON. Base: `http://localhost:5050`. All `/api/*` routes have `@api_route` error handling (500 on exception, 400 on invalid date format).

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/dashboard?date=` | GET | Daily totals, hourly, categories, apps |
| `/api/dashboard/weekly?week_start=` | GET | 7-day breakdown from Monday |
| `/api/stats/daily?date=` | GET | Pickups, detox, sessions, first/last pickup |
| `/api/stats/weekly?week_start=` | GET | Same as dashboard/weekly |
| `/api/apps` | GET | All apps with total minutes |
| `/api/apps/<name>` | GET | Per-app hourly + daily history |
| `/api/goals` | GET/POST | CRUD for daily_total, app_limit, bedtime goals |
| `/api/goals/<id>` | DELETE | |
| `/api/blocks` | GET/POST | Block/whitelist rules |
| `/api/blocks/<name>` | DELETE | |
| `/api/categories` | GET/POST | App → category mapping |
| `/api/cards/generate` | POST | Returns `{filename, url}` |
| `/api/cards/<file>` | GET | Serves PNG |
| `/api/settings` | GET/POST | Key-value settings (e.g. whitelist_mode) |
| `/api/status` | GET | `{monitor_running: bool}` via PID check |
| `/api/export/csv?start=&end=` | GET | CSV download of session data |
| `/api/export/json?start=&end=` | GET | JSON export of session data |

## Database Schema

7 tables: `app_usage` (raw 2s polls), `sessions` (consolidated), `pickups`, `app_categories`, `goals` (daily_total/app_limit/bedtime types), `app_blocks` (blocked/whitelisted + optional daily_limit_minutes), `settings` (key-value).

Category blocks stored as `__category__{Name}` entries in `app_blocks` table.

## Frontend Structure

SPA with client-side routing via global `App` object. Each view is a JS module that renders into `#content`. Views: Dashboard, Apps, Stats, Goals, Blocker, Cards, Settings.

**Key features:**
- **Dark mode** — Toggle via sidebar button, `d` key, or Settings. Uses `[data-theme="dark"]` CSS variable overrides. Persists in localStorage. Respects system preference on first load.
- **Toast notifications** — `App.toast(message, type)` where type is success/error/info/warning. Slide-in from right, auto-dismiss after 3s.
- **Keyboard shortcuts** — `← →` date nav, `d` dark mode, `/` search apps, `1-7` tabs, `Esc` close modals.
- **Loading skeletons** — Dashboard shows skeleton cards/charts during fetch.
- **Search** — Apps view has search bar with `/` keyboard shortcut.
- **Data export** — Settings has date range picker with CSV/JSON download buttons.
- **Page transitions** — Content fades in with translateY animation on tab switch.
- **Glassmorphism sidebar** — `backdrop-filter: blur(20px)` with semi-transparent background.

**Module files:**
- **app.js** — Router (`showTab`), API client (`api()`), date nav, `formatTime()`, `appColor()`, `categoryColor()`, chart theme helpers, toast system, dark mode, keyboard shortcuts, 30s auto-refresh.
- **dashboard.js** — Loading skeleton → hourly bar chart, weekly trend, category doughnut, top 6 apps, animated progress ring.
- **apps.js** — Search/filter bar + app list + detail view with per-app hourly/daily charts.
- **stats.js** — Daily (pickups, detox, sessions) + weekly (bar + average line overlay).
- **goals.js** — Manage daily goal, per-app limits, bedtime reminder via modals. Toast on save/delete.
- **blocker.js** — Block apps/categories, whitelist mode toggle, time-limited blocks. Toast on all actions.
- **cards.js** — Generate + preview + download shareable PNG card. Toast on generate.
- **settings.js** — Dark mode toggle, data export with date range, category management, keyboard shortcut reference, about section.

## Code Conventions

**Python (backend):**
- `snake_case` functions/variables, `SCREAMING_SNAKE_CASE` constants
- Context managers for DB connections
- Parameterized SQL queries (no f-strings in SQL)
- `@api_route` decorator on all API endpoints for error handling
- Section comments: `# ── Section ───`

**JavaScript (frontend):**
- `camelCase` variables/methods
- Object literal modules (e.g. `const Dashboard = { render() {...} }`)
- `async/await` for all API calls
- Template literals for HTML generation
- Modals: create overlay div → append to body → remove on close
- Always call `destroyCharts()` before rendering new charts
- Use `App.chartGridColor()` and `App.chartTickColor()` for theme-aware charts

**CSS:**
- `kebab-case` classes
- CSS custom properties for theming, with `[data-theme="dark"]` overrides
- Light: accent `#0071e3`, bg `#f5f5f7`, card `#ffffff`
- Dark: bg `#0d0d0d`, card `#1a1a1a`, border `#2d2d2d`
- Radius: 14px cards, 10px inputs/buttons
- Section comments: `/* ── Section ─── */`
- Animations: fadeIn, modalSlideUp, toastIn/Out, shimmer, pulse

## Known Bugs (Remaining)

1. **Usage calc assumes consistent 2s polls** — `COUNT(*) * 2 / 60` is inaccurate if system sleeps or polling lags
2. **pkill process name mismatch** — Display name may differ from process name for some apps
3. **Whitelist mode uses `__category__` hack** — Category blocks stored as fake app_name entries instead of a proper table

## TODOs / Potential Improvements

- Replace `__category__` hack with a proper `category_blocks` table
- Add inline validation/error messages to modal forms
- Handle long app names in card generation (text wrapping)
- Add notification preferences (sound, frequency)
