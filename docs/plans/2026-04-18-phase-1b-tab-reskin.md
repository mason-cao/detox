# Phase 1b — Tab Reskin (Residents, Chronicle, Charter)

**Goal:** Bring the Dawn Cove visual language into the three most data-dense tabs (Apps → Residents, Stats → Chronicle, Goals → Charter). Replace the legacy card/button styling with `pixel-panel` / `pixel-button` / `pixel-chip` primitives already established in Phase 1a. No data-layer changes.

**Architecture:** A single new CSS module (`web/css/views.css`) holds all per-view Dawn Cove classes. Each tab module's `render()` template is rewritten to emit pixel-UI markup. Legacy rules in `style.css` for `.card`, `.stat-card`, `.app-item`, `.goal-item`, `.modal`, `.tab-toggle`, `.search-box` are either removed or scoped so they no longer leak in. Charts keep Chart.js but switch to Dawn Cove palette via `App.chart*` helpers.

**Tech stack:** Vanilla HTML/CSS/JS. No build step. Chart.js 4.4.1 already vendored. Press Start 2P / VT323 / Inter already loaded.

**Non-goals (deferred to later plans):**
- Wax-seal decrees, ration hourglass, portrait illustrations — these need bespoke pixel-art assets.
- Rule Board / Market / Postcards / Study reskins (Plan 4).
- New data fields (resident "role", weather, etc. — Plan 5+ with schema changes).

---

## File structure

- **Create:** `web/css/views.css` — Dawn Cove classes for list items, stat tiles, decree cards, modals, tab toggles, search box.
- **Modify:** `web/index.html` — add `<link>` for `views.css`, bump cache busters.
- **Modify:** `web/js/apps.js` — rewrite list + detail templates to pixel-UI.
- **Modify:** `web/js/stats.js` — rewrite daily/weekly templates + chart colors.
- **Modify:** `web/js/goals.js` — rewrite goal cards + modals.
- **Modify:** `web/js/app.js` — `chartGridColor()` / `chartTickColor()` tuned to Dawn Cove; shared modal classes.
- **Modify:** `web/css/style.css` — strip duplicated rules that `views.css` replaces.

---

## Task 1 — `views.css` skeleton

**Files:**
- Create: `web/css/views.css`
- Modify: `web/index.html`

**Steps:**

1. Create `web/css/views.css` with section comments but no rules yet — placeholder that subsequent tasks fill. This keeps diffs small per commit.

```css
/* Per-tab Dawn Cove styling. Builds on pixel-ui.css primitives. */

/* ── Page header (shared across Residents, Chronicle, Charter) ───────── */
.page-heading {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink);
    letter-spacing: 1px;
    margin: 0 0 var(--sp-4) 0;
}

.page-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
    flex-wrap: wrap;
}

/* Residents, Chronicle, Charter sections get filled in Tasks 2, 4, 5. */
```

2. In `web/index.html`, add after `isle.css`:

```html
<link rel="stylesheet" href="/css/views.css?v=20260418">
```

3. Bump every existing `/css/*.css?v=...` to `v=20260418` so the browser reloads.

4. Hard-reload — verify page header in each current tab shows in Press Start 2P and sits above content without a wrapper. (Legacy `page-header` class still works; we're only *adding* — nothing removed yet.)

5. Commit — suggested message: `views: add views.css scaffold + load from index.html`

---

## Task 2 — Residents (apps.js) list reskin

**Files:**
- Modify: `web/css/views.css`
- Modify: `web/js/apps.js:44-70` (list template), `web/js/apps.js:81-119` (list-item template)

**Steps:**

1. Append to `views.css`:

```css
/* ── Residents' Registry ─────────────────────────────────────────────── */
.registry-search {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    margin-bottom: var(--sp-4);
}

.registry-search input {
    flex: 1;
    background: transparent;
    border: none;
    font-family: var(--font-game);
    font-size: var(--fs-lg);
    color: var(--dc-ink);
    outline: none;
}

.registry-search input::placeholder {
    color: var(--dc-ink-soft);
}

.registry-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    list-style: none;
    padding: 0;
    margin: 0;
}

.resident {
    display: grid;
    grid-template-columns: 44px 1fr 120px auto auto;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    cursor: pointer;
    font-family: var(--font-ui);
}

.resident:hover { background: var(--dc-noon); }

.resident__portrait {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 14px;
    color: #fff;
    box-shadow: 0 0 0 2px var(--dc-ink);
}

.resident__info { min-width: 0; }
.resident__name { font-weight: 600; color: var(--dc-ink); font-size: var(--fs-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resident__category { font-size: var(--fs-xs); color: var(--dc-ink-soft); margin-top: 2px; }

.resident__bar {
    height: 8px;
    background: rgba(42, 30, 42, 0.12);
    box-shadow: inset 0 0 0 1px var(--dc-ink);
}
.resident__bar-fill { height: 100%; }

.resident__actions { display: flex; gap: var(--sp-1); }
.resident__action {
    width: 32px; height: 32px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--dc-parchment);
    color: var(--dc-ink);
    border: none;
    cursor: pointer;
    box-shadow: 0 0 0 2px var(--dc-ink);
}
.resident__action:hover { background: var(--dc-noon); }
.resident__action.is-on { background: var(--dc-coin); }
.resident__action.is-danger-on { background: var(--dc-danger); color: #fff; }
.resident__action.is-ok-on { background: var(--dc-ok); color: #fff; }

.resident__time {
    font-family: var(--font-game);
    font-size: var(--fs-lg);
    color: var(--dc-ink);
    padding-left: var(--sp-2);
}

.registry-empty {
    padding: var(--sp-6);
    text-align: center;
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    font-family: var(--font-game);
    font-size: var(--fs-lg);
    color: var(--dc-ink-soft);
}
```

2. Replace `Apps.render()` template in `apps.js` with:

```javascript
container.innerHTML = `
    <div class="fade-in">
        <h1 class="page-heading">The Residents' Registry</h1>
        ${apps.length === 0 ? `
            <div class="registry-empty">
                No one lives on the isle yet.<br>
                Open any app for a few seconds — they'll move in.
            </div>
        ` : `
            <div class="registry-search">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="appSearch" placeholder="call for a resident…"
                    value="${App.escapeAttr(this.searchQuery)}"
                    oninput="Apps.filterApps(this.value)">
            </div>
            <ul class="registry-list" id="appsList">
                ${this.renderAppList(apps)}
            </ul>
        `}
    </div>
`;
```

3. Replace `Apps.renderAppList()` item template. Key structural swap — `.app-item` → `.resident`, icon → `.resident__portrait`, bar → `.resident__bar` + `.resident__bar-fill`, action buttons → `.resident__action` with state classes (`is-on`, `is-danger-on`, `is-ok-on`):

```javascript
return `
<li class="resident" onclick="Apps.showDetail(${appArg})">
    <div class="resident__portrait" style="background: ${App.appColor(app.app_name)}">${firstLetter}</div>
    <div class="resident__info">
        <div class="resident__name">${appName}</div>
        <div class="resident__category">${category}</div>
    </div>
    <div class="resident__bar">
        <div class="resident__bar-fill" style="width: ${(app.total_minutes / maxMin * 100)}%; background: ${App.appColor(app.app_name)}"></div>
    </div>
    <div class="resident__actions">
        <button class="resident__action ${hasLimit ? 'is-on' : ''}" title="${hasLimit ? 'Change limit' : 'Set limit'}" onclick="event.stopPropagation(); App.runAction(() => Apps.quickLimit(${appArg}))">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        </button>
        <button class="resident__action ${isBlocked ? 'is-danger-on' : ''}" title="${isBlocked ? 'Blocked' : 'Block app'}" onclick="event.stopPropagation(); App.runAction(() => Apps.quickBlock(${appArg}))">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
        </button>
        <button class="resident__action ${isWhitelisted ? 'is-ok-on' : ''}" title="${isWhitelisted ? 'Allowed in Focus Mode' : 'Categorize'}" onclick="event.stopPropagation(); App.runAction(() => Apps.quickCategory(${appArg}))">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10l-8 8-8-8V4h16z"/><circle cx="12" cy="8" r="1"/></svg>
        </button>
    </div>
    <div class="resident__time">${App.formatTime(app.total_minutes)}</div>
</li>
`;
```

4. Verify: load Residents tab — confirm list renders with parchment tiles, chunky icons, visible usage bars, working hover. Search box filters. Click through to detail (still legacy — next task).

5. Commit — suggested: `residents: reskin list in Dawn Cove pixel-panel language`

---

## Task 3 — Residents detail view

**Files:**
- Modify: `web/css/views.css`
- Modify: `web/js/apps.js:152-227` (renderDetail), `apps.js:229-287` (chart dataset colors)

**Steps:**

1. Append to `views.css`:

```css
/* ── Resident detail ─────────────────────────────────────────────────── */
.resident-detail__header {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    margin-bottom: var(--sp-4);
}

.resident-detail__back {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink);
    cursor: pointer;
    padding: var(--sp-1) var(--sp-2);
    background: var(--dc-noon);
    box-shadow: 0 0 0 2px var(--dc-ink);
    text-decoration: none;
}

.resident-detail__title {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink);
    margin: 0;
}

.resident-detail__portrait {
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display);
    font-size: 16px;
    color: #fff;
    box-shadow: 0 0 0 2px var(--dc-ink);
}

.resident-detail__actions {
    display: flex;
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
    flex-wrap: wrap;
}

.status-pill {
    display: inline-block;
    padding: 2px 8px;
    font-family: var(--font-game);
    font-size: var(--fs-md);
    background: var(--dc-parchment);
    color: var(--dc-ink);
    box-shadow: 0 0 0 2px var(--dc-ink);
    margin-right: var(--sp-1);
}
.status-pill--danger { background: var(--dc-danger); color: #fff; }
.status-pill--ok { background: var(--dc-ok); color: #fff; }

.chronicle-chart {
    padding: var(--sp-4);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    margin-bottom: var(--sp-4);
}
.chronicle-chart h3 {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink);
    margin: 0 0 var(--sp-3) 0;
}
.chart-wrapper { position: relative; height: 240px; }
.chart-wrapper.small { height: 160px; }
```

2. Replace `Apps.renderDetail()` innerHTML with pixel-UI markup:

```javascript
container.innerHTML = `
    <div class="fade-in">
        <div class="resident-detail__header">
            <a class="resident-detail__back" onclick="Apps.detailApp=null; Apps.searchQuery=''; App.showTab('apps')">← BACK</a>
            <span class="resident-detail__portrait" style="background: ${App.appColor(appName)}">${firstLetter}</span>
            <h1 class="resident-detail__title">${appNameEsc}</h1>
            <div style="flex: 1"></div>
            <div class="date-nav">
                <button class="pixel-button" onclick="App.prevDate(); Apps.showDetail(${appArg})">&#8249;</button>
                <span style="font-family: var(--font-game); font-size: var(--fs-lg); padding: 0 var(--sp-2);">${App.formatDate(App.currentDate)}</span>
                <button class="pixel-button" onclick="App.nextDate(); Apps.showDetail(${appArg})">&#8250;</button>
            </div>
        </div>

        <div class="resident-detail__actions">
            <button class="pixel-button ${hasLimit ? 'pixel-button--primary' : ''}" onclick="App.runAction(() => Apps.quickLimit(${appArg}))">${hasLimit ? 'CHANGE LIMIT' : 'SET LIMIT'}</button>
            <button class="pixel-button ${isBlocked ? 'pixel-button--danger' : ''}" onclick="App.runAction(() => Apps.quickBlock(${appArg}))">${isBlocked ? 'BLOCKED' : 'BLOCK'}</button>
            <button class="pixel-button" onclick="App.runAction(() => Apps.quickCategory(${appArg}))">CATEGORIZE</button>
        </div>

        <div class="pixel-panel" style="margin-bottom: var(--sp-4);">
            <div style="font-family: var(--font-display); font-size: var(--fs-display); color: var(--dc-ink-soft);">${App.escapeHtml(App.formatDate(App.currentDate))}</div>
            <div style="font-family: var(--font-game); font-size: var(--fs-xl); color: var(--dc-ink); margin-top: var(--sp-2);">${App.formatTime(selectedTotal)}</div>
            ${hasLimit || isBlocked || isWhitelisted ? `<div style="margin-top: var(--sp-2);">
                ${hasLimit ? '<span class="status-pill">Limit set</span>' : ''}
                ${isBlocked ? '<span class="status-pill status-pill--danger">Blocked</span>' : ''}
                ${isWhitelisted ? '<span class="status-pill status-pill--ok">Focus allowed</span>' : ''}
            </div>` : ''}
        </div>

        <div class="chronicle-chart">
            <h3>HOURLY USAGE</h3>
            <div class="chart-wrapper"><canvas id="appHourlyChart"></canvas></div>
        </div>
        <div class="chronicle-chart">
            <h3>LAST 7 DAYS</h3>
            <div class="chart-wrapper small"><canvas id="appDailyChart"></canvas></div>
        </div>
    </div>
`;
```

3. In `renderAppHourlyChart` and `renderAppDailyChart`, change `borderRadius: 4/6` → `borderRadius: 0` (pixel-style blocks) and leave `App.appColor(appName)` for per-app tint. Chart grid/tick colors already flow through `App.chartGridColor()` — Task 7 tunes them.

4. Verify: click a resident — detail page shows pixel-panel header with back button, parchment chart containers, chunky buttons. Charts still render data correctly. Block/limit/categorize buttons toggle color on click.

5. Commit — suggested: `residents: reskin detail view with parchment panels + pixel buttons`

---

## Task 4 — Chronicle (stats.js)

**Files:**
- Modify: `web/css/views.css`
- Modify: `web/js/stats.js` (whole file)

**Steps:**

1. Append to `views.css`:

```css
/* ── Chronicle (stats) ───────────────────────────────────────────────── */
.chronicle-toggle {
    display: inline-flex;
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
}
.chronicle-toggle button {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    padding: var(--sp-2) var(--sp-3);
    background: transparent;
    color: var(--dc-ink-soft);
    border: none;
    cursor: pointer;
}
.chronicle-toggle button.is-active {
    background: var(--dc-noon);
    color: var(--dc-ink);
}

.chronicle-hero {
    padding: var(--sp-5);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    margin-bottom: var(--sp-4);
    text-align: center;
}
.chronicle-hero__label {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink-soft);
    letter-spacing: 1px;
}
.chronicle-hero__value {
    font-family: var(--font-game);
    font-size: 48px;
    color: var(--dc-ink);
    line-height: 1;
    margin-top: var(--sp-2);
}

.chronicle-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
}

.chronicle-tile {
    padding: var(--sp-3);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
}
.chronicle-tile__label {
    font-family: var(--font-display);
    font-size: 10px;
    color: var(--dc-ink-soft);
    letter-spacing: 0.5px;
}
.chronicle-tile__value {
    font-family: var(--font-game);
    font-size: var(--fs-xl);
    color: var(--dc-ink);
    margin-top: var(--sp-1);
    line-height: 1;
}
.chronicle-tile__detail {
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    color: var(--dc-ink-soft);
    margin-top: var(--sp-1);
}
```

2. Rewrite `Stats.render()` to emit pixel-UI:

```javascript
container.innerHTML = `
    <div class="fade-in">
        <h1 class="page-heading">The Chronicle</h1>
        <div class="page-bar">
            <div class="chronicle-toggle">
                <button class="${this.view === 'daily' ? 'is-active' : ''}" onclick="Stats.view='daily'; Stats.render(document.getElementById('content'))">DAILY</button>
                <button class="${this.view === 'weekly' ? 'is-active' : ''}" onclick="Stats.view='weekly'; Stats.render(document.getElementById('content'))">WEEKLY</button>
            </div>
            <div class="date-nav">
                <button class="pixel-button" onclick="App.prevDate()">&#8249;</button>
                <span style="font-family: var(--font-game); font-size: var(--fs-lg); padding: 0 var(--sp-2);">${App.formatDate(date)}</span>
                <button class="pixel-button" onclick="App.nextDate()">&#8250;</button>
            </div>
        </div>
        ${this.view === 'daily' ? this.renderDaily(daily) : this.renderWeekly(weekly)}
    </div>
`;
```

3. Replace `renderDaily` body with `.chronicle-hero` + `.chronicle-grid` of `.chronicle-tile`s. Keep same data keys (`pickups_count`, `longest_detox_minutes`, etc.).

```javascript
renderDaily(stats) {
    return `
        <div class="chronicle-hero">
            <div class="chronicle-hero__label">TOTAL SCREEN TIME</div>
            <div class="chronicle-hero__value">${App.formatTime(stats.total_minutes)}</div>
        </div>
        <div class="chronicle-grid">
            <div class="chronicle-tile">
                <div class="chronicle-tile__label">PICKUPS</div>
                <div class="chronicle-tile__value">${stats.pickups_count}</div>
                <div class="chronicle-tile__detail">times today</div>
            </div>
            <div class="chronicle-tile">
                <div class="chronicle-tile__label">CHECKING EVERY</div>
                <div class="chronicle-tile__value">${stats.checking_every_minutes || '—'}</div>
                <div class="chronicle-tile__detail">minutes</div>
            </div>
            <div class="chronicle-tile">
                <div class="chronicle-tile__label">LONGEST DETOX</div>
                <div class="chronicle-tile__value">${App.formatTime(stats.longest_detox_minutes)}</div>
                <div class="chronicle-tile__detail">away from screen</div>
            </div>
            <div class="chronicle-tile">
                <div class="chronicle-tile__label">CONTINUOUS USE</div>
                <div class="chronicle-tile__value">${App.formatTime(stats.continuous_use_minutes)}</div>
                <div class="chronicle-tile__detail">longest session</div>
            </div>
            <div class="chronicle-tile">
                <div class="chronicle-tile__label">FIRST PICKUP</div>
                <div class="chronicle-tile__value">${stats.first_pickup || '—'}</div>
            </div>
            <div class="chronicle-tile">
                <div class="chronicle-tile__label">LAST PICKUP</div>
                <div class="chronicle-tile__value">${stats.last_pickup || '—'}</div>
            </div>
            <div class="chronicle-tile">
                <div class="chronicle-tile__label">MOST USED</div>
                <div class="chronicle-tile__value" style="font-size: var(--fs-lg);">${stats.most_used_app ? App.escapeHtml(stats.most_used_app) : '—'}</div>
            </div>
        </div>
    `;
},
```

4. Replace `renderWeekly` similarly — `.chronicle-grid` of tiles + `.chronicle-chart` wrapping canvas.

5. In `renderWeeklyChart`, swap dataset colors:
   - `backgroundColor: 'rgba(0, 113, 227, 0.15)'` → `backgroundColor: 'rgba(91, 143, 185, 0.35)'` (dc-sea @ 35%)
   - `borderColor: '#0071e3'` → `borderColor: 'var(--dc-sea)'` — Chart.js won't resolve CSS vars, so use the hex `#5b8fb9` directly
   - Average line `borderColor: '#ff9500'` → `'#d16a8f'` (dc-dusk)
   - `hoverBackgroundColor`: `'rgba(91, 143, 185, 0.6)'`
   - `borderRadius: 6` → `0` (pixel blocks)

6. Verify: Chronicle tab renders daily hero + grid, toggle flips to weekly, weekly bar chart shows in Dawn Cove blues with pink average line. Date nav still works.

7. Commit — suggested: `chronicle: reskin daily/weekly stats with parchment tiles`

---

## Task 5 — Charter (goals.js)

**Files:**
- Modify: `web/css/views.css`
- Modify: `web/js/goals.js`

**Steps:**

1. Append to `views.css`:

```css
/* ── Charter (goals) ─────────────────────────────────────────────────── */
.charter-section {
    margin-bottom: var(--sp-6);
}
.charter-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sp-3);
}
.charter-section__title {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink);
    margin: 0;
}

.decree {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    margin-bottom: var(--sp-2);
}
.decree__kind {
    font-family: var(--font-display);
    font-size: 10px;
    color: var(--dc-ink-soft);
    letter-spacing: 0.5px;
}
.decree__body {
    font-family: var(--font-game);
    font-size: var(--fs-lg);
    color: var(--dc-ink);
    margin-top: 2px;
}

.decree-empty {
    padding: var(--sp-5);
    text-align: center;
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    font-family: var(--font-game);
    font-size: var(--fs-md);
    color: var(--dc-ink-soft);
}
```

2. Rewrite `Goals.render()`:

```javascript
container.innerHTML = `
    <div class="fade-in">
        <h1 class="page-heading">The Town Charter</h1>

        <div class="charter-section">
            <div class="charter-section__header">
                <h2 class="charter-section__title">DAILY SCREEN-TIME DECREE</h2>
                ${dailyGoals.length === 0 ? `<button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Goals.addDailyGoal())">ISSUE</button>` : ''}
            </div>
            ${dailyGoals.length > 0 ? dailyGoals.map(g => `
                <div class="decree">
                    <div>
                        <div class="decree__kind">DAILY LIMIT</div>
                        <div class="decree__body">${App.formatTime(g.target_minutes)} per day</div>
                    </div>
                    <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => Goals.removeGoal(${g.id}))">REPEAL</button>
                </div>
            `).join('') : `<div class="decree-empty">No daily decree. Issue one to be warned when you exceed it.</div>`}
        </div>

        <div class="charter-section">
            <div class="charter-section__header">
                <h2 class="charter-section__title">PER-RESIDENT DECREES</h2>
                <button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Goals.addAppLimit())">ADD</button>
            </div>
            ${appGoals.length > 0 ? appGoals.map(g => `
                <div class="decree">
                    <div>
                        <div class="decree__kind">APP LIMIT</div>
                        <div class="decree__body">${App.escapeHtml(g.app_name)} — ${App.formatTime(g.target_minutes)}/day</div>
                    </div>
                    <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => Goals.removeGoal(${g.id}))">REPEAL</button>
                </div>
            `).join('') : `<div class="decree-empty">No per-resident decrees in effect.</div>`}
        </div>

        <div class="charter-section">
            <div class="charter-section__header">
                <h2 class="charter-section__title">BEDTIME BELL</h2>
                ${bedtimeGoals.length === 0 ? `<button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Goals.addBedtime())">SET</button>` : ''}
            </div>
            ${bedtimeGoals.length > 0 ? bedtimeGoals.map(g => {
                const hr = g.bedtime_hour;
                const min = (g.bedtime_minute || 0).toString().padStart(2, '0');
                const ampm = hr >= 12 ? 'PM' : 'AM';
                const h12 = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr);
                return `
                <div class="decree">
                    <div>
                        <div class="decree__kind">BEDTIME</div>
                        <div class="decree__body">${h12}:${min} ${ampm}</div>
                    </div>
                    <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => Goals.removeGoal(${g.id}))">REPEAL</button>
                </div>`;
            }).join('') : `<div class="decree-empty">No bedtime bell set.</div>`}
        </div>
    </div>
`;
```

3. Verify: Charter tab shows three parchment decree sections, ISSUE/ADD/SET buttons toast-on-save, REPEAL removes a decree. Empty states show in parchment boxes.

4. Commit — suggested: `charter: reskin daily/app/bedtime goals as decrees`

---

## Task 6 — Modal reskin

**Files:**
- Modify: `web/css/views.css`
- Modify: `web/js/goals.js` (all three modals)

**Steps:**

1. Append to `views.css`:

```css
/* ── Pixel modal ─────────────────────────────────────────────────────── */
.pixel-modal {
    max-width: 480px;
    width: 100%;
    margin: var(--sp-6) auto;
    padding: var(--sp-5);
    background: var(--dc-parchment);
    box-shadow: 0 0 0 2px var(--dc-ink);
    font-family: var(--font-ui);
}
.pixel-modal__title {
    font-family: var(--font-display);
    font-size: var(--fs-display);
    color: var(--dc-ink);
    margin: 0 0 var(--sp-4) 0;
}
.pixel-modal__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
    margin-bottom: var(--sp-3);
}
.pixel-modal__group { display: flex; flex-direction: column; gap: var(--sp-1); }
.pixel-modal__label {
    font-family: var(--font-display);
    font-size: 10px;
    color: var(--dc-ink-soft);
    letter-spacing: 0.5px;
}
.pixel-modal__input {
    font-family: var(--font-game);
    font-size: var(--fs-lg);
    color: var(--dc-ink);
    background: var(--dc-sand);
    border: none;
    padding: var(--sp-2) var(--sp-3);
    box-shadow: inset 0 0 0 2px var(--dc-ink);
    outline: none;
}
.pixel-modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-2);
    margin-top: var(--sp-4);
}
```

2. Rewrite each modal in `goals.js` (`addDailyGoal`, `addAppLimit`, `addBedtime`) with `.pixel-modal` markup. Example for `addDailyGoal`:

```javascript
App.openModal(`
    <div class="pixel-modal">
        <h2 class="pixel-modal__title">ISSUE DAILY DECREE</h2>
        <div class="pixel-modal__row">
            <div class="pixel-modal__group">
                <label class="pixel-modal__label">HOURS</label>
                <input class="pixel-modal__input" type="number" id="goalHours" min="0" max="23" value="2">
            </div>
            <div class="pixel-modal__group">
                <label class="pixel-modal__label">MINUTES</label>
                <input class="pixel-modal__input" type="number" id="goalMinutes" min="0" max="59" value="0">
            </div>
        </div>
        <div class="pixel-modal__actions">
            <button class="pixel-button" onclick="this.closest('.modal-overlay').remove()">CANCEL</button>
            <button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Goals.saveDailyGoal())">SAVE</button>
        </div>
    </div>
`, '#goalHours');
```

Apply the same translation to `addAppLimit` and `addBedtime`. For `addAppLimit`, the input with datalist stays functional — just swap classes.

3. Verify: every "ISSUE / ADD / SET" button opens a parchment modal with chunky fonts, chunky buttons, inputs with inset ink border. Cancel/Save work. Saved goals appear in Charter.

4. Commit — suggested: `goals: pixel-modal skin for daily/app/bedtime forms`

---

## Task 7 — Chart palette + chart helpers

**Files:**
- Modify: `web/js/app.js:chartGridColor` / `chartTickColor` (grep to find them)
- Modify: `web/js/apps.js` and `web/js/stats.js` chart dataset colors (if not done in prior tasks)

**Steps:**

1. In `app.js`, tune `chartGridColor()` and `chartTickColor()`:

```javascript
chartGridColor() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark ? 'rgba(232, 221, 240, 0.12)' : 'rgba(42, 30, 42, 0.15)';
},

chartTickColor() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark ? '#b0a8c0' : '#5a4a5a';
},
```

2. Audit remaining hardcoded chart colors: `grep -n "#0071e3\|#ff9500\|rgba(0, 113" web/js/*.js`. Replace each with Dawn Cove values:
   - blue primary → `#5b8fb9` (dc-sea)
   - orange accent → `#d16a8f` (dc-dusk) or `#ffd04a` (dc-coin) for "good"
   - radius → `0`

3. Verify: dark mode (press D) — chart ticks legible, grid visible but subtle. Light mode — same. Charts across Residents detail, Chronicle weekly look on-brand.

4. Commit — suggested: `charts: tune grid/tick and dataset colors to Dawn Cove palette`

---

## Task 8 — Prune legacy CSS + smoke + PR

**Files:**
- Modify: `web/css/style.css`

**Steps:**

1. Search `style.css` for selectors now fully superseded by `views.css`: `.app-item`, `.app-icon`, `.app-info`, `.app-name`, `.app-category`, `.app-bar`, `.app-bar-fill`, `.app-actions`, `.app-time`, `.goal-item`, `.goal-info`, `.goal-type`, `.goal-desc`, `.modal`, `.modal-actions`, `.form-row`, `.form-group`, `.section-header`, `.stats-grid`, `.stat-card`, `.stat-label`, `.stat-value`, `.stat-detail`, `.tab-toggle`, `.search-box`, `.search-input`, `.search-kbd`, `.cards-grid`, `.card`, `.card-header`, `.card-title`, `.card-value`, `.icon-btn`, `.empty-state`, `.empty-state-icon`, `.chart-container`.

   Delete each block **only if** no other tab still depends on it. `dashboard.js` is unused for rendering (Isle replaces it), but keep any rules also used by `blocker.js` / `cards.js` / `settings.js` (Plan 4 scope).

   Rule of thumb: if the selector is still referenced in `web/js/*.js`, leave it.

2. Keep legacy chart/toast/focus-mode-banner and the `.modal-overlay` container itself.

3. Full smoke:
   - `./start.sh` → browser opens.
   - Cmd+Shift+R.
   - Click every tab: Isle, Residents, Chronicle, Charter, Rule Board, Market, Postcards, Study. First four should all look Dawn Cove. Last four are legacy (Plan 4) but should not crash.
   - Residents: search filters, click a resident, detail page renders, back works.
   - Chronicle: daily toggle, weekly toggle, date prev/next.
   - Charter: issue a daily decree, repeal it. Add an app limit, repeal. Set a bedtime, repeal.
   - Press `D` — dark mode palette flips, charts still legible.
   - `./stop.sh`.

4. `git push -u origin feat/phase-1b-tab-reskin` then `gh pr create`:

```bash
gh pr create --title "feat(views): Phase 1b — Residents / Chronicle / Charter reskin" --body "$(cat <<'EOF'
## Summary
- Residents, Chronicle, Charter now render in Dawn Cove pixel-UI primitives.
- New shared `views.css` module; legacy `.card` / `.app-item` / `.goal-item` etc. removed from `style.css` where unused.
- Chart palette tuned to Dawn Cove (dc-sea, dc-dusk, ink).

## Out of scope
- Rule Board, Market, Postcards, Study — Plan 4.
- Pixel-art assets (portraits, wax seals, ration hourglass) — requires bespoke art pass.

## Verification
- [ ] Residents list + detail render and filter.
- [ ] Chronicle daily/weekly toggle + date nav.
- [ ] Charter issue/repeal for daily, app-limit, bedtime.
- [ ] Dark-mode toggle (D key) flips palette cleanly.
- [ ] Legacy tabs still render without console errors.
EOF
)"
```

5. After merge, tag `phase-1b-complete`.

---

## Risks & follow-ups

- **Legacy CSS audit risk.** Cutting `style.css` rules is easy to over-do — if a tab not yet reskinned (Rule Board / Market / Postcards / Study) depends on `.card` or `.btn`, those tabs will regress. Mitigation: grep each selector in `web/js/*.js` before deleting; keep broadly-shared rules.
- **Date-nav styling duplication.** Tasks 3 and 4 both inline date-nav styles. If we touch it a third time (Rule Board), extract to a shared class in Plan 4.
- **No per-app-color theme in dark mode.** `App.appColor()` returns deterministic HSL that works in light mode; some hues may clash with dark parchment. Revisit in Plan 5.
- **Modal animation.** Existing `openModal` likely fades the overlay; pixel-modal doesn't animate its own entrance. Acceptable for v1; a `steps(4)` pop-in can come later.
