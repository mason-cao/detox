# ADR-0001: Hybrid local-agent + hosted-dashboard architecture

- **Status:** Accepted
- **Date:** 2026-04-17
- **Context:** Phase 0 monorepo reorg (`docs/plans/2026-04-17-phase-0-monorepo-reorg.md`)
- **Supersedes:** Implicit "local-only v1" assumption in the original `backend/`
  + `frontend/` layout.

## Context

Detox v1 is a single-machine app: a Python daemon polls the frontmost macOS
app every 2 seconds via `osascript`, stores sessions in SQLite, and serves a
vanilla-JS dashboard through Flask on `localhost:5050`. Restrictions are
enforced locally via `pkill -x`.

The redesign (`docs/specs/2026-04-17-detox-redesign-design.md`) extends Detox
in two directions simultaneously:

1. A substantially more ambitious UI (the Isle metaphor, a reward economy, a
   Market, a Rule Board).
2. Multi-device access — view the dashboard from the phone, share Postcards
   with friends, resume state after wiping the Mac.

Both directions stress the current shape. Specifically:

- Tracking **must** stay on macOS. `osascript` and `pkill` have no portable
  substitute; the hosts that cloud vendors give us cannot introspect the
  user's frontmost window.
- The dashboard **should not** stay pinned to `localhost`. Forcing users to
  visit the Mac to view yesterday's usage defeats the multi-device goal.
- Storage **cannot** stay in a single SQLite file if users expect continuity
  across devices or a wiped machine.

## Decision

Adopt a **hybrid local-agent + hosted-dashboard** architecture:

- **`agent/`** — Python daemon on macOS. Owns OS-level tracking
  (`osascript`), restrictions (`pkill -x`), notifications (Notification
  Center), and a local SQLite buffer. Authenticates to the cloud tier and
  syncs on a schedule.
- **`api/`** — FastAPI service hosted on Fly.io. Owns the authoritative
  Postgres store, aggregations, rewards ledger, and auth (Clerk). Never
  touches the user's apps directly.
- **`web/`** — Static dashboard (vanilla HTML/CSS/JS, no build step).
  Phase 0–1: served by the agent's Flask process at `localhost:5050`.
  Phase 4+: deployed to Cloudflare Pages and talks to `api/` over HTTPS.
- **`infra/`** — `docker-compose.dev.yml` for local Postgres + Redis;
  Fly/Cloudflare configs when they exist.

Layers communicate only through well-defined interfaces:

- `agent` ↔ `api` via an authenticated JSON protocol (sessions, pickups,
  settings deltas). Buffer locally, retry on failure, no hard requirement on
  continuous connectivity.
- `web` ↔ `api` via the same JSON API.
- `agent` ↔ `web` remains localhost-only for the Phase 0–1 window; after
  Phase 4, the cloud-served `web` replaces it for cross-device viewing while
  the agent continues running for tracking.

## Consequences

**Positive**

- Tracking fidelity is preserved: nothing moves off macOS that can't move.
- Dashboard becomes reachable from any device after Phase 4.
- Storage durability improves: Postgres is the source of truth, SQLite is a
  recovery buffer.
- Each layer gets a dedicated directory from day one, so Phase 2+ doesn't
  require a second history-splitting reorg.
- Restrictions remain trustworthy — the cloud cannot silently relax them,
  because the kill switch lives on the device.

**Negative**

- Operational footprint grows from "a Python process" to "a Python process +
  Postgres + Redis + auth provider + CDN". Phase 0–1 defers all of that;
  Phase 2 onward pays the complexity.
- Agent → cloud sync introduces conflict and offline cases the current
  single-process design never had. The agent's SQLite buffer + idempotent
  sync protocol absorbs most of this, but it's real work.
- Privacy surface expands: user data leaves the device starting Phase 4. The
  spec commits to end-to-end encryption of raw usage records and opt-in for
  cross-device sync; this ADR ratifies that commitment.
- Dependency count goes up (FastAPI, SQLAlchemy, Alembic, Clerk, a queue
  library, deployment tooling). The v1 pinning of `flask + pillow` will not
  survive Phase 2.

**Neutral**

- The web bundle stays vanilla JS. A build step is explicitly out of scope
  until someone can point at an ADR justifying it.
- The agent stays macOS-only. Cross-platform tracking is not on the roadmap;
  if it ever is, it gets its own ADR.

## Alternatives considered

**A. Stay local-only.** Simplest. Kills multi-device and the spec's reward
economy (which needs durable ledgers the user can't wipe by reinstalling).
Rejected — doesn't meet the product goals.

**B. Rewrite as a pure cloud app.** Impossible. `osascript` and `pkill`
cannot be hosted. Would require a native Mac helper anyway, which is exactly
`agent/` under a different name.

**C. Keep the Flask monolith and add sync to it.** Flask + raw SQLite +
ad-hoc cloud sync is strictly worse than moving to FastAPI + Postgres: no
structured migrations, no async handling of sync traffic, no obvious place
to grow the rewards ledger. Rejected.

**D. Defer directory split until Phase 2.** Tempting (YAGNI). Rejected
because renaming `backend/` → `agent/` and creating `api/` + `infra/` in
Phase 2 would either (i) break git history mid-rewrite or (ii) land as one
giant commit entangled with the FastAPI port. Doing the reorg in Phase 0 as
a pure rename is the cheap moment.

## Follow-ups

- Phase 1 keeps everything local; the Isle UI ships against today's Flask
  routes. No cloud calls yet.
- Phase 2 introduces `api/` behind `localhost` with a local Postgres. The
  agent learns to write to it.
- Phase 4 is the first deploy; it is also the first time user data leaves
  the device, and must go through a privacy review against the spec's
  commitments.
