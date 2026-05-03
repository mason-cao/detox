/* ── Chronicle (stats) view ──────────────────────────────────────────── */

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
                <div class="page-bar">
                    ${App.backToIsleButton()}
                    <h1 class="page-heading">The Chronicle</h1>
                </div>
                <div class="page-bar">
                    <div class="chronicle-toggle">
                        <button class="${this.view === 'daily' ? 'is-active' : ''}" onclick="Stats.view='daily'; Stats.render(document.getElementById('content'))">DAILY</button>
                        <button class="${this.view === 'weekly' ? 'is-active' : ''}" onclick="Stats.view='weekly'; Stats.render(document.getElementById('content'))">WEEKLY</button>
                    </div>
                    <div class="chronicle-datenav">
                        <button class="pixel-button" onclick="App.prevDate()">&#8249;</button>
                        <span>${App.formatDate(date)}</span>
                        <button class="pixel-button" onclick="App.nextDate()">&#8250;</button>
                    </div>
                </div>
                ${this.view === 'daily' ? this.renderDaily(daily) : this.renderWeekly(weekly)}
            </div>
        `;
    },

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

    renderWeekly(weekly) {
        setTimeout(() => this.renderWeeklyChart(weekly), 0);
        return `
            <div class="chronicle-grid">
                <div class="chronicle-tile">
                    <div class="chronicle-tile__label">DAILY AVERAGE</div>
                    <div class="chronicle-tile__value">${App.formatTime(weekly.daily_average)}</div>
                </div>
                <div class="chronicle-tile">
                    <div class="chronicle-tile__label">WEEKLY TOTAL</div>
                    <div class="chronicle-tile__value">${App.formatTime(weekly.weekly_total)}</div>
                </div>
                <div class="chronicle-tile">
                    <div class="chronicle-tile__label">SHORTEST DAY</div>
                    <div class="chronicle-tile__value">${App.formatTime(weekly.shortest_day)}</div>
                </div>
                <div class="chronicle-tile">
                    <div class="chronicle-tile__label">LONGEST DAY</div>
                    <div class="chronicle-tile__value">${App.formatTime(weekly.longest_day)}</div>
                </div>
            </div>

            <div class="chronicle-chart">
                <h3>DAILY BREAKDOWN</h3>
                <div class="chart-wrapper" style="position: relative;">
                    <canvas id="weeklyStatsChart"></canvas>
                    <span class="effect-quill" data-role="quill" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#2a1e2a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 20l8-8 5-1 4-7-7 4-1 5-8 8z"/>
                            <path d="M14 10l1 1"/>
                        </svg>
                    </span>
                </div>
            </div>
        `;
    },

    renderWeeklyChart(weekly) {
        const ctx = document.getElementById('weeklyStatsChart');
        if (!ctx || !chartsAvailable()) return;
        // Re-arm the quill keyframe so it sweeps every time a new chart renders.
        const quill = document.querySelector('[data-role="quill"]');
        if (quill && !App.prefersReducedMotion()) {
            quill.style.animation = 'none';
            void quill.offsetWidth;
            quill.style.animation = '';
        }
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: weekly.days.map(d => App.formatDayShort(d.date)),
                datasets: [{
                    label: 'Screen Time',
                    data: weekly.days.map(d => d.minutes),
                    backgroundColor: 'rgba(91, 143, 185, 0.35)',
                    borderColor: '#5b8fb9',
                    borderWidth: 0,
                    borderRadius: 0,
                    hoverBackgroundColor: 'rgba(91, 143, 185, 0.6)',
                }, {
                    label: 'Average',
                    data: weekly.days.map(() => weekly.daily_average),
                    type: 'line',
                    borderColor: '#d16a8f',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: App.chartAnimation(760),
                plugins: {
                    legend: {
                        labels: { color: App.chartTickColor(), padding: 16 },
                    },
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: App.chartTickColor() } },
                    y: { grid: { color: App.chartGridColor() }, ticks: { color: App.chartTickColor(), callback: v => App.formatTime(v) } },
                },
            },
        });
    },
};
