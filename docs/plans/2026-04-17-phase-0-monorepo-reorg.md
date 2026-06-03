# Phase 0 — Monorepo Reorganization Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo from `backend/` + `frontend/` into the `agent/` + `api/` + `web/` + `infra/` + `docs/` layout that later phases assume, update all references, and land ADR-0001 documenting the hybrid local-agent + cloud architecture. The application must still run end-to-end via `./start.sh` after the reorg.

**Architecture:** Pure reorg + docs. No behavior changes. `backend/` becomes `agent/` (renamed to match its new role as the on-device data collector). `frontend/` becomes `web/`. Two empty-but-documented siblings (`api/`, `infra/`) reserve slots for future phases. Git history is preserved via `git mv`.

**Tech Stack:** Python 3.9+, Flask, SQLite. No new dependencies in this phase. Docker Compose v2 for a local dev stack (Postgres + Redis) that will be used in Phase 2 but is scaffolded now.

**Source spec:** `docs/specs/2026-04-17-detox-redesign-design.md` §11 (Phase 0) and §6 (hybrid architecture).

---

## File Structure

**Created:**
- `agent/` — was `backend/` (renamed via `git mv`)
- `api/README.md` — placeholder documenting what lives here from Phase 2
- `infra/README.md` — placeholder documenting infra layout
- `infra/docker-compose.dev.yml` — Postgres 16 + Redis 7 for future local dev
- `infra/.env.example` — sample env vars for the compose stack
- `web/` — was `frontend/` (renamed via `git mv`)
- `docs/adr/0001-hybrid-local-agent-and-cloud.md` — architecture decision record

**Modified:**
- `agent/config.py` — rename `FRONTEND_DIR` → `WEB_DIR`, point at new `web/` location
- `agent/server.py` — update `FRONTEND_DIR` imports and references
- `agent/blocker.py`, `agent/cards.py`, `agent/database.py`, `agent/monitor.py` — change `from backend.…` imports to `from agent.…`
- `start.sh` — `backend.database` → `agent.database`, `backend.monitor` → `agent.monitor`, `backend.server` → `agent.server`
- `stop.sh` — `*"backend.server"*` → `*"agent.server"*`
- `README.md` — update directory listing and any `backend/` / `frontend/` prose

**Unchanged but verify:**
- `.gitignore` — already correct; ignores `data/` and local tool notes
- `requirements.txt` — no path changes needed
- `LICENSE` — unchanged

---

## Task 1: Capture a smoke baseline

**Files:**
- None (observational)

- [ ] **Step 1: Verify the app runs on `main` before any changes**

Run: `./start.sh`

Expected output includes:
- `✓ Database ready`
- `✓ Monitor started (PID <n>)`
- Browser opens to `http://localhost:5050`
- Dashboard tab renders
- Clicking each sidebar tab (Dashboard, Apps, Statistics, Goals, Blocker, Share, Settings) renders a view with no console errors

- [ ] **Step 2: Stop the baseline run**

Run: `./stop.sh`

Expected: `✓ Monitor stopped`, `✓ Server stopped`.

- [ ] **Step 3: Note the baseline in a scratch file**

Write a one-line note in a scratch file (not committed) confirming the baseline passed. This is the reference for the post-reorg smoke test in Task 11.

- [ ] **Step 4: No commit for this task**

---

## Task 2: Move `backend/` → `agent/`

**Files:**
- Rename: `backend/` → `agent/`

- [ ] **Step 1: Move the directory preserving git history**

Run:
```bash
git mv backend agent
```

- [ ] **Step 2: Verify the move**

Run:
```bash
git status --short
```

Expected: a block of `R  backend/… -> agent/…` rename entries for every file in the directory.

- [ ] **Step 3: Remove any lingering `__pycache__`**

Run:
```bash
rm -rf agent/__pycache__
```

- [ ] **Step 4: Do NOT commit yet** — imports are broken until Task 3. Continue to Task 3 before any commit to keep the tree bisectable.

---

## Task 3: Update Python imports from `backend.*` → `agent.*`

**Files:**
- Modify: `agent/blocker.py:2`
- Modify: `agent/cards.py:7-8`
- Modify: `agent/database.py:5`
- Modify: `agent/monitor.py:14,20-22`
- Modify: `agent/server.py:12,20,408`

- [ ] **Step 1: Rewrite imports in `agent/blocker.py`**

Replace:
```python
from backend.notifier import notify
```
With:
```python
from agent.notifier import notify
```

- [ ] **Step 2: Rewrite imports in `agent/cards.py`**

Replace:
```python
from backend.config import CARDS_DIR
from backend import database as db
```
With:
```python
from agent.config import CARDS_DIR
from agent import database as db
```

- [ ] **Step 3: Rewrite imports in `agent/database.py`**

Replace:
```python
from backend.config import (
```
With:
```python
from agent.config import (
```

(Keep the rest of the import block intact — only the module path changes.)

- [ ] **Step 4: Rewrite imports in `agent/monitor.py`**

Replace:
```python
from backend.config import (
```
With:
```python
from agent.config import (
```

And replace:
```python
from backend import database as db
from backend.blocker import kill_app
from backend.notifier import notify
```
With:
```python
from agent import database as db
from agent.blocker import kill_app
from agent.notifier import notify
```

- [ ] **Step 5: Rewrite imports in `agent/server.py`**

Replace:
```python
from backend.config import (
```
With:
```python
from agent.config import (
```

Replace:
```python
from backend import database as db
```
With:
```python
from agent import database as db
```

Replace (line ~408, inside a route handler):
```python
from backend.cards import generate_card
```
With:
```python
from agent.cards import generate_card
```

- [ ] **Step 6: Verify no stale `backend.` imports remain**

Run:
```bash
grep -rn "from backend\|import backend" agent/ || echo "clean"
```

Expected: `clean`.

- [ ] **Step 7: Static import sanity check**

Run:
```bash
python3 -c "import agent.config; import agent.database; import agent.blocker; import agent.notifier; import agent.cards; import agent.monitor; import agent.server; print('imports ok')"
```

Expected: `imports ok` with no ModuleNotFoundError.

- [ ] **Step 8: Commit**

Run:
```bash
git add agent/
git commit -m "refactor: rename backend/ module to agent/"
```

---

## Task 4: Move `frontend/` → `web/`

**Files:**
- Rename: `frontend/` → `web/`

- [ ] **Step 1: Move the directory preserving git history**

Run:
```bash
git mv frontend web
```

- [ ] **Step 2: Verify the move**

Run:
```bash
git status --short
```

Expected: `R  frontend/css/style.css -> web/css/style.css`, and similar for every asset under the old `frontend/` tree.

- [ ] **Step 3: Do NOT commit yet** — server references still point at `FRONTEND_DIR`. Continue to Task 5.

---

## Task 5: Rename `FRONTEND_DIR` → `WEB_DIR` in config and server

**Files:**
- Modify: `agent/config.py:8`
- Modify: `agent/server.py:15,162,167,172,177`

- [ ] **Step 1: Update `agent/config.py`**

Replace:
```python
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
```
With:
```python
WEB_DIR = os.path.join(BASE_DIR, "web")
```

- [ ] **Step 2: Update the import block in `agent/server.py`**

Find the `from agent.config import (` block near the top of the file. Inside it, replace `FRONTEND_DIR,` with `WEB_DIR,`. Keep surrounding imports intact.

- [ ] **Step 3: Update `send_from_directory` calls in `agent/server.py`**

There are four occurrences (index, css, js, assets). In each, replace `FRONTEND_DIR` with `WEB_DIR`. After the edits, the four lines read:

```python
    return send_from_directory(WEB_DIR, "index.html")
```
```python
    return send_from_directory(os.path.join(WEB_DIR, "css"), filename)
```
```python
    return send_from_directory(os.path.join(WEB_DIR, "js"), filename)
```
```python
    return send_from_directory(os.path.join(WEB_DIR, "assets"), filename)
```

- [ ] **Step 4: Verify no stale `FRONTEND_DIR` references remain**

Run:
```bash
grep -rn "FRONTEND_DIR\|frontend/" agent/ || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5: Update the server docstring**

In `agent/server.py` line 1, change:
```python
"""Flask web server serving the dashboard API and frontend static files."""
```
to:
```python
"""Flask web server serving the dashboard API and web static files."""
```

- [ ] **Step 6: Static import check**

Run:
```bash
python3 -c "from agent.config import WEB_DIR; from agent.server import app; print('ok')"
```

Expected: `ok`.

- [ ] **Step 7: Commit**

Run:
```bash
git add agent/config.py agent/server.py web/
git commit -m "refactor: rename frontend/ to web/ and FRONTEND_DIR to WEB_DIR"
```

---

## Task 6: Update shell scripts

**Files:**
- Modify: `start.sh:44,52,76`
- Modify: `stop.sh:19`

- [ ] **Step 1: Update `start.sh` lines that reference `backend.*`**

Replace the three occurrences so they read:

Line ~44:
```bash
python3 -c "from agent.database import init_db; init_db()"
```

Line ~52:
```bash
    python3 -m agent.monitor > data/monitor.log 2>&1 &
```

Line ~76:
```bash
python3 -m agent.server
```

- [ ] **Step 2: Update the `stop.sh` process-name match**

In `stop.sh` line ~19, replace:
```bash
            *"backend.server"*)
```
with:
```bash
            *"agent.server"*)
```

- [ ] **Step 3: Verify no stale `backend` references in scripts**

Run:
```bash
grep -n "backend" start.sh stop.sh || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Run start/stop end-to-end**

Run:
```bash
./start.sh
```

Expected: monitor starts, Flask starts, browser opens to `http://localhost:5050`, dashboard renders. Press `Ctrl+C`.

Then run:
```bash
./stop.sh
```

Expected: `✓ Monitor stopped` (or "not running" if trap cleanup already ran), `✓ Server stopped` (or "not running").

- [ ] **Step 5: Commit**

Run:
```bash
git add start.sh stop.sh
git commit -m "chore: update start/stop scripts for agent/ rename"
```

---

## Task 7: Create `api/` placeholder

**Files:**
- Create: `api/README.md`

- [ ] **Step 1: Create the `api/` directory and README**

Run:
```bash
mkdir -p api
```

Then write `api/README.md` with exactly this content:

```markdown
# api/

This directory is reserved for the hosted FastAPI service introduced in Phase 2 of the rollout.

Today it is empty. When Phase 2 begins it will hold:

- `app/` — FastAPI application package
- `alembic/` — Postgres migrations
- `tests/` — contract and integration tests
- `Dockerfile` — production image

Until then, the on-device Flask server at `agent/server.py` remains the sole API surface. See `docs/specs/2026-04-17-detox-redesign-design.md` §7 and `docs/adr/0001-hybrid-local-agent-and-cloud.md` for context.
```

- [ ] **Step 2: Commit**

Run:
```bash
git add api/README.md
git commit -m "chore: add api/ placeholder for Phase 2"
```

---

## Task 8: Create `infra/` with docker-compose

**Files:**
- Create: `infra/README.md`
- Create: `infra/docker-compose.dev.yml`
- Create: `infra/.env.example`

- [ ] **Step 1: Create the directory**

Run:
```bash
mkdir -p infra
```

- [ ] **Step 2: Write `infra/README.md`**

```markdown
# infra/

Local development infrastructure and future deployment configuration.

## Current contents

- `docker-compose.dev.yml` — Postgres 16 + Redis 7 for local development of the hosted API (Phase 2+). The macOS agent and the web client run on the host, not inside Docker.
- `.env.example` — sample env vars. Copy to `.env` before `docker compose up`.

## Usage

```bash
cp infra/.env.example infra/.env
docker compose -f infra/docker-compose.dev.yml up -d
```

Postgres will be reachable at `localhost:5432`, Redis at `localhost:6379`.

To tear down:

```bash
docker compose -f infra/docker-compose.dev.yml down
```

## What will land here later

- `fly.toml` — Fly.io deployment config (Phase 4)
- `cloudflare/` — Cloudflare Pages + Workers config (Phase 4)
- Runbooks and incident docs
```

- [ ] **Step 3: Write `infra/docker-compose.dev.yml`**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-detox}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-detox}
      POSTGRES_DB: ${POSTGRES_DB:-detox}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-detox}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 4: Write `infra/.env.example`**

```bash
# Postgres
POSTGRES_USER=detox
POSTGRES_PASSWORD=detox
POSTGRES_DB=detox

# Redis has no auth in dev; change for prod
```

- [ ] **Step 5: Validate the compose file syntax (without starting services)**

Run:
```bash
docker compose -f infra/docker-compose.dev.yml config > /dev/null && echo "compose ok"
```

Expected: `compose ok`. If Docker is not installed on this machine skip the validation — the file is still syntactically correct YAML, and a later engineer on a machine with Docker will catch any real issue.

- [ ] **Step 6: Ensure `.env` is gitignored**

Run:
```bash
grep -q "^\.env$\|^infra/\.env$" .gitignore || echo ".env" >> .gitignore
grep "^\.env" .gitignore
```

Expected output: `.env` on its own line. (It already exists in `.gitignore` per line 9 — the grep should confirm it, no append needed.)

- [ ] **Step 7: Commit**

Run:
```bash
git add infra/
git commit -m "chore: scaffold infra/ with docker-compose.dev for Postgres + Redis"
```

---

## Task 9: Write ADR-0001 — hybrid local-agent + cloud

**Files:**
- Create: `docs/adr/0001-hybrid-local-agent-and-cloud.md`

- [ ] **Step 1: Create the ADR directory**

Run:
```bash
mkdir -p docs/adr
```

- [ ] **Step 2: Write `docs/adr/0001-hybrid-local-agent-and-cloud.md`**

```markdown
# ADR-0001: Hybrid local-agent + cloud architecture

- Status: Accepted
- Date: 2026-04-17

## Context

Detox started as a fully local macOS app: Flask + SQLite running on the user's Mac, polling the frontmost application via `osascript` and enforcing blocks with `pkill -x`. The rollout plan in `docs/specs/2026-04-17-detox-redesign-design.md` moves the product toward a hosted SaaS so users can view their data from any browser (including mobile), pair multiple Macs, and recover after wipe.

A full cloud migration is not possible. Two capabilities depend on local macOS APIs:

1. Detecting the frontmost application uses AppleScript via System Events.
2. Force-quitting a blocked app uses `pkill -x` against a named process.

Neither can be implemented from a server. Any architecture must keep these on the user's machine.

## Decision

The product is split into three tiers:

1. **Agent (on-device, macOS)** — keeps the current Python code that needs OS-level access: `monitor`, `blocker`, `notifier`. Owns a local SQLite buffer for offline resilience. Packaged as a signed `.app` with a menu-bar UI in Phase 3.
2. **API (cloud, Fly.io)** — FastAPI + Postgres + Redis. System of record for history, rules, rewards, and inventory. Authenticates users, distributes rules to agents, and aggregates data across devices.
3. **Web (cloud, Cloudflare Pages)** — static SPA served from a CDN. Calls the API directly. Responsive for phone and desktop.

The agent never trusts the client for reward accounting. Rule enforcement is local and latency-critical, so rules cache on the agent and refresh on a 30-second poll.

## Consequences

**Positive:**
- Privacy story is explicit and mitigable (TLS, envelope encryption, opt-in Ghost Mode). See spec §10.
- Users can read their data from any browser without installing anything beyond the agent on their Mac(s).
- Each tier scales independently; the agent stays tiny.

**Negative:**
- Offline resilience becomes a real engineering concern — agent must buffer and reconcile.
- Two languages of deployment (signed Mac app + cloud service) doubles the release surface.
- The "fully local, no network" guarantee the project started with is gone. We replace it with explicit privacy controls rather than implicit absence.

## Alternatives considered

- **Stay fully local.** Rejected: the user explicitly asked for multi-device and phone access.
- **Full SaaS (no agent).** Rejected: OS APIs above cannot be reached from a server.
- **Rewrite the agent in Swift.** Rejected for the initial rollout: estimated 6-month detour. Revisit after v1 if `py2app` bundles prove painful.

## References

- `docs/specs/2026-04-17-detox-redesign-design.md` §6, §7, §10
```

- [ ] **Step 3: Commit**

Run:
```bash
git add docs/adr/0001-hybrid-local-agent-and-cloud.md
git commit -m "docs: ADR-0001 — hybrid local-agent + cloud architecture"
```

---

## Task 10: Update README.md references

**Files:**
- Modify: `README.md:148,160,168` (and any other `backend/` or `frontend/` prose)

- [ ] **Step 1: Find every outdated reference**

Run:
```bash
grep -n "backend\|frontend" README.md
```

Capture the output — it's the work list for this task.

- [ ] **Step 2: Replace `backend/` with `agent/` and `frontend/` with `web/` in the directory-tree prose**

Around line 160 the README prints a tree that looks like:

```
├── backend/
│   ├── monitor.py
│   …
├── frontend/
│   ├── css/
│   …
```

Rewrite so it reads:

```
├── agent/
│   ├── monitor.py
│   …
├── web/
│   ├── css/
│   …
```

- [ ] **Step 3: Rewrite any narrative lines**

Around line 148:
```
- **Server** — Flask serves the REST API and static frontend files. All API routes include error handling with date validation.
```
becomes:
```
- **Server** — Flask serves the REST API and static web files. All API routes include error handling with date validation.
```

Check every `grep` hit from Step 1 and apply the equivalent substitution.

- [ ] **Step 4: Add a short note about the new top-level layout**

At the end of the project-structure section (before the next heading), add:

```markdown

The top-level layout reserves slots for later rollout phases:

- `agent/` — on-device Python (runs on macOS)
- `web/` — the dashboard SPA (vanilla HTML/CSS/JS, no build step)
- `api/` — reserved for the hosted FastAPI service (Phase 2)
- `infra/` — Docker Compose for local dev, deployment config later
- `docs/` — specs, ADRs, and plans
```

- [ ] **Step 5: Verify**

Run:
```bash
grep -n "backend/\|frontend/" README.md || echo "clean"
```

Expected: `clean`.

- [ ] **Step 6: Commit**

Run:
```bash
git add README.md
git commit -m "docs: update README for agent/ and web/ layout"
```

---

## Task 11: End-to-end smoke test after the reorg

**Files:**
- None (observational)

- [ ] **Step 1: Confirm `agent/monitor.pid` isn't stale**

Run:
```bash
[ -f data/monitor.pid ] && (kill -0 "$(cat data/monitor.pid)" 2>/dev/null || rm data/monitor.pid) || true
```

- [ ] **Step 2: Start the app**

Run:
```bash
./start.sh
```

Expected output mirrors the baseline from Task 1:
- `✓ Database ready`
- `✓ Monitor started (PID <n>)`
- Browser opens to `http://localhost:5050`

- [ ] **Step 3: Exercise every view in the browser**

In order, click each sidebar tab and verify it renders with no red console errors in DevTools:
1. Dashboard — hourly bar chart + weekly trend render
2. Apps — at least one row appears (or the empty state)
3. Statistics — today's pickups/detox cards render
4. Goals — goal creator modal opens
5. Blocker — list of blocks renders, whitelist toggle responds
6. Share — card-generate button works
7. Settings — dark-mode toggle flips the theme

- [ ] **Step 4: Exercise one data path**

Wait ~30 seconds with the app running, then refresh the Dashboard. Confirm the "Total time today" number is non-zero (the monitor ran at least one 2s poll cycle).

- [ ] **Step 5: Stop the app**

Press `Ctrl+C` in the terminal where `start.sh` runs, then run:

```bash
./stop.sh
```

Expected: both monitor and server report stopped.

- [ ] **Step 6: Confirm the working tree is clean**

Run:
```bash
git status --short
```

Expected: empty output. If anything shows up, investigate — the reorg should be complete.

- [ ] **Step 7: No commit for this task** — observational only.

---

## Task 12: Tag the end of Phase 0

**Files:**
- None

- [ ] **Step 1: Log current HEAD**

Run:
```bash
git log --oneline -n 8
```

Expected: eight most-recent commits include (in order, most-recent first): README update, ADR-0001, infra scaffold, api placeholder, start/stop update, frontend→web rename, backend→agent rename.

- [ ] **Step 2: Tag the milestone**

Run:
```bash
git tag -a phase-0-complete -m "Phase 0: monorepo reorg complete"
```

- [ ] **Step 3: No push** — the user pushes tags themselves when ready.

---

## Acceptance checklist

After Task 12, all of these should be true:

- [ ] `agent/` contains the seven former `backend/` modules with `agent.*` imports.
- [ ] `web/` contains the former `frontend/` tree.
- [ ] `api/README.md` explains the Phase 2 reservation.
- [ ] `infra/docker-compose.dev.yml` validates with `docker compose config` (where Docker is available).
- [ ] `docs/adr/0001-hybrid-local-agent-and-cloud.md` exists and describes the decision.
- [ ] `README.md` no longer mentions `backend/` or `frontend/` paths.
- [ ] `./start.sh` boots the app; `./stop.sh` stops it.
- [ ] Every tab in the dashboard renders with no console errors.
- [ ] `git status --short` is empty.
- [ ] `git tag` lists `phase-0-complete`.

---

## Out of scope (explicitly deferred)

- Any visual redesign. This plan touches zero CSS, zero JS, zero templates beyond path references. Phase 1a onwards does the visual work.
- Test harness. The project has no automated tests today. Adding them is out of scope for a pure reorg; the smoke test in Task 11 is the acceptance gate. A formal test harness lands with the FastAPI port in Phase 2.
- Agent packaging / py2app. Phase 3.
- Postgres schema, Alembic migrations, user model. Phase 2.
- Category-block migration (`__category__` hack → `category_blocks` table). Deferred to Phase 1d; Phase 0 is a pure move.
