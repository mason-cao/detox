# Phase 1e — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Isle's CSS-grid plot renderer with a single SVG world that uses true isometric projection. Add a small compass HUD. Retire the bottom ribbon. The Isle still shows the same residents and weather; only the rendering substrate and navigation surface change.

**Architecture:** A single `<svg>` element in the Isle view holds five layered `<g>` groups (sky / weather / ground / buildings / residents / effects). New helper modules provide projection math (`iso.js`), the SVG scaffold and sky/celestial logic (`world.js`), programmatic SVG building generators (`buildings.js`), and the compass HUD (`compass.js`). `isle.js` shrinks to orchestration — it composes the world, mounts buildings, and places residents at iso tile coordinates. The bottom-ribbon nav (`<nav id="tab-rail">` in `index.html` plus its CSS in `hud.css`) is removed; navigation happens by clicking buildings in the SVG world plus the compass HUD plus the existing keyboard `1`–`8` shortcuts.

**Tech stack:** Vanilla HTML / CSS / JS. No build step. Inline SVG. Existing Press Start 2P / VT323 / Inter fonts. No new Python deps. No backend changes.

**Non-goals (deferred to Plan 1f / 1g):**
- Sprite-pack residents and walk cycles. Residents in 1e remain emoji rendered as SVG `<text>` so Plan 1f can swap them for `<image>` sprite atlases in place.
- Frontmost-app live binding and the new `/api/dashboard/now` endpoint.
- Day/night light pass beyond the existing sky-gradient phase logic.
- Per-tab signature animations (chalk write, page turn, etc.).

---

## File structure

**Create:**
- `web/js/iso.js` — projection helpers, tile-grid constants.
- `web/js/world.js` — SVG scaffold (layered `<g>` groups), sky / celestial / weather logic moved from `isle.js`.
- `web/js/buildings.js` — programmatic SVG generators, one per nav destination (8 functions).
- `web/js/compass.js` — compass HUD: 8 destinations, current-room highlight, click to teleport, mobile collapse.
- `web/css/compass.css` — compass HUD styles (kept separate from `hud.css` for clarity).

**Modify:**
- `web/index.html` — remove `<nav id="tab-rail">`, mount compass HUD container in HUD top bar, register new scripts/styles, bump cache busters.
- `web/css/hud.css` — delete `#tab-rail` and `.tab-rail__*` rules; adjust `#app` grid-template-rows from 3 to 2.
- `web/css/isle.css` — replace the CSS-grid `.isle__ground` rules with SVG-world container styles; remove obsolete `.plot` rules (residents move into the SVG `<g id="residents">` layer).
- `web/js/isle.js` — thin orchestration: build world via `World.mount`, mount buildings, place residents at iso tile coords, retain date bar / weather badge / signboards as HTML overlays.
- `web/js/app.js` — no functional change; verify keyboard `1`–`8` continues to work after ribbon removal.
- `docs/specs/2026-04-17-detox-redesign-design.md` — amend §3.1, §4, §4.1 per the redesign spec §11.

**Cache-buster bump:** every cache-busted asset moves to `v=20260503`.

---

## Task 1 — Iso projection helpers (`iso.js`)

**Files:**
- Create: `web/js/iso.js`

- [ ] **Step 1: Create `web/js/iso.js`**

Pure helpers, no DOM, no globals besides the `Iso` namespace. Tile size 64×32 (classic 2:1 iso). World is 12 tiles wide × 8 tall, origin centered horizontally, `y=0` at the top of the world group.

```js
/* Iso projection helpers. Pure functions. No DOM. */

const Iso = {
    TILE_W: 64,
    TILE_H: 32,
    WORLD_TX: 12,
    WORLD_TY: 8,

    // World pixel size — derived from tile counts. The SVG viewBox uses these.
    worldW() {
        return (this.WORLD_TX + this.WORLD_TY) * (this.TILE_W / 2);
    },
    worldH() {
        return (this.WORLD_TX + this.WORLD_TY) * (this.TILE_H / 2);
    },

    // Tile (tx, ty) → screen (x, y) within the SVG viewBox. Origin is at the
    // top-center of the world; (0, 0) tile sits at screen (worldW/2, 0).
    tileToScreen(tx, ty) {
        const x = (tx - ty) * (this.TILE_W / 2) + this.worldW() / 2;
        const y = (tx + ty) * (this.TILE_H / 2);
        return { x, y };
    },

    // Inverse — handy for click-to-tile, but unused in 1e (kept for 1f path math).
    screenToTile(x, y) {
        const dx = x - this.worldW() / 2;
        const tx = (dx / (this.TILE_W / 2) + y / (this.TILE_H / 2)) / 2;
        const ty = (y / (this.TILE_H / 2) - dx / (this.TILE_W / 2)) / 2;
        return { tx, ty };
    },

    // Diamond polygon points for a single iso tile centered at (cx, cy).
    // Used for ground tiles. Returns a string for SVG `points=""`.
    tileDiamond(cx, cy) {
        const hw = this.TILE_W / 2;
        const hh = this.TILE_H / 2;
        return `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
    },
};

window.Iso = Iso;
```

- [ ] **Step 2: Verify in browser console**

```bash
./start.sh
```

Open http://localhost:5050. In DevTools console:

```js
Iso.tileToScreen(0, 0)        // → { x: worldW/2, y: 0 }
Iso.tileToScreen(11, 7)       // → { x: worldW/2 + 4*32, y: 18*16 }
Iso.screenToTile(Iso.tileToScreen(5, 3).x, Iso.tileToScreen(5, 3).y)  // → { tx: 5, ty: 3 } (within float tolerance)
Iso.tileDiamond(100, 100)     // → "100,84 132,100 100,116 68,100"
```

`./stop.sh` when done.

- [ ] **Step 3: Commit**

```bash
git add web/js/iso.js web/index.html
git commit -m "$(cat <<'EOF'
add iso projection helpers and tile constants
EOF
)"
```

> Note: the index.html script-tag registration happens in Task 2 alongside `world.js` so this and the next commit are paired logical units. Skip staging `web/index.html` here if Step 2 was console-only and you didn't add the script tag yet — it lands in Task 2's commit.

---

## Task 2 — World scaffold + sky/celestial refactor (`world.js`)

Move the sky-gradient updater, celestial-arc positioning, and weather layer out of `isle.js` into a new `world.js`. The new module owns the SVG scaffold; `isle.js` keeps date-bar, weather-badge, and signboard HTML overlays.

**Files:**
- Create: `web/js/world.js`
- Modify: `web/js/isle.js`
- Modify: `web/index.html`
- Modify: `web/css/isle.css`

- [ ] **Step 1: Create `web/js/world.js`**

```js
/* SVG world scaffold. Owns sky, celestial body, weather layer, ground tiles,
   plus building and resident layer mount points. Sky/celestial logic moved
   from isle.js verbatim. */

const World = {
    _skyInterval: null,
    _motionMedia: null,
    _motionListenerBound: false,

    // Mount the SVG world into the given parent. Returns the root SVG element.
    // Caller is responsible for emptying the parent before calling mount().
    mount(parent, weather) {
        const w = Iso.worldW();
        const h = Iso.worldH() + 80; // +80px sky headroom above the ground

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'world');
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
        svg.setAttribute('aria-hidden', 'true');
        svg.innerHTML = `
            <g id="worldSky">
                <rect class="world__sky-rect" x="0" y="0" width="${w}" height="${h}"></rect>
                <g id="worldStars"></g>
                <circle id="worldCelestial" r="14"></circle>
            </g>
            <g id="worldWeather"></g>
            <g id="worldGround">${this.groundTiles()}</g>
            <g id="worldBuildings"></g>
            <g id="worldResidents"></g>
            <g id="worldEffects"></g>
        `;
        parent.appendChild(svg);

        this.bindMotionPreference();
        this.applyWeather(weather);
        this.updateSky();
        this.syncSkyTimer();
        return svg;
    },

    // Diamond polygons for the WORLD_TX × WORLD_TY ground grid.
    // Alternates two greens for a checker visible at iso angle.
    groundTiles() {
        let out = '';
        for (let ty = 0; ty < Iso.WORLD_TY; ty++) {
            for (let tx = 0; tx < Iso.WORLD_TX; tx++) {
                const { x, y } = Iso.tileToScreen(tx, ty);
                const cy = y + Iso.TILE_H + 80; // shift down by sky headroom
                const cls = (tx + ty) % 2 === 0 ? 'world__tile world__tile--a' : 'world__tile world__tile--b';
                out += `<polygon class="${cls}" points="${Iso.tileDiamond(x, cy)}"></polygon>`;
            }
        }
        return out;
    },

    applyWeather(weather) {
        const layer = document.getElementById('worldWeather');
        if (!layer) return;

        const cloud = (cx, cy, scale = 1) => `
            <g class="weather-cloud" transform="translate(${cx} ${cy}) scale(${scale})">
                <ellipse cx="0" cy="0" rx="22" ry="8"></ellipse>
                <ellipse cx="-12" cy="-4" rx="10" ry="6"></ellipse>
                <ellipse cx="14" cy="-2" rx="12" ry="6"></ellipse>
            </g>
        `;

        if (weather.key === 'storm') {
            layer.innerHTML = cloud(120, 60, 1.2) + cloud(360, 80, 1.4);
            layer.setAttribute('class', 'weather-layer--storm');
            return;
        }
        if (weather.key === 'cloudy') {
            layer.innerHTML = cloud(120, 60) + cloud(280, 90, 0.9) + cloud(440, 50, 1.1);
            layer.setAttribute('class', 'weather-layer--cloudy');
            return;
        }
        if (weather.key === 'sunny') {
            layer.innerHTML = '<circle class="weather-sunbeam" cx="280" cy="80" r="200"></circle>';
            layer.setAttribute('class', 'weather-layer--sunny');
            return;
        }
        layer.innerHTML = '';
        layer.setAttribute('class', 'weather-layer--calm');
    },

    bindMotionPreference() {
        if (!this._motionMedia) {
            this._motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
        }
        if (this._motionListenerBound) return;
        const onChange = () => {
            this.updateSky();
            this.syncSkyTimer();
        };
        if (this._motionMedia.addEventListener) this._motionMedia.addEventListener('change', onChange);
        else if (this._motionMedia.addListener) this._motionMedia.addListener(onChange);
        this._motionListenerBound = true;
    },

    syncSkyTimer() {
        if (this._skyInterval) {
            clearInterval(this._skyInterval);
            this._skyInterval = null;
        }
        if (App.prefersReducedMotion()) return;
        this._skyInterval = setInterval(() => this.updateSky(), 60000);
    },

    updateSky() {
        const now = new Date();
        const hours = now.getHours() + now.getMinutes() / 60;
        const phase = this.hourToPhase(hours);

        document.documentElement.style.setProperty('--sky-top', phase.top);
        document.documentElement.style.setProperty('--sky-bottom', phase.bottom);
        document.documentElement.style.setProperty('--ground-tint', phase.ground);

        const skyGroup = document.getElementById('worldSky');
        if (skyGroup) skyGroup.classList.toggle('is-night', phase.isNight);

        const stars = document.getElementById('worldStars');
        if (stars) stars.innerHTML = phase.isNight ? this.starField() : '';

        const celestial = document.getElementById('worldCelestial');
        if (celestial) {
            const t = App.prefersReducedMotion() ? 0.64 : ((hours - 6 + 24) % 12) / 12;
            const w = Iso.worldW();
            const x = t * w;
            const y = 80 - Math.sin(t * Math.PI) * 56;
            celestial.setAttribute('cx', String(x));
            celestial.setAttribute('cy', String(y));
            celestial.classList.toggle('world__celestial--moon', phase.isNight);
        }
    },

    starField() {
        const out = [];
        // 18 fixed-position twinkles inside the sky band (y < 80).
        const seeds = [[0.08,12],[0.16,38],[0.24,18],[0.31,46],[0.39,8],[0.46,32],[0.54,14],[0.62,40],[0.70,22],
                       [0.78,48],[0.86,16],[0.94,36],[0.12,62],[0.28,68],[0.44,54],[0.60,72],[0.76,58],[0.92,66]];
        const w = Iso.worldW();
        for (const [px, y] of seeds) {
            out.push(`<circle class="world__star" cx="${(px * w).toFixed(1)}" cy="${y}" r="1"></circle>`);
        }
        return out.join('');
    },

    hourToPhase(h) {
        if (h >= 5 && h < 7) return { top: '#ffb27a', bottom: '#ffd98a', ground: '#e8c896', isNight: false };
        if (h >= 7 && h < 17) return { top: '#7bb8e8', bottom: '#ffd98a', ground: '#e8c896', isNight: false };
        if (h >= 17 && h < 19) return { top: '#d16a8f', bottom: '#ffb27a', ground: '#c89677', isNight: false };
        return { top: '#1a1f3a', bottom: '#2a3050', ground: '#4a4060', isNight: true };
    },
};

window.World = World;
```

- [ ] **Step 2: Replace `web/js/isle.js` with thin orchestration**

Delete the old `renderWeatherLayer`, `bindMotionPreference`, `syncSkyTimer`, `updateSky`, `hourToPhase`, `renderPlots`, `glyphFor` methods (the first four moved to `world.js`; residents will be re-added in Task 4). Keep `render`, `scaffold`, `renderSignboard`, `remainingLabel`. Replace the body with:

```js
/* Isle — orchestrates the SVG world. Date bar, weather badge, and
   signboards stay as HTML overlays positioned above the SVG. */

const Isle = {
    async render(container) {
        const data = await App.api(`/api/dashboard?date=${App.currentDate}`);
        const weather = App.describeGoalWeather(data);

        if (window.HUD) HUD.updateWeather(weather);

        container.innerHTML = this.scaffold(data, weather);
        const stage = container.querySelector('[data-role="world-stage"]');
        if (stage) World.mount(stage, weather);
    },

    scaffold(data, weather) {
        const date = data.date || App.currentDate;
        const total = Number(data.total_minutes || 0);
        const goal = Number(data.goal_target || 0);
        const remaining = goal ? goal - total : null;
        const nextDisabled = date >= toLocalDateString() ? 'disabled' : '';

        return `
            <section class="isle" data-weather="${App.escapeAttr(weather.key)}">
                <div class="isle__stage" data-role="world-stage"></div>
                <div class="isle__datebar" aria-label="Date navigation">
                    <button class="isle__date-button" type="button" onclick="App.prevDate()" aria-label="Previous day">←</button>
                    <div class="isle__date-label">
                        <span>The Isle</span>
                        <strong>${App.escapeHtml(App.formatDate(date))}</strong>
                    </div>
                    <button class="isle__date-button" type="button" onclick="App.nextDate()" aria-label="Next day" ${nextDisabled}>→</button>
                </div>
                <div class="isle__weather-badge" title="${App.escapeAttr(weather.detail)}">
                    <span aria-hidden="true">${weather.glyph}</span>
                    <strong>${App.escapeHtml(weather.label)}</strong>
                    <em>${App.escapeHtml(weather.tone)}</em>
                </div>
                <div class="isle__signboards">
                    ${this.renderSignboard('Tracked', App.formatTime(total), 'Total tracked screen time on the selected day.')}
                    ${this.renderSignboard('Goal', goal ? App.formatTime(goal) : 'Set one', 'Active daily-total goal.')}
                    ${this.renderSignboard('Left', this.remainingLabel(remaining), weather.detail)}
                </div>
            </section>
        `;
    },

    renderSignboard(label, value, title) {
        return `
            <div class="isle-signboard" title="${App.escapeAttr(title)}">
                <span>${App.escapeHtml(label)}</span>
                <strong>${App.escapeHtml(value)}</strong>
            </div>
        `;
    },

    remainingLabel(remaining) {
        if (remaining === null) return 'No goal';
        if (remaining < 0) return `${App.formatTime(Math.abs(remaining))} over`;
        return App.formatTime(remaining);
    },
};

window.Isle = Isle;
```

- [ ] **Step 3: Replace ground/sky CSS in `web/css/isle.css`**

Delete the entire current contents of `web/css/isle.css` and replace with the SVG-friendly version below. (Date-bar, weather-badge, and signboard rules are kept; sky/ground/plot rules are replaced with their SVG equivalents.)

```css
/* Isle dashboard — SVG world stage with HTML HUD overlays. */

.isle {
    position: relative;
    display: grid;
    grid-template-rows: 1fr auto;
    gap: var(--sp-4);
    min-height: calc(100vh - var(--hud-top-h) - var(--sp-6));
    padding: 0;
}

/* ── World stage — holds the SVG element ─────────────────────────────── */
.isle__stage {
    position: relative;
    border: 0;
    box-shadow: 0 0 0 2px var(--dc-ink);
    background: linear-gradient(to bottom, var(--sky-top), var(--sky-bottom));
    overflow: hidden;
    min-height: 460px;
}

.isle__stage svg.world {
    display: block;
    width: 100%;
    height: 100%;
}

.world__sky-rect {
    fill: url(#sky-grad-fallback);
    fill: transparent; /* The .isle__stage gradient shows through */
}

.world__star { fill: #fff4d6; opacity: 0.9; }

#worldCelestial { fill: var(--dc-coin); filter: drop-shadow(0 0 6px rgba(255, 208, 74, 0.7)); }
#worldCelestial.world__celestial--moon {
    fill: #e8ddf0;
    filter: drop-shadow(0 0 4px rgba(232, 221, 240, 0.6));
}

/* ── Ground tiles ────────────────────────────────────────────────────── */
.world__tile {
    stroke: rgba(42, 30, 42, 0.18);
    stroke-width: 1;
}
.world__tile--a { fill: var(--dc-moss); }
.world__tile--b { fill: #7aa84e; }

/* ── Weather ─────────────────────────────────────────────────────────── */
.weather-cloud ellipse { fill: #fff4d6; stroke: var(--dc-ink); stroke-width: 1.5; }
.weather-layer--storm .weather-cloud ellipse { fill: #4b5878; }
.weather-sunbeam {
    fill: rgba(255, 244, 214, 0.18);
    transform-origin: 280px 80px;
    animation: sunbeam-spin 26s linear infinite;
}

@keyframes sunbeam-spin { to { transform: rotate(1turn); } }

/* ── HUD overlays (HTML on top of SVG) ───────────────────────────────── */
.isle__datebar,
.isle__weather-badge,
.isle__signboards {
    position: absolute;
    z-index: 4;
}
.isle__datebar {
    top: var(--sp-4);
    left: var(--sp-4);
    display: flex;
    align-items: center;
    gap: var(--sp-2);
}
.isle__date-button {
    width: 36px;
    height: 36px;
    border: 0;
    background: var(--dc-parchment);
    color: var(--dc-ink);
    box-shadow: 0 0 0 2px var(--dc-ink);
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 12px;
}
.isle__date-button:disabled { cursor: default; opacity: 0.45; }
.isle__date-button:not(:disabled):hover { background: var(--dc-noon); }
.isle__date-label {
    min-width: 148px;
    padding: var(--sp-2) var(--sp-3);
    background: var(--dc-parchment);
    color: var(--dc-ink);
    box-shadow: 0 0 0 2px var(--dc-ink);
}
.isle__date-label span,
.isle-signboard span {
    display: block;
    font-family: var(--font-game);
    font-size: var(--fs-md);
    color: var(--dc-ink-soft);
}
.isle__date-label strong {
    display: block;
    margin-top: 2px;
    font-family: var(--font-display);
    font-size: 10px;
    line-height: 1.4;
    color: var(--dc-ink);
}

.isle__weather-badge {
    top: var(--sp-4);
    right: var(--sp-4);
    min-width: 156px;
    padding: var(--sp-2) var(--sp-3);
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px var(--sp-2);
    align-items: center;
    background: var(--dc-parchment);
    color: var(--dc-ink);
    box-shadow: 0 0 0 2px var(--dc-ink);
}
.isle__weather-badge span {
    grid-row: span 2;
    font-size: 24px;
    line-height: 1;
}
.isle__weather-badge strong {
    font-family: var(--font-display);
    font-size: 10px;
    line-height: 1.35;
}
.isle__weather-badge em {
    font-family: var(--font-game);
    font-size: var(--fs-md);
    color: var(--dc-ink-soft);
    font-style: normal;
}

.isle__signboards {
    left: var(--sp-4);
    right: var(--sp-4);
    bottom: var(--sp-4);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--sp-3);
}
.isle-signboard {
    min-height: 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: var(--sp-3);
    background: #6d4a2d;
    color: #fff4d6;
    box-shadow: 0 0 0 2px var(--dc-ink), inset 0 -8px 0 rgba(42, 30, 42, 0.16);
    text-align: center;
}
.isle-signboard span { color: #ffe38f; }
.isle-signboard strong {
    margin-top: var(--sp-1);
    font-family: var(--font-display);
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
}

@media (prefers-reduced-motion: reduce) {
    .weather-sunbeam { animation: none; opacity: 0.12; }
}

@media (max-width: 760px) {
    .isle__stage { min-height: 540px; }
    .isle__datebar { right: var(--sp-4); }
    .isle__date-label { flex: 1; min-width: 0; }
    .isle__weather-badge {
        top: 76px;
        left: var(--sp-4);
        right: var(--sp-4);
        min-width: 0;
    }
    .isle__signboards { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Wire scripts in `web/index.html`**

Add `iso.js` and `world.js` script tags before `isle.js`. Bump cache busters on every edited asset to `v=20260503`. Replace the current six cache-busted lines and the per-script tags accordingly:

```html
<link rel="stylesheet" href="/css/style.css?v=20260503">
<link rel="stylesheet" href="/css/tokens.css?v=20260503">
<link rel="stylesheet" href="/css/pixel-ui.css?v=20260503">
<link rel="stylesheet" href="/css/hud.css?v=20260503">
<link rel="stylesheet" href="/css/isle.css?v=20260503">
<link rel="stylesheet" href="/css/views.css?v=20260503">
```

```html
<script src="/js/app.js?v=20260503"></script>
<script src="/js/hud.js?v=20260503"></script>
<script src="/js/iso.js?v=20260503"></script>
<script src="/js/world.js?v=20260503"></script>
<script src="/js/isle.js?v=20260503"></script>
<script src="/js/dashboard.js?v=20260503"></script>
<script src="/js/apps.js?v=20260503"></script>
<script src="/js/stats.js?v=20260503"></script>
<script src="/js/goals.js?v=20260503"></script>
<script src="/js/blocker.js?v=20260503"></script>
<script src="/js/market.js?v=20260503"></script>
<script src="/js/cards.js?v=20260503"></script>
<script src="/js/settings.js?v=20260503"></script>
```

- [ ] **Step 5: Smoke**

```bash
./start.sh
```

Open http://localhost:5050. Cmd+Shift+R. Expected:
- Isle tab renders with a sky gradient.
- A grid of green diamond ground tiles appears in the lower portion.
- The sun/moon circle sits in the sky based on the current hour.
- The date bar (top-left), weather badge (top-right), and three signboards (bottom) still render and contain the same data as before.
- Console: no JS errors.

Verify with reduced motion via DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce". The sunbeam (sunny weather) freezes; sky updates still happen on next render but without timer.

`./stop.sh`.

- [ ] **Step 6: Commit**

```bash
git add web/index.html web/js/iso.js web/js/world.js web/js/isle.js web/css/isle.css
git commit -m "$(cat <<'EOF'
extract iso projection and world renderer into svg modules
EOF
)"
```

---

## Task 3 — Programmatic SVG buildings (`buildings.js`)

Eight buildings, each a function that returns a transform-positioned SVG `<g>` string. Major buildings (Hall, Registry, Market, Chronicle) get 2×2 footprints and ~64×80 sprite size; minor (Charter, Rule Board, Postcards, Study) get 1×1 footprints and ~48×60 sprite size.

**Files:**
- Create: `web/js/buildings.js`

- [ ] **Step 1: Create `web/js/buildings.js`**

```js
/* Programmatic SVG buildings. Each generator returns an SVG <g> string
   anchored at (0, 0) with the building's base on the x-axis. World
   placement applies a translate() at mount time. */

const Buildings = {
    /* ── Configuration ─────────────────────────────────────────────────
       Each building has: tab id, label, tile coords (top-left of footprint),
       size class ('major' | 'minor'), and a generator function. */
    catalog: [
        { id: 'townHall',  tab: 'dashboard', label: 'Town Hall',   tx: 5, ty: 1, size: 'major' },
        { id: 'registry',  tab: 'apps',      label: 'Registry',    tx: 1, ty: 2, size: 'major' },
        { id: 'market',    tab: 'market',    label: 'Market',      tx: 9, ty: 2, size: 'major' },
        { id: 'chronicle', tab: 'stats',     label: 'Chronicle',   tx: 5, ty: 5, size: 'major' },
        { id: 'charter',   tab: 'goals',     label: 'Charter',     tx: 3, ty: 0, size: 'minor' },
        { id: 'ruleBoard', tab: 'blocker',   label: 'Rule Board',  tx: 8, ty: 5, size: 'minor' },
        { id: 'postcards', tab: 'cards',     label: 'Postcards',   tx: 2, ty: 6, size: 'minor' },
        { id: 'study',     tab: 'settings',  label: 'Mayor Study', tx: 10, ty: 0, size: 'minor' },
    ],

    /* ── Generators — return inner markup of a <g> ─────────────────── */

    townHall() {
        return `
            <rect x="-30" y="-44" width="60" height="44" fill="#c4a47a" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-34,-44 34,-44 0,-72" fill="#8b3a2a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-8" y="-28" width="16" height="28" fill="#2a1e2a"/>
            <circle cx="0" cy="-58" r="3" fill="#ffd04a"/>
            <rect x="-22" y="-32" width="10" height="10" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="12" y="-32" width="10" height="10" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
        `;
    },

    registry() {
        return `
            <rect x="-26" y="-44" width="52" height="44" fill="#a87a4a" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-30,-44 30,-44 0,-66" fill="#5a3a2a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-6" y="-26" width="12" height="26" fill="#2a1e2a"/>
            <rect x="-20" y="-36" width="8" height="14" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="12" y="-36" width="8" height="14" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
        `;
    },

    market() {
        return `
            <rect x="-28" y="-40" width="56" height="40" fill="#8b5e3c" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-32,-40 32,-40 0,-58" fill="#c4453a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-32" y="-58" width="64" height="6" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="-28" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="-20" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="-12" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="-4" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="4" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="12" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="20" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="-6" y="-22" width="12" height="22" fill="#2a1e2a"/>
        `;
    },

    chronicle() {
        return `
            <rect x="-28" y="-44" width="56" height="44" fill="#9b7a4a" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-32,-44 32,-44 0,-68" fill="#5a3a2a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-6" y="-26" width="12" height="26" fill="#2a1e2a"/>
            <rect x="-22" y="-38" width="14" height="12" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="8" y="-38" width="14" height="12" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="-22" y1="-32" x2="-8" y2="-32" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="-15" y1="-38" x2="-15" y2="-26" stroke="#2a1e2a" stroke-width="1"/>
        `;
    },

    charter() {
        return `
            <rect x="-20" y="-32" width="40" height="32" fill="#6b8e4e" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-22,-32 22,-32 0,-50" fill="#4a6b3a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-5" y="-20" width="10" height="20" fill="#2a1e2a"/>
        `;
    },

    ruleBoard() {
        return `
            <rect x="-22" y="-30" width="44" height="30" fill="#3a3a3a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-18" y="-26" width="36" height="22" fill="#1a1a1a" stroke="#5a4a3a" stroke-width="1"/>
            <line x1="-12" y1="-20" x2="12" y2="-20" stroke="#fff4d6" stroke-width="0.6" opacity="0.8"/>
            <line x1="-12" y1="-14" x2="6" y2="-14" stroke="#fff4d6" stroke-width="0.6" opacity="0.8"/>
            <line x1="-12" y1="-8" x2="10" y2="-8" stroke="#fff4d6" stroke-width="0.6" opacity="0.8"/>
        `;
    },

    postcards() {
        return `
            <rect x="-20" y="-26" width="40" height="26" fill="#7a5c3a" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-22,-26 22,-26 0,-44" fill="#5a3a2a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-12" y="-20" width="24" height="14" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="-12" y1="-13" x2="12" y2="-13" stroke="#2a1e2a" stroke-width="0.6"/>
        `;
    },

    study() {
        return `
            <rect x="-20" y="-32" width="40" height="32" fill="#3a2a4a" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-22,-32 22,-32 0,-50" fill="#241a3d" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-5" y="-20" width="10" height="20" fill="#1a1330"/>
            <circle cx="0" cy="-38" r="2" fill="#ffd04a"/>
            <rect x="10" y="-26" width="6" height="10" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
        `;
    },

    /* ── Helpers ─────────────────────────────────────────────────────── */

    // Get the inner SVG markup for a building by id.
    markup(id) {
        const fn = this[id];
        if (typeof fn !== 'function') return '';
        return fn.call(this);
    },

    // Anchor offset (in pixels) for a footprint at tile (tx, ty).
    // Building base sits at the south corner of the southernmost tile —
    // i.e. at the bottom of the footprint diamond.
    anchor(tx, ty, size) {
        const span = size === 'major' ? 1 : 0; // major occupies tx..tx+1
        const { x, y } = Iso.tileToScreen(tx + span, ty + span);
        return { x, y: y + Iso.TILE_H / 2 + 80 }; // +80 for sky headroom
    },
};

window.Buildings = Buildings;
```

- [ ] **Step 2: Register script in `web/index.html`**

After the `world.js` line, add:

```html
<script src="/js/buildings.js?v=20260503"></script>
```

(Place it after `world.js` and before `isle.js`.)

- [ ] **Step 3: Console smoke**

`./start.sh`. In DevTools console:

```js
Buildings.catalog.length            // → 8
Buildings.catalog[0]                // → { id: 'townHall', tab: 'dashboard', ... }
Buildings.markup('townHall').length // → > 0
Buildings.markup('does-not-exist')  // → ''
Buildings.anchor(5, 1, 'major')     // → { x: ..., y: ... } numbers
```

`./stop.sh`.

- [ ] **Step 4: Commit**

```bash
git add web/js/buildings.js web/index.html
git commit -m "$(cat <<'EOF'
programmatic svg generators for the 8 nav buildings
EOF
)"
```

---

## Task 4 — Mount buildings on the world + click-to-nav

**Files:**
- Modify: `web/js/world.js`
- Modify: `web/js/isle.js`
- Modify: `web/css/isle.css`

- [ ] **Step 1: Add building mount + resident placement to `world.js`**

Append to `World` (above the closing `};`):

```js
    // Mount all buildings from Buildings.catalog into the buildings layer.
    // Each becomes a clickable <g class="world__building" data-tab=...>.
    mountBuildings() {
        const layer = document.getElementById('worldBuildings');
        if (!layer) return;
        layer.innerHTML = Buildings.catalog.map(b => {
            const { x, y } = Buildings.anchor(b.tx, b.ty, b.size);
            return `
                <g class="world__building world__building--${b.size}" data-tab="${b.tab}"
                   transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"
                   role="button" tabindex="0" aria-label="${b.label}">
                    ${Buildings.markup(b.id)}
                    <text class="world__building-label" x="0" y="14" text-anchor="middle">${b.label}</text>
                </g>
            `;
        }).join('');

        // Click + keyboard activation routes to App.showTab.
        layer.querySelectorAll('.world__building').forEach(node => {
            const tab = node.dataset.tab;
            const go = () => App.showTab(tab);
            node.addEventListener('click', go);
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    go();
                }
            });
        });
    },

    // Place residents (1e: SVG <text> emoji) at iso tile coords.
    // Plan 1f swaps these for <image> sprite atlases inside the same layer.
    placeResidents(apps) {
        const layer = document.getElementById('worldResidents');
        if (!layer) return;

        if (!apps || !apps.length) {
            layer.innerHTML = '';
            return;
        }

        // Tiles 0..11, 0..7 — pick a subset away from buildings.
        // Layout: residents wander the open ground row at ty=4.
        const slots = [
            { tx: 0, ty: 4 }, { tx: 2, ty: 4 }, { tx: 4, ty: 4 },
            { tx: 6, ty: 4 }, { tx: 8, ty: 4 }, { tx: 10, ty: 4 },
            { tx: 1, ty: 7 }, { tx: 11, ty: 7 },
        ];

        const top = apps.slice(0, slots.length);
        layer.innerHTML = top.map((app, i) => {
            const slot = slots[i];
            const { x, y } = Iso.tileToScreen(slot.tx, slot.ty);
            const cy = y + Iso.TILE_H / 2 + 80; // shift for sky headroom + center on tile
            return `
                <g class="world__resident" transform="translate(${x.toFixed(1)} ${cy.toFixed(1)})"
                   data-app="${App.escapeAttr(app.app_name)}">
                    <text class="world__resident-glyph" text-anchor="middle" y="-2">${this.glyphFor(app.app_name)}</text>
                    <text class="world__resident-name" text-anchor="middle" y="14">${App.escapeHtml(app.app_name)}</text>
                </g>
            `;
        }).join('');

        layer.querySelectorAll('.world__resident').forEach(node => {
            node.addEventListener('click', () => App.showTab('apps'));
        });
    },

    glyphFor(name) {
        const map = {
            'Safari': '🌐', 'Google Chrome': '🌐', 'Firefox': '🦊',
            'Mail': '✉', 'Messages': '💬', 'Slack': '💬', 'Discord': '💬',
            'Instagram': '📷', 'Twitter': '🐦', 'TikTok': '🎵', 'Reddit': '💭',
            'YouTube': '▶', 'Netflix': '🎬', 'Spotify': '♪', 'Music': '♪',
            'Terminal': '⌨', 'iTerm2': '⌨', 'Visual Studio Code': '⌨', 'Code': '⌨',
            'Xcode': '🔨', 'Finder': '📁', 'Calendar': '📅', 'Notes': '📝',
        };
        return map[name] || '🏠';
    },
```

- [ ] **Step 2: Call them from `Isle.render`**

Update `Isle.render` to mount buildings and residents after `World.mount`:

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
            World.placeResidents(apps);
        }
    },
```

- [ ] **Step 3: Wrap building markup in an inner `<g>` so hover lift animates cleanly**

The outer `<g>` carries the iso `translate()` placement. A nested inner `<g>` is the element CSS will lift on hover (CSS `transform` on the same node that has an SVG `transform` attribute fights itself; nesting avoids that).

In `World.mountBuildings`, change the template literal so the buildings markup is wrapped in `<g class="world__building-shape">`:

```js
                <g class="world__building world__building--${b.size}" data-tab="${b.tab}"
                   transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"
                   role="button" tabindex="0" aria-label="${b.label}">
                    <g class="world__building-shape">${Buildings.markup(b.id)}</g>
                    <text class="world__building-label" x="0" y="14" text-anchor="middle">${b.label}</text>
                </g>
```

- [ ] **Step 4: Add building / resident styles to `web/css/isle.css`**

Append at the bottom of `web/css/isle.css`:

```css
/* ── Buildings ───────────────────────────────────────────────────────── */
.world__building { cursor: pointer; outline: none; }
.world__building-shape { transition: transform 120ms ease-out; }
.world__building:hover .world__building-shape,
.world__building:focus .world__building-shape { transform: translateY(-2px); }

.world__building-label {
    font-family: var(--font-display);
    font-size: 7px;
    fill: var(--dc-ink);
    paint-order: stroke;
    stroke: var(--dc-parchment);
    stroke-width: 2;
    pointer-events: none;
    opacity: 0;
    transition: opacity 120ms ease-out;
}
.world__building:hover .world__building-label,
.world__building:focus .world__building-label { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
    .world__building-shape,
    .world__building-label { transition: none; }
    .world__building:hover .world__building-shape,
    .world__building:focus .world__building-shape { transform: none; }
}

/* ── Residents (1e: SVG text glyphs; 1f swaps to <image> sprites) ────── */
.world__resident { cursor: pointer; }
.world__resident-glyph { font-size: 22px; }
.world__resident-name {
    font-family: var(--font-game);
    font-size: 9px;
    fill: var(--dc-ink);
    paint-order: stroke;
    stroke: var(--dc-parchment);
    stroke-width: 2;
}
```

- [ ] **Step 5: Smoke**

```bash
./start.sh
```

http://localhost:5050. Cmd+Shift+R. Expected:
- 8 buildings appear on the iso tile grid in their assigned positions.
- Hovering a building lifts it ~2 px and shows its name label.
- Clicking a building navigates to its tab (e.g. clicking the Registry building opens the Apps view).
- Residents (top 8 tracked apps) appear as emoji glyphs along ty=4 and a couple of ty=7 slots.
- Console: no JS errors.
- Reduced motion (DevTools emulation): hover lift skipped; everything still clickable.

`./stop.sh`.

- [ ] **Step 6: Commit**

```bash
git add web/js/world.js web/js/isle.js web/css/isle.css
git commit -m "$(cat <<'EOF'
mount buildings and residents on iso world; click navigates
EOF
)"
```

---

## Task 5 — Compass HUD (`compass.js`)

A small parchment card pinned top-right under the existing `?` button. Lists the 8 destinations from `Buildings.catalog`. Highlights current room. Click to teleport. On viewports <760 px collapses to a single `🧭` icon button that toggles a popover.

**Files:**
- Create: `web/js/compass.js`
- Create: `web/css/compass.css`
- Modify: `web/index.html`
- Modify: `web/js/app.js`

- [ ] **Step 1: Create `web/css/compass.css`**

```css
/* Compass HUD — pinned top-right, mirrors the building catalog. */

.compass {
    position: fixed;
    top: calc(var(--hud-top-h) + var(--sp-2));
    right: var(--sp-3);
    z-index: 60;
    width: 92px;
    background: var(--dc-parchment);
    color: var(--dc-ink);
    box-shadow: 0 0 0 2px var(--dc-ink), 0 4px 0 0 rgba(42, 30, 42, 0.18);
    font-family: var(--font-game);
    font-size: 13px;
}

.compass__title {
    display: block;
    font-family: var(--font-display);
    font-size: 8px;
    color: var(--dc-ink-soft);
    letter-spacing: 0.5px;
    padding: var(--sp-2) var(--sp-2) var(--sp-1);
    border-bottom: 1px solid rgba(42, 30, 42, 0.2);
}

.compass__list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.compass__item {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    color: var(--dc-ink-soft);
    border: 0;
    padding: 4px var(--sp-2);
    font-family: var(--font-game);
    font-size: 13px;
    cursor: pointer;
    line-height: 1.2;
}
.compass__item:hover { color: var(--dc-ink); background: rgba(42, 30, 42, 0.06); }
.compass__item.is-current {
    color: var(--dc-ink);
    background: var(--dc-noon);
    box-shadow: inset 2px 0 0 var(--dc-coin);
}

/* ── Mobile: collapse to icon ─────────────────────────────────────── */
.compass-toggle {
    display: none;
    position: fixed;
    top: calc(var(--hud-top-h) + var(--sp-2));
    right: var(--sp-3);
    z-index: 60;
    width: 36px;
    height: 36px;
    background: var(--dc-parchment);
    color: var(--dc-ink);
    border: 0;
    box-shadow: 0 0 0 2px var(--dc-ink);
    cursor: pointer;
    font-size: 18px;
}

@media (max-width: 760px) {
    .compass {
        display: none;
        top: calc(var(--hud-top-h) + var(--sp-2) + 40px);
    }
    .compass.is-open { display: block; }
    .compass-toggle { display: inline-block; }
}
```

- [ ] **Step 2: Create `web/js/compass.js`**

```js
/* Compass HUD — diegetic nav alongside clickable buildings on the Isle.
   Lists Buildings.catalog entries. Highlights current tab. Click teleports.
   On <760px, collapses to a 🧭 toggle button. */

const Compass = {
    init() {
        this.mount();
        document.addEventListener('detox:tab-changed', () => this.refresh());
    },

    mount() {
        if (document.getElementById('compass')) return;

        const toggle = document.createElement('button');
        toggle.id = 'compassToggle';
        toggle.className = 'compass-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-label', 'Open compass');
        toggle.textContent = '🧭';
        toggle.addEventListener('click', () => this.toggleOpen());

        const card = document.createElement('aside');
        card.id = 'compass';
        card.className = 'compass';
        card.setAttribute('aria-label', 'Isle compass');
        card.innerHTML = `
            <span class="compass__title">🧭 Isle</span>
            <ul class="compass__list" id="compassList"></ul>
        `;

        document.body.appendChild(toggle);
        document.body.appendChild(card);
        this.refresh();
    },

    refresh() {
        const list = document.getElementById('compassList');
        if (!list || !window.Buildings) return;

        list.innerHTML = Buildings.catalog.map(b => {
            const cur = App.currentTab === b.tab ? 'is-current' : '';
            return `<li><button class="compass__item ${cur}" type="button" data-tab="${b.tab}">${App.escapeHtml(b.label)}</button></li>`;
        }).join('');

        list.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                App.showTab(btn.dataset.tab);
                if (window.matchMedia('(max-width: 760px)').matches) {
                    this.toggleOpen(false);
                }
            });
        });
    },

    toggleOpen(force) {
        const card = document.getElementById('compass');
        if (!card) return;
        const next = typeof force === 'boolean' ? force : !card.classList.contains('is-open');
        card.classList.toggle('is-open', next);
    },
};

window.Compass = Compass;
```

- [ ] **Step 3: Fire `detox:tab-changed` from `App.showTab`**

In `web/js/app.js`, find `showTab(tab)` (around line 380). After `this.currentTab = tab;` (line 382), add:

```js
        document.dispatchEvent(new CustomEvent('detox:tab-changed', { detail: { tab } }));
```

So the block becomes:

```js
    async showTab(tab) {
        const token = ++this.renderToken;
        this.currentTab = tab;
        document.dispatchEvent(new CustomEvent('detox:tab-changed', { detail: { tab } }));

        document.querySelectorAll('[data-tab]').forEach(el => {
            el.classList.toggle('is-active', el.dataset.tab === tab);
        });
        // ... rest unchanged
```

In `App.init()` (around line 561), after `if (window.HUD) HUD.init();` add:

```js
        if (window.Compass) Compass.init();
```

- [ ] **Step 4: Register CSS + script in `web/index.html`**

Add a stylesheet line below `isle.css`:

```html
<link rel="stylesheet" href="/css/compass.css?v=20260503">
```

Add script tag after `world.js` and before `buildings.js`:

```html
<script src="/js/compass.js?v=20260503"></script>
```

- [ ] **Step 5: Smoke**

```bash
./start.sh
```

http://localhost:5050. Cmd+Shift+R. Expected:
- A compass card sits top-right under the `?` button. It lists 8 destinations.
- The current tab's row has `is-current` highlight.
- Clicking a row navigates and the highlight follows.
- Resize the window narrower than 760 px (DevTools responsive). The card collapses; a 🧭 button appears. Tapping it opens the card overlay; tapping a row inside closes it.
- Console: no JS errors.

`./stop.sh`.

- [ ] **Step 6: Commit**

```bash
git add web/css/compass.css web/js/compass.js web/js/app.js web/index.html
git commit -m "$(cat <<'EOF'
compass hud listing the 8 destinations with current-room highlight
EOF
)"
```

---

## Task 6 — Retire bottom ribbon

Two surfaces still hold the ribbon: the `<nav id="tab-rail">` block in `index.html` and the `#tab-rail` + `.tab-rail__item` rules in `hud.css`. Remove both. Also adjust `#app` `grid-template-rows` to drop the third row.

**Files:**
- Modify: `web/index.html`
- Modify: `web/css/hud.css`

- [ ] **Step 1: Remove the `<nav>` block from `web/index.html`**

Delete lines 48–57 (the `<nav id="tab-rail">…</nav>` block and its 8 buttons). The `<main id="content"></main>` line is now the last child of `<div id="app">` before the help overlay starts.

- [ ] **Step 2: Adjust `#app` grid + remove ribbon CSS in `web/css/hud.css`**

In `web/css/hud.css`, change line 6 from:

```css
    grid-template-rows: var(--hud-top-h) 1fr var(--hud-rail-h);
```

to:

```css
    grid-template-rows: var(--hud-top-h) 1fr;
```

Delete lines 90–123 (the entire `#tab-rail` and `.tab-rail__item` blocks, ending at the closing `}` of `.tab-rail__glyph`).

- [ ] **Step 3: Smoke**

```bash
./start.sh
```

http://localhost:5050. Cmd+Shift+R. Expected:
- No bottom bar. The view fills full height down to the window edge.
- Compass HUD remains the only persistent nav surface.
- Clicking buildings still navigates.
- Keyboard `1`–`8` still navigates (verify by pressing each digit; current tab indicator on compass updates).
- Direct URL hashes / refresh: open `http://localhost:5050`, press `5`, refresh — should land back on dashboard (no hash routing exists today; this is unchanged behavior, just confirming no regression).
- Help → Keys panel still lists `1`–`8` shortcuts (no change needed; they were already listed at lines 97–104 of `index.html`).

`./stop.sh`.

- [ ] **Step 4: Commit**

```bash
git add web/index.html web/css/hud.css
git commit -m "$(cat <<'EOF'
retire bottom ribbon; nav happens through buildings and compass
EOF
)"
```

---

## Task 7 — Reduced-motion + responsive verification

No new code — a verification sweep with one fix-on-find.

**Files:**
- Modify (only if a regression is found): `web/css/isle.css`, `web/css/compass.css`, `web/js/world.js`

- [ ] **Step 1: Reduced-motion sweep**

```bash
./start.sh
```

http://localhost:5050. DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce".

Visit each tab and confirm:
- **Isle:** sunbeam (sunny weather) is static. Building hover does not lift. Sky updates do not auto-tick (timer disabled).
- **Compass:** opens/closes instantly on mobile; no transition.
- **Other tabs:** unchanged behavior. Existing reduced-motion gates in views still hold.

If any animation still runs, add `animation: none;` and `transition: none;` rules under `@media (prefers-reduced-motion: reduce)` in the appropriate file. Re-run.

- [ ] **Step 2: Responsive sweep at 360 / 760 / 1200 px**

Use DevTools responsive emulation.

At **1200 px**: Isle world fills the stage; buildings clearly distinguishable; compass card pinned top-right; signboards in a 3-column row.

At **760 px**: signboards collapse to single column; compass collapses to 🧭 toggle; weather badge moves below datebar (already in existing CSS); building click targets remain reachable.

At **360 px**: world is scrollable horizontally if needed (the SVG has `width: 100%` so it scales down — note any visual that becomes unusably small). Compass toggle is reachable. Buildings can be tapped.

If the 360-px world becomes unreadable, add a `min-width: 540px; overflow-x: auto;` wrapper around the SVG in `web/css/isle.css`:

```css
.isle__stage {
    min-width: 0;
    overflow-x: auto;
}
.isle__stage svg.world {
    min-width: 540px;
}
```

- [ ] **Step 3: Cross-tab navigation regression**

Click each compass row in turn (Isle, Residents, Chronicle, Charter, Rule Board, Market, Postcards, Study). Confirm each tab loads with no errors and the compass `is-current` highlight follows.

Press each digit `1` through `8`. Confirm the same.

`./stop.sh`.

- [ ] **Step 4: Commit (only if files changed in steps 1–2)**

```bash
git add web/css/isle.css web/css/compass.css web/js/world.js
git commit -m "$(cat <<'EOF'
reduced-motion and responsive fixups for isle world and compass
EOF
)"
```

If no fixes were needed, skip this commit.

---

## Task 8 — Spec amendment

**Files:**
- Modify: `docs/specs/2026-04-17-detox-redesign-design.md`

- [ ] **Step 1: Open the master spec**

Open `docs/specs/2026-04-17-detox-redesign-design.md`.

- [ ] **Step 2: Amend §3.1**

Find the bullet list under "Core game loop" (around line 36). After the existing "Day/night cycles…" bullet (line 41), add:

```markdown
- The frontmost application's resident glows in real time and shows a working tool overlay at their building. Background residents walk slow paths or bob in place. (Live binding lands in Phase 1f; resident-as-sprite rendering substrate lands in Phase 1e.)
```

- [ ] **Step 3: Amend §4**

Find the line under "Eight sections. The existing left sidebar is retired." that reads:

```markdown
2. **Bottom ribbon** — a persistent pixel-art bulletin board with 8 tiles. Keyboard `1`–`8`.
```

Replace it with:

```markdown
2. **Compass HUD** — a small pinned card at top-right listing the 8 destinations, highlighting the current room. Collapses to a 🧭 toggle on viewports <760 px.
3. **Keyboard `1`–`8`** — power-user shortcuts.
```

If the original list was numbered "1. Clickable buildings… / 2. Bottom ribbon…", the result reads:

```markdown
1. **Clickable buildings** on the isle deep-link to each section (click the Registry tower → Apps page).
2. **Compass HUD** — a small pinned card at top-right listing the 8 destinations, highlighting the current room. Collapses to a 🧭 toggle on viewports <760 px.
3. **Keyboard `1`–`8`** — power-user shortcuts.
```

- [ ] **Step 4: Amend §4.1**

Find the "Persistent HUD" list (around line 102). Add a new bullet at the end of that list:

```markdown
- Compass HUD (right side, under the `?` button)
```

There is no existing bullet for the bottom ribbon to remove (§4.1 lists HUD strip items, not nav surfaces) — this addition stands alone.

- [ ] **Step 5: Smoke (no app behavior, just doc)**

```bash
git diff docs/specs/2026-04-17-detox-redesign-design.md
```

Expected: only the three sections above show edits.

- [ ] **Step 6: Commit**

```bash
git add docs/specs/2026-04-17-detox-redesign-design.md
git commit -m "$(cat <<'EOF'
amend spec sections 3.1, 4, and 4.1 — buildings and compass replace bottom ribbon
EOF
)"
```

---

## Self-review

This plan covers spec sections 1–11 of `docs/specs/2026-05-02-phase-1efg-immersive-redesign-design.md` for the 1e Foundation slice:

- §3 / §4.1: SVG world, layered groups, module split → Tasks 1–4.
- §4.2: New module names align with spec (`iso.js`, `world.js`, `buildings.js`, `compass.js`).
- §4.3: Iso tile size 64×32, world 12×8 → Task 1.
- §4.4: Backend touchpoint (frontmost endpoint) deferred to 1f — explicitly noted in non-goals.
- §5.2: Programmatic SVG buildings (8 generators) → Task 3.
- §7.1: Bottom ribbon retirement → Task 6.
- §7.2: "Back to Isle" door from sub-tabs — deferred (compass already provides the same affordance; sub-tab back-doors are aesthetic and live in Plan 1g per the per-tab signature pass).
- §11: Spec amendments → Task 8.

Residents in 1e are SVG `<text>` glyphs in the `worldResidents` layer — Plan 1f swaps them for `<image>` sprite atlases inside the same layer without touching iso/world plumbing.

No backend changes in this plan. No schema changes. No new Python deps. No bundler. Total surface ≈ 5 new files (~430 LOC) and 4 modified files (~150 LOC delta).
