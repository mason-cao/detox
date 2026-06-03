/* ── Apps View ────────────────────────────────────────────────────── */

const Apps = {
    detailApp: null,
    searchQuery: '',
    appLimitNames: new Set(),
    blockedNames: new Set(),
    whitelistedNames: new Set(),

    async loadActionState() {
        const [goals, blocks] = await Promise.all([
            App.api('/api/goals'),
            App.api('/api/blocks'),
        ]);
        this.appLimitNames = new Set(
            goals
                .filter(goal => goal.type === 'app_limit' && goal.app_name)
                .map(goal => goal.app_name)
        );
        this.blockedNames = new Set(
            blocks
                .filter(block => block.block_type === 'blocked')
                .map(block => block.app_name)
        );
        this.whitelistedNames = new Set(
            blocks
                .filter(block => block.block_type === 'whitelisted')
                .map(block => block.app_name)
        );
    },

    async render(container) {
        destroyCharts();
        if (this.detailApp) {
            await this.renderDetail(container, this.detailApp);
            return;
        }

        const [apps] = await Promise.all([
            App.api('/api/apps'),
            this.loadActionState(),
        ]);

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-bar">
                    ${App.backToIsleButton()}
                    <h1 class="page-heading">The Residents' Registry</h1>
                </div>
                ${apps.length === 0 ? `
                    <div class="registry-empty">
                        No one lives on the isle yet.<br>
                        Open any app for a few seconds — they'll move in.
                    </div>
                ` : `
                    <div class="registry-search">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="appSearch"
                            placeholder="call for a resident…"
                            value="${App.escapeAttr(this.searchQuery)}"
                            oninput="Apps.filterApps(this.value)">
                    </div>
                    <ul class="registry-list" id="appsList">
                        ${this.renderAppList(apps)}
                    </ul>
                `}
            </div>
        `;
    },

    renderAppList(apps) {
        const filtered = this.searchQuery
            ? apps.filter(a => a.app_name.toLowerCase().includes(this.searchQuery.toLowerCase()))
            : apps;

        if (filtered.length === 0) {
            return '<li class="registry-empty">No residents match that call.</li>';
        }

        const maxMin = apps[0].total_minutes;
        return filtered.map(app => {
            const appName = App.escapeHtml(app.app_name);
            const categoryLabel = window.AppSymbols ? AppSymbols.inferCategory(app) : (app.category || 'Uncategorized');
            const category = App.escapeHtml(categoryLabel);
            const categorySource = app.category && app.category !== 'Uncategorized' ? 'saved' : 'inferred';
            const symbol = window.AppSymbols
                ? AppSymbols.badge(app)
                : App.escapeHtml(app.app_name.charAt(0).toUpperCase());
            const appArg = App.inlineArg(app.app_name);
            const hasLimit = this.appLimitNames.has(app.app_name);
            const isBlocked = this.blockedNames.has(app.app_name);
            const isWhitelisted = this.whitelistedNames.has(app.app_name);
            return `
            <li class="resident" onclick="Apps.showDetail(${appArg})">
                <div class="resident__portrait" style="background: ${App.categoryColor(categoryLabel)}">${symbol}</div>
                <div class="resident__info">
                    <div class="resident__name">${appName}</div>
                    <div class="resident__category" data-category-source="${App.escapeAttr(categorySource)}">${category}</div>
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
        }).join('');
    },

    async filterApps(query) {
        const wasSearching = !!this.searchQuery;
        const isSearching = !!query;
        this.searchQuery = query;
        const apps = await App.api('/api/apps');
        const list = document.getElementById('appsList');
        if (!list) return;
        // Page-turn only on entering or leaving search mode — not on every
        // keystroke, which would flicker.
        if (wasSearching !== isSearching) {
            Effects.pageTurn(list, () => { list.innerHTML = this.renderAppList(apps); });
        } else {
            list.innerHTML = this.renderAppList(apps);
        }
    },

    showDetail(appName) {
        this.detailApp = appName;
        App.showTab('apps');
    },

    async quickLimit(appName) {
        await Goals.addAppLimit(appName);
    },

    async quickBlock(appName) {
        await App.api('/api/blocks', {
            method: 'POST',
            body: { app_name: appName, block_type: 'blocked' },
        });
        App.invalidateAppSuggestions();
        App.toast(`${appName} has been blocked`, 'success');
        App.refresh();
    },

    async quickCategory(appName) {
        await Settings.addCategory(appName);
    },

    async renderDetail(container, appName) {
        const [data] = await Promise.all([
            App.api(`/api/apps/${encodeURIComponent(appName)}?date=${App.currentDate}`),
            this.loadActionState(),
        ]);
        const appNameEsc = App.escapeHtml(appName);
        const categoryLabel = window.AppSymbols
            ? AppSymbols.inferCategory({ app_name: appName, category: data.category })
            : (data.category || 'Uncategorized');
        const symbol = window.AppSymbols
            ? AppSymbols.badge({ app_name: appName, category: data.category })
            : App.escapeHtml(appName.charAt(0).toUpperCase());
        const appArg = App.inlineArg(appName);
        const selectedTotal = data.selected_total ?? data.today_total ?? 0;
        const hasLimit = this.appLimitNames.has(appName);
        const isBlocked = this.blockedNames.has(appName);
        const isWhitelisted = this.whitelistedNames.has(appName);

        container.innerHTML = `
            <div class="fade-in">
                <div class="resident-detail__header">
                    <a class="resident-detail__back" onclick="Apps.detailApp=null; Apps.searchQuery=''; App.showTab('apps')">← BACK</a>
                    <span class="resident-detail__portrait" style="background: ${App.categoryColor(categoryLabel)}">${symbol}</span>
                    <h1 class="resident-detail__title">${appNameEsc}</h1>
                    <div class="resident-detail__date-nav">
                        <button class="pixel-button" onclick="App.prevDate(); Apps.showDetail(${appArg})">&#8249;</button>
                        <span>${App.formatDate(App.currentDate)}</span>
                        <button class="pixel-button" onclick="App.nextDate(); Apps.showDetail(${appArg})">&#8250;</button>
                    </div>
                </div>

                <div class="resident-detail__actions">
                    <button class="pixel-button ${hasLimit ? 'pixel-button--primary' : ''}" onclick="App.runAction(() => Apps.quickLimit(${appArg}))">${hasLimit ? 'CHANGE LIMIT' : 'SET LIMIT'}</button>
                    <button class="pixel-button ${isBlocked ? 'pixel-button--danger' : ''}" onclick="App.runAction(() => Apps.quickBlock(${appArg}))">${isBlocked ? 'BLOCKED' : 'BLOCK'}</button>
                    <button class="pixel-button" onclick="App.runAction(() => Apps.quickCategory(${appArg}))">CATEGORIZE</button>
                </div>

                <div class="resident-detail__summary">
                    <div class="resident-detail__summary-date">${App.escapeHtml(App.formatDate(App.currentDate))}</div>
                    <div class="resident-detail__summary-value">${App.formatTime(selectedTotal)}</div>
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

        this.renderAppHourlyChart(data.hourly, appName);
        this.renderAppDailyChart(data.daily_totals, appName);
    },

    renderAppHourlyChart(hourly, appName) {
        const ctx = document.getElementById('appHourlyChart');
        if (!ctx || !chartsAvailable()) return;
        const labels = Object.keys(hourly).map(h => {
            const hr = parseInt(h);
            return hr === 0 ? '12a' : hr < 12 ? `${hr}a` : hr === 12 ? '12p' : `${hr - 12}p`;
        });
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: Object.values(hourly),
                    backgroundColor: App.appColor(appName) + '99',
                    borderColor: App.appColor(appName),
                    borderWidth: 1,
                    borderRadius: 0,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: App.chartAnimation(760),
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: App.chartGridColor() }, ticks: { color: App.chartTickColor(), font: { size: 10 }, maxRotation: 0 } },
                    y: { grid: { color: App.chartGridColor() }, ticks: { color: App.chartTickColor(), callback: v => App.formatTime(v) } },
                },
            },
        });
    },

    renderAppDailyChart(dailyTotals, appName) {
        const ctx = document.getElementById('appDailyChart');
        if (!ctx || !chartsAvailable()) return;
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dailyTotals.map(d => App.formatDayShort(d.date)),
                datasets: [{
                    data: dailyTotals.map(d => d.minutes),
                    backgroundColor: App.appColor(appName) + '66',
                    borderColor: App.appColor(appName),
                    borderWidth: 1,
                    borderRadius: 0,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: App.chartAnimation(760),
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: App.chartTickColor() } },
                    y: { grid: { color: App.chartGridColor() }, ticks: { color: App.chartTickColor(), callback: v => App.formatTime(v) } },
                },
            },
        });
    },
};
