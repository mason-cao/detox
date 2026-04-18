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

Nothing runnable yet. This is intentional.

## Planned structure (Phase 2)

```
api/
  main.py              # FastAPI app factory
  routers/             # /sessions, /pickups, /goals, /rewards, ...
  models/              # SQLAlchemy models (Postgres schema)
  services/            # aggregations, rewards ledger, RLS helpers
  auth/                # Clerk integration + JWT verification
  migrations/          # Alembic
  tests/               # pytest, hits a real Postgres (docker-compose.dev.yml)
  pyproject.toml
```

See the design spec for endpoint shapes and the sync protocol between
`agent/` (SQLite buffer) and `api/` (Postgres source of truth).
