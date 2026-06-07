# ADR — frontend frontmost-poll cadence

Date: 2026-05-03
Status: Accepted

## Context

Phase 1f's marquee feature is the frontmost-app glow on the Isle. The
frontend needs to know which app is frontmost in near-real-time so the
matching resident marker can pulse a halo and snap to its home tile.

## Decision

- Frontend polls `GET /api/dashboard/now` every 3 seconds while the Isle
  tab is open. The poll lifecycle is tied to `App.showTab` — entering the
  Isle starts the poll, leaving stops it.
- Server caches the result for 2 seconds in module memory
  (`_NOW_CACHE` in `agent/server.py`).
- Server reads from the most recent row of `app_usage`, populated by the
  monitor's existing 2-second `osascript` poll.

## Consequences

- Worst-case staleness: 2 s monitor cycle + 3 s frontend gap = ~5 s.
  Acceptable for a behavior-mirror feature; not a real-time game loop.
- ~1200 requests/hour while the Isle is open. Within budget — the route
  is a single cache hit most of the time, and a single indexed
  `ORDER BY timestamp DESC LIMIT 1` query at most every 2 s.
- No new `osascript` fork per request. CPU budget preserved.

## Alternatives considered

- **Per-request `osascript` fork.** Ground-truth fresh, but adds ~50 ms
  latency and a process spawn. Rejected — the monitor already owns the
  osascript path; duplicating it racks up needless work.
- **WebSocket / SSE push from monitor.** Simplest model is HTTP polling;
  WebSockets exceed the project's "stay vanilla" constraint.
- **Reuse `agent/server.py:get_frontmost_app_name`.** Same osascript
  problem above. The DB-row path is cheaper and equally fresh.
