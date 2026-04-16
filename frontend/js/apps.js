/* ── Apps View ────────────────────────────────────────────────────── */

const Apps = {
    detailApp: null,
    searchQuery: '',

    async render(container) {
        destroyCharts();
        if (this.detailApp) {
            await this.renderDetail(container, this.detailApp);
            return;
        }

        const apps = await App.api('/api/apps');

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
            return `
            <li class="app-item" onclick="Apps.showDetail(${App.inlineArg(app.app_name)})">
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

    async renderDetail(container, appName) {
        const data = await App.api(`/api/apps/${encodeURIComponent(appName)}?date=${App.currentDate}`);
        const appNameEsc = App.escapeHtml(appName);
        const firstLetter = App.escapeHtml(appName.charAt(0).toUpperCase());
        const appArg = App.inlineArg(appName);
        const selectedTotal = data.selected_total ?? data.today_total ?? 0;

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

                <div class="cards-grid">
                    <div class="card">
                        <div class="card-header"><span class="card-title">${App.escapeHtml(App.formatDate(App.currentDate))}</span></div>
                        <div class="card-value">${App.formatTime(selectedTotal)}</div>
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
                animation: { duration: 600, easing: 'easeOutQuart' },
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
                animation: { duration: 600, easing: 'easeOutQuart' },
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: App.chartTickColor() } },
                    y: { grid: { color: App.chartGridColor() }, ticks: { color: App.chartTickColor(), callback: v => App.formatTime(v) } },
                },
            },
        });
    },
};
