# Phase 1f — Living World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Isle alive. Replace SVG `<text>` glyph residents with sprite-atlas residents that walk short paths between buildings. Add a single new endpoint `GET /api/dashboard/now`, polled every 3 s, so the frontmost application's resident glows in real time and shows a working tool overlay at their building. Add a day/night light pass and building lantern glow synced to the system clock. Honor `prefers-reduced-motion` for every new motion.

**Architecture:** Phase 1e's SVG iso world is the substrate. Resident `<text>` nodes inside `#worldResidents` are replaced with `<image>` nodes whose `href` points at one of eight CC0 atlas PNGs (one per archetype) and whose `background-position` advances on a 6 fps walk-cycle ticker. Path waypoints per archetype are author-defined tile coordinates. A new `residents.js` module owns archetype assignment, walk ticking, and frontmost-glow application. A new `effects.js` module owns the reusable glow-halo primitive (chalk dust, wax seal, currency float deferred to 1g). The backend gains exactly one route — `GET /api/dashboard/now` — backed by a 2 s module-memory cache that reads the most recent row of `app_usage`.

**Tech stack:** Vanilla HTML / CSS / JS. No build step. Inline SVG `<image>` for sprites. CSS `background-position-x` is unavailable in SVG; sprite frame advance is done via `<svg viewBox>` shifting on a parent `<g>` clip OR by swapping `href` between four single-frame PNGs. This plan uses the **viewBox-shift** approach: each atlas is a 128×32 PNG embedded as `<image width="128" height="32">` inside a 32×32 `<clipPath>`, and the ticker animates the image's `x` attribute (`-0`, `-32`, `-64`, `-96`). No new Python deps. One new Flask route. No schema change.

**Non-goals (explicitly deferred to Plan 1g):**
- Per-tab signature animations (chalk write, page turn, wax seal, candle, etc.).
- "Back to Isle" door icon in sub-tab headers (compass HUD already covers nav; the door is aesthetic).
- Daily NPC schedules (wake / lunch / sleep loops) — spec §2 non-goal.
- Audio / sound packs — spec §2 non-goal.

---

## Open questions resolved at plan-writing time

Per spec §12:

1. **CC0 pack:** Kenney's [1-Bit Pack](https://kenney.nl/assets/1-bit-pack) (CC0). Each archetype is a 32×32 character with a 4-frame side-walk strip extractable into a 128×32 atlas. Fallback if the licensing or source disappears: programmatic CSS rectangles in archetype colors at the same coordinates (8 archetypes × 4 colored rects each, looks worse but ships).
2. **Walk-path waypoints:** authored in Task 5 below as fixed tile coordinates per archetype. Three waypoints each, looped.
3. **Sheriff visibility:** idle-visible, walks slowly between Town Hall and Rule Board. No "enforcement" trigger in 1f — the Sheriff archetype is reserved for category=`enforcement` which no app maps to today, so in practice the Sheriff sprite never appears in 1f. Plan 1g may add a synthetic "always-on" Sheriff resident; out of scope here.
4. **Mobile compass UX:** locked in plan 1e. No new work.

---

## File structure

**Create:**
- `web/assets/sprites/residents/scribe.png` (8 KB target) — quill, glasses
- `web/assets/sprites/residents/builder.png` — hard-hat, hammer
- `web/assets/sprites/residents/jester.png` — bells, bright color
- `web/assets/sprites/residents/banished.png` — grey, in rowboat
- `web/assets/sprites/residents/farmer.png` — straw hat
- `web/assets/sprites/residents/musician.png` — lute
- `web/assets/sprites/residents/wanderer.png` — plain cloak
- `web/assets/sprites/residents/sheriff.png` — star badge, lantern
- `web/assets/sprites/CREDITS.md` — pack source, author, license
- `web/js/residents.js` — archetype assignment, walk ticker, frontmost-glow application
- `web/js/effects.js` — reusable visual primitives (glow halo for 1f; wax seal / chalk dust / currency float scaffolded for 1g)
- `web/css/residents.css` — sprite layer styles, glow halo CSS, day/night dim overlay
- `docs/adr/2026-05-XX-frontmost-poll-cadence.md` — rationale for 3 s frontend poll + 2 s server cache

**Modify:**
- `agent/server.py` — add `GET /api/dashboard/now` route + module-memory cache.
- `agent/database.py` — add `latest_usage_row()` query helper used by the new route.
- `web/js/world.js` — remove the now-deferred `placeResidents` + `glyphFor` (residents.js takes over); add `mountLanterns()` + `applyDayNightDim()` for the light pass; export a `tickResidents` registration hook.
- `web/js/isle.js` — call `Residents.mount(apps)` after `World.mountBuildings()`; start poll on tab enter, stop on tab leave.
- `web/js/app.js` — register a `detox:tab-changed` handler that starts/stops the residents poll.
- `web/index.html` — register `effects.js`, `residents.js`, and `residents.css`. Bump cache busters to `v=20260520` (or whatever today's date stamp is at execution time).

**Cache-buster bump:** `v=20260503` → `v=20260520` (or replace with execution date) on every cache-busted asset.

---

## Task 0 — Sprite pack landing

**Files:**
- Create: `web/assets/sprites/residents/*.png` (8 atlases)
- Create: `web/assets/sprites/CREDITS.md`

- [ ] **Step 1: Download Kenney's 1-Bit Pack**

```bash
curl -L -o /tmp/kenney-1bit.zip https://kenney.nl/media/pages/assets/1-bit-pack/<resolved-asset-path>
unzip /tmp/kenney-1bit.zip -d /tmp/kenney-1bit
```

If the URL drifts, pull from https://kenney.nl/assets/1-bit-pack — Kenney exposes a stable downloads page.

- [ ] **Step 2: Extract 8 archetype atlases**

Each archetype atlas is 128×32 PNG (4 frames × 32×32). Use `sips` (preinstalled on macOS) or `magick` to crop the source character + 3 walk-cycle variants from the pack into a single horizontal strip. Save to `web/assets/sprites/residents/<archetype>.png`. If a chosen pack character lacks a 4-frame strip, duplicate the idle frame and shift legs ±2 px in two of the four — good enough at 32-px resolution.

Verify each atlas is ≤ 8 KB:

```bash
ls -lh web/assets/sprites/residents/*.png
```

Total folder ≤ 64 KB confirms the spec §5.3 budget.

- [ ] **Step 3: Write `web/assets/sprites/CREDITS.md`**

```markdown
# Sprite credits

All resident sprites in `web/assets/sprites/residents/` are derived from
[Kenney's 1-Bit Pack](https://kenney.nl/assets/1-bit-pack), released under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

CC0 does not require attribution; we credit anyway.

| Archetype | Source | Modifications |
|---|---|---|
| Scribe | tile_0084 | re-strip into 4-frame walk |
| Builder | tile_0091 | re-strip + hard-hat color tweak |
| Jester | tile_0102 | re-strip + bell-bright recolor |
| Banished | tile_0118 | desaturated, placed in rowboat |
| Farmer | tile_0078 | re-strip |
| Musician | tile_0098 | re-strip + lute prop |
| Wanderer | tile_0072 | re-strip |
| Sheriff | tile_0089 | re-strip + lantern prop |
```

Edit the table to match the actual tile IDs you crop.

- [ ] **Step 4: Commit**

```bash
git add web/assets/sprites/residents/*.png web/assets/sprites/CREDITS.md
git commit -m "$(cat <<'EOF'
add cc0 sprite pack with 8 resident archetypes
EOF
)"
```

---

## Task 1 — Archetype mapping (`residents.js` foundation)

**Files:**
- Create: `web/js/residents.js`
- Modify: `web/index.html`

- [ ] **Step 1: Create `web/js/residents.js` with archetype map and per-app assignment**

Pure orchestration scaffold. No DOM yet — that lands in Task 4. Walk-tick + frontmost-glow logic land in Tasks 5 and 6.

```js
/* Residents — sprite-atlas walk + frontmost-glow binding.
   Foundation: archetype assignment from app category. */

const Residents = {
    // Eight archetypes, each backed by a 128×32 PNG atlas under
    // web/assets/sprites/residents/. Order is the enumeration order
    // used when no app maps to a given archetype.
    archetypes: ['scribe', 'builder', 'jester', 'banished', 'farmer', 'musician', 'wanderer', 'sheriff'],

    // Map an app's category (from agent/config.py) to an archetype.
    // Categories that don't appear here fall through to 'wanderer'.
    archetypeFor(category) {
        const map = {
            productivity: 'scribe',
            'dev tools': 'builder',
            development: 'builder',
            entertainment: 'jester',
            social: 'jester',
            utilities: 'farmer',
            media: 'musician',
            music: 'musician',
            enforcement: 'sheriff',
        };
        return map[(category || '').toLowerCase()] || 'wanderer';
    },

    // Hash an app name to a stable 0-359 hue rotation for per-app uniqueness.
    // Two apps in the same archetype get distinguishable shirt tints.
    tintFor(appName) {
        let h = 0;
        for (let i = 0; i < appName.length; i++) {
            h = ((h << 5) - h + appName.charCodeAt(i)) | 0;
        }
        return Math.abs(h) % 360;
    },

    // Build the resident objects from /api/dashboard's `apps` array.
    // Residents are stable per app_name across renders so frontmost-binding
    // can target a known DOM node.
    build(apps) {
        if (!apps || !apps.length) return [];
        return apps.slice(0, 8).map(app => ({
            appName: app.app_name,
            archetype: this.archetypeFor(app.category),
            tint: this.tintFor(app.app_name),
            tile: { tx: 0, ty: 0 },     // assigned by walk-path init in Task 5
            progress: 0,                 // 0-1 within the current path leg
            frame: 0,                    // 0-3 walk-cycle frame
            isFrontmost: false,
        }));
    },
};

window.Residents = Residents;
```

- [ ] **Step 2: Register in `web/index.html`**

After the `world.js` line, add `effects.js` and `residents.js`. Order matters because residents reads from buildings.js (for home-tile lookup) and from effects.js (for halo).

```html
<script src="/js/world.js?v=20260520"></script>
<script src="/js/buildings.js?v=20260520"></script>
<script src="/js/effects.js?v=20260520"></script>
<script src="/js/residents.js?v=20260520"></script>
<script src="/js/compass.js?v=20260520"></script>
<script src="/js/isle.js?v=20260520"></script>
```

(Adjust the date stamp in the `v=` query string to today's date at execution time. Bump every cache-busted asset.)

- [ ] **Step 3: Console smoke**

`./start.sh`. In DevTools console:

```js
Residents.archetypeFor('Productivity')      // → 'scribe'
Residents.archetypeFor('social')            // → 'jester'
Residents.archetypeFor(null)                // → 'wanderer'
Residents.tintFor('Visual Studio Code')     // → some 0-359 number, stable across reloads
Residents.tintFor('Visual Studio Code') === Residents.tintFor('Visual Studio Code')  // → true
Residents.build([{ app_name: 'Slack', category: 'social' }, { app_name: 'Code', category: 'dev tools' }])
// → [{ appName: 'Slack', archetype: 'jester', tint: ..., ... }, { ... }]
```

`./stop.sh`.

- [ ] **Step 4: Commit**

```bash
git add web/js/residents.js web/index.html
git commit -m "$(cat <<'EOF'
residents archetype mapping and per-app tint
EOF
)"
```

---

## Task 2 — Effects primitives (`effects.js`)

**Files:**
- Create: `web/js/effects.js`
- Modify: `web/index.html` (already done in Task 1, no further change)

- [ ] **Step 1: Create `web/js/effects.js`**

1f only needs the glow halo. Wax seal, chalk dust, currency float are scaffolded as exported stubs so plan 1g can fill them in without a module-creation diff.

```js
/* Effects — reusable SVG visual primitives.
   1f wires glowHalo. waxSeal / chalkDust / currencyFloat scaffolded for 1g. */

const Effects = {
    // Mount a glow halo into a parent SVG <g>. Returns the <circle> node.
    // The halo is a soft yellow filled circle with a blur filter; opacity
    // pulses 0.45 → 0.15 over 1.4s. Reduced motion: static at 0.30.
    glowHalo(parent, opts = {}) {
        const r = opts.r || 22;
        const cx = opts.cx || 0;
        const cy = opts.cy || 0;
        const node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        node.setAttribute('class', 'effect-halo');
        node.setAttribute('r', String(r));
        node.setAttribute('cx', String(cx));
        node.setAttribute('cy', String(cy));
        parent.appendChild(node);
        return node;
    },

    // 1g placeholders — keep the namespace stable so per-tab signatures
    // can land without re-introducing this module.
    waxSeal()       { /* 1g */ },
    chalkDust()     { /* 1g */ },
    currencyFloat() { /* 1g */ },
};

window.Effects = Effects;
```

The script tag is already registered (Task 1 step 2).

- [ ] **Step 2: Append CSS for the halo to `web/css/residents.css`** *(file created in Task 4; defer this step until Task 4 if executing strictly task-by-task)*

If you've already started Task 4 you can append this now. Otherwise note the snippet and add it during Task 4 step 1.

```css
.effect-halo {
    fill: var(--dc-coin);
    filter: blur(4px);
    opacity: 0.30;
    pointer-events: none;
}
.effect-halo.is-active { animation: halo-pulse 1.4s ease-in-out infinite; }
@keyframes halo-pulse {
    0%, 100% { opacity: 0.15; }
    50%      { opacity: 0.45; }
}
@media (prefers-reduced-motion: reduce) {
    .effect-halo.is-active { animation: none; opacity: 0.30; }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/js/effects.js
git commit -m "$(cat <<'EOF'
effects scaffold with glow halo primitive
EOF
)"
```

---

## Task 3 — Frontmost endpoint (`GET /api/dashboard/now`)

**Files:**
- Modify: `agent/server.py`
- Modify: `agent/database.py`
- Create: `docs/adr/2026-05-XX-frontmost-poll-cadence.md`

- [ ] **Step 1: Add `latest_usage_row()` to `agent/database.py`**

Append to `agent/database.py` at the end of the public-helper section. Returns the most recent `app_usage` row or `None`.

```python
def latest_usage_row():
    """Return the most recent app_usage row as {app_name, timestamp} or None."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT app_name, timestamp FROM app_usage ORDER BY timestamp DESC LIMIT 1"
        ).fetchone()
    if row is None:
        return None
    return {"app_name": row["app_name"], "timestamp": float(row["timestamp"])}
```

- [ ] **Step 2: Add the `/api/dashboard/now` route to `agent/server.py`**

Place after `/api/dashboard/weekly` (around line 226). Module-memory cache of 2 seconds avoids hammering the DB when both browser tabs and the help overlay poll concurrently.

```python
_NOW_CACHE = {"value": None, "fetched_at": 0.0}
_NOW_CACHE_TTL_SECONDS = 2.0


@app.route("/api/dashboard/now")
@api_route
def api_dashboard_now():
    now = time.time()
    if now - _NOW_CACHE["fetched_at"] > _NOW_CACHE_TTL_SECONDS:
        row = database.latest_usage_row()
        _NOW_CACHE["value"] = {
            "app_name": row["app_name"] if row else None,
            "since_unix": int(row["timestamp"]) if row else None,
        }
        _NOW_CACHE["fetched_at"] = now
    return jsonify(_NOW_CACHE["value"])
```

If `time` and `jsonify` are not yet imported at the top of `agent/server.py`, add the missing imports.

- [ ] **Step 3: Smoke**

```bash
./start.sh
sleep 5
curl -s http://localhost:5050/api/dashboard/now | python3 -m json.tool
```

Expected output:

```json
{
    "app_name": "Terminal",
    "since_unix": 1714752123
}
```

If `app_name` is `null` immediately after first start, the monitor hasn't logged a row yet — wait 4 s and retry. If it stays `null` for >10 s, the monitor is not running; check `data/monitor.pid`.

`./stop.sh` after verification.

- [ ] **Step 4: Write the ADR**

Create `docs/adr/2026-05-03-frontmost-poll-cadence.md`:

```markdown
# ADR — frontend frontmost-poll cadence

Date: 2026-05-XX
Status: Accepted

## Context

Phase 1f's marquee feature is the frontmost-app glow on the Isle.
The frontend needs to know which app is frontmost in near-real-time.

## Decision

- Frontend polls `GET /api/dashboard/now` every 3 seconds.
- Server caches the result for 2 seconds in module memory.
- Server reads from the most recent row of `app_usage`, populated by the
  monitor's existing 2-second osascript poll.

## Consequences

- Worst-case staleness: 2 s monitor cycle + 3 s frontend gap = ~5 s.
  Acceptable for a behavior-mirror feature; not a real-time game loop.
- ~1200 requests/hour to local Flask. Within budget; the route is a single
  cache hit most of the time.
- No new osascript fork per request — preserves CPU budget.

## Alternatives considered

- Per-request osascript fork: ground-truth fresh, but adds ~50ms latency
  and a process spawn. Rejected.
- WebSocket / SSE push from monitor: simplest model is HTTP polling;
  WebSockets exceed the "stay vanilla" constraint of CLAUDE.md.
```

- [ ] **Step 5: Commit**

```bash
git add agent/server.py agent/database.py docs/adr/2026-05-03-frontmost-poll-cadence.md
git commit -m "$(cat <<'EOF'
api endpoint /api/dashboard/now with 2s server cache
EOF
)"
```

---

## Task 4 — Sprite-atlas resident layer

Replace SVG `<text>` glyph residents with sprite-atlas residents. Each resident becomes a `<g class="world__resident">` containing a `<defs><clipPath>` and an `<image>` whose `x` attribute advances through the four 32-px walk frames.

**Files:**
- Modify: `web/js/world.js` — remove `placeResidents` + `glyphFor` (moved into residents.js).
- Modify: `web/js/residents.js` — add `mount(parent, apps)` and the SVG generation.
- Modify: `web/js/isle.js` — call `Residents.mount(...)` after `World.mountBuildings()`.
- Create: `web/css/residents.css` — sprite + halo styles.
- Modify: `web/index.html` — register `residents.css`.

- [ ] **Step 1: Create `web/css/residents.css`**

```css
/* Resident sprite layer — atlas-based walk + halo glow. */

.world__resident-sprite {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
}

.world__resident[data-archetype="banished"] .world__resident-sprite {
    filter: grayscale(1) brightness(0.7);
}

.world__resident-name {
    font-family: var(--font-game);
    font-size: 9px;
    fill: var(--dc-ink);
    paint-order: stroke;
    stroke: var(--dc-parchment);
    stroke-width: 2;
}

.effect-halo {
    fill: var(--dc-coin);
    filter: blur(4px);
    opacity: 0.30;
    pointer-events: none;
}
.effect-halo.is-active { animation: halo-pulse 1.4s ease-in-out infinite; }
@keyframes halo-pulse {
    0%, 100% { opacity: 0.15; }
    50%      { opacity: 0.45; }
}

@media (prefers-reduced-motion: reduce) {
    .effect-halo.is-active { animation: none; opacity: 0.30; }
}
```

- [ ] **Step 2: Register in `web/index.html`**

```html
<link rel="stylesheet" href="/css/compass.css?v=20260520">
<link rel="stylesheet" href="/css/residents.css?v=20260520">
<link rel="stylesheet" href="/css/views.css?v=20260520">
```

- [ ] **Step 3: Add `mount` and `_render` to `web/js/residents.js`**

Append to the `Residents` object (above the closing `};`):

```js
    // Internal cache of the mounted residents, keyed by app_name.
    _state: new Map(),

    // Slots reused from 1e — open ground row at ty=4 plus two corners.
    _initialSlots: [
        { tx: 0, ty: 4 }, { tx: 2, ty: 4 }, { tx: 4, ty: 4 },
        { tx: 6, ty: 4 }, { tx: 8, ty: 4 }, { tx: 10, ty: 4 },
        { tx: 1, ty: 7 }, { tx: 11, ty: 7 },
    ],

    // Mount sprite residents into the world's #worldResidents <g>.
    // Replaces any existing children. Idempotent across re-renders.
    mount(apps) {
        const layer = document.getElementById('worldResidents');
        if (!layer) return;

        const built = this.build(apps).map((r, i) => ({
            ...r,
            tile: this._initialSlots[i] || { tx: 5, ty: 4 },
        }));

        this._state.clear();
        layer.innerHTML = built.map(r => this._render(r)).join('');
        built.forEach(r => this._state.set(r.appName, r));

        layer.querySelectorAll('.world__resident').forEach(node => {
            node.addEventListener('click', () => App.showTab('apps'));
        });
    },

    // Render one resident as an SVG <g>. The <image>'s x attribute is
    // -frame*32 so the same atlas serves all four walk frames.
    _render(r) {
        const { x, y } = Iso.tileToScreen(r.tile.tx, r.tile.ty);
        const cy = y + Iso.TILE_H / 2 + 80; // sky headroom + tile-center
        const ix = -r.frame * 32;
        const clipId = `resClip-${this._slug(r.appName)}`;
        const haloId = `resHalo-${this._slug(r.appName)}`;
        return `
            <g class="world__resident" transform="translate(${x.toFixed(1)} ${cy.toFixed(1)})"
               data-app="${App.escapeAttr(r.appName)}"
               data-archetype="${r.archetype}"
               data-active="false"
               style="--tint: ${r.tint};">
                <defs>
                    <clipPath id="${clipId}"><rect x="-16" y="-32" width="32" height="32"/></clipPath>
                </defs>
                <circle id="${haloId}" class="effect-halo" cx="0" cy="-16" r="22" style="display: none;"></circle>
                <image class="world__resident-sprite"
                       href="/assets/sprites/residents/${r.archetype}.png"
                       x="${ix - 16}" y="-32" width="128" height="32"
                       clip-path="url(#${clipId})"
                       style="filter: hue-rotate(${r.tint}deg);"></image>
                <text class="world__resident-name" text-anchor="middle" y="14">${App.escapeHtml(r.appName)}</text>
            </g>
        `;
    },

    _slug(s) { return s.replace(/[^a-z0-9]/gi, '_'); },
```

- [ ] **Step 4: Remove `placeResidents` and `glyphFor` from `web/js/world.js`**

Delete the `placeResidents` and `glyphFor` methods on `World` (added in plan 1e Task 4). Their slots and rendering have moved into `residents.js`. Leave `mountBuildings` untouched.

- [ ] **Step 5: Update `web/js/isle.js` to call `Residents.mount`**

Replace the `World.placeResidents(apps)` call inside `Isle.render` with `Residents.mount(apps)`:

```js
    async render(container) {
        const data = await App.api(`/api/dashboard?date=${App.currentDate}`);
        const apps = data.apps || [];
        const weather = App.describeGoalWeather(data);

        if (window.HUD) HUD.updateWeather(weather);

        container.innerHTML = this.scaffold(data, weather);
        const stage = container.querySelector('[data-role="world-stage"]');
        if (stage) {
            World.mount(stage, weather);
            World.mountBuildings();
            Residents.mount(apps);
        }
    },
```

- [ ] **Step 6: Smoke**

```bash
./start.sh
```

Open http://localhost:5050. Cmd+Shift+R. Expected:
- Residents appear as small (32×32) sprite characters along ty=4.
- Each resident has the archetype matching its app's category.
- The same archetype across two apps shows visible color difference (hue-rotate works).
- Console: no JS errors. No 404s in Network for `/assets/sprites/residents/*.png`.

If a 404 appears for `/assets/sprites/...`, confirm `agent/server.py:178` `serve_assets` already covers `/assets/<path:filename>` (it does as of 1e). If not, add the route.

- [ ] **Step 7: Commit**

```bash
git add web/js/residents.js web/js/world.js web/js/isle.js web/css/residents.css web/index.html
git commit -m "$(cat <<'EOF'
sprite-atlas resident layer replacing svg text glyphs
EOF
)"
```

---

## Task 5 — Walk paths and walk-cycle ticker

**Files:**
- Modify: `web/js/residents.js`

- [ ] **Step 1: Add path waypoints per archetype**

Append to the `Residents` object:

```js
    // Three-waypoint loops, in tile coords. Walks are slow — 4 s per leg.
    // Tuned to keep residents on open ground (ty=3..6, tx=0..11) and away
    // from the major-building 2x2 footprints.
    paths: {
        scribe:    [{ tx: 1, ty: 4 }, { tx: 4, ty: 4 }, { tx: 4, ty: 5 }],
        builder:   [{ tx: 6, ty: 4 }, { tx: 8, ty: 4 }, { tx: 6, ty: 6 }],
        jester:    [{ tx: 0, ty: 4 }, { tx: 3, ty: 5 }, { tx: 0, ty: 6 }],
        farmer:    [{ tx: 10, ty: 4 }, { tx: 11, ty: 5 }, { tx: 10, ty: 6 }],
        musician:  [{ tx: 2, ty: 6 }, { tx: 4, ty: 6 }, { tx: 2, ty: 7 }],
        wanderer:  [{ tx: 5, ty: 4 }, { tx: 7, ty: 5 }, { tx: 5, ty: 6 }],
        sheriff:   [{ tx: 5, ty: 3 }, { tx: 7, ty: 3 }, { tx: 5, ty: 4 }],
        // Banished sits offshore; never walks.
        banished:  null,
    },

    _tickInterval: null,
    _legDurationMs: 4000,

    startTicker() {
        this.stopTicker();
        if (App.prefersReducedMotion()) return; // residents stand still
        this._tickStart = performance.now();
        this._tickInterval = setInterval(() => this._tick(), 1000 / 6); // 6 fps
    },

    stopTicker() {
        if (this._tickInterval) clearInterval(this._tickInterval);
        this._tickInterval = null;
    },

    _tick() {
        const layer = document.getElementById('worldResidents');
        if (!layer) return this.stopTicker();
        const now = performance.now();

        this._state.forEach((r, appName) => {
            // Frontmost residents stand at their home tile and don't walk.
            if (r.isFrontmost) return;

            const path = this.paths[r.archetype];
            if (!path) return; // banished — no walk

            // Use an app-name-keyed offset so the 8 residents don't march in lockstep.
            const offset = this.tintFor(appName) * 13;
            const cycleMs = path.length * this._legDurationMs;
            const t = ((now + offset) % cycleMs) / cycleMs;
            const legCount = path.length;
            const leg = Math.floor(t * legCount);
            const legProgress = (t * legCount) - leg;
            const a = path[leg];
            const b = path[(leg + 1) % legCount];
            const tx = a.tx + (b.tx - a.tx) * legProgress;
            const ty = a.ty + (b.ty - a.ty) * legProgress;

            // Walk-frame advances by one every 167ms; mod 4.
            const frame = Math.floor(now / 167) % 4;

            this._reposition(appName, tx, ty, frame);
        });
    },

    _reposition(appName, tx, ty, frame) {
        const node = document.querySelector(`.world__resident[data-app="${App.escapeAttr(appName)}"]`);
        if (!node) return;
        const { x, y } = Iso.tileToScreen(tx, ty);
        const cy = y + Iso.TILE_H / 2 + 80;
        node.setAttribute('transform', `translate(${x.toFixed(1)} ${cy.toFixed(1)})`);
        const img = node.querySelector('.world__resident-sprite');
        if (img) img.setAttribute('x', String(-frame * 32 - 16));
    },
```

- [ ] **Step 2: Start the ticker after mount**

In `Residents.mount`, after `this._state.set(...)` calls, add:

```js
        this.startTicker();
```

- [ ] **Step 3: Stop the ticker when leaving the Isle**

In `web/js/app.js` `showTab`, after the existing `detox:tab-changed` dispatch, add:

```js
        if (window.Residents) {
            if (tab === 'dashboard') Residents.startTicker();
            else Residents.stopTicker();
        }
```

- [ ] **Step 4: Smoke**

`./start.sh`. Open Isle. Expected:
- Each non-banished resident drifts slowly (3-waypoint loop, ~4 s per leg).
- Walk-cycle frame visibly changes (sprite legs alternate every ~170 ms).
- Banished resident, if present, stands still.
- Switch to another tab — residents stop animating (ticker cleared).
- Return to Isle — residents resume.
- Reduced motion: residents stand at their first waypoint, no walk.

`./stop.sh`.

- [ ] **Step 5: Commit**

```bash
git add web/js/residents.js web/js/app.js
git commit -m "$(cat <<'EOF'
walk cycles and 3-waypoint paths per archetype
EOF
)"
```

---

## Task 6 — Frontmost glow + working overlay

**Files:**
- Modify: `web/js/residents.js`
- Modify: `web/js/isle.js`

- [ ] **Step 1: Add frontmost polling and `applyFrontmost` to `residents.js`**

Append to the `Residents` object:

```js
    _pollInterval: null,
    _pollMs: 3000,
    _frontmostAppName: null,

    startPoll() {
        this.stopPoll();
        this._poll();
        this._pollInterval = setInterval(() => this._poll(), this._pollMs);
    },

    stopPoll() {
        if (this._pollInterval) clearInterval(this._pollInterval);
        this._pollInterval = null;
    },

    async _poll() {
        try {
            const res = await App.api('/api/dashboard/now');
            this.applyFrontmost(res && res.app_name ? res.app_name : null);
        } catch (e) {
            // Network blip; leave glow state untouched.
        }
    },

    applyFrontmost(appName) {
        if (this._frontmostAppName === appName) return;
        const prev = this._frontmostAppName;
        this._frontmostAppName = appName;

        if (prev) this._setGlow(prev, false);
        if (appName) this._setGlow(appName, true);
    },

    _setGlow(appName, on) {
        const r = this._state.get(appName);
        if (!r) return;
        r.isFrontmost = on;

        const node = document.querySelector(`.world__resident[data-app="${App.escapeAttr(appName)}"]`);
        if (!node) return;

        node.setAttribute('data-active', on ? 'true' : 'false');

        const halo = node.querySelector('.effect-halo');
        if (halo) {
            halo.style.display = on ? '' : 'none';
            halo.classList.toggle('is-active', on);
        }

        // When turning on, snap the resident to home tile (their archetype's
        // first waypoint) so the glow appears at a stable, readable spot.
        if (on) {
            const path = this.paths[r.archetype];
            if (path && path.length) {
                this._reposition(appName, path[0].tx, path[0].ty, 0);
            }
        }
    },
```

- [ ] **Step 2: Start the poll on Isle entry, stop on exit**

In `web/js/app.js`'s `showTab`, replace the Task-5 ticker block with:

```js
        if (window.Residents) {
            if (tab === 'dashboard') {
                Residents.startTicker();
                Residents.startPoll();
            } else {
                Residents.stopTicker();
                Residents.stopPoll();
            }
        }
```

- [ ] **Step 3: Smoke**

`./start.sh`. Open the Isle. Pick a tracked app on the Mac (e.g. Safari) and bring it to focus. Expected within ~5 s:
- Safari's resident on the Isle has a soft yellow halo, opacity pulsing.
- Switch focus to a different tracked app — the previous halo fades, the new one appears.
- Switch focus to an *untracked* app — all halos fade.
- Reduced motion: halo is static (no pulse), still visible.

`./stop.sh`.

- [ ] **Step 4: Commit**

```bash
git add web/js/residents.js web/js/app.js
git commit -m "$(cat <<'EOF'
frontmost resident glow with 3s poll and 2s server cache
EOF
)"
```

---

## Task 7 — Day/night light pass + lantern glow

**Files:**
- Modify: `web/js/world.js`
- Modify: `web/css/isle.css`

- [ ] **Step 1: Add a dim-overlay layer to the world SVG**

In `World.mount`, change the `svg.innerHTML` template to insert `<rect id="worldNightDim">` directly above the buildings layer:

```js
        svg.innerHTML = `
            <g id="worldSky"> ... </g>
            <g id="worldWeather"></g>
            <g id="worldGround">${this.groundTiles()}</g>
            <rect id="worldNightDim" x="0" y="0" width="${w}" height="${h}" pointer-events="none"></rect>
            <g id="worldBuildings"></g>
            <g id="worldResidents"></g>
            <g id="worldEffects"></g>
        `;
```

The dim overlay paints below buildings + residents so they appear *lit* through the dim. Buildings get an explicit lantern circle on top in step 3.

- [ ] **Step 2: CSS for the dim overlay**

Append to `web/css/isle.css`:

```css
#worldNightDim {
    fill: #1a1330;
    opacity: 0;
    transition: opacity 1200ms ease-out;
}
.is-night #worldNightDim { opacity: 0.35; }
.is-dusk #worldNightDim  { opacity: 0.18; }

@media (prefers-reduced-motion: reduce) {
    #worldNightDim { transition: none; }
}
```

- [ ] **Step 3: Lantern circles per building**

Add to `World` after `mountBuildings`:

```js
    mountLanterns() {
        const layer = document.getElementById('worldBuildings');
        if (!layer) return;
        Buildings.catalog.forEach(b => {
            const { x, y } = Buildings.anchor(b.tx, b.ty, b.size);
            const lanternY = y - (b.size === 'major' ? 76 : 56);
            const lantern = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            lantern.setAttribute('class', 'world__lantern');
            lantern.setAttribute('cx', x.toFixed(1));
            lantern.setAttribute('cy', String(lanternY));
            lantern.setAttribute('r', '6');
            layer.appendChild(lantern);
        });
    },
```

CSS:

```css
.world__lantern {
    fill: var(--dc-coin);
    filter: blur(4px);
    opacity: 0;
    transition: opacity 1200ms ease-out;
    pointer-events: none;
}
.is-night .world__lantern { opacity: 0.65; }
.is-dusk  .world__lantern { opacity: 0.35; }

@media (prefers-reduced-motion: reduce) {
    .world__lantern { transition: none; }
}
```

- [ ] **Step 4: Apply `is-night` / `is-dusk` to the SVG root from `updateSky`**

In `World.updateSky`, after the existing `skyGroup.classList.toggle('is-night', phase.isNight);` line, also toggle on the SVG root so the dim and lanterns react:

```js
        const svg = document.querySelector('.isle__stage svg.world');
        if (svg) {
            const isDusk = !phase.isNight && (h => h >= 17 && h < 19)(now.getHours());
            svg.classList.toggle('is-night', phase.isNight);
            svg.classList.toggle('is-dusk', isDusk);
        }
```

- [ ] **Step 5: Mount lanterns from `Isle.render`**

In `web/js/isle.js`, after `World.mountBuildings()`:

```js
            World.mount(stage, weather);
            World.mountBuildings();
            World.mountLanterns();
            Residents.mount(apps);
```

- [ ] **Step 6: Smoke**

`./start.sh`. Open Isle. Expected behavior depends on the system clock:
- Daytime: no dim, lanterns invisible.
- Dusk (17:00–19:00 local): mild dim, lanterns at 35 % glow.
- Night (≥19:00 or <05:00): stronger dim, lanterns at 65 % glow.

Use DevTools console to fast-forward by overriding `Date`:

```js
const origNow = Date.now; Date.now = () => new Date('2026-05-04T22:00:00').getTime(); World.updateSky(); Date.now = origNow;
```

(`updateSky` constructs a `new Date()` not from `Date.now`, so this trick won't actually work without monkey-patching `Date`. Easiest verification: change the system clock or wait for actual dusk.)

- [ ] **Step 7: Commit**

```bash
git add web/js/world.js web/js/isle.js web/css/isle.css
git commit -m "$(cat <<'EOF'
day/night dim and building lantern glow
EOF
)"
```

---

## Task 8 — Reduced-motion + responsive verification

No new code (mirroring 1e Task 7). Verification sweep with fix-on-find.

- [ ] **Step 1: Reduced-motion sweep**

`./start.sh`. DevTools → Rendering → "Emulate prefers-reduced-motion: reduce". Confirm:
- Residents stand at first waypoint, walk frame frozen at 0.
- Halo on the frontmost resident is static (no pulse).
- Day/night transition is instant (no 1200ms dim fade).
- Building hover lift skipped (1e gate).

Fix any animation that still runs by gating it under `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 2: Responsive sweep at 360 / 760 / 1200 px**

At each breakpoint confirm:
- Sprites render at expected size; click target still ≥ 32×32.
- Halo glow doesn't bleed off the SVG bounds.
- Residents stay inside `worldGround` tile space.

Fix-on-find: tighten paths to ty ≥ 4 and tx range adjustment in `Residents.paths` if a sprite walks off the visible world at narrow viewports.

- [ ] **Step 3: Cross-tab navigation**

Confirm starting/stopping ticker + poll on each tab change leaves no orphan intervals (DevTools Performance > Timers, or `setInterval` count via the console).

- [ ] **Step 4: Commit (only if files changed)**

```bash
git add web/js/residents.js web/css/residents.css web/css/isle.css
git commit -m "$(cat <<'EOF'
reduced-motion and responsive fixups for residents and night dim
EOF
)"
```

If no fixes needed, skip this commit.

---

## Self-review

This plan covers spec sections 4.4, 5, and 6 of `docs/specs/2026-05-02-phase-1efg-immersive-redesign-design.md` for the 1f Living-world slice:

- §4.4 (`/api/dashboard/now`): Task 3.
- §5.1 (CC0 sprite pack + 8 archetypes): Task 0.
- §5.2 (programmatic SVG buildings): already shipped in 1e; no work here.
- §5.3 (asset budget + license): Task 0 step 3.
- §6.1 (motion catalogue): Tasks 4–7 with reduced-motion gates in Task 8.
- §6.2 (frontmost glow): Task 6.
- §6.3 (walk paths): Task 5.
- §6.4 (performance): 3 s poll + 2 s cache established in Task 3 ADR; ticker is 6 fps over ≤8 sprites — well under the spec's 30-element budget.

Spec amendments: none. The 1e plan already amended §3.1 and §4 with the resident-glow bullet and Compass HUD. Section §11's third bullet (Persistent HUD) is also done.

Surface: ~8 new files (~520 LOC including ~80 KB of binary atlas), 4 modified files (~120 LOC delta), 1 new Flask route, 1 new DB helper. No schema change. No Python deps added.
