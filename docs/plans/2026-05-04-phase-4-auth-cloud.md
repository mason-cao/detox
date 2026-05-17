# Phase 4 — Auth + Cloud Implementation Plan

**Goal:** Take the FastAPI service from "single dev-token user" to a real multi-tenant cloud product. Add Supabase Auth on web and api, pair the macOS agent with a JWT stored in the Keychain, drain the local `sync_queue` to a hosted Postgres via `POST /v1/ingest`, distribute rules back to the agent with ETag-cached pulls, move the rewards ledger to the server, and deploy api → Fly.io and web → Cloudflare Pages. End state: any browser logged into the user's Supabase session sees the same data the local agent is collecting.

**Architecture:** Three separately deployable surfaces share one Postgres.

```
USER'S MAC                                CLOUD
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│  agent (rumps + monitor)        │      │  api.detox.app  (Fly.io)        │
│  ├─ sqlite (sessions, queue)    │      │  ├─ FastAPI                     │
│  ├─ sync.flush (every 5 min)    │ JWT  │  ├─ Supabase JWT verifier       │
│  ├─ rules.pull (every 30 s)     │◀────▶│  ├─ /v1/ingest /v1/rules        │
│  └─ rewards mirror (read-only)  │      │  ├─ /v1/rewards/balances        │
└─────────────────────────────────┘      │  └─ Postgres (RLS) + Redis      │
                                         └─────────────────────────────────┘
                                                        ▲
                                                        │ JWT
                                         ┌──────────────┴──────────────────┐
                                         │  app.detox.app  (CF Pages)      │
                                         │  vanilla web/ + supabase-js      │
                                         └─────────────────────────────────┘
```

The agent is the only writer of session/usage/pickup rows; the cloud is the system-of-record for users, devices, blocks, goals, settings, rewards, milestones, and inventory. The web app is a pure reader plus a place to set rules; rules flow cloud → agent. Blocker enforcement stays client-side for latency.

**Tech stack:**
- **Auth:** Supabase Auth, magic-link + Google. Hosted Supabase project (free tier OK for dev). The api verifies JWTs locally with the project's JWKS — no per-request RPC to Supabase.
- **Server libs:** add `pyjwt[crypto]>=2.8`, `httpx>=0.27`, `redis>=5.0`. Drop `DETOX_DEV_TOKEN` from prod (kept for local-only smoke).
- **Agent libs:** add `keyring>=24` (macOS Keychain via Security.framework), `requests>=2.31`. No new compiled deps.
- **Frontend:** vanilla JS + `@supabase/supabase-js@2` from CDN — no bundler.
- **Infra:** Fly.io single region (sjc), managed Postgres (`fly postgres`), Upstash Redis via Fly extension.
- **Static web:** Cloudflare Pages connected to repo, builds nothing (publishes `web/`), routed at `app.detox.app`.

**Source of truth:** `docs/specs/2026-04-17-detox-redesign-design.md` §6 (hybrid topology), §7 (stack — but Supabase Auth wins over Clerk per the resolved §13 question), §8 (`users`, `devices`, `rewards`, `inventory`, `milestones`), §9 (sync protocol), §10 (privacy). Where this plan and the spec disagree, the spec wins on intent and this plan wins on wire format.

**Non-goals (deferred):**
- **Ghost Mode** (hashed app names, on-device salt). Spec §10 — lands in Phase 5.
- **Sparkle release of agent with cloud build baked in.** Phase 4 is dev-builds only; Phase 5 cuts the first signed `Detox.app` that ships with cloud enabled.
- **Invite gating.** Removed from the launch path; the hosted app relies on Supabase auth plus per-user RLS.
- **Real-time push (websockets).** All cloud → agent flow is poll + ETag.
- **Multi-region or read replicas.** Single Fly region is fine at our user count.
- **Apple Sign-In native flow.** Web Supabase Apple provider is enough for the v1.
- **Per-device pause from web.** Read-only on web for Phase 4.
- **Migration of historical local data uploaded on first pair.** Brand-new account = brand-new server; spec §13 documents this trade-off.

---

## File structure

**Create:**
- `api/app/supabase_auth.py` — JWT verification, JWKS cache, `resolve_supabase_user_id()`.
- `api/app/routers/ingest.py` — `POST /v1/ingest` (sessions + app_usage + pickups, idempotency-keyed).
- `api/app/routers/rules.py` — `GET /v1/rules` (blocks + category_blocks + goals + settings) with ETag.
- `api/app/routers/devices.py` — `POST /v1/devices/pair`, `GET /v1/devices`, `POST /v1/devices/{id}/heartbeat`.
- `api/app/routers/rewards.py` — `GET /v1/rewards/balances`, `POST /v1/rewards/spend`, `POST /v1/rewards/refund`, `GET /v1/rewards/inventory`, `GET /v1/milestones`.
- `api/app/services/rewards.py` — server-authoritative ledger (port from `agent/database.py`).
- `api/app/services/ingest.py` — idempotent insert helpers using `(device_id, started_at, app_name)` and equivalent for usage/pickups.
- `api/app/redis_client.py` — connection pool + rate-limit primitives.
- `api/migrations/versions/0003_rewards_inventory_milestones.py` — adds `rewards_balances`, `inventory`, `milestones` tables (per spec §8).
- `api/migrations/versions/0004_devices_pairing_fields.py` — extends `devices` with `paired_at`, `pairing_code_hash`, `pairing_expires_at`.
- `api/Dockerfile` — multi-stage Python 3.11 image for Fly.
- `infra/fly/api.fly.toml` — Fly.io app config for the api.
- `infra/fly/README.md` — runbook (create app, attach Postgres, attach Redis, set secrets, deploy).
- `infra/cloudflare/wrangler.toml` — Pages routes config.
- `infra/cloudflare/README.md` — runbook (connect repo, custom domain, env vars).
- `web/js/auth.js` — Supabase client + sign-in / sign-out / session manager. Replaces today's same-origin assumption.
- `web/js/cloud.js` — auth-aware fetch wrapper. Existing `App.api` swaps to call this.
- `web/sign-in.html` — minimal magic-link page reusing the Dawn Cove palette.
- `agent/keychain.py` — `store_jwt`, `load_jwt`, `clear_jwt` over `keyring` (service id `com.detox.agent`).
- `agent/cloud.py` — HTTP client (base URL, retry, JWT header injection). Used by `sync.py` and the new puller.
- `agent/rules.py` — `pull_once()` + threaded `start_puller()` with ETag cache in `sync_state`.
- `agent/cli/pair.py` — `python3 -m agent.cli.pair` — opens the browser to `app.detox.app/pair?code=…`, polls api for completion, stores JWT.
- `agent/tests/test_rules_puller.py`, `agent/tests/test_sync_flush.py`.
- `api/tests/test_ingest.py`, `api/tests/test_rules.py`, `api/tests/test_rewards.py`, `api/tests/test_supabase_auth.py`.

**Modify:**
- `api/app/main.py` — register the four new routers; bind Redis on app state.
- `api/app/auth.py` — keep dev-token branch for `DETOX_ENV=local`; add new `supabase_auth` branch and switch `dependencies.api_request_setup` to call the right resolver.
- `api/app/dependencies.py` — set `request.state.user_id` from Supabase JWT, set Postgres `app.current_user_id` GUC inside the session pool.
- `api/app/config.py` — add `supabase_url`, `supabase_jwt_jwks_url`, `supabase_jwt_audience`, `redis_url`, `auth_mode` (`local` / `supabase`).
- `api/pyproject.toml`, `api/requirements.txt` (if present) — bump deps.
- `agent/sync.py` — replace no-op `flush()` with a real batched `POST /v1/ingest`. Drain `sync_queue` 100 rows at a time; mark posted via DELETE; surface `posted/pending/last_error/last_success_at`.
- `agent/menubar.py` — show pairing state ("Not paired" / "Paired as you@x.com / device-name"), pull-cadence indicator, manual "Sync now" + "Pair this device" menu items.
- `agent/config.py` — add `CLOUD_API_BASE`, `CLOUD_PULL_INTERVAL_SECONDS=30`, `CLOUD_PUSH_INTERVAL_SECONDS=300`.
- `agent/database.py` — `sync_state` gains `rules_etag`, `rules_pulled_at`, `last_push_status`. Local rewards tables stop being authoritative — migration drops the unique constraint that prevented re-mirroring server state.
- `agent/blocker.py` — read blocks/category_blocks from a local mirror table updated by the puller, not the existing user-facing tables. Keeps single-source-of-truth on the server while preserving sub-second enforcement.
- `agent/server.py` — when paired, the local Flask routes proxy reads to the cloud (so the local dashboard still works), with a banner if the cloud is unreachable.
- `web/index.html`, `web/sign-in.html` — load `auth.js` + `cloud.js`. Bump cache busters.
- `web/js/app.js` — gate `App.api` behind `Auth.ready()`; redirect to `/sign-in.html` on 401.
- `requirements.txt` (root) — append `keyring>=24`, `requests>=2.31`.
- `infra/build/setup.py` — include `keyring`, `requests` in py2app `includes`.
- `start.sh` — print which mode the api is in (local dev-token vs Supabase) so dev confusion stays low.
- `README.md` — short "Running against the cloud" section + the agent pairing one-liner.
- `.gitignore` — add `.env*` and `infra/cloudflare/.wrangler/`.

---

## Task 1 — Supabase JWT verification on the api

**Files:**
- Create: `api/app/supabase_auth.py`, `api/tests/test_supabase_auth.py`.
- Modify: `api/app/auth.py`, `api/app/config.py`, `api/app/dependencies.py`, `api/app/main.py`, `api/pyproject.toml`.

**Steps:**

- [ ] **Step 1: Add deps + config.** Append to `api/pyproject.toml` `dependencies`: `pyjwt[crypto]>=2.8`, `httpx>=0.27`. In `api/app/config.py`, extend `Settings`:

  ```python
  auth_mode: str = "local"  # "local" | "supabase"
  supabase_url: str | None = None
  supabase_jwt_jwks_url: str | None = None
  supabase_jwt_audience: str = "authenticated"
  ```

  Read each from env (`DETOX_AUTH_MODE`, `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_AUD`). Default `auth_mode="local"` so existing `DETOX_DEV_TOKEN` flows unchanged.

- [ ] **Step 2: JWKS-cached verifier.** Create `api/app/supabase_auth.py`:

  ```python
  """Verify Supabase Auth JWTs against the project's JWKS."""

  from __future__ import annotations

  import time
  import threading
  from typing import Final

  import httpx
  import jwt
  from fastapi import Request

  from .config import Settings
  from .errors import ApiError

  _JWKS_TTL_SECONDS: Final = 3600
  _ALG: Final = "RS256"

  _cache_lock = threading.Lock()
  _cached_jwks: dict | None = None
  _cached_at: float = 0.0


  def _fetch_jwks(url: str) -> dict:
      with httpx.Client(timeout=5.0) as client:
          resp = client.get(url)
          resp.raise_for_status()
          return resp.json()


  def _get_jwks(url: str) -> dict:
      global _cached_jwks, _cached_at
      with _cache_lock:
          if _cached_jwks and (time.time() - _cached_at) < _JWKS_TTL_SECONDS:
              return _cached_jwks
          _cached_jwks = _fetch_jwks(url)
          _cached_at = time.time()
          return _cached_jwks


  def _signing_key(token: str, jwks: dict):
      header = jwt.get_unverified_header(token)
      kid = header.get("kid")
      for key in jwks.get("keys", []):
          if key.get("kid") == kid:
              return jwt.algorithms.RSAAlgorithm.from_jwk(key)
      raise ApiError("unknown signing key", status_code=401)


  def resolve_supabase_user_id(request: Request) -> str:
      settings: Settings = request.app.state.settings
      if not settings.supabase_jwt_jwks_url:
          raise ApiError("supabase auth not configured", status_code=500)
      header = (request.headers.get("authorization") or "").strip()
      if not header.lower().startswith("bearer "):
          raise ApiError("missing bearer token", status_code=401)
      token = header.split(" ", 1)[1].strip()

      jwks = _get_jwks(settings.supabase_jwt_jwks_url)
      key = _signing_key(token, jwks)
      try:
          claims = jwt.decode(
              token,
              key=key,
              algorithms=[_ALG],
              audience=settings.supabase_jwt_audience,
          )
      except jwt.PyJWTError as exc:
          raise ApiError(f"invalid token: {exc}", status_code=401)

      sub = claims.get("sub")
      if not sub:
          raise ApiError("token missing sub claim", status_code=401)
      return sub
  ```

- [ ] **Step 3: Switch `auth.py` to dispatch on mode.** In `api/app/auth.py`, keep `resolve_dev_user_id` and add:

  ```python
  def resolve_user_id(request: Request) -> str | None:
      settings = _settings(request)
      if settings.auth_mode == "supabase":
          from .supabase_auth import resolve_supabase_user_id
          return resolve_supabase_user_id(request)
      return resolve_dev_user_id(request)
  ```

  In `api/app/dependencies.py`, replace the `resolve_dev_user_id(request)` call with `resolve_user_id(request)`.

- [ ] **Step 4: Tests.** Create `api/tests/test_supabase_auth.py`. Generate an RSA keypair in-test, build a JWKS and a signed JWT, monkeypatch `_fetch_jwks` to return the local JWKS, assert:

  - Valid token → `resolve_supabase_user_id` returns the `sub`.
  - Wrong audience → 401.
  - Expired token → 401.
  - Unknown kid → 401.
  - Missing header → 401.

  Run `pytest api/tests/test_supabase_auth.py -q`.

- [ ] **Step 5: Local smoke (still runs in dev-token mode).** From repo root: `python -m pytest api/tests -q` — every existing contract test must still pass because `auth_mode="local"` is the default.

- [ ] **Step 6: Commit.**

  ```
  feat(auth): supabase JWT verification with JWKS cache (auth_mode=supabase)
  ```

---

## Task 2 — Postgres RLS GUC propagation

**Files:**
- Modify: `api/app/dependencies.py`, `api/app/services/__init__.py` (or wherever the SQLAlchemy/async pool lives), one new helper.

**Steps:**

- [ ] **Step 1: Inspect** the existing services layer to confirm where it acquires a per-request DB connection. The migration 0002 set up RLS expecting `SET LOCAL app.current_user_id = '<uuid>'` per request — the Phase 2 dev-token path already had a TODO for this. We finish it here.

- [ ] **Step 2: Per-request GUC set.** Wherever the request opens a Postgres transaction, run `SET LOCAL app.current_user_id = $1` with the resolved UUID before any user-data query. SQLite local-dev path is unaffected (RLS only applies on Postgres).

- [ ] **Step 3: Tests.** Add a fixture in `api/tests/conftest.py` that creates two test users in Postgres and asserts that an authenticated request as user A cannot read user B's rows even with raw SQL (`SELECT * FROM app_usage` returns empty). Skip this test on SQLite.

- [ ] **Step 4: Commit.**

  ```
  feat(api): propagate authenticated user_id into postgres RLS GUC
  ```

---

## Task 3 — Devices, pairing, and ingest endpoints

**Files:**
- Create: `api/app/routers/devices.py`, `api/app/routers/ingest.py`, `api/app/services/ingest.py`, `api/migrations/versions/0004_devices_pairing_fields.py`, `api/tests/test_ingest.py`, `api/tests/test_devices.py`.
- Modify: `api/app/main.py`, `api/app/redis_client.py` (rate-limit only — see Task 8).

**Wire format (locked here so the agent in Task 6 can target it):**

```
POST /v1/devices/pair
  body: { "device_name": "Mason MBP", "agent_version": "1.0.0" }
  auth: Supabase JWT (the user's web session)
  resp: { "device_id": "uuid", "api_token": "<long-lived JWT>", "expires_at": "..." }

POST /v1/devices/{id}/heartbeat
  body: { "agent_version": "1.0.0", "pending_queue": 12 }
  auth: device JWT
  resp: { "ok": true }

POST /v1/ingest
  body: {
    "device_id": "uuid",
    "sessions":   [{ "app_name", "started_at", "ended_at", "category" }, ...],
    "app_usage":  [{ "app_name", "timestamp" }, ...],
    "pickups":    [{ "app_name", "timestamp" }, ...]
  }
  auth: device JWT
  resp: { "accepted": { "sessions": 24, "app_usage": 240, "pickups": 3 }, "rejected": [...] }

  Idempotency:
    sessions:   UNIQUE (user_id, device_id, started_at, app_name)
    app_usage:  UNIQUE (user_id, device_id, timestamp, app_name)
    pickups:    UNIQUE (user_id, device_id, timestamp, app_name)
  Conflicts return ok (silent dedupe), not 409.
```

**Steps:**

- [ ] **Step 1: Migration 0004.** Add to `devices`: `paired_at TIMESTAMPTZ`, `pairing_code_hash TEXT`, `pairing_expires_at TIMESTAMPTZ`, plus the three idempotency unique constraints above. Also add `agent_version` (already there per spec §8 — confirm before re-adding).

- [ ] **Step 2: Pairing flow.** The web app initiates pairing by calling `POST /v1/devices/pair-init` with the user's Supabase JWT; the server returns a 6-character code and a 5-minute expiry. The agent (run via `python3 -m agent.cli.pair`) prompts the user to paste that code; agent calls `POST /v1/devices/pair-claim` with the code and gets back `{device_id, api_token}`. `api_token` is a long-lived signed JWT (server-issued, NOT a Supabase token). Store the issuing key in env (`DETOX_DEVICE_JWT_SECRET`).

  Two endpoints, paired:
  ```
  POST /v1/devices/pair-init    auth: supabase user JWT  → { code, expires_at }
  POST /v1/devices/pair-claim   auth: none, body has code → { device_id, api_token }
  ```

  Code is stored as a SHA-256 hash, single-use, expires after 5 minutes.

- [ ] **Step 3: Device JWT verifier.** Add `resolve_device_user_id` in `supabase_auth.py` (or a new `device_auth.py`) that decodes the agent's `api_token` and returns `(user_id, device_id)`. The api dispatches based on token claims (`device_id` claim present → device path; otherwise Supabase path).

- [ ] **Step 4: Ingest service.** `api/app/services/ingest.py` implements idempotent inserts. Each batch wraps in one transaction; conflicts on the unique indexes are upserted as no-ops with `ON CONFLICT DO NOTHING`. Return per-kind accepted counts.

- [ ] **Step 5: Heartbeat.** `POST /v1/devices/{id}/heartbeat` updates `last_sync_at`, `agent_version`. Used by the menu-bar "last sync" line.

- [ ] **Step 6: Tests.** `api/tests/test_devices.py`:
  - pair-init requires Supabase JWT (401 without).
  - pair-claim with wrong code → 404.
  - pair-claim after expiry → 410.
  - pair-claim issues a JWT whose claims include `device_id` and the originating `user_id`.

  `api/tests/test_ingest.py`:
  - happy path: 100-row session batch returns `accepted.sessions=100`.
  - replay: same batch posted twice → second call returns 100 again; DB row count stays at 100.
  - mismatched device_id (token's `device_id` ≠ body `device_id`) → 403.
  - oversize batch (>1000 rows) → 413.

- [ ] **Step 7: Commit.**

  ```
  feat(sync): /v1/devices pairing + /v1/ingest with idempotent inserts
  ```

---

## Task 4 — Rules pull endpoint

**Files:**
- Create: `api/app/routers/rules.py`, `api/tests/test_rules.py`.
- Modify: `api/app/main.py`.

**Wire format:**

```
GET /v1/rules
  auth: device JWT
  headers: If-None-Match: "<etag>"
  resp 200: {
    "etag": "v123-<hash>",
    "blocks":          [{ "app_name", "block_type", "daily_limit_minutes" }, ...],
    "category_blocks": [{ "category_name" }, ...],
    "goals":           [{ "type", "target_minutes", "active" }, ...],
    "settings":        { "bedtime_start": "22:00", ... }
  }
  resp 304: empty body when If-None-Match matches.
```

**Steps:**

- [ ] **Step 1: Compute etag.** Hash a tuple of the four collection counts + max(updated_at) per table per user. Cache the result in Redis under `rules:etag:<user_id>` for 30 s; bust on writes from `/api/blocks`, `/api/goals`, `/api/settings`. Use SHA-256 truncated to 16 hex chars.

- [ ] **Step 2: Bust on writes.** In `services/blocks.py`, `services/goals.py`, `services/settings.py`, after every write call a small helper `rules.invalidate_etag(user_id)`.

- [ ] **Step 3: Tests.** `api/tests/test_rules.py`:
  - first call returns 200 + etag.
  - second call with matching `If-None-Match` returns 304.
  - after a block write, the next call returns 200 with a new etag.
  - device of user A cannot see user B's rules.

- [ ] **Step 4: Commit.**

  ```
  feat(sync): /v1/rules with ETag, bust on rule writes
  ```

---

## Task 5 — Server-authoritative rewards ledger

**Files:**
- Create: `api/app/routers/rewards.py`, `api/app/services/rewards.py`, `api/migrations/versions/0003_rewards_inventory_milestones.py`, `api/tests/test_rewards.py`.
- Modify: `api/app/main.py`, `agent/database.py`.

**Steps:**

- [ ] **Step 1: Migration 0003.** Add (per spec §8):
  - `rewards_balances (user_id PK, sunlight_total INT, starshards_total INT, daily_earned INT, daily_earn_date DATE, last_earn_at TIMESTAMPTZ)`.
  - `inventory (id PK, user_id, item_key, acquired_at, refunded BOOL DEFAULT false, refunded_at TIMESTAMPTZ NULL, UNIQUE(user_id, item_key) WHERE refunded = false)`.
  - `milestones (id PK, user_id, kind, detail, awarded_at, UNIQUE(user_id, kind, detail))`.
  - The existing `rewards_ledger` and `rewards_awards` (already on Postgres from Phase 2 mirror) remain — they store the entries the new tables roll up.

- [ ] **Step 2: Port the rollup.** Move the sunlight-earn logic from `agent/database.py` (`_sunlight_for_date`, `_sunlight_earnings`, ledger-balance calc) into `api/app/services/rewards.py`. The cloud rollup runs on `POST /v1/ingest` when the new sessions cross day boundaries, and on a Redis-locked daily cron (Fly machine schedule). Daily cap of 120 ☀ enforced server-side.

- [ ] **Step 3: Endpoints.**
  ```
  GET /v1/rewards/balances        → { sunlight, starshards, daily_earned, daily_cap, etag }
  POST /v1/rewards/spend          → atomic deduct + inventory insert
  POST /v1/rewards/refund         → 100% within 24 h, 50% after
  GET /v1/rewards/inventory       → owned items
  GET /v1/milestones              → ordered desc
  ```

- [ ] **Step 4: Agent goes read-only on rewards.** In `agent/database.py`, drop the `INSERT INTO rewards_ledger` / `rewards_awards` calls behind `if cloud_authoritative()` (returns true once the device is paired). Keep the local schema for unpaired-mode and for the cached HUD balance (a single-row mirror updated by the puller in Task 6). The local rewards UI continues to read from the local mirror.

- [ ] **Step 5: Tests.** `api/tests/test_rewards.py`:
  - earning over 120 ☀/day caps at 120.
  - spend deducts atomically; concurrent spend test (two requests simultaneously) — only one succeeds.
  - refund within 24 h returns 100 %; after 24 h returns 50 %.
  - inventory respects refund flag.

- [ ] **Step 6: Commit.**

  ```
  feat(rewards): server-authoritative ledger, balances, inventory, milestones
  ```

---

## Task 6 — Agent: keychain, cloud client, sync flush, rules puller

**Files:**
- Create: `agent/keychain.py`, `agent/cloud.py`, `agent/rules.py`, `agent/cli/__init__.py`, `agent/cli/pair.py`, `agent/tests/test_rules_puller.py`, `agent/tests/test_sync_flush.py`.
- Modify: `agent/sync.py`, `agent/menubar.py`, `agent/database.py`, `agent/blocker.py`, `agent/config.py`, `requirements.txt`, `infra/build/setup.py`.

**Steps:**

- [ ] **Step 1: Keychain wrapper.** `agent/keychain.py`:

  ```python
  import keyring

  SERVICE = "com.detox.agent"
  ACCOUNT = "default"

  def store_jwt(token: str) -> None:
      keyring.set_password(SERVICE, ACCOUNT, token)

  def load_jwt() -> str | None:
      return keyring.get_password(SERVICE, ACCOUNT)

  def clear_jwt() -> None:
      try:
          keyring.delete_password(SERVICE, ACCOUNT)
      except keyring.errors.PasswordDeleteError:
          pass
  ```

- [ ] **Step 2: HTTP client.** `agent/cloud.py` — single `requests.Session`, retries on 502/503, baseline timeout 5 s, JSON only. Reads `CLOUD_API_BASE` (default `https://api.detox.app`). Injects `Authorization: Bearer <jwt>` from `keychain.load_jwt()`. Surfaces `is_paired()`.

- [ ] **Step 3: Pairing CLI.** `python3 -m agent.cli.pair`:
  1. Print: open this URL in your browser, sign in, paste the 6-char code that appears.
  2. Read code from stdin.
  3. `POST /v1/devices/pair-claim {code}`.
  4. On success → `keychain.store_jwt(api_token)`, echo "Paired as {device_id}". Tell user to relaunch the menubar app to pick up the new state.

  Web flow (Task 7) renders the code; here we just consume it.

- [ ] **Step 4: Drain `sync_queue`.** Replace `agent/sync.py`:

  ```python
  def flush(batch_size: int = 200) -> dict:
      if not cloud.is_paired():
          return {"posted": 0, "pending": pending_count(), "status": "unpaired"}
      sessions, app_usage, pickups, row_ids = _next_batch(batch_size)
      if not row_ids:
          return {"posted": 0, "pending": 0, "status": "idle"}
      try:
          resp = cloud.post_json("/v1/ingest", {
              "device_id": device_id(),
              "sessions": sessions,
              "app_usage": app_usage,
              "pickups": pickups,
          })
      except cloud.HTTPError as e:
          return {"posted": 0, "pending": pending_count(),
                  "status": "error", "last_error": str(e)}
      _delete_rows(row_ids)
      return {"posted": sum(resp["accepted"].values()),
              "pending": pending_count(), "status": "ok"}
  ```

  `_next_batch` reads `sync_queue` rows ordered by `queued_at`, decodes `payload_json`, partitions by `kind`. `_delete_rows` deletes by id within a single transaction.

  Run `flush` on a 5-minute timer from `menubar.py`.

- [ ] **Step 5: Rules puller.** `agent/rules.py`:

  ```python
  def pull_once() -> str:
      etag = _read_etag()
      try:
          resp = cloud.get("/v1/rules", headers={"If-None-Match": etag} if etag else {})
      except cloud.HTTPError as e:
          return f"error: {e}"
      if resp.status_code == 304:
          _touch_pulled_at()
          return "unchanged"
      payload = resp.json()
      _apply(payload)
      _store_etag(payload["etag"])
      return "applied"
  ```

  `_apply` writes into a local `cloud_blocks_mirror`, `cloud_category_blocks_mirror`, `cloud_goals_mirror`, `cloud_settings_mirror` table (added in this task — schema migration 0005 in `agent/database.py`). The blocker (next step) reads from the mirror tables.

  Run `pull_once` on a 30 s threading timer from `menubar.py`.

- [ ] **Step 6: Blocker reads from mirror.** In `agent/blocker.py`, swap `db.list_blocks()` for `db.list_block_mirror()`. Behavior is identical when unpaired (mirror is seeded from local tables) and pulled-from-cloud when paired.

- [ ] **Step 7: Menu-bar integration.** Add to `DetoxApp.menu`:
  - "Pair this device…" (only shown when unpaired) → spawns `python3 -m agent.cli.pair` in Terminal.
  - "Paired as {device_name}" header (when paired).
  - "Last sync: {hh:mm}" (from `last_push_status`).
  - "Sync now" (calls `sync.flush()`).
  - "Sign out" → `keychain.clear_jwt()` + clear mirror tables + restart pullers.

- [ ] **Step 8: Tests.** `agent/tests/test_sync_flush.py`:
  - unpaired → `flush` returns `unpaired`, no HTTP call.
  - paired + 50 rows queued + mocked api → all 50 rows deleted on success.
  - paired + api 500 → no rows deleted, status `error`.

  `agent/tests/test_rules_puller.py`:
  - 200 response writes mirror tables and stores etag.
  - 304 response leaves mirrors untouched, updates `rules_pulled_at`.
  - blocker reads from mirror after `pull_once`.

- [ ] **Step 9: py2app includes.** Append `keyring`, `requests` to `infra/build/setup.py` `OPTIONS["packages"]` (or `includes`).

- [ ] **Step 10: Commit.**

  ```
  feat(agent): keychain JWT, cloud client, sync flush + rules puller
  ```

---

## Task 7 — Web auth + pairing page

**Files:**
- Create: `web/sign-in.html`, `web/pair.html`, `web/js/auth.js`, `web/js/cloud.js`, `web/js/pair.js`.
- Modify: `web/index.html`, `web/js/app.js`.

**Steps:**

- [ ] **Step 1: Supabase client init.** `web/js/auth.js`:

  ```js
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

  const supabase = createClient(
      window.DETOX_SUPABASE_URL,
      window.DETOX_SUPABASE_ANON_KEY
  );

  const Auth = {
      _ready: null,
      ready() { return this._ready ||= supabase.auth.getSession(); },
      session() { return supabase.auth.getSession(); },
      signInWithMagicLink(email) {
          return supabase.auth.signInWithOtp({
              email,
              options: { emailRedirectTo: `${location.origin}/` }
          });
      },
      signOut() { return supabase.auth.signOut(); },
      onChange(cb) { return supabase.auth.onAuthStateChange(cb); },
  };
  window.Auth = Auth;
  ```

  Inject `DETOX_SUPABASE_URL` and `DETOX_SUPABASE_ANON_KEY` into `index.html` at build time (Cloudflare Pages env). Local dev reads them from the Flask `/api/config` endpoint (added in this task).

- [ ] **Step 2: Auth-aware fetch.** `web/js/cloud.js`:

  ```js
  const Cloud = {
      async fetch(path, init = {}) {
          const { data: { session } } = await Auth.session();
          if (!session) { location.href = "/sign-in.html"; throw new Error("unauthenticated"); }
          const headers = new Headers(init.headers || {});
          headers.set("Authorization", `Bearer ${session.access_token}`);
          headers.set("Content-Type", "application/json");
          const resp = await fetch(`${window.DETOX_API_BASE}${path}`, { ...init, headers });
          if (resp.status === 401) location.href = "/sign-in.html";
          return resp;
      }
  };
  window.Cloud = Cloud;
  ```

  `App.api` in `app.js` switches to `Cloud.fetch` when `window.DETOX_API_BASE` is set; otherwise it stays on the same-origin Flask path.

- [ ] **Step 3: Sign-in page.** `web/sign-in.html` — single field, magic-link only, Dawn Cove palette, no Inter changes. After link is requested, show "Check your email." On callback (`?type=magiclink`), redirect to `/`.

- [ ] **Step 4: Pair page.** `web/pair.html` — calls `POST /v1/devices/pair-init` on load, shows a 6-character code prominently, polls `GET /v1/devices` every 5 s; when the new device shows up, switches to "✓ paired".

- [ ] **Step 5: Manual smoke (browser).**
  - Visit `app.detox.app` unauthenticated → bounced to `/sign-in.html`.
  - Magic-link → callback → land on `/`. Existing Isle dashboard renders against cloud data.
  - Visit `/pair` → see code → run `python3 -m agent.cli.pair` locally → paste code → both browser and menu-bar reflect "paired".

- [ ] **Step 6: Commit.**

  ```
  feat(auth): supabase sign-in on web + pair-this-device page
  ```

---

## Task 8 — Redis + rate limit + per-handler cleanup

**Files:**
- Create: `api/app/redis_client.py`.
- Modify: `api/app/main.py`, `api/app/dependencies.py`, `api/app/routers/ingest.py`.

**Steps:**

- [ ] **Step 1: Redis pool.** `api/app/redis_client.py` exposes `get_redis(app) -> redis.Redis` from a connection pool created on startup.

- [ ] **Step 2: Ingest rate limit.** Per device: 60 ingest requests / minute. Implementation: `INCR rl:ingest:{device_id}:{minute}` with 60 s expiry; reject 429 over the limit.

- [ ] **Step 3: Etag cache.** Wire the Task-4 etag cache against this client.

- [ ] **Step 4: Tests.** Mark the rate-limit test as `@pytest.mark.requires_redis` and skip when Redis isn't reachable in CI.

- [ ] **Step 5: Commit.**

  ```
  feat(api): redis-backed rate limit on /v1/ingest and rules etag cache
  ```

---

## Task 9 — Fly.io deploy

**Files:**
- Create: `api/Dockerfile`, `infra/fly/api.fly.toml`, `infra/fly/README.md`.

**Steps:**

- [ ] **Step 1: Dockerfile.** Two-stage Python 3.11-slim. Install `pyproject.toml` deps, copy `api/`, run `uvicorn api.app.main:app --host 0.0.0.0 --port 8080`.

- [ ] **Step 2: fly.toml.** App `detox-api`, region `sjc`, internal port 8080, health check `/health`, `min_machines_running = 1`. `[mounts]` not needed — Postgres is managed.

- [ ] **Step 3: Runbook.** `infra/fly/README.md` — exact commands:

  ```bash
  fly apps create detox-api
  fly postgres create --name detox-pg --region sjc --vm-size shared-cpu-1x
  fly postgres attach detox-pg --app detox-api
  fly ext redis create --name detox-redis --region sjc --plan free
  fly secrets set --app detox-api \
      DETOX_AUTH_MODE=supabase \
      SUPABASE_URL=https://xxx.supabase.co \
      SUPABASE_JWKS_URL=https://xxx.supabase.co/auth/v1/keys \
      DETOX_DEVICE_JWT_SECRET=$(openssl rand -hex 32)
  fly deploy --app detox-api --config infra/fly/api.fly.toml
  ```

  After first deploy: `fly ssh console -C "alembic upgrade head"`.

- [ ] **Step 4: Commit.**

  ```
  feat(infra): fly.io api deploy with managed postgres and redis
  ```

---

## Task 10 — Cloudflare Pages deploy

**Files:**
- Create: `infra/cloudflare/wrangler.toml`, `infra/cloudflare/README.md`.
- Modify: `web/index.html`, `web/sign-in.html` (env-injected globals).

**Steps:**

- [ ] **Step 1: Wrangler config.** `infra/cloudflare/wrangler.toml`:

  ```toml
  name = "detox-app"
  pages_build_output_dir = "../../web"
  compatibility_date = "2026-05-01"
  ```

- [ ] **Step 2: Env vars.** In Cloudflare Pages dashboard set:
  - `DETOX_SUPABASE_URL`
  - `DETOX_SUPABASE_ANON_KEY`
  - `DETOX_API_BASE=https://api.detox.app`

  Inject as `window.DETOX_*` via a `_headers` + `_redirects`-driven HTML rewrite step OR via a small `web/config.js` whose contents are templated at build time (preferred — simpler).

- [ ] **Step 3: Custom domain + DNS.** `app.detox.app` CNAME to Pages, `api.detox.app` A/AAAA to Fly.

- [ ] **Step 4: Smoke.** From a real browser on a phone: `app.detox.app` → sign in → see today's data. Verify CORS works (api allows `https://app.detox.app`).

- [ ] **Step 5: Commit.**

  ```
  feat(infra): cloudflare pages web deploy + api routing
  ```

---

## Task 11 — End-to-end verification

No new code by default. Fix-on-find.

- [ ] **Step 1: Local stack green.** `docker compose -f infra/docker-compose.dev.yml up`, `alembic upgrade head`, `pytest api/tests agent/tests -q`. All green.

- [ ] **Step 2: Remote sign-in.** From a fresh device with no Detox install: visit `app.detox.app`, sign in with magic link, observe empty Isle (no data yet).

- [ ] **Step 3: Pair the local agent.** Run `python3 -m agent.cli.pair`, paste code from `/pair`. Menubar shows "Paired as ...". Within 5 minutes, web Isle shows app usage.

- [ ] **Step 4: Rules round-trip.** From the web Charter, set a daily-total goal of 120 minutes. Within 30 s, the agent's rules puller applies it; restrictions enforce locally.

- [ ] **Step 5: Rewards.** Verify `/v1/rewards/balances` matches what the local mirror shows; spend an item via the Market; balance goes down, inventory updates on both devices.

- [ ] **Step 6: Privacy sweep.** Confirm: no app names appear in Sentry breadcrumbs; CORS rejects `evil.com`; `Authorization` header missing → 401 from every `/v1/*` route.

- [ ] **Step 7: Commit (only if fixes needed).**

  ```
  fix(phase-4): tighten cors / sentry scrubbing / cold-start race in puller
  ```

---

## Self-review

Spec coverage (`docs/specs/2026-04-17-detox-redesign-design.md` §11/§12):

- `feat(auth): Clerk integration on web and api` → Tasks 1, 2, 7 (Supabase substituted per resolved §13).
- `feat(agent): device pairing flow + JWT storage in Keychain` → Tasks 3, 6.
- `feat(sync): POST /v1/ingest with idempotency + batching` → Tasks 3, 6, 8.
- `feat(sync): rules puller every 30s with ETag caching` → Tasks 4, 6, 8.
- `feat(rewards): move ledger authority to server, push to agent for HUD` → Tasks 5, 6.
- `feat(infra): Fly.io deploy config + Postgres + Redis` → Tasks 8, 9.
- `feat(infra): Cloudflare Pages web deploy + API routing` → Task 10.

Spec amendments needed: §7 row "Auth: Clerk (or Supabase Auth)" should be edited in a follow-up commit to record the Supabase decision and retire the open §13 question. Not done in this plan to keep the spec/plan boundary clean — it's a one-line `docs:` commit.

Surface: ~14 new files in `api/`, 8 new files in `agent/`, 5 new files in `web/`, 4 new files in `infra/`. ~3 new dependencies on the api side, 2 on the agent side, 1 on the web side (CDN, no install). Two Alembic migrations (0003, 0004) plus one local-SQLite schema bump for the mirror tables.

Suggested commit cadence (one per task; matches spec §12 ordering as closely as the new auth vendor allows):
- `feat(auth): supabase JWT verification with JWKS cache`
- `feat(api): propagate authenticated user_id into postgres RLS GUC`
- `feat(sync): /v1/devices pairing + /v1/ingest with idempotent inserts`
- `feat(sync): /v1/rules with ETag, bust on rule writes`
- `feat(rewards): server-authoritative ledger, balances, inventory, milestones`
- `feat(agent): keychain JWT, cloud client, sync flush + rules puller`
- `feat(auth): supabase sign-in on web + pair-this-device page`
- `feat(api): redis-backed rate limit on /v1/ingest and rules etag cache`
- `feat(infra): fly.io api deploy with managed postgres and redis`
- `feat(infra): cloudflare pages web deploy + api routing`
- `fix(phase-4): tighten cors / sentry scrubbing / cold-start race in puller` (if needed)
