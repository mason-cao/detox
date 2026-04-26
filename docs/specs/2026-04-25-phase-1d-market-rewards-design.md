# Phase 1d — Market + Rewards Ledger

Date: 2026-04-25
Status: Draft — pending implementation plan
Owner: Mason Cao

## 1. Summary

Phase 1d makes the Detox Isle reward economy real. It adds the Sunlight (☀) and Starshard (✦) currencies described in the redesign spec §3.3, opens the Market tab with a five-item stub catalog spanning every category (decor, outfit, weather, building, map), wires a balance display into the HUD, and writes a Hall of Honor section for streak milestones. Sunlight is *derived* from existing usage and goal data; spends, refunds, and starshard awards are *persisted* in two new SQLite tables.

This closes the reward thread of Phase 1 except for actual visual application of owned items, which is deferred to a later art-asset pass.

## 2. Goals & non-goals

**Goals:**
- Earning ledger: sunlight derives from `app_usage` + `goals` on read, with a 120 ☀/day cap.
- Awards: streak days, clean weeks, and four named milestones write rows to `rewards_awards`.
- Spending: a five-item stub catalog plus buy/refund flows.
- Refund policy: 100 % within 24 h, 50 % thereafter, indefinitely, returning to the original currency.
- Hall of Honor: chronological list of every awarded row, grouped by month.
- HUD balance display: `☀ X / 120` and `✦ Y`.

**Non-goals:**
- Visual application of purchased items. Owned items are name-only in inventory; building skins / weather charms / decor / outfits do not change the Isle render yet. That waits for the art pass.
- The category_blocks schema migration (separate plan).
- Phase 2 server / Postgres port — schema deltas are written as plain SQLite, but with names and shapes that map cleanly to spec §8 deltas (`rewards`, `inventory`, `milestones`).
- Multi-device or multi-user concerns. Single-user assumed. No `user_id` columns in this phase.
- Real-money anything.

## 3. Currency model

### 3.1 Sunlight (☀) — derived

Sunlight is computed on read as a pure function of usage + goals + ledger:

```
earned_today = min(
    minutes_under_daily_total(today)
    + sum_over_apps(minutes_under_app_limit(app, today)),
    DAILY_CAP_SUNLIGHT  # 120
)

earned_lifetime = sum_over_days(min(per-day formula above, DAILY_CAP_SUNLIGHT))
```

For each day:
- `minutes_under_daily_total` = `max(0, daily_total_goal_minutes − daily_total_usage_minutes)` if a `daily_total` goal is active, else 0.
- `minutes_under_app_limit(app)` = `max(0, app_limit_minutes − app_usage_minutes)` if that app has an active `app_limit` goal, else 0.
- Both factors apply *simultaneously* (spec §3.3 explicitly stacks them).
- The 120 ☀/day cap is applied *per day*, after stacking, before summing into lifetime.

```
balance_sunlight = earned_lifetime − sum(spend.sunlight) + sum(refund.sunlight)
```

Refunds do *not* count against today's earning cap; the cap is on earned, not on net.

**Backfill:** `earned_lifetime` scans all `app_usage` from the earliest date forward. There is no "ledger landing date" — pre-existing usage that meets goals contributes. This is consistent with how Detox already shows historical stats and sidesteps the awkwardness of a ledger that ignores its own past.

### 3.2 Starshards (✦) — persisted

Starshards are awarded *once per qualifying date* and stored as rows in `rewards_awards`. Three award kinds:

| kind         | detail                       | amount | trigger                                                                                                |
| ------------ | ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `streak_day` | "Day N of streak"            | 1 ✦    | a day under the active `daily_total` goal that extends a streak                                        |
| `clean_week` | "Week of YYYY-MM-DD" (Monday) | 3 ✦    | every day Mon–Sun in that calendar week was a streak day; `awarded_for_date` is that Sunday            |
| `milestone` | one of the four named below  | varies | first time a streak threshold is reached; `awarded_for_date` is the date that triggered it             |

Milestones (one-shot — `UNIQUE(kind, detail)` enforced):

- `first_7_streak` — 1 ✦ bonus
- `first_14_streak` — 2 ✦ bonus
- `first_30_streak` — 5 ✦ bonus
- `first_clean_month` — 5 ✦ bonus (a calendar month with every day a streak day; `awarded_for_date` is the last day of that month)

```
balance_starshards = sum(awards.amount where currency = 'starshard')
                     − sum(spend.starshard) + sum(refund.starshard)
```

### 3.3 Streak definition

A streak is consecutive calendar days where each day is a *streak day*. A day is a *streak day* iff:

1. A `daily_total` goal is active for that date, AND
2. Total `app_usage` for that date is less than or equal to the goal's `target_minutes`.

A day with no active `daily_total` goal is **neutral** — it neither extends nor breaks a streak. (Spec §3.3 says "Days without a configured goal are neutral.") Streaks bridge across neutral days; the streak counter advances only on streak days.

A day with usage strictly greater than the goal breaks the streak. The next streak starts at "Day 1" on the next streak day.

### 3.4 Refund policy

- Within 24 h of `created_at`: 100 % of the original price returned.
- After 24 h: 50 % of the original price returned, indefinitely (spec §3.3 verbatim).
- Refund is to the original currency.
- Item disappears from inventory; the same item key may be re-purchased.
- Refunded sunlight does not count against today's earning cap.

## 4. Daily rollup

A single function `run_rollup_if_needed()` runs at the top of every API request. It consults the `last_rollup_date` setting:

1. If `last_rollup_date` is unset, scan from the earliest `app_usage` date.
2. Otherwise scan from `last_rollup_date + 1` through yesterday (the current day is in flight, never rolled up).
3. For each scanned date, evaluate it as a streak day. If yes, insert a `streak_day` award (idempotent via `UNIQUE(kind, detail, awarded_for_date)`).
4. After processing each date, check if it completes a Mon–Sun calendar week — if every Mon–Sun day in that week was a streak day, insert a `clean_week` award.
5. After processing each date, check streak length — if it crosses 7, 14, or 30 *for the first time ever*, insert the corresponding milestone award.
6. After processing each date, check if it completes a calendar month — if every day in that month was a streak day, insert `first_clean_month` (idempotent via UNIQUE).
7. Update `last_rollup_date` to the latest scanned date.

The rollup is read-only-and-append; it never deletes or modifies awards. Changing the `daily_total` goal mid-history does not retroactively rewrite past streak-day rows. New days are evaluated against the *currently active* goal at the time of rollup.

The rollup is gated by `last_rollup_date` so that the steady state is one cheap settings read per API request. The first request after midnight does the day's rollup work — typically a handful of inserts. The first request after the spec lands does a full backfill scan; this is bounded by the size of `app_usage` (low thousands of days for any realistic install).

## 5. Schema deltas

Two new tables and one new setting key. No existing tables touched.

```sql
CREATE TABLE rewards_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('spend', 'refund')),
    currency TEXT NOT NULL CHECK (currency IN ('sunlight', 'starshard')),
    amount INTEGER NOT NULL,
    item_key TEXT NOT NULL,
    spend_id INTEGER,                    -- for refund rows: FK back to the spend row being refunded
    created_at REAL NOT NULL,
    FOREIGN KEY (spend_id) REFERENCES rewards_ledger(id)
);

CREATE INDEX idx_rewards_ledger_kind ON rewards_ledger(kind);
CREATE INDEX idx_rewards_ledger_item ON rewards_ledger(item_key);

CREATE TABLE rewards_awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('streak_day', 'clean_week', 'milestone')),
    detail TEXT NOT NULL,                -- "Day 7 of streak", "Week of 2026-04-13", "first_7_streak"
    currency TEXT NOT NULL DEFAULT 'starshard',
    amount INTEGER NOT NULL,
    awarded_for_date TEXT NOT NULL,      -- "YYYY-MM-DD" — the date that triggered the award
    awarded_at REAL NOT NULL,
    UNIQUE (kind, detail, awarded_for_date)
);

CREATE INDEX idx_rewards_awards_date ON rewards_awards(awarded_for_date);
```

New setting key: `last_rollup_date` (string, "YYYY-MM-DD" or NULL on first run).

**Inventory is derived** from `rewards_ledger`: an item is currently owned iff there exists a `spend` row for `item_key` with no matching `refund` row. No separate `inventory` table — keeps the slice tight, and a single-table view is easy to express.

## 6. API surface

All routes wrapped in `@api_route` and mounted on `agent/server.py`. Every read-route triggers `run_rollup_if_needed()` first.

| Route                         | Method | Body                                    | Returns                                                                                                    |
| ----------------------------- | ------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/api/rewards/balance`        | GET    | —                                       | `{sunlight: int, sunlight_today: int, sunlight_cap: 120, starshards: int}`                                 |
| `/api/rewards/awards`         | GET    | —                                       | `[{id, kind, detail, currency, amount, awarded_for_date, awarded_at}, …]` — descending by `awarded_at`     |
| `/api/market/catalog`         | GET    | —                                       | `[{key, name, description, currency, price, category}, …]`                                                  |
| `/api/market/inventory`       | GET    | —                                       | `[{spend_id, item_key, name, currency, price, purchased_at, refund_amount, refund_pct}, …]`                |
| `/api/market/buy`             | POST   | `{item_key: str}`                       | `{ok: true, balance: {…}}` (balance shape mirrors `/api/rewards/balance`) or 400 with `{error: "insufficient_funds" \| "unknown_item" \| "already_owned"}` |
| `/api/market/refund`          | POST   | `{spend_id: int}`                       | `{ok: true, refunded: int, currency: str, balance: {…}}` (balance shape mirrors `/api/rewards/balance`) or 400 with `{error: "unknown_spend" \| "already_refunded"}` |

Validation:
- `item_key` must exist in the catalog dict.
- "Already owned" check: if there is a `spend` row for `item_key` not yet refunded, refuse a new buy.
- `spend_id` must reference an un-refunded `spend` row.

## 7. Catalog (stub)

Hardcoded in `agent/config.py` as `MARKET_CATALOG: list[dict]`. Five items, one per category, prices straddling both currencies:

| key              | name              | description                                  | currency  | price | category  |
| ---------------- | ----------------- | -------------------------------------------- | --------- | ----- | --------- |
| `lantern_path`   | Lantern Path      | Soft amber lights along the main road.       | sunlight  | 30    | decor     |
| `mayors_hat`     | Mayor's Hat       | A modest tricorn for the resident-in-chief.  | sunlight  | 60    | outfit    |
| `sunbeam_charm`  | Sunbeam Charm     | Adds a warm bias to the weather overlay.     | sunlight  | 90    | weather   |
| `lighthouse_skin`| Lighthouse Skin   | Re-skins the harbor lighthouse.              | starshard | 2     | building  |
| `cove_expansion` | Dawn Cove Annex   | Extends the map with a small annex.          | starshard | 5     | map       |

Owned items currently have no visual effect. The frontend renders them in inventory by name only.

## 8. Frontend

### 8.1 HUD

`web/js/dashboard.js` already builds the HUD strip. Add two new HUD chips:

- `☀ {earned_today} / 120` — title attribute shows `"{lifetime_sunlight} ☀ in lifetime balance"`.
- `✦ {starshards}` — title attribute shows `"Starshards earned through streaks and milestones"`.

Both fetch from `/api/rewards/balance` on dashboard render; reuse the existing `App.api()` helper. Re-fetch on tab focus (already wired for usage HUD).

### 8.2 Market tab

`web/js/market.js` is rewritten — the placeholder block deletes. Single page, three sections:

1. **Balance banner** at the top in `pixel-panel` styling: large ☀ and ✦ readouts, with the daily cap shown as `☀ 42 / 120 today (412 lifetime)`.
2. **STALLS** (`charter-section__header` + grid of pixel-panel rows). Each row shows name, description, price, BUY button. BUY is disabled (with tooltip) if owned or insufficient funds.
3. **INVENTORY** (`charter-section__header`). Empty state copy: "No purchases yet. Spend Sunlight in the Stalls above." Each row shows name, purchased date, current refund amount, REFUND button.
4. **HALL OF HONOR** (`charter-section__header`). Empty state copy: "No milestones yet. Stay under your daily goal to begin a streak." Otherwise grouped by month: `<h3>April 2026</h3>` followed by award rows.

Refund tooltip on each inventory row reads `"Refund: 30 ☀ (within 24h)"` or `"Refund: 15 ☀ (50%)"`. Button label: `REFUND`.

Toasts on buy / refund using existing `App.toast()`. Errors surface the server's `error` string via a humanized lookup table on the client.

### 8.3 CSS

Append a Market section to `web/css/views.css`:
- `.market-balance` panel for the banner.
- `.stall-grid` / `.stall-row` for catalog items.
- `.inventory-row` for owned items.
- `.honor-month-group` / `.honor-row` for Hall of Honor.

Reuse `pixel-panel`, `pixel-button`, `pixel-button--primary`, `pixel-button--danger` (REFUND uses default styling). Reuse `.charter-section__header` from Phase 1b.

## 9. Testing & verification

There is no pytest yet (per CLAUDE.md). Verification is the existing manual smoke path plus:

1. **Earning math:** open dashboard with a `daily_total` goal of 60 min, no `app_limit` goals, and current usage of 20 min — HUD should show `☀ 40 / 120`. Bump the goal to 90 — refresh — HUD should now show `☀ 70 / 120` (retroactive within today).
2. **Cap enforcement:** with a generous goal, confirm `☀` does not exceed 120 even if the math would.
3. **Streak rollup:** with a `daily_total` goal active and at least one historic day under it, hit any API endpoint — check `sqlite3 data/screentime.db "select * from rewards_awards"` for at least one `streak_day` row. Confirm `last_rollup_date` updated.
4. **Buy / refund:** purchase `lantern_path` (30 ☀), confirm balance drops; immediately refund — full 30 ☀ returned. Buy again, manually `UPDATE rewards_ledger SET created_at = created_at - 86400*2 WHERE item_key = 'lantern_path'` to simulate >24 h, refund — 15 ☀ returned.
5. **Idempotency:** hit any read endpoint twice in a row. Award table count must not change between calls (rollup is gated).
6. **Insufficient funds:** try to buy `cove_expansion` (5 ✦) with no starshards — 400 + `insufficient_funds`.
7. **Already owned:** buy `lantern_path`, attempt to re-buy without refunding — 400 + `already_owned`.

If a `pkill`-affecting code path is touched, confirm restrictions still fire on a test app — but Phase 1d does not touch `agent/blocker.py` or `agent/monitor.py`.

## 10. Risks & follow-ups

- **Backfill cost on first request after deployment.** Bounded by `app_usage` row count per day, but a multi-year install could see one slow request. Acceptable; if it becomes a problem, gate behind a one-time chunked migration.
- **Award detail strings as data.** "Day 7 of streak" is human-readable but bakes presentation into the row. Acceptable for the slice; if the Hall of Honor needs richer rendering later, the detail can be a JSON blob and the UI joins on `kind`.
- **Visual application of owned items.** Multiple owned items currently have no on-screen effect. The inventory will show them by name, which is honest but ugly. Tracked as a follow-up — the next plan should be the art pass that wires `lighthouse_skin` and friends into the Isle render.
- **Goal-change retroactivity asymmetry.** Sunlight changes when goals change (derived). Starshards do not (persisted). This is by design — the awards table is an immutable event log — but a user changing their goal might be surprised that ☀ moved and ✦ didn't. Document in HUD tooltip.
- **`daily_total_goal` cardinality.** Spec assumes a single active `daily_total` goal at a time, and `agent/database.py:create_goal()` enforces this by deactivating the prior one. The rollup uses `goals.active = 1 AND type = 'daily_total'` on the day's date *as of rollup time* — which means a goal change re-evaluates new days against the new goal but does not rewrite old days. This matches spec.
- **Market sub-tabs.** If the catalog grows past ~10 items, the Market page becomes long. Acceptable at five; revisit when that pressure shows up.

## 11. Out-of-scope sketches

The following are mentioned for completeness but explicitly deferred:

- Building skins, weather charms, decor, outfits, and map expansions changing the Isle render — separate art pass.
- Daily / monthly catalog rotation — spec says new stock rotates monthly. Out of scope until there is enough catalog to rotate.
- Free first-of-month Starshard bonus (spec §3.3) — out of scope; can be added as a fifth milestone kind once the four named milestones land.
- A "spent / earned" Chronicle widget — useful but scope creep on this plan.
