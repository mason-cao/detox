/* ── Statistics View ──────────────────────────────────────────────── */

const Stats = {
    view: 'daily',

    async render(container) {
        destroyCharts();
        const date = App.currentDate;
        const weekStart = App.getWeekStart(date);

        const [daily, weekly] = await Promise.all([
            App.api(`/api/stats/daily?date=${date}`),
            App.api(`/api/stats/weekly?week_start=${weekStart}`),
        ]);

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-header">
                    <h1>Statistics</h1>
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div class="tab-toggle">
                            <button class="${this.view === 'daily' ? 'active' : ''}" onclick="Stats.view='daily'; Stats.render(document.getElementById('content'))">Daily</button>
                            <button class="${this.view === 'weekly' ? 'active' : ''}" onclick="Stats.view='weekly'; Stats.render(document.getElementById('content'))">Weekly</button>
                        </div>
                        <div class="date-nav">
                            <button onclick="App.prevDate()">&#8249;</button>
                            <span class="date-label">${App.formatDate(date)}</span>
                            <button onclick="App.nextDate()">&#8250;</button>
                        </div>
                    </div>
                </div>

                ${this.view === 'daily' ? this.renderDaily(daily) : this.renderWeekly(weekly)}
            </div>
        `;
    },

    renderDaily(stats) {
        return `
            <div class="cards-grid">
                <div class="card">
                    <div class="card-header"><span class="card-title">Total Screen Time</span></div>
                    <div class="card-value">${App.formatTime(stats.total_minutes)}</div>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Pickups</div>
                    <div class="stat-value">${stats.pickups_count}</div>
                    <div class="stat-detail">times today</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Checking Every</div>
                    <div class="stat-value">${stats.checking_every_minutes || '—'}</div>
                    <div class="stat-detail">minutes</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Longest Detox</div>
                    <div class="stat-value">${App.formatTime(stats.longest_detox_minutes)}</div>
                    <div class="stat-detail">away from screen</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Continuous Use</div>
                    <div class="stat-value">${App.formatTime(stats.continuous_use_minutes)}</div>
                    <div class="stat-detail">longest session</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">First Pickup</div>
                    <div class="stat-value" style="font-size: 22px;">${stats.first_pickup || '—'}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Last Pickup</div>
                    <div class="stat-value" style="font-size: 22px;">${stats.last_pickup || '—'}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Most Used App</div>
                    <div class="stat-value" style="font-size: 18px;">${stats.most_used_app || '—'}</div>
                </div>
            </div>
        `;
    },

    renderWeekly(weekly) {
        setTimeout(() => this.renderWeeklyChart(weekly), 0);
        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Daily Average</div>
                    <div class="stat-value">${App.formatTime(weekly.daily_average)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Weekly Total</div>
                    <div class="stat-value">${App.formatTime(weekly.weekly_total)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Shortest Day</div>
                    <div class="stat-value">${App.formatTime(weekly.shortest_day)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Longest Day</div>
                    <div class="stat-value">${App.formatTime(weekly.longest_day)}</div>
                </div>
            </div>

            <div class="chart-container">
                <h3>Daily Breakdown</h3>
                <div class="chart-wrapper">
                    <canvas id="weeklyStatsChart"></canvas>
                </div>
            </div>
        `;
    },

    renderWeeklyChart(weekly) {
        const ctx = document.getElementById('weeklyStatsChart');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: weekly.days.map(d => App.formatDayShort(d.date)),
                datasets: [{
                    label: 'Screen Time',
                    data: weekly.days.map(d => d.minutes),
                    backgroundColor: 'rgba(0, 113, 227, 0.15)',
                    borderColor: '#0071e3',
                    borderWidth: 0,
                    borderRadius: 6,
                    hoverBackgroundColor: 'rgba(0, 113, 227, 0.3)',
                }, {
                    label: 'Average',
                    data: weekly.days.map(() => weekly.daily_average),
                    type: 'line',
                    borderColor: '#ff9500',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#64748b', padding: 16 },
                    },
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                    y: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#94a3b8', callback: v => App.formatTime(v) } },
                },
            },
        });
    },
};
