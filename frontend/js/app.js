/* ── Global App State & Utilities ─────────────────────────────────── */

const App = {
    currentTab: 'dashboard',
    currentDate: new Date().toISOString().split('T')[0],

    /* ── Time & Date Formatting ─────────────────────────────────────── */

    formatTime(minutes) {
        if (!minutes || minutes <= 0) return '0m';
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    },

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

    formatDayShort(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    },

    /* ── Date Navigation ────────────────────────────────────────────── */

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

    getWeekStart(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        return d.toISOString().split('T')[0];
    },

    /* ── API Client ─────────────────────────────────────────────────── */

    async api(path, options = {}) {
        const res = await fetch(path, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        return res.json();
    },

    /* ── Colors ─────────────────────────────────────────────────────── */

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

    /* ── Chart Theme ────────────────────────────────────────────────── */

    chartGridColor() {
        return getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim();
    },

    chartTickColor() {
        return getComputedStyle(document.documentElement).getPropertyValue('--chart-tick').trim();
    },

    /* ── Navigation ─────────────────────────────────────────────────── */

    refresh() {
        this.showTab(this.currentTab);
    },

    showTab(tab) {
        this.currentTab = tab;

        document.querySelectorAll('.nav-links a').forEach(a => {
            a.classList.toggle('active', a.dataset.tab === tab);
        });

        const content = document.getElementById('content');
        content.style.opacity = '0';
        content.style.transform = 'translateY(6px)';

        requestAnimationFrame(() => {
            switch (tab) {
                case 'dashboard': Dashboard.render(content); break;
                case 'apps': Apps.render(content); break;
                case 'stats': Stats.render(content); break;
                case 'goals': Goals.render(content); break;
                case 'blocker': Blocker.render(content); break;
                case 'cards': Cards.render(content); break;
                case 'settings': Settings.render(content); break;
            }
            requestAnimationFrame(() => {
                content.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
                content.style.opacity = '1';
                content.style.transform = 'translateY(0)';
            });
        });
    },

    /* ── Toast Notifications ────────────────────────────────────────── */

    toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="#30d158" stroke-width="2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff3b30" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="#0071e3" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff9500" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    },

    /* ── Dark Mode ──────────────────────────────────────────────────── */

    toggleDarkMode() {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('detox-theme', newTheme);
        this.updateThemeIcon();
        this.toast(isDark ? 'Light mode enabled' : 'Dark mode enabled', 'info');
    },

    updateThemeIcon() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const icon = document.getElementById('themeIcon');
        const label = document.querySelector('.theme-toggle-label');
        if (isDark) {
            icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
            if (label) label.textContent = 'Light Mode';
        } else {
            icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
            if (label) label.textContent = 'Dark Mode';
        }
    },

    initTheme() {
        const saved = localStorage.getItem('detox-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeIcon();
    },

    /* ── Keyboard Shortcuts ─────────────────────────────────────────── */

    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                if (e.key === 'Escape') modal.remove();
                return;
            }

            switch (e.key) {
                case 'ArrowLeft': e.preventDefault(); this.prevDate(); break;
                case 'ArrowRight': e.preventDefault(); this.nextDate(); break;
                case 'd': this.toggleDarkMode(); break;
                case '/':
                    e.preventDefault();
                    if (this.currentTab === 'apps') {
                        const search = document.getElementById('appSearch');
                        if (search) search.focus();
                    } else {
                        this.showTab('apps');
                        setTimeout(() => {
                            const search = document.getElementById('appSearch');
                            if (search) search.focus();
                        }, 100);
                    }
                    break;
                case '1': this.showTab('dashboard'); break;
                case '2': this.showTab('apps'); break;
                case '3': this.showTab('stats'); break;
                case '4': this.showTab('goals'); break;
                case '5': this.showTab('blocker'); break;
                case '6': this.showTab('cards'); break;
                case '7': this.showTab('settings'); break;
            }
        });
    },

    /* ── Monitor Status ─────────────────────────────────────────────── */

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

    startAutoRefresh() {
        setInterval(() => {
            if (this.currentTab === 'dashboard' || this.currentTab === 'stats') {
                this.refresh();
            }
            this.checkMonitor();
        }, 30000);
    },

    /* ── Init ───────────────────────────────────────────────────────── */

    init() {
        this.initTheme();

        document.querySelectorAll('.nav-links a').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTab(a.dataset.tab);
            });
        });

        this.initKeyboardShortcuts();
        this.showTab('dashboard');
        this.checkMonitor();
        this.startAutoRefresh();
    }
};

function destroyCharts() {
    Object.keys(Chart.instances).forEach(key => {
        Chart.instances[key].destroy();
    });
}

document.addEventListener('DOMContentLoaded', () => App.init());
