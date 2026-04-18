# Phase 1a — Design System + HUD + Isle Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the Detox Isle design system (fonts, color tokens, pixel-UI primitives), replace the sidebar with a persistent HUD (top bar + bottom tab rail), and swap the Dashboard tab for an isometric Isle scene with a live day/night cycle. Other tabs keep their current rendering for now.

**Architecture:** Pure frontend change. No API, schema, or Python changes. Adds four new CSS files (`tokens.css`, `hud.css`, `pixel-ui.css`, `isle.css`) and two new JS modules (`hud.js`, `isle.js`). `index.html` is restructured to load the HUD shell. The existing router (`App.showTab`) still drives tab switching — only the Dashboard tab gets a new renderer. Currency counters are **display-only** for Plan 2: Sunlight = total detoxed time today (minutes under budget / 1440 capped at 120), Starshards = `stats.longest_detox_minutes / 60` floored. Proper ledger arrives in Plan 4.

**Tech Stack:** Vanilla HTML + CSS + JS, no build step. Google Fonts (Press Start 2P, VT323, Inter). SVG inline. Chart.js remains for sparklines but not used in Plan 2.

**Branch:** `feat/phase-1a-isle-foundations`

---

## File Structure

**Create:**
- `web/css/tokens.css` — CSS custom properties for the Dawn Cove palette, spacing scale, typography tokens, day/night variables.
- `web/css/pixel-ui.css` — Reusable primitives: `.pixel-panel`, `.pixel-button`, `.pixel-chip`, `.pixel-divider`. 1-px pixel-art borders via `box-shadow` trick.
- `web/css/hud.css` — Top bar (logo, currency counters, help button, monitor status) + bottom tab rail (8 destinations).
- `web/css/isle.css` — Isle scene layout: sky gradient, isometric ground grid, plot cells, sun/moon, resident plots.
- `web/js/hud.js` — `HUD.refresh()` reads `/api/dashboard` + `/api/stats/daily`, updates counters and help overlay. Exposes `HUD.openHelp()` / `HUD.closeHelp()`.
- `web/js/isle.js` — `Isle.render(container)` as the new Dashboard renderer. Responsible for sky, day/night, sun/moon position, resident plot layout.

**Modify:**
- `web/index.html` — Replace `<nav id="sidebar">` with `<header id="hud">` + `<nav id="tab-rail">`. Load new CSS and JS files. Add script tag for `hud.js` and `isle.js` before other modules.
- `web/js/app.js:311-321` (`renderTab`) — Route `dashboard` tab to `Isle.render(content)` instead of `Dashboard.render(content)`. Keep `Dashboard` module intact for now (Residents page in Plan 3 will reuse it).
- `web/js/app.js:460-466` (keyboard shortcuts) — Remap `1`–`8` to the eight new tab names; keep `d`, `/`, `Esc` as-is.
- `web/css/style.css` — Remove the sidebar/layout rules superseded by the HUD. Leave per-tab content styles (cards, tables, etc.) untouched.

**Unchanged:** Everything under `agent/`. All other `web/js/*.js` modules. The database.

---

## Pre-Task Setup

- [ ] **Create branch**

```bash
git checkout main
git pull origin main
git checkout -b feat/phase-1a-isle-foundations
```

- [ ] **Confirm baseline**

Run `./start.sh`, confirm dashboard renders at `localhost:5050`, stop. No code changes yet.

---

## Task 1: Add design tokens

**Files:**
- Create: `web/css/tokens.css`

- [ ] **Step 1: Write the token file**

```css
/* Dawn Cove — Detox Isle design tokens. */

:root {
    /* ── Palette (Dawn Cove) ─────────────────────────────────────────── */
    --dc-dawn:       #ffb27a;  /* sunrise peach */
    --dc-noon:       #ffd98a;  /* mid-morning gold */
    --dc-dusk:       #d16a8f;  /* evening rose */
    --dc-night:      #1a1f3a;  /* midnight navy */
    --dc-parchment:  #fff4d6;  /* panel background, warm */
    --dc-sand:       #e8c896;  /* ground tile base */
    --dc-moss:       #6b8e4e;  /* grass accents */
    --dc-sea:        #5b8fb9;  /* water / sky-horizon */
    --dc-ink:        #2a1e2a;  /* body text, pixel outlines */
    --dc-ink-soft:   #5a4a5a;  /* secondary text */
    --dc-coin:       #ffd04a;  /* Sunlight currency */
    --dc-shard:      #b59cff;  /* Starshard currency */
    --dc-danger:     #c4453a;  /* law / block color */
    --dc-ok:         #4a9b6e;  /* approval / completed */

    /* ── Typography ──────────────────────────────────────────────────── */
    --font-display:  'Press Start 2P', 'Courier New', monospace;
    --font-game:     'VT323', 'Courier New', monospace;
    --font-ui:       'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

    --fs-xs:   12px;
    --fs-sm:   14px;
    --fs-md:   16px;
    --fs-lg:   20px;
    --fs-xl:   28px;
    --fs-display: 14px;   /* Press Start 2P is chunky — keep display small */

    /* ── Spacing (4px rhythm) ────────────────────────────────────────── */
    --sp-1: 4px;
    --sp-2: 8px;
    --sp-3: 12px;
    --sp-4: 16px;
    --sp-5: 24px;
    --sp-6: 32px;
    --sp-8: 48px;

    /* ── HUD sizing ──────────────────────────────────────────────────── */
    --hud-top-h:    56px;
    --hud-rail-h:   64px;

    /* ── Day/night cycle (set by isle.js) ────────────────────────────── */
    --sky-top:       var(--dc-dawn);
    --sky-bottom:    var(--dc-noon);
    --ground-tint:   var(--dc-sand);
    --ink-current:   var(--dc-ink);
}

/* Dark mode overrides the *defaults*; isle.js overrides again based on hour. */
body.dark-mode {
    --sky-top:       var(--dc-night);
    --sky-bottom:    #2a3050;
    --ground-tint:   #4a4060;
    --ink-current:   #e8ddf0;
}

/* Pixel-perfect rendering for scaled SVG / image assets. */
.pixel-art {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
}
```

- [ ] **Step 2: Register in index.html**

Edit `web/index.html`. Find the line:

```html
    <link rel="stylesheet" href="/css/style.css?v=20260416">
```

Replace with:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/tokens.css?v=20260417">
    <link rel="stylesheet" href="/css/style.css?v=20260416">
```

(This keeps the existing Inter link by consolidating it into the new `family=` param. The existing `<link>` to `Inter` above this line was already present — delete the duplicate so only one Google Fonts request remains.)

- [ ] **Step 3: Verify load**

`./start.sh`, open `localhost:5050`. DevTools → Network: confirm `tokens.css` returns 200 and Google Fonts request now includes `Press+Start+2P|VT323|Inter`. No visual change expected.

- [ ] **Step 4: Commit**

```bash
git add web/css/tokens.css web/index.html
```

Suggested message:

```
feat(isle): add Dawn Cove design tokens and pixel fonts

Introduce web/css/tokens.css with the Dawn Cove palette, 4px spacing
scale, three-font typography stack (Press Start 2P / VT323 / Inter),
and day/night CSS variables that isle.js will drive. Consolidate the
Google Fonts request to pull all three families in one call.

No visual change yet — tokens are unused until the HUD lands.
```

---

## Task 2: Add pixel-UI primitives

**Files:**
- Create: `web/css/pixel-ui.css`

- [ ] **Step 1: Write the primitives**

```css
/* Reusable pixel-art UI primitives. Layered on top of tokens.css. */

/* ── Panel: parchment card with 2-color pixel border ─────────────────── */
.pixel-panel {
    background: var(--dc-parchment);
    color: var(--dc-ink);
    border: none;
    padding: var(--sp-4);
    position: relative;
    /* Fake pixel border: 2px outer ink + 1px inner highlight. */
    box-shadow:
        0 0 0 2px var(--dc-ink),
        inset 0 0 0 1px rgba(255, 255, 255, 0.35);
    font-family: var(--font-ui);
}

.pixel-panel--dark {
    background: var(--dc-night);
    color: #e8ddf0;
    box-shadow:
        0 0 0 2px var(--dc-ink),
        inset 0 0 0 1px rgba(181, 156, 255, 0.2);
}

/* ── Button: chunky pressable tile ───────────────────────────────────── */
.pixel-button {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    padding: var(--sp-3) var(--sp-4);
    background: var(--dc-parchment);
    color: var(--dc-ink);
    border: none;
    cursor: pointer;
    letter-spacing: 0.5px;
    box-shadow:
        0 0 0 2px var(--dc-ink),
        0 4px 0 0 var(--dc-ink);
    transition: transform 80ms steps(2), box-shadow 80ms steps(2);
    user-select: none;
}

.pixel-button:hover {
    background: var(--dc-noon);
}

.pixel-button:active {
    transform: translateY(3px);
    box-shadow:
        0 0 0 2px var(--dc-ink),
        0 1px 0 0 var(--dc-ink);
}

.pixel-button--primary {
    background: var(--dc-coin);
}

.pixel-button--danger {
    background: var(--dc-danger);
    color: #fff;
}

/* ── Chip: inline currency / counter pill ────────────────────────────── */
.pixel-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-1) var(--sp-3);
    font-family: var(--font-game);
    font-size: var(--fs-lg);
    line-height: 1;
    background: var(--dc-parchment);
    color: var(--dc-ink);
    box-shadow: 0 0 0 2px var(--dc-ink);
    min-height: 32px;
}

.pixel-chip__glyph {
    font-size: var(--fs-md);
    line-height: 1;
}

.pixel-chip--sunlight .pixel-chip__glyph { color: var(--dc-coin); }
.pixel-chip--shard    .pixel-chip__glyph { color: var(--dc-shard); }

/* ── Divider: dotted line, pixel-style ───────────────────────────────── */
.pixel-divider {
    height: 2px;
    background: repeating-linear-gradient(
        to right,
        var(--dc-ink) 0 4px,
        transparent 4px 8px
    );
    margin: var(--sp-4) 0;
}
```

- [ ] **Step 2: Register in index.html**

Edit `web/index.html`. Under the `tokens.css` link add:

```html
    <link rel="stylesheet" href="/css/pixel-ui.css?v=20260417">
```

- [ ] **Step 3: Smoke check**

Reload `localhost:5050`. No visible change expected. DevTools → Network: `pixel-ui.css` returns 200.

- [ ] **Step 4: Commit**

```bash
git add web/css/pixel-ui.css web/index.html
```

Suggested message:

```
feat(isle): add pixel-UI primitives (panel, button, chip, divider)

Four reusable classes that the HUD, Isle scene, and every future page
will lean on: .pixel-panel (parchment card with ink border),
.pixel-button (chunky press-down button with stepped transitions),
.pixel-chip (currency pill using VT323), .pixel-divider (dotted line).

Still no visible change — classes land with the HUD in the next commit.
```

---

## Task 3: Build the HUD chrome (top bar + tab rail)

**Files:**
- Create: `web/css/hud.css`
- Modify: `web/index.html` (replace sidebar markup)

- [ ] **Step 1: Write HUD styles**

```css
/* Top bar + bottom tab rail. Sits above all tab content. */

/* ── App layout: HUD-wrapped content ─────────────────────────────────── */
#app {
    display: grid;
    grid-template-rows: var(--hud-top-h) 1fr var(--hud-rail-h);
    min-height: 100vh;
    background: var(--dc-sand);
}

/* Old sidebar layout is replaced — reset any stray width constraints. */
#content {
    overflow: auto;
    padding: var(--sp-4);
}

/* ── Top bar ─────────────────────────────────────────────────────────── */
#hud {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    padding: 0 var(--sp-4);
    background: var(--dc-parchment);
    box-shadow: 0 2px 0 0 var(--dc-ink);
    font-family: var(--font-display);
    font-size: var(--fs-display);
    position: sticky;
    top: 0;
    z-index: 50;
}

.hud-logo {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink);
    letter-spacing: 1px;
    margin-right: auto;
}

.hud-currencies {
    display: flex;
    gap: var(--sp-3);
}

.hud-actions {
    display: flex;
    gap: var(--sp-2);
    align-items: center;
}

.hud-icon-button {
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--dc-parchment);
    color: var(--dc-ink);
    border: none;
    cursor: pointer;
    box-shadow: 0 0 0 2px var(--dc-ink);
    font-family: var(--font-display);
    font-size: var(--fs-display);
}

.hud-icon-button:hover { background: var(--dc-noon); }

/* ── Bottom tab rail ─────────────────────────────────────────────────── */
#tab-rail {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    background: var(--dc-parchment);
    box-shadow: 0 -2px 0 0 var(--dc-ink);
    position: sticky;
    bottom: 0;
    z-index: 50;
}

.tab-rail__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-1);
    padding: var(--sp-2);
    font-family: var(--font-display);
    font-size: 9px;
    letter-spacing: 0.5px;
    color: var(--dc-ink-soft);
    text-decoration: none;
    cursor: pointer;
    border: none;
    background: transparent;
}

.tab-rail__item:hover { color: var(--dc-ink); background: rgba(0, 0, 0, 0.04); }
.tab-rail__item.is-active { color: var(--dc-ink); background: var(--dc-noon); }

.tab-rail__glyph { font-size: 18px; line-height: 1; }

/* ── Monitor status dot ──────────────────────────────────────────────── */
.hud-status {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-family: var(--font-game);
    font-size: var(--fs-md);
    color: var(--dc-ink-soft);
}

.hud-status__dot {
    width: 8px;
    height: 8px;
    background: var(--dc-ok);
    box-shadow: 0 0 0 1px var(--dc-ink);
}

.hud-status--offline .hud-status__dot { background: var(--dc-danger); }

/* ── Help overlay (minimalist, text-only for Plan 2) ─────────────────── */
.help-overlay {
    position: fixed;
    inset: 0;
    background: rgba(26, 31, 58, 0.75);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: var(--sp-4);
}

.help-overlay.is-open { display: flex; }

.help-overlay__panel {
    max-width: 560px;
    width: 100%;
}

.help-overlay__title {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    margin: 0 0 var(--sp-4) 0;
}

.help-overlay__body {
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    line-height: 1.6;
}

.help-overlay__body kbd {
    font-family: var(--font-game);
    background: var(--dc-ink);
    color: var(--dc-parchment);
    padding: 2px 6px;
    margin: 0 2px;
}
```

- [ ] **Step 2: Register HUD CSS**

Edit `web/index.html`. After the `pixel-ui.css` link add:

```html
    <link rel="stylesheet" href="/css/hud.css?v=20260417">
```

- [ ] **Step 3: Replace sidebar markup**

Edit `web/index.html`. Delete the entire `<nav id="sidebar">…</nav>` block (lines 15-59 in the current file) and replace with:

```html
        <header id="hud">
            <span class="hud-logo">DETOX</span>
            <div class="hud-currencies">
                <span class="pixel-chip pixel-chip--sunlight" id="hudSunlight" title="Sunlight — earned from detoxed minutes">
                    <span class="pixel-chip__glyph">☀</span>
                    <span data-role="value">0</span>
                </span>
                <span class="pixel-chip pixel-chip--shard" id="hudShards" title="Starshards — earned from streaks and milestones">
                    <span class="pixel-chip__glyph">✦</span>
                    <span data-role="value">0</span>
                </span>
            </div>
            <div class="hud-actions">
                <span class="hud-status" id="monitor-status">
                    <span class="hud-status__dot"></span>
                    <span class="status-text">Checking…</span>
                </span>
                <button class="hud-icon-button" id="themeToggle" onclick="App.toggleDarkMode()" title="Toggle theme (D)">
                    <svg id="themeIcon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                </button>
                <button class="hud-icon-button" onclick="HUD.openHelp()" title="Help (?)">?</button>
            </div>
        </header>
        <main id="content"></main>
        <nav id="tab-rail">
            <button class="tab-rail__item is-active" data-tab="dashboard"><span class="tab-rail__glyph">🏝</span>Isle</button>
            <button class="tab-rail__item" data-tab="apps"><span class="tab-rail__glyph">🏘</span>Residents</button>
            <button class="tab-rail__item" data-tab="stats"><span class="tab-rail__glyph">📜</span>Chronicle</button>
            <button class="tab-rail__item" data-tab="goals"><span class="tab-rail__glyph">✒</span>Charter</button>
            <button class="tab-rail__item" data-tab="blocker"><span class="tab-rail__glyph">⚖</span>Rule Board</button>
            <button class="tab-rail__item" data-tab="cards"><span class="tab-rail__glyph">🏪</span>Market</button>
            <button class="tab-rail__item" data-tab="cards"><span class="tab-rail__glyph">✉</span>Postcards</button>
            <button class="tab-rail__item" data-tab="settings"><span class="tab-rail__glyph">🏛</span>Study</button>
        </nav>
```

**Note:** Market and Postcards both point at the existing `cards` tab for Plan 2. Plan 4 will split them. The glyph fonts show emoji because real pixel sprites haven't been produced yet — replace with `.pixel-art` SVGs in Plan 3/4.

Then add the help overlay markup immediately before `<div class="toast-container">`:

```html
    <div class="help-overlay" id="helpOverlay" onclick="if(event.target===this)HUD.closeHelp()">
        <div class="help-overlay__panel pixel-panel">
            <h2 class="help-overlay__title">How the Isle works</h2>
            <div class="help-overlay__body">
                <p>Each app you use is a <strong>resident</strong> of your isle. The ones you spend the most time with get the biggest plots.</p>
                <p><strong>Sunlight (☀)</strong> grows while you stay under your daily budget. <strong>Starshards (✦)</strong> come from streaks and milestones — they're the rarer currency.</p>
                <p>The sky and sun/moon track your local time. Close the app, touch grass, come back tomorrow.</p>
                <p>Shortcuts: <kbd>1</kbd>–<kbd>8</kbd> switch tabs, <kbd>D</kbd> toggles theme, <kbd>?</kbd> opens this panel, <kbd>Esc</kbd> closes it.</p>
                <button class="pixel-button" onclick="HUD.closeHelp()" style="margin-top: var(--sp-4)">Got it</button>
            </div>
        </div>
    </div>
```

- [ ] **Step 4: Wire tab-rail clicks to router**

Edit `web/js/app.js`. Find the block starting around line 505:

```javascript
        document.querySelectorAll('.nav-links a').forEach(a => {
            a.addEventListener('click', e => {
                e.preventDefault();
                this.showTab(a.dataset.tab);
            });
        });
```

Replace with:

```javascript
        document.querySelectorAll('[data-tab]').forEach(el => {
            el.addEventListener('click', e => {
                e.preventDefault();
                this.showTab(el.dataset.tab);
            });
        });
```

Then find (around line 328-330):

```javascript
        document.querySelectorAll('.nav-links a').forEach(a => {
            a.classList.toggle('active', a.dataset.tab === tab);
        });
```

Replace with:

```javascript
        document.querySelectorAll('[data-tab]').forEach(el => {
            el.classList.toggle('is-active', el.dataset.tab === tab);
        });
```

- [ ] **Step 5: Remap keyboard shortcuts**

Edit `web/js/app.js` around lines 460-466. Replace the `case '1':` … `case '7':` block with:

```javascript
                case '1': this.showTab('dashboard'); break;
                case '2': this.showTab('apps'); break;
                case '3': this.showTab('stats'); break;
                case '4': this.showTab('goals'); break;
                case '5': this.showTab('blocker'); break;
                case '6': this.showTab('cards'); break;
                case '7': this.showTab('cards'); break;
                case '8': this.showTab('settings'); break;
```

(6 and 7 share `cards` until Market is split in Plan 4.)

- [ ] **Step 6: Verify**

`./start.sh`, reload.

Expected:
- HUD bar across the top with "DETOX" logo, two currency chips showing `0`, status dot, theme toggle, help button.
- Bottom tab rail with 8 labeled buttons.
- Clicking tabs still loads the old rendered views inside `#content` (Dashboard, Apps, Stats, etc. render with their current styles — ugly overlap with the new chrome is expected and gets resolved in Task 5).
- Clicking `?` opens the help overlay. Clicking "Got it" or outside the panel closes it.
- Pressing `1` through `8` switches tabs.

- [ ] **Step 7: Commit**

```bash
git add web/css/hud.css web/index.html web/js/app.js
```

Suggested message:

```
feat(isle): replace sidebar with top HUD + bottom tab rail

Introduce the persistent HUD chrome: parchment top bar with logo,
Sunlight / Starshard counters (display-only, value 0), monitor status,
theme toggle, help button. Bottom tab rail with 8 new destinations
(Isle, Residents, Chronicle, Charter, Rule Board, Market, Postcards,
Study) mapped onto existing tab renderers for now.

Router wired to [data-tab] selector so both rail and future overlays
can trigger navigation. Keyboard shortcuts 1-8 remapped. Help overlay
stubbed with keyboard reference — proper content ships in Plan 4.
```

---

## Task 4: HUD state module (counters + help)

**Files:**
- Create: `web/js/hud.js`

- [ ] **Step 1: Write the module**

```javascript
/* HUD — currency counters, help overlay, monitor status. */

const HUD = {
    refreshIntervalId: null,

    init() {
        this.refresh();
        // Poll every 30 seconds; no push channel yet.
        this.refreshIntervalId = setInterval(() => this.refresh(), 30000);

        document.addEventListener('keydown', (e) => {
            if (e.key === '?' && !this.isTyping(e.target)) {
                e.preventDefault();
                this.openHelp();
            } else if (e.key === 'Escape') {
                this.closeHelp();
            }
        });
    },

    isTyping(el) {
        const tag = el && el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || (el && el.isContentEditable);
    },

    async refresh() {
        try {
            const [dashboard, stats] = await Promise.all([
                App.api('/api/dashboard'),
                App.api('/api/stats/daily'),
            ]);
            this.updateCurrencies(dashboard, stats);
        } catch (_) {
            // Counters stay at their last known value; monitor status dot
            // already surfaces agent health separately.
        }
    },

    updateCurrencies(dashboard, stats) {
        const budget = dashboard.goal_target || 0;
        const used = dashboard.total_minutes || 0;
        // Sunlight: every minute under budget earns 1 ☀, capped at 120/day.
        // If no budget is set, pay 0 — can't reward against an undefined goal.
        const sunlight = budget > 0 ? Math.max(0, Math.min(120, Math.floor(budget - used))) : 0;
        // Starshards: 1 per hour of longest detox today. Cheap proxy until
        // Plan 4 introduces the real streak/milestone ledger.
        const shards = Math.floor((stats.longest_detox_minutes || 0) / 60);

        this.setChipValue('hudSunlight', sunlight);
        this.setChipValue('hudShards', shards);
    },

    setChipValue(id, n) {
        const el = document.querySelector(`#${id} [data-role="value"]`);
        if (el) el.textContent = String(n);
    },

    openHelp() {
        document.getElementById('helpOverlay').classList.add('is-open');
    },

    closeHelp() {
        document.getElementById('helpOverlay').classList.remove('is-open');
    },
};

window.HUD = HUD;
```

- [ ] **Step 2: Register script**

Edit `web/index.html`. Find the block of `<script>` tags at the bottom. Add a line immediately after the `app.js` script:

```html
    <script src="/js/hud.js?v=20260417"></script>
```

- [ ] **Step 3: Call `HUD.init()` on boot**

Edit `web/js/app.js`. Find the `init()` method (search for `this.showTab('dashboard');` around line 514) and add a line just after `this.showTab('dashboard');`:

```javascript
        if (window.HUD) HUD.init();
```

- [ ] **Step 4: Verify**

Reload. Let the monitor record some usage (or set a daily goal under Goals tab). Within 30s, the ☀ counter should reflect `max(0, min(120, floor(budget - used)))`. ✦ stays at 0 unless you have ≥60 minutes of longest detox today.

Check that `?` key and the `?` button both open the help overlay. `Esc` closes it. Typing `?` inside a text input does NOT open it.

- [ ] **Step 5: Commit**

```bash
git add web/js/hud.js web/index.html web/js/app.js
```

Suggested message:

```
feat(isle): HUD counters pull live values from /api/dashboard + /api/stats

HUD.init() installs a 30s refresh of the Sunlight and Starshard chips
plus a global key handler for '?' (opens help) and 'Esc' (closes help).

Sunlight formula is displayed-only for now:
  budget > 0 ? clamp(0, 120, floor(budget - used)) : 0

Starshards = floor(longest_detox_minutes / 60). Both numbers are proxies
that will be replaced by the real ledger in Plan 4.
```

---

## Task 5: Clean up legacy sidebar CSS

**Files:**
- Modify: `web/css/style.css` — remove rules the HUD now replaces.

- [ ] **Step 1: Identify and delete sidebar rules**

In `web/css/style.css`, search for and delete every rule that targets:
- `#sidebar`, `.nav-links`, `.sidebar-footer`, `.theme-toggle-btn`, `.monitor-status`, `.logo`, `.logo-text`
- Any layout rule on `#app` that sets grid-template-columns / flex-direction for the sidebar layout (e.g., `#app { display: flex; }` with width rules for the sidebar).

Do NOT delete:
- `.toast` / `.toast-*` rules (toasts still work).
- `.btn`, `.btn-primary`, `.empty-state`, `.view-loading*`, per-tab content styles (cards, tables, charts).
- `.fade-in`, `.is-transitioning`, dark-mode rules not tied to the sidebar.

If uncertain whether a rule is still referenced, search for its selector in `web/`:

```bash
grep -rn "\\.class-name" web/
```

- [ ] **Step 2: Verify**

Reload. Expected:
- HUD and tab rail look clean (no leftover width clamps from old `#app` flex layout).
- Content area uses full width minus HUD heights.
- Every tab still renders. Toasts still work. Dark-mode toggle still flips the theme.
- DevTools console: no 404s, no reference errors.

If a page breaks, the offending rule was load-bearing — restore it and narrow the delete.

- [ ] **Step 3: Commit**

```bash
git add web/css/style.css
```

Suggested message:

```
refactor(isle): remove sidebar CSS superseded by HUD

Delete rules for #sidebar, .nav-links, .sidebar-footer, the old
#app flex layout, and the sidebar-bound theme toggle / monitor
status. Per-tab content styles (cards, tables, charts, toasts,
empty states, loading) stay intact — only the chrome moves.
```

---

## Task 6: Isle scene CSS (sky + ground + plots)

**Files:**
- Create: `web/css/isle.css`

- [ ] **Step 1: Write scene styles**

```css
/* Isle dashboard — sky, ground, residents. */

.isle {
    position: relative;
    display: grid;
    grid-template-rows: 1fr auto;
    gap: var(--sp-4);
    min-height: calc(100vh - var(--hud-top-h) - var(--hud-rail-h) - var(--sp-6));
    padding: 0;
}

/* ── Sky layer ──────────────────────────────────────────────────────── */
.isle__sky {
    position: relative;
    border-radius: 0;
    box-shadow: 0 0 0 2px var(--dc-ink);
    background: linear-gradient(to bottom, var(--sky-top), var(--sky-bottom));
    overflow: hidden;
    min-height: 320px;
}

.isle__celestial {
    position: absolute;
    width: 48px;
    height: 48px;
    background: var(--dc-coin);
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--dc-ink), 0 0 32px 4px rgba(255, 208, 74, 0.4);
    transition: left 4s linear, top 4s linear, background 4s linear;
}

.isle__celestial--moon {
    background: #e8ddf0;
    box-shadow: 0 0 0 2px var(--dc-ink), 0 0 24px 2px rgba(232, 221, 240, 0.35);
}

.isle__stars {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 2s;
    background-image:
        radial-gradient(1px 1px at 10% 20%, #fff, transparent),
        radial-gradient(1px 1px at 30% 40%, #fff, transparent),
        radial-gradient(1px 1px at 55% 15%, #fff, transparent),
        radial-gradient(1px 1px at 75% 35%, #fff, transparent),
        radial-gradient(1px 1px at 85% 10%, #fff, transparent),
        radial-gradient(1px 1px at 20% 60%, #fff, transparent);
}

.isle__sky.is-night .isle__stars { opacity: 0.8; }

/* ── Ground (isometric grid) ─────────────────────────────────────────── */
.isle__ground {
    position: relative;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--sp-2);
    padding: var(--sp-4);
    background: var(--ground-tint);
    box-shadow: 0 0 0 2px var(--dc-ink);
    min-height: 180px;
}

/* ── Plot: one resident ──────────────────────────────────────────────── */
.plot {
    aspect-ratio: 1 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding: var(--sp-2);
    position: relative;
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    cursor: pointer;
    font-family: var(--font-game);
    font-size: var(--fs-md);
    color: var(--dc-ink);
    text-align: center;
}

.plot:hover { background: var(--dc-noon); }

.plot__icon {
    font-size: 32px;
    line-height: 1;
    margin-bottom: var(--sp-1);
}

.plot__name {
    font-family: var(--font-game);
    font-size: var(--fs-md);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.plot__time {
    font-family: var(--font-display);
    font-size: 9px;
    color: var(--dc-ink-soft);
    margin-top: var(--sp-1);
}

/* Plot size tiers — driven by rank */
.plot--tier-1 { grid-column: span 2; grid-row: span 2; }
.plot--tier-2 { grid-column: span 2; }
/* tier-3 and below use default 1x1 */

/* ── Empty state ─────────────────────────────────────────────────────── */
.isle__empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: var(--sp-6);
    font-family: var(--font-game);
    font-size: var(--fs-lg);
    color: var(--dc-ink-soft);
}
```

- [ ] **Step 2: Register**

Edit `web/index.html`. After the `hud.css` link add:

```html
    <link rel="stylesheet" href="/css/isle.css?v=20260417">
```

- [ ] **Step 3: Verify load**

Reload — no visual change yet; `Isle.render` isn't wired. DevTools Network: `isle.css` 200.

- [ ] **Step 4: Commit**

```bash
git add web/css/isle.css web/index.html
```

Suggested message:

```
feat(isle): add scene CSS (sky, ground grid, plot tiers, stars)

Scene layout uses a 5-column grid where top apps claim larger plots
(tier-1 = 2x2, tier-2 = 2x1). Sky is a linear gradient driven by CSS
variables (isle.js will update them with hour-of-day). Stars fade in
when .is-night is applied. No renderer yet.
```

---

## Task 7: Isle renderer (data → scene)

**Files:**
- Create: `web/js/isle.js`
- Modify: `web/js/app.js` — route dashboard to Isle.

- [ ] **Step 1: Write renderer**

```javascript
/* Isle — isometric dashboard. Replaces Dashboard.render for the 'dashboard' tab. */

const Isle = {
    async render(container) {
        const data = await App.api(`/api/dashboard?date=${App.currentDate}`);
        const apps = data.apps || [];

        container.innerHTML = this.scaffold();
        this.updateSky();
        this.renderPlots(apps);

        // Update sky every minute — cheap, covers the edge case of the user
        // leaving the dashboard open across sunset.
        if (this._skyInterval) clearInterval(this._skyInterval);
        this._skyInterval = setInterval(() => this.updateSky(), 60000);
    },

    scaffold() {
        return `
            <section class="isle">
                <div class="isle__sky" id="isleSky">
                    <div class="isle__stars"></div>
                    <div class="isle__celestial" id="isleCelestial"></div>
                </div>
                <div class="isle__ground" id="isleGround"></div>
            </section>
        `;
    },

    updateSky() {
        const sky = document.getElementById('isleSky');
        if (!sky) return;
        const now = new Date();
        const hours = now.getHours() + now.getMinutes() / 60;
        const phase = this.hourToPhase(hours);

        document.documentElement.style.setProperty('--sky-top', phase.top);
        document.documentElement.style.setProperty('--sky-bottom', phase.bottom);
        document.documentElement.style.setProperty('--ground-tint', phase.ground);
        sky.classList.toggle('is-night', phase.isNight);

        const celestial = document.getElementById('isleCelestial');
        if (celestial) {
            // Sun arcs 6am → 6pm, moon 6pm → 6am. Horizontal = time, vertical = parabolic.
            const t = ((hours - 6 + 24) % 12) / 12; // 0..1 across daylight OR night
            const rect = sky.getBoundingClientRect();
            const x = t * (rect.width - 48);
            const y = rect.height - 48 - Math.sin(t * Math.PI) * (rect.height * 0.6);
            celestial.style.left = `${x}px`;
            celestial.style.top = `${y}px`;
            celestial.classList.toggle('isle__celestial--moon', phase.isNight);
        }
    },

    hourToPhase(h) {
        // Dawn 5-7, day 7-17, dusk 17-19, night 19-5.
        if (h >= 5 && h < 7) return { top: '#ffb27a', bottom: '#ffd98a', ground: '#e8c896', isNight: false };
        if (h >= 7 && h < 17) return { top: '#7bb8e8', bottom: '#ffd98a', ground: '#e8c896', isNight: false };
        if (h >= 17 && h < 19) return { top: '#d16a8f', bottom: '#ffb27a', ground: '#c89677', isNight: false };
        return { top: '#1a1f3a', bottom: '#2a3050', ground: '#4a4060', isNight: true };
    },

    renderPlots(apps) {
        const ground = document.getElementById('isleGround');
        if (!ground) return;

        if (!apps.length) {
            ground.innerHTML = `
                <div class="isle__empty">
                    Your isle is quiet today.<br>
                    Use any app for 2+ seconds and they'll move in.
                </div>
            `;
            return;
        }

        const top = apps.slice(0, 8);
        ground.innerHTML = top.map((app, i) => {
            const tier = i === 0 ? 1 : i < 3 ? 2 : 3;
            const glyph = this.glyphFor(app.app_name);
            const time = App.formatTime(app.minutes);
            return `
                <div class="plot plot--tier-${tier}" data-app="${App.escapeHtml(app.app_name)}" onclick="App.showTab('apps')">
                    <span class="plot__icon" aria-hidden="true">${glyph}</span>
                    <span class="plot__name">${App.escapeHtml(app.app_name)}</span>
                    <span class="plot__time">${time}</span>
                </div>
            `;
        }).join('');
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
};

window.Isle = Isle;
```

- [ ] **Step 2: Register script**

Edit `web/index.html`. Under the `hud.js` script tag add:

```html
    <script src="/js/isle.js?v=20260417"></script>
```

- [ ] **Step 3: Route dashboard to Isle**

Edit `web/js/app.js:311-321`. Replace:

```javascript
    async renderTab(content, tab) {
        switch (tab) {
            case 'dashboard': return Dashboard.render(content);
```

with:

```javascript
    async renderTab(content, tab) {
        switch (tab) {
            case 'dashboard': return Isle.render(content);
```

(Leave the rest of the switch intact.)

- [ ] **Step 4: Verify**

`./start.sh`, reload.

Expected:
- Isle tab shows a sky panel with a sun (or moon, depending on time of day) placed according to the hour.
- Below the sky: a 5-column ground grid. If the monitor has recorded usage today, the top 8 apps render as plots. The #1 app is the biggest (tier-1 = 2×2). #2 and #3 are tier-2 (2×1). The rest are 1×1.
- If no apps tracked today: empty-state copy appears instead.
- Clicking a plot navigates to Residents (apps) tab.
- Leave the tab open; after one minute, the sun/moon position adjusts slightly.
- Other tabs still render their existing views.

- [ ] **Step 5: Commit**

```bash
git add web/js/isle.js web/index.html web/js/app.js
```

Suggested message:

```
feat(isle): replace Dashboard renderer with isometric Isle scene

Isle.render pulls today's apps from /api/dashboard and lays them out
as plots on a 5-column ground grid, sized by rank (tier-1 for the
most-used, tier-2 for #2-3, tier-3 for the rest). Sky gradient and
sun/moon position are driven by system clock, refreshed every minute.

Clicking a plot jumps to the Residents tab for per-app detail. The
Dashboard module is untouched and remains available — Residents in
Plan 3 will reuse parts of it.
```

---

## Task 8: Smoke test + open PR

- [ ] **Step 1: Full smoke walkthrough**

`./start.sh`. In the browser:

1. Isle tab renders with sky, sun/moon, plots for top apps.
2. HUD shows Sunlight and Starshard chips. Values update within 30s when usage / goals change.
3. All 8 tab-rail buttons switch views. Residents/Chronicle/Charter/Rule Board/Market/Postcards/Study render their legacy views inside the new HUD frame.
4. `?` key and `?` button open help overlay. `Esc` closes it.
5. Dark mode toggle still works from the HUD.
6. `1`–`8` keyboard shortcuts hit the right tabs.
7. DevTools console: zero red errors. Network: zero 404s on CSS/JS.

If any step fails, fix before moving on. Do NOT paper over broken tabs — the point of Phase 1a is a usable Isle with intact legacy fallback for the other tabs.

`./stop.sh` — confirm clean shutdown.

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin feat/phase-1a-isle-foundations
gh pr create --base main --title "Phase 1a: Isle foundations (HUD + design system + dashboard reskin)" --body "$(cat <<'EOF'
## Summary

- Introduces the Dawn Cove design tokens, pixel-UI primitives, and the HUD chrome (top bar + tab rail), replacing the sidebar.
- Replaces the Dashboard tab with the isometric Isle scene: plots for today's top apps, sun/moon tracking local time.
- Other tabs (Residents, Chronicle, Charter, Rule Board, Market, Postcards, Study) keep their current renderers and will be reskinned in Plans 3 and 4.

See `docs/plans/2026-04-17-phase-1a-isle-foundations.md` for the task breakdown and `docs/specs/2026-04-17-detox-redesign-design.md` §2 for the target UX.

## Test plan

- [ ] `./start.sh` boots, browser opens to the new Isle
- [ ] All 8 tabs switch without console errors
- [ ] Sunlight/Starshard counters update within 30s after usage
- [ ] Help overlay opens with `?` and the HUD button, closes with `Esc`
- [ ] Dark mode toggle still works
- [ ] Keyboard shortcuts 1-8 hit the right tabs
- [ ] `./stop.sh` shuts down cleanly
EOF
)"
```

After PR merges, tag locally:

```bash
git checkout main
git pull
git tag -a phase-1a-complete -m "Phase 1a: Isle foundations (HUD + dashboard reskin)"
git push origin phase-1a-complete
```

---

## Out of Scope (deliberately)

- Real pixel-art SVG sprites for plots / buildings / sun / moon. Emoji glyphs stand in; Plan 3 swaps them for actual assets.
- Residents (apps), Chronicle (stats), Charter (goals), Rule Board (blocker), Market, Postcards, Study pages — all still render their current views inside the new HUD. Reskin happens in Plan 3 (Residents, Chronicle, Charter) and Plan 4 (Rule Board, Market, Postcards, Study, help content).
- Rewards ledger, streak tracking, actual Starshard earning rules. Sunlight and Starshards are proxies in Plan 2; Plan 4 introduces the real formulas from spec §2b.
- Any backend change. `agent/server.py`, `agent/database.py` are untouched.
- Weekly / historical views on the Isle. Plan 2 is today-only.
- Animation polish (ship docking, sunbeams, resident idle animations). Post-MVP.

## Self-Review Notes

- **Placeholder scan:** All tasks include the actual CSS/JS to paste. No "TBD" or "handle errors appropriately".
- **Type/name consistency:** `HUD.init`, `HUD.openHelp`, `HUD.closeHelp`, `Isle.render` match across task references. Tab names `dashboard|apps|stats|goals|blocker|cards|settings` match `App.renderTab`'s switch.
- **Scope:** Single plan produces a usable app — Isle dashboard + chrome. Other tabs fall back to legacy rendering, so nothing is half-finished.
- **Spec coverage:** Design spec §2 (HUD + Isle scene + day/night), §3 (Dawn Cove palette + typography), and the display-only currency interpretation are all covered. Residents/Chronicle/etc. are explicitly deferred.
