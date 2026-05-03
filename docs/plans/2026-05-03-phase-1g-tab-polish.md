# Phase 1g — Tab Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each non-Isle tab gets one signature animation tied to its primary action, plus a small "back to Isle" door icon. The whole app feels built rather than styled. No backend change. No new dependencies. All motion gated on `prefers-reduced-motion`.

**Architecture:** Plan 1f scaffolded `effects.js` with `glowHalo` working and `waxSeal` / `chalkDust` / `currencyFloat` as stubs. Plan 1g fills the stubs and adds a small set of DOM-mounted helpers (page turn, postcard slide, quill draw, candle flame). Each tab module imports the helper it needs and fires it on its primary action. Animations are CSS keyframes triggered by toggling a class; JS removes the class after the keyframe completes so the trigger is re-armable.

**Tech stack:** Vanilla HTML / CSS / JS. No build step. New file `web/css/effects.css` owns every signature keyframe in one place. `effects.js` grows from ~30 LOC to ~140 LOC. Each tab module gets a 1–8 line touch.

**Non-goals:**
- Daily NPC schedules (spec §2 non-goal).
- Audio / sound packs (spec §2 non-goal). The "thunk", "clink" descriptors in spec §8 are character, not committed audio.
- Camera-pan into building interiors (spec §2 non-goal).
- Backend changes.

---

## File structure

**Create:**
- `web/css/effects.css` — every signature keyframe (chalk-dust burst, wax-seal stamp, coin float, page turn, postcard slide, candle flame, quill draw, back-to-isle door).

**Modify:**
- `web/js/effects.js` — replace stubs with real implementations: `waxSeal`, `chalkDust`, `currencyFloat`, `pageTurn`, `slamIn`. SVG world helpers (`glowHalo`) untouched.
- `web/js/app.js` — add `Esc` keybinding → dashboard, add `backToIsleButton()` helper, ensure `runAction` re-renders work with the post-action animation hook.
- `web/index.html` — register `effects.css`. Bump cache busters to today's date stamp.
- `web/js/blocker.js` — fire `Effects.chalkDust()` + chalk-write keyframe on add, chalk-erase swipe on remove.
- `web/js/goals.js` — fire `Effects.waxSeal()` on every `save*` success.
- `web/js/cards.js` — replace fade-in preview with postcard slide-in + reused `Effects.waxSeal()` on the stamp.
- `web/js/market.js` — fire `Effects.currencyFloat()` from clicked item card to top-right Sunlight HUD on buy.
- `web/js/apps.js` — wrap `filterApps` re-render in `Effects.pageTurn()`.
- `web/js/stats.js` — gain a quill SVG sweep that traces the bar chart on render.
- `web/js/settings.js` — wrap the dark-mode toggle in a candle-flame swap.
- `web/css/views.css` (or `pixel-ui.css` — pick the one already loaded by every tab) — add `.page-bar` slot styles for the back-to-isle door.

**Cache-buster bump:** every `?v=` query string updates to today's execution date (e.g. `v=20260503` → `v=20260520`).

---

## Task 0 — Effects CSS keyframes

**Files:**
- Create: `web/css/effects.css`
- Modify: `web/index.html`

- [ ] **Step 1: Create `web/css/effects.css`**

```css
/* Signature keyframes for plan 1g tab polish. */

/* ── Wax seal — scale + slight rotate; 300 ms cubic-out ─────────────── */
@keyframes seal-stamp {
    0%   { transform: translate(-50%, -50%) scale(0.2) rotate(-12deg); opacity: 0; }
    60%  { transform: translate(-50%, -50%) scale(1.18) rotate(2deg);  opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1) rotate(0);        opacity: 1; }
}
.effect-seal {
    position: absolute;
    width: 56px; height: 56px;
    pointer-events: none;
    z-index: 80;
    transform-origin: center;
    animation: seal-stamp 320ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.effect-seal__disk {
    width: 100%; height: 100%;
    background: radial-gradient(circle at 35% 30%, #f06a4a, #b53120 70%, #6a1f15 100%);
    border-radius: 50%;
    box-shadow: 0 4px 0 0 rgba(106, 31, 21, 0.6);
    display: grid;
    place-items: center;
    color: #fff4d6;
    font-family: var(--font-game);
    font-size: 18px;
    letter-spacing: 1px;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
}

/* ── Chalk dust — 12 short-lived radial particles ───────────────────── */
@keyframes chalk-dust-puff {
    0%   { transform: translate(0, 0) scale(0.4); opacity: 0.9; }
    100% { transform: translate(var(--dx, 12px), var(--dy, -10px)) scale(0); opacity: 0; }
}
.effect-chalk-dust {
    position: absolute;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #fff4d6;
    pointer-events: none;
    z-index: 70;
    animation: chalk-dust-puff 480ms ease-out forwards;
}

/* ── Chalk write — letter-by-letter typewriter ──────────────────────── */
@keyframes chalk-write-in {
    from { clip-path: inset(0 100% 0 0); }
    to   { clip-path: inset(0 0 0 0); }
}
.effect-chalk-write {
    animation: chalk-write-in 360ms steps(20, end) forwards;
}

/* ── Chalk erase — wipe right-to-left ───────────────────────────────── */
@keyframes chalk-erase-out {
    from { clip-path: inset(0 0 0 0);   opacity: 1; }
    to   { clip-path: inset(0 0 0 100%); opacity: 0; }
}
.effect-chalk-erase {
    animation: chalk-erase-out 320ms ease-in forwards;
}

/* ── Currency float — coin rises 80px and fades over 500 ms ─────────── */
@keyframes coin-float {
    0%   { transform: translate(var(--cx, 0), var(--cy, 0)) scale(1);   opacity: 1; }
    20%  { transform: translate(var(--cx, 0), calc(var(--cy, 0) - 14px)) scale(1.1); opacity: 1; }
    100% { transform: translate(var(--tx, 0), var(--ty, 0)) scale(0.6); opacity: 0; }
}
.effect-coin {
    position: fixed;
    left: 0; top: 0;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #ffe48a, #ffd04a 60%, #b8860b);
    box-shadow: 0 0 6px rgba(255, 208, 74, 0.6);
    pointer-events: none;
    z-index: 90;
    animation: coin-float 540ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

/* ── Page turn — rotateY flip on the list container ─────────────────── */
@keyframes page-turn-flip {
    0%   { transform: perspective(900px) rotateY(0);    opacity: 1; }
    50%  { transform: perspective(900px) rotateY(-90deg); opacity: 0.4; }
    100% { transform: perspective(900px) rotateY(0);    opacity: 1; }
}
.effect-page-turn {
    transform-origin: left center;
    animation: page-turn-flip 380ms ease-in-out;
}

/* ── Postcard slide-in — translateY with overshoot ──────────────────── */
@keyframes postcard-slide-in {
    0%   { transform: translateY(40px) rotate(-2deg); opacity: 0; }
    70%  { transform: translateY(-6px) rotate(0.5deg); opacity: 1; }
    100% { transform: translateY(0)    rotate(0);     opacity: 1; }
}
.effect-postcard-in {
    animation: postcard-slide-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* ── Quill draw — used by stats.js to trace bar chart axis ──────────── */
@keyframes quill-sweep {
    from { transform: translateX(0);   opacity: 1; }
    to   { transform: translateX(100%); opacity: 0; }
}
.effect-quill {
    position: absolute;
    width: 24px; height: 24px;
    pointer-events: none;
    animation: quill-sweep 760ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* ── Candle flame swap — flicker on dark/light toggle ───────────────── */
@keyframes candle-flicker {
    0%, 100% { transform: scaleY(1)   scaleX(1); }
    25%      { transform: scaleY(1.1) scaleX(0.9); }
    50%      { transform: scaleY(0.9) scaleX(1.05); }
    75%      { transform: scaleY(1.05) scaleX(0.95); }
}
.effect-candle-flame { animation: candle-flicker 600ms ease-in-out; transform-origin: center bottom; }

@keyframes candle-puff {
    0%   { transform: translateY(0) scale(0.4); opacity: 0.7; }
    100% { transform: translateY(-18px) scale(1.6); opacity: 0; }
}
.effect-candle-puff {
    position: absolute;
    width: 10px; height: 10px;
    border-radius: 50%;
    background: rgba(220, 220, 220, 0.65);
    pointer-events: none;
    animation: candle-puff 460ms ease-out forwards;
}

/* ── Back-to-isle door icon — tiny press affordance ─────────────────── */
.back-to-isle {
    background: transparent;
    border: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    color: var(--dc-ink);
    font-family: var(--font-game);
    font-size: 11px;
    letter-spacing: 0.5px;
    transition: transform 120ms ease-out;
}
.back-to-isle:hover,
.back-to-isle:focus { transform: translateX(-1px); outline: none; }
.back-to-isle svg { width: 16px; height: 16px; }

/* ── Reduced-motion overrides — every signature collapses to instant ── */
@media (prefers-reduced-motion: reduce) {
    .effect-seal,
    .effect-chalk-dust,
    .effect-chalk-write,
    .effect-chalk-erase,
    .effect-coin,
    .effect-page-turn,
    .effect-postcard-in,
    .effect-quill,
    .effect-candle-flame,
    .effect-candle-puff,
    .back-to-isle { animation: none; transition: none; }
    .effect-seal { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    .effect-postcard-in { opacity: 1; transform: none; }
    .effect-chalk-write { clip-path: none; }
    .effect-coin,
    .effect-chalk-dust,
    .effect-candle-puff { display: none; }
}
```

- [ ] **Step 2: Register the stylesheet in `web/index.html`**

Find the existing `<link rel="stylesheet" href="/css/residents.css?...">` line. Insert a new line directly below it:

```html
<link rel="stylesheet" href="/css/effects.css?v=20260520">
```

Bump every existing `?v=` cache-buster on this same pass to today's date stamp. (Leave any third-party CDN line untouched.)

- [ ] **Step 3: Smoke**

```bash
./start.sh
```

Open http://localhost:5050. DevTools Network tab → confirm `/css/effects.css` returns 200. Console: no parse errors. `./stop.sh`.

- [ ] **Step 4: Commit**

```bash
git add web/css/effects.css web/index.html
git commit -m "$(cat <<'EOF'
effects keyframes for tab signature animations
EOF
)"
```

---

## Task 1 — Effects.js stubs filled

**Files:**
- Modify: `web/js/effects.js`

- [ ] **Step 1: Replace stubs in `web/js/effects.js`**

Open `web/js/effects.js`. Replace the file body (keep the file header comment) with:

```js
/* Effects — reusable visual primitives. SVG-mounted (glowHalo) and
   DOM-mounted (waxSeal, chalkDust, currencyFloat, pageTurn, slamIn). */

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

    // Stamp a wax seal at the given screen point inside `host`. The host
    // must be position: relative or absolute. `text` is the 1-3 char glyph
    // shown on the disk (e.g. 'M' for Mayor, '✓' for save).
    // Auto-removes after 1 s. Returns the seal node.
    waxSeal(host, opts = {}) {
        if (!host) return null;
        const text = opts.text || '✓';
        const x = opts.x != null ? opts.x : host.clientWidth / 2;
        const y = opts.y != null ? opts.y : host.clientHeight / 2;
        const seal = document.createElement('div');
        seal.className = 'effect-seal';
        seal.style.left = `${x}px`;
        seal.style.top = `${y}px`;
        seal.innerHTML = `<div class="effect-seal__disk">${text}</div>`;
        host.appendChild(seal);
        setTimeout(() => seal.remove(), 1000);
        return seal;
    },

    // Burst N chalk-dust particles outward from (x, y) inside host.
    // Particles auto-remove after their keyframe. n defaults to 12.
    chalkDust(host, opts = {}) {
        if (!host) return;
        if (App.prefersReducedMotion()) return;
        const n = opts.n || 12;
        const x = opts.x != null ? opts.x : host.clientWidth / 2;
        const y = opts.y != null ? opts.y : host.clientHeight / 2;
        for (let i = 0; i < n; i++) {
            const p = document.createElement('span');
            p.className = 'effect-chalk-dust';
            p.style.left = `${x}px`;
            p.style.top = `${y}px`;
            const angle = (Math.PI * 2 * i) / n;
            const dist = 18 + Math.random() * 14;
            p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--dy', `${Math.sin(angle) * dist - 8}px`);
            host.appendChild(p);
            setTimeout(() => p.remove(), 600);
        }
    },

    // Float a coin from `fromEl` to `toEl`. Both must be on-screen. The
    // coin is a fixed-position div animated via CSS custom properties.
    // Auto-removes after 600 ms.
    currencyFloat(fromEl, toEl) {
        if (!fromEl || !toEl) return;
        if (App.prefersReducedMotion()) return;
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const startX = a.left + a.width / 2 - 11;
        const startY = a.top + a.height / 2 - 11;
        const endX = b.left + b.width / 2 - 11;
        const endY = b.top + b.height / 2 - 11;

        const coin = document.createElement('div');
        coin.className = 'effect-coin';
        coin.style.setProperty('--cx', `${startX}px`);
        coin.style.setProperty('--cy', `${startY}px`);
        coin.style.setProperty('--tx', `${endX}px`);
        coin.style.setProperty('--ty', `${endY}px`);
        coin.style.transform = `translate(${startX}px, ${startY}px)`;
        document.body.appendChild(coin);
        setTimeout(() => coin.remove(), 600);
    },

    // Apply a page-turn flip class to `el`, removing it after the keyframe.
    // Caller is responsible for swapping content during the flip — pass a
    // mutate fn that runs at the half-flip frame (~190 ms).
    pageTurn(el, mutate) {
        if (!el) return;
        if (App.prefersReducedMotion()) {
            if (typeof mutate === 'function') mutate();
            return;
        }
        el.classList.remove('effect-page-turn');
        // Force reflow so the animation restarts on consecutive calls.
        void el.offsetWidth;
        el.classList.add('effect-page-turn');
        if (typeof mutate === 'function') setTimeout(mutate, 190);
        setTimeout(() => el.classList.remove('effect-page-turn'), 400);
    },

    // Slide an element in (postcard, modal). Adds the keyframe class then
    // removes it. The element should already be in the DOM at final position.
    slamIn(el) {
        if (!el) return;
        if (App.prefersReducedMotion()) return;
        el.classList.remove('effect-postcard-in');
        void el.offsetWidth;
        el.classList.add('effect-postcard-in');
        setTimeout(() => el.classList.remove('effect-postcard-in'), 520);
    },
};

window.Effects = Effects;
```

- [ ] **Step 2: Console smoke**

```bash
./start.sh
```

DevTools console:

```js
// Drop a seal on the body
const host = document.createElement('div');
host.style.cssText = 'position: fixed; inset: 0; pointer-events: none;';
document.body.appendChild(host);
Effects.waxSeal(host, { x: 200, y: 200, text: 'M' });

// Chalk dust
Effects.chalkDust(host, { x: 400, y: 200 });

// Coin float between two visible elements
const a = document.querySelector('.compass-hud') || document.body;
const b = document.querySelector('.hud-top') || document.body;
Effects.currencyFloat(a, b);
```

Expected: each effect visibly appears and removes itself. No DOM leaks (inspect `host` and confirm it empties).

`./stop.sh`.

- [ ] **Step 3: Commit**

```bash
git add web/js/effects.js
git commit -m "$(cat <<'EOF'
effects: implement waxSeal, chalkDust, currencyFloat, pageTurn, slamIn
EOF
)"
```

---

## Task 2 — Back-to-Isle door icon + Esc shortcut

**Files:**
- Modify: `web/js/app.js`

- [ ] **Step 1: Add `App.backToIsleButton()` helper**

Find the location near other helpers in `web/js/app.js` (around `escapeHtml` / `escapeAttr`). Add:

```js
    // Returns markup for the diegetic "back to Isle" door icon. Tabs that
    // render a .page-bar header should include this in their bar.
    backToIsleButton() {
        return `
            <button class="back-to-isle" type="button" onclick="App.showTab('dashboard')" aria-label="Back to the Isle">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                    <rect x="3" y="3" width="10" height="11"/>
                    <path d="M3 3l5-2 5 2"/>
                    <circle cx="11" cy="9" r="0.7" fill="currentColor"/>
                </svg>
                ISLE
            </button>
        `;
    },
```

- [ ] **Step 2: Add Esc keybinding inside the existing `keydown` handler**

Locate the existing keyboard-shortcut block in `web/js/app.js` (near `case '1': this.showTab('dashboard'); break;`). Above the `case '1':` line, add:

```js
                case 'Escape':
                    if (this.currentTab !== 'dashboard') this.showTab('dashboard');
                    break;
```

Confirm the `switch (e.key)` reads from `e.key` (not `e.keyCode`); the existing handler does — `Escape` matches the standard key name.

- [ ] **Step 3: Smoke**

```bash
./start.sh
```

DevTools console: `App.backToIsleButton()` returns a non-empty string. Open any tab, press Esc → routes to dashboard. Press Esc on dashboard → no-op.

`./stop.sh`.

- [ ] **Step 4: Commit**

```bash
git add web/js/app.js
git commit -m "$(cat <<'EOF'
back-to-isle door helper and Esc shortcut
EOF
)"
```

---

## Task 3 — Wire the door into every sub-tab page-bar

**Files:**
- Modify: `web/js/apps.js`, `web/js/stats.js`, `web/js/goals.js`, `web/js/blocker.js`, `web/js/market.js`, `web/js/cards.js`, `web/js/settings.js`

Each module currently renders a header that ends with a heading or filter row. Insert the back-to-isle button as the first child of the page-bar where it exists, or alongside the heading if not.

- [ ] **Step 1: Apps view**

In `web/js/apps.js`, find the `<div class="page-bar">` (or equivalent header — search for the heading "Residents" or "Apps"). Inject `${App.backToIsleButton()}` as its first child. Example pattern, applied to whichever wrapper element holds the title:

```js
            <div class="page-bar">
                ${App.backToIsleButton()}
                <h1 class="page-heading">Residents</h1>
                <!-- existing controls -->
            </div>
```

If no `.page-bar` exists, wrap the existing heading in one.

- [ ] **Step 2: Stats view**

In `web/js/stats.js`, same pattern — insert into the existing top toolbar that holds the DAILY / WEEKLY toggle.

- [ ] **Step 3: Goals view**

In `web/js/goals.js`, the layout is a grid of three sections. Add a new top-level header above the grid:

```js
            <div class="page-bar">
                ${App.backToIsleButton()}
                <h1 class="page-heading">Charter</h1>
            </div>
```

- [ ] **Step 4: Blocker view**

In `web/js/blocker.js`, insert into the heading row (search for "Rule Board" or the heading element).

- [ ] **Step 5: Market view**

In `web/js/market.js`, insert into the existing market header.

- [ ] **Step 6: Cards view**

In `web/js/cards.js`, the existing `.page-bar` already contains the date nav. Add the door as its first child:

```js
                <div class="page-bar">
                    ${App.backToIsleButton()}
                    <h1 class="page-heading">Postcards</h1>
                    <div class="postcard-date-nav"> ... </div>
                </div>
```

- [ ] **Step 7: Settings view**

In `web/js/settings.js`, same — insert into the heading.

- [ ] **Step 8: Smoke**

```bash
./start.sh
```

Click each of the seven non-Isle tabs in turn. Each should show an "ISLE" door button at the top-left of its page-bar. Click → returns to dashboard. Press Esc on each → returns to dashboard.

`./stop.sh`.

- [ ] **Step 9: Commit**

```bash
git add web/js/apps.js web/js/stats.js web/js/goals.js web/js/blocker.js web/js/market.js web/js/cards.js web/js/settings.js
git commit -m "$(cat <<'EOF'
wire back-to-isle door into every sub-tab header
EOF
)"
```

---

## Task 4 — Charter: wax seal on goal save

**Files:**
- Modify: `web/js/goals.js`

The Charter has three save paths: `saveDailyGoal`, `saveAppLimit`, `saveBedtime`. Each closes the modal and calls `Goals.render(...)` after a successful POST. We fire the seal at the moment the modal closes — the seal animates inside the rendered Charter view.

- [ ] **Step 1: Add a `_celebrateSave` helper**

Append to the `Goals` object in `web/js/goals.js`:

```js
    _celebrateSave(content) {
        const host = content.querySelector('.fade-in') || content;
        if (!host) return;
        // Make the host position: relative so the seal positions correctly.
        const prev = host.style.position;
        if (!prev) host.style.position = 'relative';
        Effects.waxSeal(host, {
            x: host.clientWidth / 2,
            y: 80,
            text: '✓',
        });
    },
```

- [ ] **Step 2: Wire into each save path**

Find each `save*` method's success branch. After `await App.api(...)` and before / alongside the existing `App.toast(...)` + `Goals.render(...)` calls, capture the content element and pass it through. Example for `saveDailyGoal`:

```js
    async saveDailyGoal() {
        const minutes = parseInt(document.getElementById('dailyMinutes').value);
        if (!minutes) { App.toast('Enter a goal in minutes', 'warning'); return; }
        try {
            await App.api('/api/goals', {
                method: 'POST',
                body: { type: 'daily_total', target_minutes: minutes },
            });
            document.querySelector('.modal-overlay')?.remove();
            const content = document.getElementById('content');
            await Goals.render(content);
            this._celebrateSave(content);
            App.toast('Goal sealed', 'success');
        } catch (e) {
            App.toast(e.message || 'Failed to save goal', 'error');
        }
    },
```

Apply the same pattern to `saveAppLimit` and `saveBedtime` — capture `content`, render, then `_celebrateSave(content)`.

- [ ] **Step 3: Smoke**

```bash
./start.sh
```

Charter → ISSUE / SET / ADD a goal → confirm a wax seal stamps in at the top of the Charter view, ~320 ms.

`./stop.sh`.

- [ ] **Step 4: Commit**

```bash
git add web/js/goals.js
git commit -m "$(cat <<'EOF'
charter: wax seal stamp on goal save
EOF
)"
```

---

## Task 5 — Rule Board: chalk write/erase + dust

**Files:**
- Modify: `web/js/blocker.js`

`Blocker.addBlock` calls `App.api('/api/blocks', {method: 'POST'})` then `Blocker.render(content)`. The write effect runs on the newly rendered rule entry; we identify it by `data-app-name` (added in this task).

- [ ] **Step 1: Tag rule entries with `data-app-name`**

In `web/js/blocker.js`, find the `ruleEntry` IIFE / template literal. Add `data-app-name="${App.escapeAttr(block.app_name)}"` to the outer `.rule-entry` div:

```js
            return `
                <div class="rule-entry${allow ? ' rule-entry--allow' : ''}" data-app-name="${App.escapeAttr(block.app_name)}">
                    ...
                </div>
            `;
```

- [ ] **Step 2: Add `_celebrateAdd` and `_celebrateRemove` helpers**

Append to the `Blocker` object:

```js
    _celebrateAdd(content, appName) {
        const node = content.querySelector(`.rule-entry[data-app-name="${CSS.escape(appName)}"]`);
        if (!node) return;
        node.classList.add('effect-chalk-write');
        setTimeout(() => node.classList.remove('effect-chalk-write'), 380);

        const rect = node.getBoundingClientRect();
        const host = content.querySelector('.fade-in') || content;
        if (host) {
            const prev = host.style.position;
            if (!prev) host.style.position = 'relative';
            const hostRect = host.getBoundingClientRect();
            Effects.chalkDust(host, {
                x: rect.left - hostRect.left + 24,
                y: rect.top - hostRect.top + rect.height / 2,
            });
        }
    },

    _celebrateRemove(node, after) {
        if (!node) { after(); return; }
        if (App.prefersReducedMotion()) { after(); return; }
        node.classList.add('effect-chalk-erase');
        setTimeout(() => { node.classList.remove('effect-chalk-erase'); after(); }, 320);
    },
```

- [ ] **Step 3: Wire into `addBlock` success**

Find `Blocker.addBlock`. After the existing successful POST + `Blocker.render(...)` call, add:

```js
            const content = document.getElementById('content');
            await Blocker.render(content);
            this._celebrateAdd(content, appName);
```

(`appName` is already in scope inside `addBlock` — confirm the variable name; if it's `app_name` adjust accordingly.)

- [ ] **Step 4: Wire into `removeBlock`**

`removeBlock(appName)` currently fires the API call then re-renders. Wrap the API call so the chalk-erase plays before the row is re-rendered:

```js
    async removeBlock(appName) {
        const content = document.getElementById('content');
        const node = content.querySelector(`.rule-entry[data-app-name="${CSS.escape(appName)}"]`);
        const finish = async () => {
            try {
                await App.api(`/api/blocks/${encodeURIComponent(appName)}`, { method: 'DELETE' });
                await Blocker.render(content);
                App.toast('Rule lifted', 'success');
            } catch (e) {
                App.toast(e.message || 'Failed to remove block', 'error');
            }
        };
        this._celebrateRemove(node, finish);
    },
```

(If the existing `removeBlock` body differs — e.g. uses `App.runAction` — preserve its semantics. The wrap above is the canonical shape.)

- [ ] **Step 5: Smoke**

```bash
./start.sh
```

Rule Board → ADD a block. New entry chalk-writes left-to-right; small dust burst at the leading edge. Click LIFT/REMOVE → entry chalk-erases right-to-left, then disappears on re-render.

`./stop.sh`.

- [ ] **Step 6: Commit**

```bash
git add web/js/blocker.js
git commit -m "$(cat <<'EOF'
rule board: chalk write on add, erase on remove, dust burst
EOF
)"
```

---

## Task 6 — Postcards: slide-in + reused wax seal

**Files:**
- Modify: `web/js/cards.js`

- [ ] **Step 1: Wrap preview in `slamIn`**

In `Cards.showPreview`, after the `preview.innerHTML = ...` assignment, animate the new `.postcard-preview` element and stamp a seal on top:

```js
    showPreview(url) {
        const preview = document.getElementById('cardPreview');
        if (!preview) return;
        const safeUrl = App.escapeAttr(url);
        preview.innerHTML = `
            <div class="postcard-preview">
                <div class="postcard-preview__frame">
                    <img src="${safeUrl}" alt="Island postcard">
                </div>
                <div class="postcard-preview__actions">
                    <a href="${safeUrl}" download="detox-postcard.png" class="pixel-button pixel-button--primary">DOWNLOAD</a>
                    <button class="pixel-button" onclick="Cards.generatedUrl=null; Cards.render(document.getElementById('content'))">STAMP ANOTHER</button>
                </div>
            </div>
        `;
        const card = preview.querySelector('.postcard-preview');
        if (card) {
            // Make the card a positioning context so the seal lands on it.
            const prev = card.style.position;
            if (!prev) card.style.position = 'relative';
            Effects.slamIn(card);
            setTimeout(() => {
                Effects.waxSeal(card, {
                    x: card.clientWidth - 56,
                    y: 56,
                    text: 'D',
                });
            }, 320);
        }
    },
```

- [ ] **Step 2: Smoke**

```bash
./start.sh
```

Postcards → STAMP POSTCARD. Preview slides in with overshoot; ~320 ms later a wax seal stamps onto the top-right corner.

`./stop.sh`.

- [ ] **Step 3: Commit**

```bash
git add web/js/cards.js
git commit -m "$(cat <<'EOF'
postcards: slide-in with stamp slam
EOF
)"
```

---

## Task 7 — Market: coin float to HUD on buy

**Files:**
- Modify: `web/js/market.js`

The Sunlight balance lives in the top HUD; `web/js/hud.js` exposes the element. Find the most stable selector by inspecting `web/index.html` and `web/js/hud.js`. Default fallback: `.hud-top__currency` or `[data-role="sunlight-balance"]`.

- [ ] **Step 1: Identify the HUD currency element**

```bash
grep -n "sunlight\|Sunlight\|currency\|hud-top" /Users/mason/project/detox/web/index.html /Users/mason/project/detox/web/js/hud.js
```

Use whichever element class/id displays the Sunlight balance. For this task assume the selector is `.hud-top__currency` — substitute the actual selector found above.

- [ ] **Step 2: Wire `currencyFloat` into `Market.buy` success branch**

In `web/js/market.js`, locate `Market.buy(itemKey)`. Capture the clicked card before the API call:

```js
    async buy(itemKey) {
        const card = document.querySelector(`.market-item[data-item-key="${CSS.escape(itemKey)}"]`);
        try {
            await App.api('/api/market/buy', {
                method: 'POST',
                body: { item_key: itemKey },
            });
            const hud = document.querySelector('.hud-top__currency') || document.querySelector('.hud-top');
            if (card && hud) Effects.currencyFloat(card, hud);
            App.toast('Market purchase added to inventory', 'success');
            await Market.render(document.getElementById('content'));
        } catch (e) {
            // existing error mapping unchanged
            // ...
        }
    },
```

- [ ] **Step 3: Tag market items with `data-item-key`**

In the same file, find the `<div class="market-item">` template (or whatever class the buy-able card uses). Add `data-item-key="${App.escapeAttr(item.key)}"` to the outer element so the selector in step 2 resolves.

- [ ] **Step 4: Smoke**

```bash
./start.sh
```

Market → buy a stall item with sufficient Sunlight. A coin animates from the item card up to the HUD currency badge over ~540 ms.

`./stop.sh`.

- [ ] **Step 5: Commit**

```bash
git add web/js/market.js
git commit -m "$(cat <<'EOF'
market: coin clink and item-to-HUD float on buy
EOF
)"
```

---

## Task 8 — Registry: parchment page-turn between filter views

**Files:**
- Modify: `web/js/apps.js`

`Apps.filterApps(query)` filters the in-memory list and rewrites the `<ul>` (or `<ol>`) container. We wrap that swap in `Effects.pageTurn`, mutating the DOM at the half-flip frame so the user sees a parchment turn rather than a flicker.

- [ ] **Step 1: Identify the list container**

In `web/js/apps.js`, locate `Apps.filterApps`. The current implementation calls `list.innerHTML = this.renderAppList(apps)` where `list` is a fixed selector. Confirm that selector and reuse it.

- [ ] **Step 2: Wrap the swap in `pageTurn`**

```js
    async filterApps(query) {
        this.searchQuery = query;
        const list = document.querySelector('[data-role="app-list"]') || document.querySelector('.resident-list');
        if (!list) return;
        const apps = await App.api('/api/apps');
        Effects.pageTurn(list, () => {
            list.innerHTML = this.renderAppList(apps);
        });
    },
```

If the existing `filterApps` already caches the apps array, prefer that to skip the network round-trip. The shape — `Effects.pageTurn(el, mutate)` — stays the same.

- [ ] **Step 3: Confirm the list element has `data-role="app-list"`**

In the `render` method's template, ensure the list element has `data-role="app-list"`. If it's currently `<ul class="resident-list">`, add the attribute:

```js
                <ul class="resident-list" data-role="app-list">
                    ${this.renderAppList(apps)}
                </ul>
```

- [ ] **Step 4: Smoke**

```bash
./start.sh
```

Registry → type into the search box. Each keystroke triggers a 380 ms page-turn flip on the list. Reduced motion → instant swap, no flip.

`./stop.sh`.

- [ ] **Step 5: Commit**

```bash
git add web/js/apps.js
git commit -m "$(cat <<'EOF'
registry: parchment page-turn between filter views
EOF
)"
```

---

## Task 9 — Chronicle: quill draws bar chart

**Files:**
- Modify: `web/js/stats.js`

Chart.js already animates the bars via its built-in animation API. The signature here is the *quill* — a small SVG quill that traces along the chart's x-axis as the bars animate in.

- [ ] **Step 1: Add a quill SVG over the chart canvas**

In `web/js/stats.js`, find `renderWeeklyChart`. The chart is mounted into a `<canvas>`; we need a sibling positioned-absolute SVG that lives inside the same chart wrapper. Update the chart-mount markup in `renderWeekly`:

```js
    renderWeekly(weekly) {
        setTimeout(() => this.renderWeeklyChart(weekly), 0);
        return `
            <div class="chronicle-chart" style="position: relative;">
                <canvas id="weeklyChart"></canvas>
                <span class="effect-quill" data-role="quill" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#2a1e2a" stroke-width="1.5" stroke-linecap="round">
                        <path d="M4 20l8-8 5-1 4-7-7 4-1 5-8 8z"/>
                        <path d="M14 10l1 1"/>
                    </svg>
                </span>
            </div>
        `;
    },
```

(The wrapping markup already exists; add the quill `<span>` and the inline `position: relative`.)

- [ ] **Step 2: Trigger the quill on chart render**

`renderWeeklyChart` runs ~0 ms after `renderWeekly`. Inside it, after `new Chart(...)`:

```js
    renderWeeklyChart(weekly) {
        const ctx = document.getElementById('weeklyChart');
        if (!ctx) return;
        new Chart(ctx, {
            // existing config unchanged
        });
        const quill = document.querySelector('[data-role="quill"]');
        if (quill && !App.prefersReducedMotion()) {
            quill.style.animation = 'none';
            void quill.offsetWidth;
            quill.style.animation = '';
        }
    },
```

The `effect-quill` class already binds the keyframe; the reset above re-arms it on subsequent re-renders.

- [ ] **Step 3: Smoke**

```bash
./start.sh
```

Chronicle → WEEKLY toggle. The quill should sweep left-to-right across the chart over ~760 ms in sync with the bars animating in. Reduced motion → quill hidden; bars instant.

`./stop.sh`.

- [ ] **Step 4: Commit**

```bash
git add web/js/stats.js
git commit -m "$(cat <<'EOF'
chronicle: quill sweep over the bar chart on render
EOF
)"
```

---

## Task 10 — Mayor Study: candle flame swap on dark mode toggle

**Files:**
- Modify: `web/js/settings.js`, `web/js/app.js`

`App.toggleDarkMode` already flips the theme. We add a candle next to the toggle that flickers on switch, with a smoke puff when going dark.

- [ ] **Step 1: Add a candle SVG to the dark-mode setting row**

In `web/js/settings.js`, find the row containing the dark-mode toggle. Add a sibling element:

```js
                <div class="settings-row">
                    <span class="settings-row__label">Mayor's lantern</span>
                    <span class="settings-row__candle" data-role="candle">
                        <svg viewBox="0 0 16 24" width="16" height="24" aria-hidden="true">
                            <rect x="6" y="10" width="4" height="12" fill="#c4a47a" stroke="#2a1e2a" stroke-width="1"/>
                            <path data-role="flame" d="M8 10c-2-2-2-5 0-7 2 2 2 5 0 7z" fill="#ffd04a" stroke="#b8860b" stroke-width="0.5" class="effect-candle-flame"/>
                        </svg>
                    </span>
                    <label class="settings-row__toggle">
                        <input type="checkbox" ${isDark ? 'checked' : ''} onchange="App.toggleDarkMode()">
                        <span>${isDark ? 'Dark' : 'Light'}</span>
                    </label>
                </div>
```

(Match the existing `.settings-row` markup — adapt classnames if the file uses different ones. The minimum is: a `[data-role="candle"]` host containing a `[data-role="flame"]` SVG path.)

- [ ] **Step 2: Augment `App.toggleDarkMode` to fire the candle effect**

In `web/js/app.js`, find `toggleDarkMode()`. Append after the existing theme-flip body:

```js
        const candle = document.querySelector('[data-role="candle"]');
        if (!candle) return;
        const flame = candle.querySelector('[data-role="flame"]');
        if (!flame || this.prefersReducedMotion()) return;

        // Restart the flicker keyframe.
        flame.classList.remove('effect-candle-flame');
        void flame.getBoundingClientRect();
        flame.classList.add('effect-candle-flame');

        // Smoke puff when transitioning to dark.
        if (document.body.classList.contains('theme-dark')) {
            const puff = document.createElement('span');
            puff.className = 'effect-candle-puff';
            const rect = candle.getBoundingClientRect();
            puff.style.position = 'fixed';
            puff.style.left = `${rect.left + rect.width / 2 - 5}px`;
            puff.style.top = `${rect.top + 4}px`;
            document.body.appendChild(puff);
            setTimeout(() => puff.remove(), 500);
        }
```

(Use whichever class name the project uses for the dark theme — `theme-dark`, `is-dark`, `dark-mode`. Confirm by grepping `body.classList` or `document.documentElement.dataset` in `app.js`.)

- [ ] **Step 3: Smoke**

```bash
./start.sh
```

Settings → toggle the dark-mode switch. Flame flickers ~600 ms; on the dark transition, a small smoke puff rises above the candle. Reduced motion → no flicker, no puff.

`./stop.sh`.

- [ ] **Step 4: Commit**

```bash
git add web/js/settings.js web/js/app.js
git commit -m "$(cat <<'EOF'
study: candle flame flicker on dark mode toggle
EOF
)"
```

---

## Task 11 — Reduced-motion + responsive sweep

No new code by default. Verification with fix-on-find.

- [ ] **Step 1: Reduced-motion sweep**

```bash
./start.sh
```

DevTools → Rendering → "Emulate prefers-reduced-motion: reduce". Walk every signature:

- Charter save → seal appears instantly, no rotate/scale.
- Rule Board add → entry appears instantly; no chalk dust.
- Rule Board remove → entry disappears with the row removal, no erase wipe.
- Postcards stamp → preview appears instantly, no slide; seal still present (instant pose).
- Market buy → no coin float; toast still fires.
- Registry filter → instant list swap, no flip.
- Chronicle render → quill hidden, bars instant.
- Study toggle → no flicker, no puff.
- Back-to-isle door → no transform on hover.

Any animation that still runs is a bug — track it down to the missing `prefers-reduced-motion` gate and fix.

- [ ] **Step 2: Responsive sweep at 360 / 760 / 1200 px**

At each breakpoint:

- Door icon visible and not overlapping the heading.
- Wax seal does not exceed parent bounds (Charter, Postcards).
- Coin float hits the HUD even when it has scrolled.
- Page-turn flip does not bleed past the viewport.

Fix: tighten seal/coin offsets relative to host width, not absolute.

- [ ] **Step 3: Esc shortcut sanity**

From every sub-tab, press Esc. Should land on dashboard. From dashboard, Esc is a no-op.

- [ ] **Step 4: Commit (only if files changed)**

```bash
git add -A web/css web/js
git commit -m "$(cat <<'EOF'
reduced-motion and responsive fixups for tab signatures
EOF
)"
```

If no fixes needed, skip this commit.

---

## Self-review

Spec coverage (`docs/specs/2026-05-02-phase-1efg-immersive-redesign-design.md` §8 motion catalogue + §7.2 back-to-isle):

- Registry parchment page-turn (§8): Task 8.
- Chronicle quill draws (§8): Task 9.
- Charter wax seal (§8): Task 4.
- Rule Board chalk write/erase (§8): Task 5.
- Market coin clink + float (§8): Task 7.
- Postcards slide + stamp (§8): Task 6.
- Study candle flame swap (§8): Task 10.
- Reusable `effects.js` primitives (§8 "Reused primitives"): Tasks 0 + 1.
- Reduced-motion gates for every animation (§8 "Reduced motion"): Tasks 0 + 11.
- Back-to-Isle door icon in sub-tab headers (§7.2): Tasks 2 + 3.
- Esc to Isle (implicit in §7.2 "equivalent to the Esc key"): Task 2.

Spec amendments: none. Phase 1e already amended §3.1, §4, §4.1.

Surface: 1 new CSS file (~140 LOC), 1 modified JS module owning effects (~110 LOC delta), 7 modified tab modules (~10–25 LOC each). No new files in `web/js/`. No backend touch. No schema change. No Python deps added.

Suggested commit cadence (matching spec §9.3):
- `effects: keyframes for tab signature animations`
- `effects: implement waxSeal, chalkDust, currencyFloat, pageTurn, slamIn`
- `back-to-isle door helper and Esc shortcut`
- `wire back-to-isle door into every sub-tab header`
- `charter: wax seal stamp on goal save`
- `rule board: chalk write on add, erase on remove, dust burst`
- `postcards: slide-in with stamp slam`
- `market: coin clink and item-to-HUD float on buy`
- `registry: parchment page-turn between filter views`
- `chronicle: quill sweep over the bar chart on render`
- `study: candle flame flicker on dark mode toggle`
- `reduced-motion and responsive fixups for tab signatures` (if needed)
