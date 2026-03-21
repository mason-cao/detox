/* ── Global App State & Utilities ─────────────────────────────────── */

const App = {
    currentTab: 'dashboard',
    currentDate: new Date().toISOString().split('T')[0],

    // Format minutes into human-readable string
    formatTime(minutes) {
        if (!minutes || minutes <= 0) return '0m';
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    },

    // Format date for display
    formatDate(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (dateStr === todayStr) return 'Today';
        if (dateStr === yesterdayStr) return 'Yesterday';
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    },

    // Format day of week short
    formatDayShort(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    },

    // Navigate date
    prevDate() {
        const d = new Date(this.currentDate + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        this.currentDate = d.toISOString().split('T')[0];
        this.refresh();
    },

    nextDate() {
        const d = new Date(this.currentDate + 'T12:00:00');
        const today = new Date();
        d.setDate(d.getDate() + 1);
        if (d <= today) {
            this.currentDate = d.toISOString().split('T')[0];
            this.refresh();
        }
    },

    // Get Monday of the week containing the given date
    getWeekStart(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        return d.toISOString().split('T')[0];
    },

    // API call helper
    async api(path, options = {}) {
        const res = await fetch(path, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        return res.json();
    },

    // Generate color for an app based on its name
    appColor(name) {
        const colors = [
            '#0071e3', '#af52de', '#ff2d55', '#ff9500', '#30d158',
            '#5ac8fa', '#ff6482', '#64d2ff', '#bf5af2', '#34c759',
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    },

    // Category color
    categoryColor(category) {
        const map = {
            'Productivity': '#0071e3',
            'Communication': '#af52de',
            'Social': '#ff2d55',
            'Entertainment': '#ff9500',
            'Utilities': '#6e6e73',
            'Uncategorized': '#aeaeb2',
        };
        return map[category] || '#aeaeb2';
    },

    // Refresh current tab
    refresh() {
        this.showTab(this.currentTab);
    },

    // Show a tab
    showTab(tab) {
        this.currentTab = tab;

        // Update nav
        document.querySelectorAll('.nav-links a').forEach(a => {
            a.classList.toggle('active', a.dataset.tab === tab);
        });

        // Render tab content
        const content = document.getElementById('content');
        switch (tab) {
            case 'dashboard': Dashboard.render(content); break;
            case 'apps': Apps.render(content); break;
            case 'stats': Stats.render(content); break;
            case 'goals': Goals.render(content); break;
            case 'blocker': Blocker.render(content); break;
            case 'cards': Cards.render(content); break;
            case 'settings': Settings.render(content); break;
        }
    },

    // Check monitor status
    async checkMonitor() {
        try {
            const data = await this.api('/api/status');
            const el = document.getElementById('monitor-status');
            const dot = el.querySelector('.status-dot');
            const text = el.querySelector('.status-text');
            if (data.monitor_running) {
                dot.className = 'status-dot online';
                text.textContent = 'Monitoring';
            } else {
                dot.className = 'status-dot offline';
                text.textContent = 'Monitor offline';
            }
        } catch (e) {
            // Server not reachable
        }
    },

    // Auto-refresh
    startAutoRefresh() {
        setInterval(() => {
            if (this.currentTab === 'dashboard' || this.currentTab === 'stats') {
                this.refresh();
            }
            this.checkMonitor();
        }, 30000);
    },

    // Initialize
    init() {
        // Tab navigation
        document.querySelectorAll('.nav-links a').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTab(a.dataset.tab);
            });
        });

        this.showTab('dashboard');
        this.checkMonitor();
        this.startAutoRefresh();
    }
};

// Destroy all Chart.js charts before re-rendering
function destroyCharts() {
    Object.keys(Chart.instances).forEach(key => {
        Chart.instances[key].destroy();
    });
}

// Start app
document.addEventListener('DOMContentLoaded', () => App.init());
