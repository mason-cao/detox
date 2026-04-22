# Phase 1c — Rule Board, Postcards, Mayor's Study Reskin

**Goal:** Bring the Dawn Cove visual language into the three remaining legacy tabs (Blocker → Rule Board, Share → Postcards, Settings → Mayor's Study), wire up a Market placeholder slot, then prune the legacy `style.css` blocks that no tab still depends on.

**Architecture:** Extend `web/css/views.css` with three new per-view sections. Rewrite each tab module's `render()` template and its modals to emit pixel-UI markup (`pixel-panel`, `pixel-button`, `pixel-chip`, `.pixel-modal`, and the `.page-heading` / `.page-bar` primitives already shipped in Phase 1b). Preserve all data-layer behavior — no route changes, no schema changes.

**Tech stack:** Vanilla HTML/CSS/JS. No build step. Chart.js already loaded. Press Start 2P / VT323 / Inter already loaded.

**Non-goals (deferred to later plans):**

- **The Market** — the reward economy (Sunlight/Starshard balances, purchases, daily cap, Market catalog) needs its own DB schema and Python routes. Scoped to a separate plan (tentatively "Phase 1d — Market + Rewards Ledger"). This plan ships a placeholder tab that renders "Coming soon — the economy is being built." No data, no buttons.
- **Wax-seal decrees, ration hourglass, sheriff/gate animations, portrait illustrations** — bespoke pixel-art assets.
- **`category_blocks` schema migration** — removing the `__category__{Name}` hack is spec §8 follow-up, not part of the visual reskin.

---

## File structure

- **Modify:** `web/index.html` — give the Market tab button its own `data-tab="market"`, bump cache busters.
- **Modify:** `web/css/views.css` — append new sections for Rule Board, Postcards, Mayor's Study.
- **Modify:** `web/css/style.css` — end-of-Plan-1c prune: delete the legacy blocks no tab references anymore.
- **Modify:** `web/js/blocker.js` — reskin render + both modals to pixel-UI.
- **Modify:** `web/js/cards.js` — reskin render + preview.
- **Modify:** `web/js/settings.js` — reskin render + Categorize App modal.
- **Create:** `web/js/market.js` — thin placeholder module; same shape as other view modules so the router can resolve it.
- **Modify:** `web/js/app.js` — register `Market` in the view map (wherever dashboard/apps/stats/etc. are registered).

---

## Task 1 — Market placeholder + tab wiring

**Files:**

- Modify: `web/index.html`
- Create: `web/js/market.js`
- Modify: `web/js/app.js`

**Steps:**

1. Open `web/index.html`. Find the tab-rail block. Change the Market button so its own tab id is `market` (it currently collides with Postcards):

```html
<button class="tab-rail__item" data-tab="market"><span class="tab-rail__glyph">🏪</span>Market</button>
```

   Leave the Postcards button (`data-tab="cards"`) as-is. Bump the CSS/JS cache busters on the edited file to `v=20260419`.

2. Create `web/js/market.js` with a minimal module that matches the shape the router expects (`async render(container) { ... }`):

```js
/* ── The Market (placeholder — economy lands in Phase 1d) ─────────── */

const Market = {
    async render(container) {
        destroyCharts();
        container.innerHTML = `
            <div class="fade-in">
                <h1 class="page-heading">The Market</h1>
                <div class="market-placeholder">
                    <div class="market-placeholder__seal">🏪</div>
                    <div class="market-placeholder__title">THE STALLS ARE CLOSED</div>
                    <div class="market-placeholder__body">
                        The mayor is still building the economy.<br>
                        Return when Sunlight can be earned and spent.
                    </div>
                </div>
            </div>
        `;
    },
};
```

3. Open `web/js/app.js`. Find the view map (the switch or object that maps tab id → module). Add `market: Market` alongside the existing entries. If `<script src="/js/market.js">` is not already in `index.html`, add it next to the other per-view scripts.

4. Add `.market-placeholder` styles to `web/css/views.css`:

```css
/* ── Market (placeholder) ────────────────────────────────────────────── */
.market-placeholder {
    padding: var(--sp-8) var(--sp-4);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    text-align: center;
}
.market-placeholder__seal {
    font-size: 64px;
    line-height: 1;
    margin-bottom: var(--sp-4);
}
.market-placeholder__title {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink);
    letter-spacing: 1px;
    margin-bottom: var(--sp-3);
}
.market-placeholder__body {
    font-family: var(--font-game);
    font-size: var(--fs-lg);
    color: var(--dc-ink-soft);
    line-height: 1.5;
}
```

5. Smoke: `./start.sh`, Cmd+Shift+R, click the Market tab. Expect the closed-stalls placeholder. Click Postcards — should still render the existing cards view (no routing collision). `./stop.sh`.

6. Commit:

```
git add web/index.html web/js/market.js web/js/app.js web/css/views.css
git commit -m "add Market placeholder tab + stall-closed view"
```

---

## Task 2 — Rule Board: list + category grid

**Files:**

- Modify: `web/js/blocker.js`
- Modify: `web/css/views.css`

**Steps:**

1. Append a Rule Board section to `web/css/views.css`:

```css
/* ── Rule Board ─────────────────────────────────────────────────────── */
.rule-board__copy {
    font-family: var(--font-game);
    font-size: var(--fs-lg);
    color: var(--dc-ink-soft);
    margin: 0 0 var(--sp-3) 0;
}

.lockdown-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    background: var(--dc-danger);
    color: #fff;
    box-shadow: 0 0 0 2px var(--dc-ink);
    margin-bottom: var(--sp-4);
}
.lockdown-banner__title {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    letter-spacing: 0.5px;
}
.lockdown-banner__detail {
    font-family: var(--font-game);
    font-size: var(--fs-md);
    margin-top: 2px;
    opacity: 0.9;
}

.rule-toggle-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    margin-bottom: var(--sp-5);
}
.rule-toggle-panel__title {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink);
    letter-spacing: 0.5px;
}
.rule-toggle-panel__detail {
    font-family: var(--font-game);
    font-size: var(--fs-md);
    color: var(--dc-ink-soft);
    margin-top: 2px;
}

.rule-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    margin-bottom: var(--sp-5);
}
.rule-entry {
    display: grid;
    grid-template-columns: 36px 1fr auto;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
}
.rule-entry__portrait {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 12px;
    color: #fff;
    box-shadow: 0 0 0 2px var(--dc-ink);
}
.rule-entry--allow .rule-entry__portrait { background: var(--dc-ok); }
.rule-entry__name {
    font-family: var(--font-ui);
    font-weight: 600;
    color: var(--dc-ink);
    font-size: var(--fs-md);
}
.rule-entry__detail {
    font-family: var(--font-game);
    font-size: var(--fs-md);
    color: var(--dc-ink-soft);
    margin-top: 2px;
}
.rule-empty {
    padding: var(--sp-5);
    text-align: center;
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    font-family: var(--font-game);
    font-size: var(--fs-md);
    color: var(--dc-ink-soft);
    margin-bottom: var(--sp-5);
}

.category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
}
.category-tile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-3);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    cursor: pointer;
    font-family: var(--font-ui);
}
.category-tile:hover { background: var(--dc-noon); }
.category-tile--blocked { background: var(--dc-dusk); color: #fff; }
.category-tile--blocked:hover { background: var(--dc-danger); }
.category-tile__name {
    font-family: var(--font-display);
    font-size: 11px;
    letter-spacing: 0.5px;
}
.category-tile__state {
    font-family: var(--font-game);
    font-size: var(--fs-md);
    margin-top: 2px;
    opacity: 0.85;
}
.category-tile__dot {
    width: 12px;
    height: 12px;
    box-shadow: 0 0 0 2px var(--dc-ink);
}
.category-tile--blocked .category-tile__dot { background: var(--dc-ink); }
.category-tile:not(.category-tile--blocked) .category-tile__dot { background: var(--dc-ok); }

.rule-board__toggle {
    display: inline-block;
    width: 44px;
    height: 24px;
    background: var(--dc-sand);
    box-shadow: inset 0 0 0 2px var(--dc-ink);
    position: relative;
    cursor: pointer;
    vertical-align: middle;
}
.rule-board__toggle input { display: none; }
.rule-board__toggle::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: var(--dc-ink);
    transition: left 140ms steps(4);
}
.rule-board__toggle input:checked + .rule-board__knob,
.rule-board__toggle:has(input:checked)::after { left: 22px; background: var(--dc-danger); }
```

2. Rewrite `Blocker.render` in `web/js/blocker.js` to emit:

   - `<h1 class="page-heading">The Rule Board</h1>`
   - if `whitelistMode`: a `.lockdown-banner` with title "FULL LOCKDOWN" + detail "Non-whitelisted residents are being escorted home." + a `pixel-button pixel-button--danger` labeled "EXIT" calling `App.runAction(() => App.exitFocusMode())`.
   - a `.rule-toggle-panel` with title "FULL LOCKDOWN", detail "Close every resident except whitelisted ones.", and a `<label class="rule-board__toggle"><input type="checkbox" ...></label>` that calls `Blocker.toggleWhitelist(event.target.checked)`.
   - A `.charter-section__header` reused from Phase 1b for "BLOCKED RESIDENTS" with an ADD `pixel-button pixel-button--primary` → `Blocker.addBlock()`. Follow with `<p class="rule-board__copy">These residents are sent home on sight.</p>`.
   - A `.rule-list` containing one `.rule-entry` per entry in `blockedApps`, each with `.rule-entry__portrait` (styled `background: ${App.appColor(b.app_name)}`), `.rule-entry__name` + `.rule-entry__detail` (time-limit or "Always banished"), and a `pixel-button pixel-button--danger` "LIFT" → `Blocker.removeBlock(...)`. Empty state → `.rule-empty`.
   - A second `.charter-section__header` for "WHITELISTED RESIDENTS" with an ADD button → `Blocker.addWhitelist()`. Copy: "These residents are always allowed, even in lockdown." Render `whitelisted` in a `.rule-list` with `.rule-entry.rule-entry--allow` rows and a "REMOVE" danger button. Empty state → `.rule-empty` copy.
   - A third `.charter-section__header` for "CATEGORY DECREES" (no button). Copy: "Block every resident in a category at once." Followed by a `.category-grid` with one `.category-tile` per `categoryNames` entry, toggling `.category-tile--blocked` based on `isBlocked`. Click still calls `Blocker.toggleCategory(cat, !isBlocked)`. Inside each tile: `<div>` wrapping `.category-tile__name` + `.category-tile__state` ("BLOCKED" / "ALLOWED"), plus `.category-tile__dot`.

3. Leave the handlers (`toggleWhitelist`, `addBlock`, `saveBlock`, `addWhitelist`, `saveWhitelist`, `removeBlock`, `toggleCategory`) untouched for this task — only the render template changes. Update the success-toast copy inside them to match the new language: `${category} residents banished` / `${category} residents pardoned` in `toggleCategory`; `${appName} banished` / `${appName} added to whitelist` in save handlers. These are optional polish; prioritize the render first.

4. Smoke: reload, click Rule Board, verify the list renders, FULL LOCKDOWN banner appears when you flip the toggle, category tiles toggle red on click, no console errors.

5. Commit:

```
git add web/js/blocker.js web/css/views.css
git commit -m "reskin blocker as rule board: list + category tiles"
```

---

## Task 3 — Rule Board modals

**Files:**

- Modify: `web/js/blocker.js`

**Steps:**

1. Rewrite `Blocker.addBlock` to use `.pixel-modal` primitives (identical structure to Phase 1b's goal modals):

```js
async addBlock(prefillAppName = '') {
    const appNames = await App.getAppSuggestions();
    App.openModal(`
        <div class="pixel-modal">
            <h2 class="pixel-modal__title">BANISH A RESIDENT</h2>
            <div class="pixel-modal__group">
                <label class="pixel-modal__label">RESIDENT</label>
                <input class="pixel-modal__input" type="text" id="blockAppName" list="blockAppOptions" placeholder="choose or type an app" value="${App.escapeAttr(prefillAppName)}">
                ${App.appDatalist('blockAppOptions', appNames)}
            </div>
            <div class="pixel-modal__group">
                <label class="pixel-modal__label">DECREE</label>
                <select class="pixel-modal__input" id="blockType" onchange="document.getElementById('limitFields').style.display = this.value === 'limit' ? 'grid' : 'none'">
                    <option value="always">Always banished</option>
                    <option value="limit">After time limit</option>
                </select>
            </div>
            <div class="pixel-modal__row" id="limitFields" style="display: none;">
                <div class="pixel-modal__group">
                    <label class="pixel-modal__label">HOURS</label>
                    <input class="pixel-modal__input" type="number" id="blockHours" min="0" max="23" value="1">
                </div>
                <div class="pixel-modal__group">
                    <label class="pixel-modal__label">MINUTES</label>
                    <input class="pixel-modal__input" type="number" id="blockMinutes" min="0" max="59" value="0">
                </div>
            </div>
            <div class="pixel-modal__actions">
                <button class="pixel-button" onclick="this.closest('.modal-overlay').remove()">CANCEL</button>
                <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => Blocker.saveBlock())">BANISH</button>
            </div>
        </div>
    `, '#blockAppName');
},
```

2. Rewrite `Blocker.addWhitelist` in the same style — title "WHITELIST A RESIDENT", single RESIDENT group, action buttons CANCEL + primary "ALLOW" → `Blocker.saveWhitelist()`.

3. `saveBlock` / `saveWhitelist` keep their existing logic untouched — they already close the `.modal-overlay` and fire toasts. Only the markup changes.

4. Smoke: open each modal, confirm pixel styling, type an app name, save. Confirm the Rule Board refreshes with the new entry. `./stop.sh`.

5. Commit:

```
git add web/js/blocker.js
git commit -m "reskin rule board modals with pixel-modal primitives"
```

---

## Task 4 — Postcards reskin

**Files:**

- Modify: `web/js/cards.js`
- Modify: `web/css/views.css`

**Steps:**

1. Append a Postcards section to `web/css/views.css`:

```css
/* ── Postcards (share cards) ─────────────────────────────────────────── */
.postcard-intro {
    padding: var(--sp-5);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    text-align: center;
    margin-bottom: var(--sp-4);
}
.postcard-intro__copy {
    font-family: var(--font-game);
    font-size: var(--fs-lg);
    color: var(--dc-ink);
    margin-bottom: var(--sp-4);
    line-height: 1.4;
}
.postcard-date-nav {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-family: var(--font-game);
    font-size: var(--fs-lg);
    color: var(--dc-ink);
}

.postcard-preview {
    padding: var(--sp-5);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    text-align: center;
}
.postcard-preview__frame {
    display: inline-block;
    padding: var(--sp-2);
    background: var(--dc-sand);
    box-shadow: 0 0 0 3px var(--dc-ink);
    margin-bottom: var(--sp-4);
}
.postcard-preview__frame img {
    display: block;
    max-width: 100%;
    max-height: 60vh;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
}
.postcard-preview__actions {
    display: flex;
    justify-content: center;
    gap: var(--sp-3);
    flex-wrap: wrap;
}
```

2. Rewrite `Cards.render` in `web/js/cards.js` to emit:

   - `.page-bar` containing `<h1 class="page-heading">Postcards</h1>` and a `.postcard-date-nav` with two `pixel-button` prev/next (`onclick="App.prevDate()"` / `App.nextDate()`) framing `<span>${App.formatDate(date)}</span>`.
   - `.postcard-intro` with `.postcard-intro__copy` — copy: "Stamp a postcard for today's island and send it to a friend. No one sees your data but you." — followed by a `pixel-button pixel-button--primary` id `generateBtn` calling `Cards.generate('${date}')`. Button label "STAMP POSTCARD".
   - `<div id="cardPreview"></div>` underneath (no inline style).

3. Rewrite `Cards.showPreview(url)` to render into `#cardPreview`:

```html
<div class="postcard-preview">
    <div class="postcard-preview__frame">
        <img src="${safeUrl}" alt="Island postcard">
    </div>
    <div class="postcard-preview__actions">
        <a href="${safeUrl}" download="detox-postcard.png" class="pixel-button pixel-button--primary">DOWNLOAD</a>
        <button class="pixel-button" onclick="Cards.generatedUrl=null; Cards.render(document.getElementById('content'))">STAMP ANOTHER</button>
    </div>
</div>
```

4. `Cards.generate` stays the same; only the button label it flips to during loading changes: set `btn.textContent = 'STAMPING…'` on entry and `btn.textContent = 'ERROR — TRY AGAIN'` on failure. Keep `btn.disabled` logic.

5. Smoke: open Postcards, click STAMP POSTCARD, confirm image loads in the pixel frame, DOWNLOAD works, STAMP ANOTHER resets the view.

6. Commit:

```
git add web/js/cards.js web/css/views.css
git commit -m "reskin share as postcards with pixel frame"
```

---

## Task 5 — Mayor's Study: main panel

**Files:**

- Modify: `web/js/settings.js`
- Modify: `web/css/views.css`

**Steps:**

1. Append a Study section to `web/css/views.css`:

```css
/* ── Mayor's Study (settings) ────────────────────────────────────────── */
.study-section {
    margin-bottom: var(--sp-6);
}
.study-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    margin-bottom: var(--sp-3);
    flex-wrap: wrap;
}
.study-section__title {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink);
    letter-spacing: 0.5px;
    margin: 0;
}

.study-panel {
    padding: var(--sp-4);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
}

.study-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    flex-wrap: wrap;
}
.study-row__label {
    font-family: var(--font-display);
    font-size: 11px;
    color: var(--dc-ink);
    letter-spacing: 0.5px;
}
.study-row__detail {
    font-family: var(--font-game);
    font-size: var(--fs-md);
    color: var(--dc-ink-soft);
    margin-top: 2px;
}

.study-form {
    display: flex;
    gap: var(--sp-3);
    align-items: flex-end;
    flex-wrap: wrap;
    margin-top: var(--sp-3);
}
.study-form .pixel-modal__group { flex: 1 1 140px; margin-bottom: 0; }

.kbd-scroll {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--sp-2);
}
.kbd-scroll__row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    color: var(--dc-ink);
}
.kbd-scroll__keys {
    display: inline-flex;
    gap: 2px;
}
.kbd-scroll__key {
    display: inline-block;
    min-width: 22px;
    padding: 1px 6px;
    background: var(--dc-sand);
    color: var(--dc-ink);
    font-family: var(--font-display);
    font-size: 10px;
    text-align: center;
    box-shadow: 0 0 0 2px var(--dc-ink);
    letter-spacing: 0.5px;
}

.category-catalog {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--sp-3);
}
.category-card {
    padding: var(--sp-3);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
}
.category-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sp-2);
}
.category-card__name {
    font-family: var(--font-display);
    font-size: 11px;
    letter-spacing: 0.5px;
}
.category-card__count {
    font-family: var(--font-game);
    font-size: var(--fs-md);
    color: var(--dc-ink-soft);
}
.category-card__apps {
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    color: var(--dc-ink-soft);
    line-height: 1.6;
}

.about-study {
    padding: var(--sp-5);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    text-align: center;
}
.about-study__sigil {
    font-size: 48px;
    line-height: 1;
    margin-bottom: var(--sp-3);
}
.about-study__title {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink);
    letter-spacing: 1px;
    margin-bottom: var(--sp-2);
}
.about-study__copy {
    font-family: var(--font-game);
    font-size: var(--fs-md);
    color: var(--dc-ink-soft);
    line-height: 1.5;
}
```

2. Rewrite `Settings.render` to produce the new structure. Replace the entire existing template with:

   - `<h1 class="page-heading">The Mayor's Study</h1>`
   - **Appearance** `.study-section`: header "APPEARANCE", one `.study-panel` containing a `.study-row` with a left block (label "CANDLELIGHT", detail "Switch between dawn and midnight palettes.") and a right-side `.rule-board__toggle` checkbox bound to `App.toggleDarkMode()`.
   - **Tracking** `.study-section`: header "TRACKING", `.study-panel` with a label row ("IDLE DETECTION" + detail "Stop counting screen time after no keyboard or pointer activity.") then a `.study-form` containing a `.pixel-modal__group` (label "IDLE TIMEOUT (min)", input `id="idleTimeoutMinutes"`) and a `pixel-button pixel-button--primary` "SAVE" → `Settings.saveIdleTimeout()`. Below the form, a small hint row `<div class="study-row__detail">Use 0 minutes to disable idle detection.</div>`.
   - **Data Export** `.study-section`: header "DATA EXPORT", `.study-panel` with label row ("EXPORT YOUR DATA" + detail "Download a CSV or JSON dump of your sessions."), then a `.study-form` with two `.pixel-modal__group` (START DATE / END DATE inputs `type="date"` ids `exportStart` / `exportEnd`) and two `pixel-button` actions "EXPORT CSV" (primary) / "EXPORT JSON" (default) wired to `Settings.exportData('csv'|'json')`.
   - **App Categories** `.study-section`: `.study-section__header` with title "CATEGORIES" and a `pixel-button pixel-button--primary` "CATEGORIZE" → `Settings.addCategory()`. Copy line `<p class="rule-board__copy">Assign residents to categories for decrees and the Chronicle breakdown.</p>`. Then a `.category-catalog` grid where each category becomes a `.category-card` (header: `.category-card__name` in `${App.categoryColor(cat)}` and `.category-card__count` "N apps"; body: `.category-card__apps` with `apps.slice(0, 8).join(', ')` + overflow suffix).
   - **Keyboard Shortcuts** `.study-section`: header "SHORTCUTS", then a `.kbd-scroll` grid. Each row is a `.kbd-scroll__row` with `.kbd-scroll__keys` wrapping `.kbd-scroll__key` boxes followed by a plain description span. Keep the same five entries: ←/→ "Navigate dates", D "Toggle candlelight", / "Search residents", 1–8 "Switch tabs" (update from 1-7 now that there are 8 tabs), Esc "Close modals".
   - **About** `.study-section`: header "ABOUT", `.about-study` panel with sigil `🏛`, title "DETOX ISLE", copy lines "A private screen-time tracker for macOS." + "Monitor polls every 2 seconds. Data stays on this Mac.".

3. Leave `saveIdleTimeout`, `exportData`, `addCategory`, `saveCategory` handlers untouched for this task. Only the render template changes.

4. Smoke: reload, click Study. Every section should render in parchment panels with pixel fonts. Toggle dark mode from within the panel — palette flips. Idle save still persists. Export CSV/JSON still triggers download.

5. Commit:

```
git add web/js/settings.js web/css/views.css
git commit -m "reskin settings as mayor's study with parchment panels"
```

---

## Task 6 — Mayor's Study: Categorize App modal

**Files:**

- Modify: `web/js/settings.js`

**Steps:**

1. Rewrite `Settings.addCategory` to use `.pixel-modal`:

```js
async addCategory(prefillAppName = '') {
    const [appNames, categories] = await Promise.all([
        App.getAppSuggestions(),
        App.api('/api/categories'),
    ]);
    const categoryOptions = [...new Set([
        'Productivity',
        'Communication',
        'Social',
        'Entertainment',
        'Utilities',
        ...categories.map(c => c.category),
    ])];
    const existing = categories.find(c => c.app_name === prefillAppName);
    const selectedCategory = existing ? existing.category : 'Productivity';

    App.openModal(`
        <div class="pixel-modal">
            <h2 class="pixel-modal__title">CATEGORIZE RESIDENT</h2>
            <div class="pixel-modal__group">
                <label class="pixel-modal__label">RESIDENT</label>
                <input class="pixel-modal__input" type="text" id="catAppName" list="categoryAppOptions" placeholder="choose or type an app" value="${App.escapeAttr(prefillAppName)}">
                ${App.appDatalist('categoryAppOptions', appNames)}
            </div>
            <div class="pixel-modal__group">
                <label class="pixel-modal__label">CATEGORY</label>
                <input class="pixel-modal__input" type="text" id="catCategory" list="categoryOptions" value="${App.escapeAttr(selectedCategory)}">
                ${App.datalist('categoryOptions', categoryOptions)}
            </div>
            <div class="pixel-modal__actions">
                <button class="pixel-button" onclick="this.closest('.modal-overlay').remove()">CANCEL</button>
                <button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Settings.saveCategory())">SAVE</button>
            </div>
        </div>
    `, '#catAppName');
},
```

2. `saveCategory` body untouched.

3. Smoke: click CATEGORIZE, pixel-modal opens, type a resident + category, save. Toast fires. Catalog refreshes.

4. Commit:

```
git add web/js/settings.js
git commit -m "reskin categorize-app modal with pixel-modal primitives"
```

---

## Task 7 — Prune legacy CSS

**Files:**

- Modify: `web/css/style.css`

**Steps:**

1. `grep -nE "class=['\"][^'\"]*\b(card|btn|modal|form-group|form-row|modal-actions|section-header|cards-grid|card-header|card-title|card-value|empty-state|empty-state-icon|chart-container|app-item|app-icon|app-info|app-name|app-category|app-bar|app-bar-fill|app-actions|app-time|goal-item|goal-info|goal-type|goal-desc|stats-grid|stat-card|stat-label|stat-value|stat-detail|tab-toggle|search-box|search-input|search-kbd|focus-mode-card|focus-exit-btn|block-item|block-item-info|block-item-name|block-item-detail|cat-card|cat-status-dot|kbd-grid|kbd-item|kbd-desc|export-row|card-preview)\b" web/js/*.js` — the Plan 3 audit-selectors plus Plan 1c new ones. Any selector that returns **no hits** is safe to delete from `style.css`.

2. Open `web/css/style.css`. For each safe-to-delete selector, remove the rule block (and any comment headers that are now empty). Keep:

   - `.modal-overlay` container + fade animation.
   - `.toast` + toast modifiers.
   - `.fade-in`, `.skeleton-card`, `.skeleton-chart` (still used in dashboard's pre-Isle loading path).
   - `.toggle` + `.toggle-slider` (used by appearance panel's `App.toggleDarkMode()` wiring — **re-check the re-skin**: Task 5 uses `.rule-board__toggle` instead, so `.toggle` / `.toggle-slider` can be removed only if no other tab still uses them. Grep before deleting.)
   - Font-face rules, the `:root` palette block, body defaults, and `.page-header` (still referenced by the dashboard fallback render).

3. If a deletion regressess a still-live tab, restore the rule and leave a `/* kept: used by <tab> — remove when <tab> is reskinned */` comment.

4. Run the full smoke checklist from Task 8 below before committing — any visual regression means the prune was too aggressive.

5. Commit:

```
git add web/css/style.css
git commit -m "prune legacy CSS rules superseded by views.css"
```

---

## Task 8 — Full smoke + PR + tag

**Steps:**

1. `./start.sh`. Browser opens.

2. Cmd+Shift+R.

3. Click every tab and verify:

   - **Isle** — dashboard scene renders; HUD counters update.
   - **Residents** — list + search + resident detail + back button.
   - **Chronicle** — daily/weekly toggle + date nav.
   - **Charter** — issue/repeal all three decree types; modals are pixel-modals.
   - **Rule Board** — list + whitelist + category tiles; lockdown toggle flips; BANISH / WHITELIST modals open; REPEAL works.
   - **Market** — "THE STALLS ARE CLOSED" placeholder.
   - **Postcards** — STAMP POSTCARD generates; pixel frame shows image; DOWNLOAD works; STAMP ANOTHER resets.
   - **Study** — Appearance toggles dark mode; Tracking saves idle; Data Export triggers CSV + JSON downloads; CATEGORIZE modal opens and saves; all five shortcut rows render; About panel renders.

4. Press `D` from any tab — dark mode flips. Inspect charts (Chronicle weekly, Residents detail hourly) — grid + tick readable.

5. Press `1`–`8` — tab switching still works. `Esc` closes any open modal.

6. Check DevTools console — no red errors.

7. `./stop.sh`.

8. Push + PR:

```bash
git push -u origin feat/phase-1c-rule-board-study
gh pr create --title "feat(views): Phase 1c — Rule Board / Postcards / Study reskin" --body "$(cat <<'EOF'
## Summary
- Rule Board (blocker), Postcards (cards), Mayor's Study (settings) now render in Dawn Cove pixel-UI primitives.
- Market tab stubbed with "stalls are closed" placeholder; economy + rewards ledger deferred to a dedicated plan.
- `style.css` pruned of legacy rules now fully superseded by `views.css`.

## Out of scope
- The Market (economy, balances, purchases, daily cap) — separate plan. Needs schema + routes.
- `category_blocks` table migration — spec §8 follow-up.
- Pixel-art assets (sheriff/gate animation, wax-seal decrees, portrait illustrations) — bespoke art pass.

## Verification
- [ ] Rule Board: list + whitelist + category tiles; lockdown toggle flips; modals open + save.
- [ ] Postcards: generate + download + reset.
- [ ] Mayor's Study: dark-mode toggle, idle save, CSV + JSON export, categorize modal.
- [ ] Market placeholder renders; tab routes correctly (no collision with Postcards).
- [ ] Legacy tabs pruned without regressing Isle/Residents/Chronicle/Charter.
- [ ] `D` flips palette cleanly across every tab.
EOF
)"
```

9. After merge, `git checkout main && git pull && git tag phase-1c-complete && git push origin phase-1c-complete`.

---

## Risks & follow-ups

- **Dark-mode toggle inside Study.** The Appearance panel uses `.rule-board__toggle` which is a CSS-only checkbox skin. If its `:has(input:checked)` selector fails to animate (older Safari), fall back to adding a JS click handler that sets the class directly. Note in testing.
- **Over-pruning `style.css`.** Plan 4 tabs are done, but `app.js`'s error fallback still references `.empty-state` and `.btn`. Keep those even though no per-view renderer uses them. Grep `web/js/app.js` specifically before each deletion.
- **Category catalog dense wall of text.** If a user has many categories, the grid gets long. Acceptable — the Chronicle is the primary browsing surface for categories. Re-evaluate if user feedback says otherwise.
- **Market placeholder will be overwritten.** When the Market plan ships, `web/js/market.js`, the Market tab wiring, and `.market-placeholder` styles are all deleted and replaced. Leave a comment at the top of `market.js` noting that.
- **Shortcut `1`–`8` count.** Shortcuts previously said `1`–`7`; now 8 tabs. Double-check `web/js/app.js` actually wires all eight number keys.
