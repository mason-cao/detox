/* ── Apps View ────────────────────────────────────────────────────── */

const Apps = {
    detailApp: null,

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
                    <div class="chart-container">
                        <ul class="app-list">
                            ${apps.map(app => {
                                const maxMin = apps[0].total_minutes;
                                return `
                                <li class="app-item" onclick="Apps.showDetail('${app.app_name.replace(/'/g, "\\'")}')">
                                    <div class="app-icon" style="background: ${App.appColor(app.app_name)}">
                                        ${app.app_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div class="app-info">
                                        <div class="app-name">${app.app_name}</div>
                                        <div class="app-category">${app.category}</div>
                                    </div>
                                    <div class="app-bar-wrapper">
                                        <div class="app-bar">
                                            <div class="app-bar-fill" style="width: ${(app.total_minutes / maxMin * 100)}%; background: ${App.appColor(app.app_name)}"></div>
                                        </div>
                                    </div>
                                    <div class="app-time">${App.formatTime(app.total_minutes)}</div>
                                </li>`;
                            }).join('')}
                        </ul>
                    </div>
                `}
            </div>
        `;
    },

    showDetail(appName) {
        this.detailApp = appName;
        App.showTab('apps');
    },

    async renderDetail(container, appName) {
        const data = await App.api(`/api/apps/${encodeURIComponent(appName)}?date=${App.currentDate}`);

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-header">
                    <h1>
                        <a class="view-link" onclick="Apps.detailApp=null; App.showTab('apps')" style="font-size: 16px; margin-right: 8px;">← Back</a>
                        <span class="app-icon" style="background: ${App.appColor(appName)}; display: inline-flex; width: 36px; height: 36px; vertical-align: middle; margin-right: 8px; font-size: 14px;">
                            ${appName.charAt(0).toUpperCase()}
                        </span>
                        ${appName}
                    </h1>
                    <div class="date-nav">
                        <button onclick="App.prevDate(); Apps.showDetail('${appName.replace(/'/g, "\\'")}')" >&#8249;</button>
                        <span class="date-label">${App.formatDate(App.currentDate)}</span>
                        <button onclick="App.nextDate(); Apps.showDetail('${appName.replace(/'/g, "\\'")}')" >&#8250;</button>
                    </div>
                </div>

                <div class="cards-grid">
                    <div class="card">
                        <div class="card-header"><span class="card-title">Today</span></div>
                        <div class="card-value">${App.formatTime(data.today_total)}</div>
                    </div>
                </div>

                <div class="chart-container">
                    <h3>Hourly Usage Today</h3>
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
        if (!ctx) return;
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
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 0 } },
                    y: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#94a3b8', callback: v => App.formatTime(v) } },
                },
            },
        });
    },

    renderAppDailyChart(dailyTotals, appName) {
        const ctx = document.getElementById('appDailyChart');
        if (!ctx) return;
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
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                    y: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#94a3b8', callback: v => App.formatTime(v) } },
                },
            },
        });
    },
};
