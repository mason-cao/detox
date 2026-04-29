# api/

Reserved for the hosted FastAPI tier that lands in **Phase 2** of the rollout
(see `docs/plans/` for the phased rollout, `docs/specs/2026-04-17-detox-redesign-design.md`
§11 for the target architecture).

## Why this directory exists now

The redesign moves Detox to a hybrid shape:

- **`agent/`** — on-device macOS daemon (osascript polling, pkill blocking).
  Stays local. Cannot move.
- **`api/`** — cloud-hosted FastAPI service (Postgres + Redis, auth, sync,
  aggregations, rewards ledger). Phase 2+.
- **`web/`** — static dashboard. Today served by the agent's Flask process;
  eventually deployable standalone to Cloudflare Pages.

Creating the placeholder in Phase 0 prevents a future rename / git-history
split when the cloud work begins.

## Current contents

Phase 2 has started with a minimal FastAPI service scaffold:

- `app/main.py` — app factory, OpenAPI metadata, CORS middleware.
- `app/config.py` — environment-backed runtime settings.
- `app/errors.py` / `app/validation.py` — Flask-compatible error JSON and
  shared date validation.
- `app/routers/health.py` — `GET /healthz`.
- `app/routers/dashboard.py` — `GET /api/dashboard` and
  `GET /api/dashboard/weekly`, matching the local agent response shapes.
- `app/routers/apps.py` — `GET /api/apps`, `GET /api/app-suggestions`,
  `GET /api/apps/{app_name}`, `GET|POST /api/categories`.
- `app/routers/goals.py` — `GET|POST /api/goals`,
  `DELETE /api/goals/{goal_id}`.
- `app/routers/blocks.py` — `GET|POST /api/blocks`,
  `DELETE /api/blocks/{app_name}`, `GET|POST /api/category-blocks`,
  `DELETE /api/category-blocks/{category_name}`.
- `app/routers/settings.py` — `GET|POST /api/settings`.
- `app/services/` — temporary local SQLite adapters using `agent.database`
  until the Postgres read models land.
- `app/dependencies.py` — query-date validation + rewards rollup applied to
  every `/api` route, mirroring the Flask `@api_route` decorator.
- `pyproject.toml` — API-only dependencies.

Install the API dependencies from the repository root with:

```bash
python3 -m pip install -e api
```

Then run the service from the repository root with:

```bash
python3 -m uvicorn api.app.main:app --reload --host 127.0.0.1 --port 8000
```

Useful local URLs:

- `http://127.0.0.1:8000/healthz`
- `http://127.0.0.1:8000/api/dashboard`
- `http://127.0.0.1:8000/api/dashboard/weekly`
- `http://127.0.0.1:8000/api/apps`
- `http://127.0.0.1:8000/api/goals`
- `http://127.0.0.1:8000/api/blocks`
- `http://127.0.0.1:8000/api/settings`
- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/openapi.json`

## Planned structure (Phase 2)

```
api/
  app/
    main.py            # FastAPI app factory
    routers/           # /sessions, /pickups, /goals, /rewards, ...
    models/            # SQLAlchemy models (Postgres schema)
    services/          # aggregations, rewards ledger, RLS helpers
    auth/              # Clerk integration + JWT verification
  migrations/          # Alembic
  tests/               # pytest, hits a real Postgres (docker-compose.dev.yml)
  pyproject.toml
```

See the design spec for endpoint shapes and the sync protocol between
`agent/` (SQLite buffer) and `api/` (Postgres source of truth).
