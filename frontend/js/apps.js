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
                .filter(block => block.block_type === 'blocked' && !block.app_name.startsWith('__category__'))
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
                <div class="page-header">
                    <h1>Apps</h1>
                </div>
                ${apps.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-state-icon">📱</div>
                        <h3>No apps tracked yet</h3>
                        <p>The monitor will start tracking apps as you use them.</p>
                    </div>
                ` : `
                    <div class="search-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="search-input" id="appSearch"
                            placeholder="Search apps..." value="${App.escapeAttr(this.searchQuery)}"
                            oninput="Apps.filterApps(this.value)">
                        <span class="search-kbd">/</span>
                    </div>
                    <div class="chart-container">
                        <ul class="app-list" id="appsList">
                            ${this.renderAppList(apps)}
                        </ul>
                    </div>
                `}
            </div>
        `;
    },

    renderAppList(apps) {
        const filtered = this.searchQuery
            ? apps.filter(a => a.app_name.toLowerCase().includes(this.searchQuery.toLowerCase()))
            : apps;

        if (filtered.length === 0) {
            return '<div class="empty-state" style="padding: 24px;"><p>No apps match your search.</p></div>';
        }

        const maxMin = apps[0].total_minutes;
        return filtered.map(app => {
            const appName = App.escapeHtml(app.app_name);
            const category = App.escapeHtml(app.category);
            const firstLetter = App.escapeHtml(app.app_name.charAt(0).toUpperCase());
            const appArg = App.inlineArg(app.app_name);
            const hasLimit = this.appLimitNames.has(app.app_name);
            const isBlocked = this.blockedNames.has(app.app_name);
            const isWhitelisted = this.whitelistedNames.has(app.app_name);
            return `
            <li class="app-item" onclick="Apps.showDetail(${appArg})">
                <div class="app-icon" style="background: ${App.appColor(app.app_name)}">
                    ${firstLetter}
                </div>
                <div class="app-info">
                    <div class="app-name">${appName}</div>
                    <div class="app-category">${category}</div>
                </div>
                <div class="app-bar-wrapper">
                    <div class="app-bar">
                        <div class="app-bar-fill" style="width: ${(app.total_minutes / maxMin * 100)}%; background: ${App.appColor(app.app_name)}"></div>
                    </div>
                </div>
                <div class="app-actions">
                    <button class="icon-btn ${hasLimit ? 'active' : ''}" title="${hasLimit ? 'Change limit' : 'Set limit'}" onclick="event.stopPropagation(); App.runAction(() => Apps.quickLimit(${appArg}))">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                    </button>
                    <button class="icon-btn ${isBlocked ? 'danger-active' : ''}" title="${isBlocked ? 'Blocked' : 'Block app'}" onclick="event.stopPropagation(); App.runAction(() => Apps.quickBlock(${appArg}))">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
                    </button>
                    <button class="icon-btn ${isWhitelisted ? 'success-active' : ''}" title="${isWhitelisted ? 'Allowed in Focus Mode' : 'Categorize'}" onclick="event.stopPropagation(); App.runAction(() => Apps.quickCategory(${appArg}))">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10l-8 8-8-8V4h16z"/><circle cx="12" cy="8" r="1"/></svg>
                    </button>
                </div>
                <div class="app-time">${App.formatTime(app.total_minutes)}</div>
            </li>
        `;
        }).join('');
    },

    async filterApps(query) {
        this.searchQuery = query;
        const apps = await App.api('/api/apps');
        const list = document.getElementById('appsList');
        if (list) list.innerHTML = this.renderAppList(apps);
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
        const firstLetter = App.escapeHtml(appName.charAt(0).toUpperCase());
        const appArg = App.inlineArg(appName);
        const selectedTotal = data.selected_total ?? data.today_total ?? 0;
        const hasLimit = this.appLimitNames.has(appName);
        const isBlocked = this.blockedNames.has(appName);
        const isWhitelisted = this.whitelistedNames.has(appName);

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-header">
                    <h1>
                        <a class="view-link" onclick="Apps.detailApp=null; Apps.searchQuery=''; App.showTab('apps')" style="font-size: 16px; margin-right: 8px;">← Back</a>
                        <span class="app-icon" style="background: ${App.appColor(appName)}; display: inline-flex; width: 36px; height: 36px; vertical-align: middle; margin-right: 8px; font-size: 14px;">
                            ${firstLetter}
                        </span>
                        ${appNameEsc}
                    </h1>
                    <div class="date-nav">
                        <button onclick="App.prevDate(); Apps.showDetail(${appArg})" >&#8249;</button>
                        <span class="date-label">${App.formatDate(App.currentDate)}</span>
                        <button onclick="App.nextDate(); Apps.showDetail(${appArg})" >&#8250;</button>
                    </div>
                </div>

                <div class="detail-actions">
                    <button class="btn btn-secondary btn-sm ${hasLimit ? 'active-action' : ''}" onclick="App.runAction(() => Apps.quickLimit(${appArg}))">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                        ${hasLimit ? 'Change Limit' : 'Set Limit'}
                    </button>
                    <button class="btn btn-secondary btn-sm ${isBlocked ? 'danger-action' : ''}" onclick="App.runAction(() => Apps.quickBlock(${appArg}))">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
                        ${isBlocked ? 'Blocked' : 'Block App'}
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="App.runAction(() => Apps.quickCategory(${appArg}))">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10l-8 8-8-8V4h16z"/><circle cx="12" cy="8" r="1"/></svg>
                        Categorize
                    </button>
                </div>

                <div class="cards-grid">
                    <div class="card">
                        <div class="card-header"><span class="card-title">${App.escapeHtml(App.formatDate(App.currentDate))}</span></div>
                        <div class="card-value">${App.formatTime(selectedTotal)}</div>
                        ${hasLimit || isBlocked || isWhitelisted ? `<div class="app-status-row">
                            ${hasLimit ? '<span class="status-pill">Limit set</span>' : ''}
                            ${isBlocked ? '<span class="status-pill danger">Blocked</span>' : ''}
                            ${isWhitelisted ? '<span class="status-pill success">Focus allowed</span>' : ''}
                        </div>` : ''}
                    </div>
                </div>

                <div class="chart-container">
                    <h3>Hourly Usage</h3>
                    <div class="chart-wrapper">
                        <canvas id="appHourlyChart"></canvas>
                    </div>
                </div>

                <div class="chart-container">
                    <h3>Last 7 Days</h3>
                    <div class="chart-wrapper small">
                        <canvas id="appDailyChart"></canvas>
                    </div>
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
                    borderRadius: 4,
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
                    borderRadius: 6,
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
