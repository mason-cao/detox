# Detox — Redesign & Deployment Design

Date: 2026-04-17
Status: Draft — pending implementation plan
Owner: Mason Cao

## 1. Summary

Detox currently works as a local-only macOS screen-time tracker with a clean but generic Flask + vanilla-JS dashboard. This doc specifies a full UX/identity redesign and a rollout path from "local-only" to a hybrid local-agent + hosted-dashboard product.

The redesign recasts the app as **Detox Isle**: an isometric pixel-art island where every tracked app is a resident, every restriction is a law passed by the mayor (the user), and every minute of detox pays into a visible reward economy. This is a full takeover — every existing view is reskinned as an in-world location.

The deployment plan treats the macOS agent as the sensing/enforcement layer and extracts everything else (storage, auth, rules, rewards, web UI) into a hosted stack so users can view their data from any browser (including phones) and optionally pair multiple Macs.

## 2. Goals & non-goals

**Goals:**
- Distinct visual identity that is obviously not a generic dashboard template.
- First-class restriction and reward mechanics that reinforce the product's purpose (spending less time on the wrong things).
- A clear path from the current local-only app to a hosted service without breaking the privacy story.
- Keep the frontend build-step-free (vanilla HTML/CSS/JS).
- Preserve every existing feature; redesign changes presentation, not capabilities.

**Non-goals:**
- Native mobile app. Responsive web is enough; tracking on mobile isn't feasible anyway.
- Real-money microtransactions. The reward economy is closed.
- Rewriting the backend in Rust/Go. Python is fine at our traffic tier.
- Replacing vanilla JS with React/Vue. No build pipeline.

## 3. Concept — Detox Isle

A sunset-lit island viewed from an isometric camera. The user is the mayor. Every tracked application is a resident. Weather, day/night, and the state of buildings all reflect real data about the user's screen time.

### 3.1 Core game loop

- Minutes spent under daily limits generate **Sunlight** (☀) — soft currency, daily cap.
- Hitting weekly goals and streak milestones grants **Starshards** (✦) — rare currency.
- Both are spent in **The Market** on decorations, building skins, map expansions, postcard frames, and sound packs.
- **Residents** visibly change behavior based on use: productive apps become farmers/builders/scribes; over-limit apps become idle tourists; blocked apps are banished to a rowboat offshore.
- **Weather** is an honest read of today's adherence: sunny under goal, overcast when approaching, storm when past.
- **Day/night** cycles with the actual system clock; at the user's configured bedtime, a town bell rings and residents walk home.
- The frontmost application's resident glows in real time and shows a working tool overlay at their building. Background residents walk slow paths or bob in place. (Live binding lands in Phase 1f; resident-as-sprite rendering substrate lands in Phase 1e.)
- Missing a goal brings clouds but does not wipe progress. No punitive mechanics, no FOMO, no streak-loss rage bait.

### 3.2 Restrictions as law

Restrictions are first-class visible mechanics, not a separate admin tab.

- **The Gate** — hard blocks close the town gate on the offending resident; reopening plays a welcome chime.
- **Daily rations** — per-app limits show as a sand-hourglass above each resident; when empty, the **Sheriff** sprite walks over and escorts them off, force-quitting the app via the existing `pkill -x` path.
- **Curfew** — bedtime goal rings the town bell; residents return home. Opening a restricted app past curfew sends the Sheriff out with a lantern.
- **Quarantine Zones** — category blocks are a fenced area on the map where category-blocked residents live.
- **Banishment** — full blocks put the resident in a rowboat offshore.
- **Whitelist mode** — closes the gate to everyone except chosen residents; road empties visibly.
- **Rule Board** — the chalkboard at the town hall lists every active decree.

Every restriction has a visible actor and animation, so setting a limit isn't filling out a form — it's passing a law.

### 3.3 Reward economy

Two tiers, both earned, neither purchasable:

| Currency | Source | Daily cap | Spends on |
|---|---|---|---|
| Sunlight ☀ | 1 ☀ per minute spent while today's daily-total usage is under the user's `daily_total` goal; also 1 ☀ per minute an app remains under its per-app `app_limit` | 120/day | decorations, small building skins, outfits, weather charms, sound packs, postcard frames |
| Starshards ✦ | 1 ✦ per 7-day streak extension, 3 ✦ for a clean calendar week (all 7 days under goal), bonus ✦ for named milestones (first 14-day streak, first month, etc.) | — | large building skins, map expansions |

**Streak definition:** consecutive calendar days where daily-total usage stayed at or below the user's `daily_total` goal. Days without a configured goal are neutral (do not extend or break a streak). A user with no `daily_total` goal sees the streak HUD as dashed until one is set.

**"Weekly goal" is derived**, not a separate entity: 7 consecutive streak days inside a Mon–Sun calendar week = weekly goal hit.

**Anti-dark-pattern guardrails (baked in, not optional):**
- No real money. Stated on the market screen.
- No time-limited FOMO. New stock rotates monthly; old stock stays.
- No loot boxes. Every item has a visible price.
- Currency is only earned by not using tracked apps, so the incentive always points the right way.
- Refund window: 100% for 24 h, then 50% thereafter.

Beyond the market:
- Streak milestones grant named landmarks on the isle ("7-day streak, Apr 2026").
- First-of-month bonus: one free Starshard if the previous month had any detox-positive week.
- **Hall of Honor** (inside the Town Hall) lists all milestones chronologically.

## 4. Information architecture

Eight sections. The existing left sidebar is retired. Navigation happens two ways:

1. **Clickable buildings** on the isle deep-link to each section (click the Registry tower → Apps page).
2. **Compass HUD** — a small pinned card at top-right listing the 8 destinations, highlighting the current room. Collapses to a 🧭 toggle on viewports <760 px.
3. **Keyboard `1`–`8`** — power-user shortcuts.

| Today | Becomes | What lives there |
|---|---|---|
| Dashboard | **The Isle** | Live isometric view, weather, residents, KPI signboards, date nav. |
| Apps | **The Residents' Registry** | Portrait grid of tracked apps with role, today's usage, ration hourglass. Parchment detail sheet per resident. |
| Stats | **The Chronicle** | Daily/weekly breakdowns drawn as pixel bar charts on parchment. |
| Goals | **The Town Charter** | Scroll pinned to the town-hall door. Each goal is a decree with a wax seal. Streak sunbeam on the isle. |
| Blocker | **The Rule Board** | Chalkboard at the town hall. Block/whitelist toggles are gate-control levers. |
| *(new)* | **The Market** | Pixel-art bazaar. Sunlight/Starshard economy. |
| Share (cards) | **Postcards** | Mail desk. Pick a postcard template, stamp it, download. |
| Settings | **The Mayor's Study** | Wood-paneled office. Dark mode = candle. Shortcuts = framed cheat sheet. Export = filing cabinet. |

### 4.1 Persistent HUD

Every screen has a top HUD strip:

- Date + day-of-week (left)
- Weather glyph + label ("sunny", "cloudy", "stormy")
- Sunlight ☀ counter
- Starshards ✦ counter
- Streak count with sunbeam glyph
- Monitor/lighthouse status (beam = healthy; dim/red = stopped)
- **`?` help button** (see §4.2)
- Compass HUD (right side, under the `?` button)

### 4.2 Help button

A minimalist outlined `?` icon lives in the HUD, 32×32, always one click away. Opens a centered parchment overlay with four tabs:

- **Tour** — auto-advance walkthrough of the 8 sections. First-run users get it automatically; returning users can replay. Arrow keys navigate, Esc closes.
- **How the game works** — one-screen cheat sheet for Sunlight/Starshards, weather meanings, resident statuses (✓/⚠/✗/🚫), streaks, refund window.
- **Keys** — keyboard shortcuts. `1`–`8` tabs, `←`/`→` date nav, `?` toggle help, `/` search, `Esc` close, `d` dark mode.
- **What's new** — changelog since last visit, pulled from the API.

Contextual hooks (subtle):
- First visit to any section shows a one-line speech bubble from the town crier; dismissable, never re-shown.
- Hovering any glyph (☀, ✦, ⚠, 🚫) shows a definition tooltip.
- Hovering a signboard KPI shows the computation.

A11y: button is focusable, `aria-label="Help"`, overlay traps focus, Esc closes, tour respects `prefers-reduced-motion`.

## 5. Visual system

### 5.1 Palette — "Dawn Cove"

All pairs meet WCAG AA 4.5:1.

| Role | Light (day) | Dark (night) |
|---|---|---|
| Sky gradient | `#FFB9A3 → #FDE68A → #8FD3F4` | `#0F1028 → #1E1B4B → #312E81` + star-points |
| Sand / canvas bg | `#FCE7B5` | `#1A1330` |
| Card / parchment | `#FFF3D6` | `#241A3D` |
| Sea (deep) | `#2E7CA6` | `#4C8BF5` |
| Sea (shallow) | `#7FC8DF` | `#6FAFE8` |
| Foliage | `#4A8B4E` | `#2E5C3A` |
| Sunlight ☀ | `#F8B42C` | `#F8B42C` with glow |
| Starshard ✦ | `#C4B5FD` | `#E9D5FF` |
| CTA | `#FF7A45` | `#FB923C` |
| Text primary | `#3B2A1A` | `#FEF3C7` |
| Text muted | `#7A5C44` | `#C9B896` |
| Warning | `#DC2626` | `#F87171` |

### 5.2 Typography

Three-font hierarchy:

- **Press Start 2P** — display only. KPI numbers on signboards, section titles, HUD counters. Max 24 px — readable at that size, brutal above.
- **VT323** — monospace body for game-ish contexts: resident names, chalkboard, chronicle entries, tooltips. 18–20 px.
- **Inter** — retained for long-form UI: settings forms, modal labels, toasts, anything over ~2 lines. This is the deliberate concession to readability; pixel fonts fatigue the eye past a paragraph.

Rule: Inter is the default; `font-family: pixel` is a per-component opt-in.

### 5.3 Effects & motion

- `image-rendering: pixelated` on all sprites/illustrations; anti-aliasing disabled there.
- Pixel borders via double-step box-shadow: `0 0 0 2px #3B2A1A, 0 4px 0 0 #3B2A1A`.
- Hover micro-interactions: 100–150 ms, color/opacity only, **never scale** (prevents layout shift).
- Sprite animation: 4–8 frame walk cycles at ~6 fps via single background-position sprite sheet per resident.
- Day/night: 30-minute cross-fade of sky gradient based on real system time.
- Weather layer: SVG + CSS overlay above the isle; clouds drift, rain falls, sun beams rotate.
- Currency earn: `+1` tokens float up from a resident's head; HUD counter ticks.
- `prefers-reduced-motion`: isle freezes to a painted snapshot, tokens fade instead of flying, no weather motion.

### 5.4 Component primitives

Plain HTML/CSS — no framework change.

- `<Signboard>` — wooden pixel sign. KPIs on the isle.
- `<Parchment>` — cream card with curled corners. Chronicle entries, decrees, resident detail.
- `<Chalkboard>` — dark slate panel. Rule Board, Market prices.
- `<Portrait>` — framed pixel resident. Registry, Postcards.
- `<Stamp>` — wax seal for decrees, postcard stamps.
- `<HUDBar>` — top-right counter strip.
- `<Ribbon>` — bottom navigation (8 tabs).
- `<Toast>` — reskinned as a town-crier speech bubble.

## 6. Architectural truth — why hybrid, not pure SaaS

App detection and blocking are only possible from a process running on the user's Mac (`osascript` System Events, `pkill -x`). "SaaS" therefore means **hybrid**:

```
┌──────── USER'S MAC ────────┐       ┌─────── CLOUD ────────┐
│  ┌─ Detox Agent (menubar)─┐│ HTTPS │ ┌─ API (FastAPI) ──┐ │
│  │ monitor, blocker,      ││──────▶│ │ ingest, auth,     │ │
│  │ notifier               ││ JWT   │ │ rules, rewards    │ │
│  │ local SQLite buffer    ││◀──────│ └───────────────────┘ │
│  └────────────────────────┘│ rules │          │            │
└────────────────────────────┘       │ ┌─ Postgres ───────┐ │
                                     │ │ multi-tenant     │ │
                                     │ └───────────────────┘ │
          any browser  ◀─────────────│ ── Web dashboard ────│
          (desktop + phone)          │ (CDN static)         │
                                     └──────────────────────┘
```

- **Agent** does OS-level work + a local SQLite buffer for offline resilience.
- **Backend** is system-of-record + rule distribution + auth.
- **Web app** is a static SPA on a CDN, talks to the API.

## 7. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Agent runtime | Python 3.11 (retained) | Existing code, subprocess works for macOS APIs. |
| Agent packaging | `py2app` → signed `.app`, menu bar via `rumps` | Native-feeling, launches at login. Swift rewrite is a 6-month detour — rejected. |
| Agent distribution | DMG + Homebrew cask + Sparkle auto-update | DMG for normies, cask for the technical, Sparkle for security patches. |
| Backend | FastAPI (from Flask) | Async, OpenAPI, Pydantic. Route parity with current Flask API is straightforward. |
| DB | Postgres 16 (from SQLite) | Multi-tenant, RLS, concurrency. |
| Cache | Redis | Rate-limiting ingest, session cache. |
| Auth | Clerk (or Supabase Auth) | Magic link + Google + Apple. Not NIH-ing auth. |
| Hosting | Fly.io single-region | Docker, managed Postgres, cheap at our tier. |
| Static web | Cloudflare Pages | Free, DDoS absorption. |
| Frontend | Vanilla JS + HTML/CSS (retained) | No build step. Responsive breakpoints added. |
| Observability | Sentry + Plausible | Errors + privacy-respecting analytics. |

## 8. Data model deltas

All seven existing tables gain `user_id UUID` + RLS. New tables:

- `users (id, email, auth_provider, created_at)`
- `devices (id, user_id, device_name, last_sync_at, agent_version)`
- `rewards (id, user_id, sunlight_total, starshards_total, daily_earned, last_earn_at)`
- `inventory (id, user_id, item_key, acquired_at, refunded)` — owned market items
- `milestones (id, user_id, kind, detail, awarded_at)` — Hall of Honor
- `category_blocks (id, user_id, category_name, active)` — retires the current `__category__{Name}` hack in `app_blocks`

Alembic migrations mirror the SQLite schema initially; RLS policies and new tables land in a follow-up migration.

## 9. Sync protocol

- Agent batches sessions, posts `POST /v1/ingest` every 5 min (configurable).
- Payload: `[{app_name, started_at, ended_at, category, device_id}, …]`.
- **Idempotency key**: `(device_id, started_at, app_name)` — unique index.
- Offline: agent buffers in local SQLite indefinitely; `detox agent status` shows pending count.
- Rules flow: cloud → agent, poll every 30 s with ETag. Blocker rules must be authoritative client-side (latency-critical enforcement).
- Rewards ledger lives on the server — the agent does not trust itself with currency. Server pushes current balances to agent for HUD display.

## 10. Privacy

Going hosted breaks today's "all local, no network" guarantee. Mitigations, spec'd as requirements:

- Encryption at rest (Postgres-level + envelope encryption on app-name columns).
- Encryption in transit (TLS 1.3 only).
- **Ghost Mode** (opt-in): server stores only hashed app names. User sees their own data by keeping the hash salt on-device. Trade-off: cannot recover names after rotation.
- One-click export + delete. GDPR- and CCPA-clean.
- No third-party trackers on dashboard. Plausible is first-party.
- Privacy policy + TOS versioned in-repo.

## 11. Rollout phases

Each phase is a shippable milestone.

| Phase | Scope | Duration (rough) |
|---|---|---|
| **0** Reorg | Monorepo: `/agent`, `/api`, `/web`, `/infra`. Tests stay green. | 0.5 wk |
| **1** Redesign (local) | Full isle/market UI against existing Flask + SQLite. Local-only v2. | 2–3 wk |
| **2** Backend extract | Port Flask → FastAPI, SQLite → Postgres, user scaffolding (dev token). Runs via docker-compose. | 1.5 wk |
| **3** Agent packaging | `py2app` bundle, menu bar, Sparkle updater, install script. Agent targets local API. | 1 wk |
| **4** Auth + cloud | Clerk, RLS, cloud ingest, rules puller, rewards ledger. Deploy to Fly + Cloudflare. | 2 wk |
| **5** Private beta | 10–20 invite users, telemetry, iteration. | 2 wk |
| **6** Public launch | Landing, Homebrew cask, signed DMG, announcement. | 1 wk |

## 12. Commit plan

Every commit below is one atomic change. Ordering matches phase sequence. Messages are deliberately plain.

### Phase 0 — Reorg
- `chore: reorganize into monorepo (agent/, api/, web/, infra/)`
- `chore: add docker-compose.dev.yml for local stack`
- `docs: ADR-0001 — why hybrid local-agent + cloud`

### Phase 1 — Redesign
- `feat(ui): add HUD, bottom ribbon nav, retire left sidebar`
- `feat(ui): pixel design tokens — palette, Press Start 2P/VT323 typography`
- `feat(isle): isometric home view with clickable buildings`
- `feat(isle): day/night cycle + weather overlay reflecting goal adherence`
- `feat(residents): registry view with portraits, roles, ration hourglasses`
- `feat(chronicle): reskin stats as parchment ledger`
- `feat(charter): reskin goals as decrees with wax seals`
- `feat(rules): reskin blocker as rule board + sheriff/gate animations`
- `feat(postcards): reskin cards generator with island snapshot template`
- `feat(study): reskin settings as the mayor's study`
- `feat(market): add store view with sunlight/starshard economy`  _(deferred from Plan 4 — needs economy schema; scoped to its own plan)_
- `feat(rewards): local ledger for sunlight earn + daily cap`  _(bundled with Market plan)_
- `feat(rewards): hall of honor + streak milestones`
- `feat(help): minimalist ? in HUD opens tour, game-rules, keys, changelog`
- `feat(a11y): honor prefers-reduced-motion across isle, weather, and help overlay`
- `refactor(db): add category_blocks table, migrate from __category__ hack`

### Phase 2 — Backend extract
- `feat(api): scaffold FastAPI service with OpenAPI + health check`
- `feat(api): port dashboard routes from Flask, match response shapes`
- `feat(api): port apps/goals/blocks/settings routes`
- `feat(db): Postgres schema + Alembic migrations mirroring SQLite`
- `feat(db): add user_id FKs + row-level security policies`
- `feat(api): dev-token middleware for local testing`
- `test(api): contract tests ensuring agent sees identical responses`

### Phase 3 — Agent packaging
- `feat(agent): extract monitor into library, keep CLI entrypoint`
- `feat(agent): rumps menu-bar app with status + pause controls`
- `build(agent): py2app config + signing script`
- `feat(agent): Sparkle auto-update feed + DMG build`
- `feat(agent): local SQLite buffer + offline queue`

### Phase 4 — Auth + cloud
- `feat(auth): Clerk integration on web and api`
- `feat(agent): device pairing flow + JWT storage in Keychain`
- `feat(sync): POST /v1/ingest with idempotency + batching`
- `feat(sync): rules puller every 30s with ETag caching`
- `feat(rewards): move ledger authority to server, push to agent for HUD`
- `feat(infra): Fly.io deploy config + Postgres + Redis`
- `feat(infra): Cloudflare Pages web deploy + API routing`

### Phases 5–6
- `feat(privacy): ghost mode (hashed app names) opt-in`
- `feat(privacy): one-click data export + delete`
- `docs: privacy policy and terms of service`
- `feat(web): marketing landing + install instructions`
- `release: v1.0.0 — Detox Isle`

## 13. Open questions

- Agent signing certificate — Apple Developer account needed before Phase 3 packaging.
- Auth vendor choice (Clerk vs. Supabase Auth) — revisit before Phase 4 start; pricing and Apple-Sign-In compliance are the deciders.
- Pixel sprite production — commission an illustrator or build in Aseprite internally. Impacts Phase 1 timeline.
- Sound pack licensing — chiptune sources must be CC-BY or original compositions.

## 14. Appendix — wireframes

ASCII sketches of the three marquee screens. Implementation uses CSS grid + pixel sprites; these show layout intent only.

### 14.1 The Isle

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DETOX ISLE     Mon Apr 17  ☀ sunny       ☀ 142   ✦ 3   🔆 day 5    ? │
├─────────────────────────────────────────────────────────────────────────┤
│              [sky gradient: dawn-pink → pale-gold → cyan]               │
│                      ╔══════════════════════╗                           │
│                    ╔═╝   [isometric isle]   ╚═╗                         │
│                 ║    🏛 Town Hall               ║                       │
│                 ║    📚 Registry   🎪 Market    ║                       │
│                 ║    🏮 Rule Board  🗼 Lighthouse║                      │
│                    ╚═╗    beach   dock       ╔═╝                        │
│      🛶 [banished resident waves]                                       │
│   ┌─ SIGNBOARD ─┐  ┌─ SIGNBOARD ─┐  ┌─ SIGNBOARD ─┐  ┌─ SIGNBOARD ─┐   │
│   │  2h 14m     │  │  47 pickups │  │  3 residents│  │  Streak: 5  │   │
│   │  screen     │  │  today      │  │  over limit │  │  sunlit days│   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│   [ < Apr 16 ]           TODAY                            [ Apr 18 > ] │
├─────────────────────────────────────────────────────────────────────────┤
│ 🏝 Isle  👥 Residents  📜 Chronicle  ⚖ Charter  🚪 Rules  🛒 Market ...│
└─────────────────────────────────────────────────────────────────────────┘
```

### 14.2 The Residents' Registry

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📚 THE REGISTRY                       [ 🔍 call for…            ] / │
│  Filter: [All]  [Productive]  [Idle]  [Over-limit]  [Banished]         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  [👤]   │  │  [👤]   │  │  [👤⚠]  │  │  [👤🚫]  │                │
│  │  Slack   │  │  VSCode  │  │ YouTube  │  │ Twitter  │                │
│  │  scribe  │  │  builder │  │ jester   │  │ banished │                │
│  │  ⏳⏳⏳ │  │  ⏳⏳⏳ │  │  ⏳     │  │  —       │                  │
│  │  42m     │  │  1h 30m  │  │ 1h 12m   │  │ 0m       │                │
│  │  ✓ under │  │  ✓ under │  │ ✗ over   │  │ at sea   │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
│                    [ Show 12 more residents ]                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 14.3 The Market

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🛒 THE MARKET                                                          │
│  "The Mayor does not accept gold from the outside world."               │
│  Categories: [Decor] [Buildings] [Weather] [Outfits] [Maps] [Sounds]   │
│  ┌ CHALKBOARD ─────────────────────────────────────────────────────┐   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │   │
│  │  │ [🏮]  │ │ [🌳]  │ │ [🦆]  │ │ [🕯]  │ │ [🌻]  │         │   │
│  │  │ lamp   │ │ palm   │ │ duck   │ │ candle │ │ sunflr │         │   │
│  │  │ ☀ 20   │ │ ☀ 40   │ │ ☀ 60   │ │ ☀ 15   │ │ ☀ 25   │         │   │
│  │  │ [buy]  │ │ [buy]  │ │ [owned]│ │ [buy]  │ │ [buy]  │         │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘         │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐                                │   │
│  │  │ [🏰]  │ │ [⛲]  │ │ [🏯]  │                                │   │
│  │  │ windml │ │ fount  │ │ clockt │                                │   │
│  │  │ ✦ 2    │ │ ☀ 200  │ │ ✦ 5    │                                │   │
│  │  │ [buy]  │ │ [buy]  │ │ [locked]│                               │   │
│  │  └────────┘ └────────┘ └────────┘                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  Your balance:  ☀ 142   ✦ 3                                             │
│  Today's earned: ☀ 38 (capped at ☀ 120/day)                             │
└─────────────────────────────────────────────────────────────────────────┘
```
