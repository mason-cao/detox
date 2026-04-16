/* ── Dashboard View ───────────────────────────────────────────────── */

const Dashboard = {
    async render(container) {
        destroyCharts();
        const date = App.currentDate;

        // Show loading skeleton
        container.innerHTML = `
            <div class="fade-in">
                <div class="page-header">
                    <h1>Dashboard</h1>
                    <div class="date-nav">
                        <button onclick="App.prevDate()">&#8249;</button>
                        <span class="date-label">${App.formatDate(date)}</span>
                        <button onclick="App.nextDate()">&#8250;</button>
                    </div>
                </div>
                <div class="cards-grid">
                    <div class="skeleton-card"></div>
                    <div class="skeleton-card"></div>
                    <div class="skeleton-card"></div>
                </div>
                <div class="content-grid">
                    <div><div class="skeleton-chart"></div></div>
                    <div><div class="skeleton-chart"></div></div>
                </div>
            </div>
        `;

        const [data, weekData] = await Promise.all([
            App.api(`/api/dashboard?date=${date}`),
            App.api(`/api/dashboard/weekly?week_start=${App.getWeekStart(date)}`),
        ]);

        const totalStr = App.formatTime(data.total_minutes);
        const goalPct = data.goal_target ? Math.min(100, (data.total_minutes / data.goal_target) * 100) : 0;
        const goalStr = data.goal_target ? App.formatTime(data.goal_target) : null;
        const circumference = 2 * Math.PI * 60;

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-header">
                    <h1>Dashboard</h1>
                    <div class="date-nav">
                        <button onclick="App.prevDate()">&#8249;</button>
                        <span class="date-label">${App.formatDate(date)}</span>
                        <button onclick="App.nextDate()">&#8250;</button>
                    </div>
                </div>

                <div class="cards-grid">
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">Screen Time</span>
                        </div>
                        <div class="card-value">${totalStr}</div>
                        <div class="card-subtitle">${data.apps.length} apps used</div>
                    </div>
                    ${goalStr ? `
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">Daily Goal</span>
                        </div>
                        <div class="progress-ring-container">
                            <div class="progress-ring">
                                <svg width="140" height="140" viewBox="0 0 140 140">
                                    <circle class="ring-track" cx="70" cy="70" r="60" stroke="var(--border)" stroke-width="9" fill="none"/>
                                    <circle class="ring-fill" cx="70" cy="70" r="60" stroke="${goalPct >= 100 ? 'var(--red)' : 'var(--accent)'}"
                                        stroke-width="9" fill="none" stroke-linecap="round"
                                        stroke-dasharray="${circumference}"
                                        stroke-dashoffset="${circumference}"
                                        id="goalRing"/>
                                </svg>
                                <div class="progress-text">
                                    <span class="progress-value">${Math.round(goalPct)}%</span>
                                    <span class="progress-label">of ${goalStr}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : `
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">Weekly Average</span>
                        </div>
                        <div class="card-value">${App.formatTime(weekData.daily_average)}</div>
                        <div class="card-subtitle">Total: ${App.formatTime(weekData.weekly_total)}</div>
                    </div>
                    `}
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">Most Used</span>
                        </div>
                        <div class="card-value small">${data.apps.length > 0 ? App.escapeHtml(data.apps[0].app_name) : '—'}</div>
                        <div class="card-subtitle">${data.apps.length > 0 ? App.formatTime(data.apps[0].minutes) : 'No data yet'}</div>
                    </div>
                </div>

                <div class="content-grid">
                    <div>
                        <div class="chart-container">
                            <h3>Hourly Breakdown</h3>
                            <div class="chart-wrapper">
                                <canvas id="hourlyChart"></canvas>
                            </div>
                        </div>
                        <div class="chart-container">
                            <h3>Weekly Trend</h3>
                            <div class="chart-wrapper small">
                                <canvas id="weeklyChart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div class="chart-container">
                            <h3>By Category</h3>
                            <div class="chart-wrapper">
                                <canvas id="categoryChart"></canvas>
                            </div>
                        </div>
                        <div class="chart-container">
                            <div class="section-header">
                                <h3>Top Apps</h3>
                                <a class="view-link" onclick="App.showTab('apps')">View all</a>
                            </div>
                            <ul class="app-list" id="topApps"></ul>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Animate progress ring
        if (goalStr) {
            const ring = document.getElementById('goalRing');
            if (ring) {
                requestAnimationFrame(() => {
                    ring.style.strokeDashoffset = circumference * (1 - goalPct / 100);
                });
            }
        }

        this.renderHourlyChart(data.hourly);
        this.renderCategoryChart(data.categories);
        this.renderWeeklyChart(weekData);
        this.renderTopApps(data.apps.slice(0, 6));
    },

    renderHourlyChart(hourly) {
        const ctx = document.getElementById('hourlyChart');
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
                    backgroundColor: 'rgba(0, 113, 227, 0.15)',
                    borderColor: '#0071e3',
                    borderWidth: 0,
                    borderRadius: 6,
                    hoverBackgroundColor: 'rgba(0, 113, 227, 0.3)',
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 600, easing: 'easeOutQuart' },
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        grid: { color: App.chartGridColor() },
                        ticks: { color: App.chartTickColor(), font: { size: 10 }, maxRotation: 0 },
                    },
                    y: {
                        grid: { color: App.chartGridColor() },
                        ticks: { color: App.chartTickColor(), callback: v => App.formatTime(v) },
                    },
                },
            },
        });
    },

    renderCategoryChart(categories) {
        const ctx = document.getElementById('categoryChart');
        if (!ctx || !chartsAvailable() || categories.length === 0) return;
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categories.map(c => c.category),
                datasets: [{
                    data: categories.map(c => Math.round(c.minutes * 10) / 10),
                    backgroundColor: categories.map(c => App.categoryColor(c.category)),
                    borderWidth: 0,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                animation: { duration: 800, easing: 'easeOutQuart' },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: App.chartTickColor(), padding: 12, font: { size: 11 } },
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.label}: ${App.formatTime(ctx.raw)}`,
                        },
                    },
                },
            },
        });
    },

    renderWeeklyChart(weekData) {
        const ctx = document.getElementById('weeklyChart');
        if (!ctx || !chartsAvailable()) return;
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: weekData.days.map(d => App.formatDayShort(d.date)),
                datasets: [{
                    data: weekData.days.map(d => d.minutes),
                    backgroundColor: weekData.days.map(d =>
                        d.date === App.currentDate ? '#0071e3' : 'rgba(0, 113, 227, 0.15)'
                    ),
                    borderRadius: 6,
                    borderWidth: 0,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 600, easing: 'easeOutQuart' },
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: App.chartTickColor() },
                    },
                    y: {
                        grid: { color: App.chartGridColor() },
                        ticks: { color: App.chartTickColor(), callback: v => App.formatTime(v) },
                    },
                },
            },
        });
    },

    renderTopApps(apps) {
        const el = document.getElementById('topApps');
        if (!el) return;
        if (apps.length === 0) {
            el.innerHTML = '<div class="empty-state"><p>No data yet. Keep the monitor running!</p></div>';
            return;
        }
        const maxMin = apps[0].minutes;
        el.innerHTML = apps.map(app => {
            const appName = App.escapeHtml(app.app_name);
            const category = App.escapeHtml(app.category || 'Uncategorized');
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
                        <div class="app-bar-fill" style="width: ${(app.minutes / maxMin * 100)}%; background: ${App.appColor(app.app_name)}"></div>
                    </div>
                </div>
                <div class="app-time">${App.formatTime(app.minutes)}</div>
            </li>
        `;
        }).join('');
    },
};
