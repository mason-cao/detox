/* ── Global App State & Utilities ─────────────────────────────────── */

function toLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const App = {
    currentTab: 'dashboard',
    currentDate: toLocalDateString(),
    focusModeActive: false,
    appSuggestionsCache: null,
    renderToken: 0,

    /* ── Time & Date Formatting ─────────────────────────────────────── */

    formatTime(minutes) {
        if (!minutes || minutes <= 0) return '0m';
        const totalMinutes = Math.round(minutes);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    },

    formatDate(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const today = new Date();
        const todayStr = toLocalDateString(today);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = toLocalDateString(yesterday);

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
        this.currentDate = toLocalDateString(d);
        this.refresh();
    },

    nextDate() {
        const d = new Date(this.currentDate + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        const nextDate = toLocalDateString(d);
        if (nextDate <= toLocalDateString()) {
            this.currentDate = nextDate;
            this.refresh();
        }
    },

    getWeekStart(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        return toLocalDateString(d);
    },

    /* ── API Client ─────────────────────────────────────────────────── */

    async api(path, options = {}) {
        const res = await fetch(path, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        const contentType = res.headers.get('Content-Type') || '';
        const data = contentType.includes('application/json') ? await res.json() : await res.text();
        if (!res.ok) {
            const message = data && data.error ? data.error : `Request failed (${res.status})`;
            throw new Error(message);
        }
        return data;
    },

    async getAppSuggestions({ refresh = false } = {}) {
        if (this.appSuggestionsCache && !refresh) {
            return this.appSuggestionsCache;
        }

        try {
            const names = await this.api('/api/app-suggestions');
            this.appSuggestionsCache = [...new Set(names)].sort((a, b) => a.localeCompare(b));
            return this.appSuggestionsCache;
        } catch (e) {
            const apps = await this.api('/api/apps');
            this.appSuggestionsCache = [...new Set(apps.map(app => app.app_name))]
                .sort((a, b) => a.localeCompare(b));
            return this.appSuggestionsCache;
        }
    },

    invalidateAppSuggestions() {
        this.appSuggestionsCache = null;
    },

    datalist(id, values) {
        const options = [...new Set((values || [])
            .filter(value => value !== null && value !== undefined)
            .map(value => String(value)))]
            .sort((a, b) => a.localeCompare(b));
        return `
            <datalist id="${this.escapeAttr(id)}">
                ${options.map(value => `<option value="${this.escapeAttr(value)}"></option>`).join('')}
            </datalist>
        `;
    },

    appDatalist(id, appNames) {
        return this.datalist(id, appNames);
    },

    openModal(markup, focusSelector = 'input, select, textarea, button') {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = markup;
        modal.addEventListener('mousedown', (event) => {
            if (event.target === modal) modal.remove();
        });
        modal.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.target.tagName === 'TEXTAREA') return;
            if (event.target.hasAttribute && event.target.hasAttribute('list')) return;
            const primary = modal.querySelector('.modal-actions .btn-primary');
            if (!primary) return;
            event.preventDefault();
            primary.click();
        });
        document.body.appendChild(modal);

        requestAnimationFrame(() => {
            const target = modal.querySelector(focusSelector);
            if (!target) return;
            target.focus();
            if (target.tagName === 'INPUT' && target.type === 'text') {
                target.select();
            }
        });

        return modal;
    },

    async runAction(action, fallbackMessage = 'Action failed') {
        try {
            return await action();
        } catch (e) {
            this.toast(e.message || fallbackMessage, 'error');
            return null;
        }
    },

    /* ── Focus Mode Exit ─────────────────────────────────────────────── */

    ensureFocusModeBanner() {
        let banner = document.getElementById('focusModeBanner');
        if (banner) return banner;

        banner = document.createElement('div');
        banner.id = 'focusModeBanner';
        banner.className = 'focus-mode-banner';
        banner.hidden = true;

        const copy = document.createElement('div');
        copy.className = 'focus-mode-banner-copy';

        const title = document.createElement('strong');
        title.textContent = 'Full Lockdown Active';

        const detail = document.createElement('span');
        detail.textContent = 'Only whitelisted apps are allowed.';

        const button = document.createElement('button');
        button.className = 'focus-exit-btn';
        button.type = 'button';
        button.textContent = 'Exit Focus Mode';
        button.addEventListener('click', () => this.exitFocusMode());

        copy.append(title, detail);
        banner.append(copy, button);
        document.body.appendChild(banner);
        return banner;
    },

    setFocusModeActive(enabled) {
        this.focusModeActive = enabled;
        document.body.classList.toggle('focus-mode-active', enabled);
        this.ensureFocusModeBanner().hidden = !enabled;
    },

    async refreshFocusMode() {
        try {
            const settings = await this.api('/api/settings');
            this.setFocusModeActive(settings.whitelist_mode === '1');
        } catch (e) {
            // Leave the last visible state in place if the server is unreachable.
        }
    },

    async exitFocusMode({ refresh = true } = {}) {
        try {
            await this.api('/api/focus-mode/disable', { method: 'POST', body: {} });
            this.setFocusModeActive(false);
            this.toast('Focus Mode disabled', 'success');
            if (refresh) this.refresh();
            return true;
        } catch (e) {
            this.toast(e.message || 'Failed to disable Focus Mode', 'error');
            return false;
        }
    },

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    escapeAttr(value) {
        return this.escapeHtml(value).replace(/`/g, '&#96;');
    },

    inlineArg(value) {
        return this.escapeAttr(JSON.stringify(String(value ?? '')));
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
            'Productivity': '#5b8fb9',
            'Communication': '#b59cff',
            'Social': '#d16a8f',
            'Entertainment': '#ffd04a',
            'Utilities': '#6b8e4e',
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

    chartAnimation(duration = 760) {
        return {
            duration: this.prefersReducedMotion() ? 0 : duration,
            easing: 'easeOutQuart',
        };
    },

    /* ── Navigation ─────────────────────────────────────────────────── */

    refresh() {
        this.showTab(this.currentTab);
    },

    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    wait(ms) {
        if (ms <= 0) return Promise.resolve();
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    loadingMarkup(tab) {
        const label = tab ? tab.charAt(0).toUpperCase() + tab.slice(1) : 'View';
        return `
            <div class="view-loading" role="status" aria-live="polite">
                <div class="view-loading-ring"></div>
                <span>Loading ${this.escapeHtml(label)}</span>
            </div>
        `;
    },

    async renderTab(content, tab) {
        switch (tab) {
            case 'dashboard': return Isle.render(content);
            case 'apps': return Apps.render(content);
            case 'stats': return Stats.render(content);
            case 'goals': return Goals.render(content);
            case 'blocker': return Blocker.render(content);
            case 'cards': return Cards.render(content);
            case 'settings': return Settings.render(content);
            default: throw new Error(`Unknown tab: ${tab}`);
        }
    },

    async showTab(tab) {
        const token = ++this.renderToken;
        this.currentTab = tab;

        document.querySelectorAll('[data-tab]').forEach(el => {
            el.classList.toggle('is-active', el.dataset.tab === tab);
        });

        const content = document.getElementById('content');
        const hasContent = content.innerHTML.trim().length > 0;
        const transitionMs = this.prefersReducedMotion() ? 0 : 120;

        content.setAttribute('aria-busy', 'true');
        if (hasContent) {
            content.classList.add('is-transitioning');
            await this.wait(transitionMs);
            if (token !== this.renderToken) return;
        }

        content.innerHTML = this.loadingMarkup(tab);
        content.classList.remove('is-transitioning');

        try {
            await Promise.resolve(this.renderTab(content, tab));
            if (token !== this.renderToken) return;
        } catch (e) {
            if (token !== this.renderToken) return;
            content.innerHTML = `
                <div class="empty-state fade-in">
                    <h3>Unable to load ${this.escapeHtml(tab)}</h3>
                    <p>${this.escapeHtml(e.message || 'Please try again.')}</p>
                    <button class="btn btn-primary btn-sm" onclick="App.refresh()">Retry</button>
                </div>
            `;
            this.toast(e.message || 'Unable to load view', 'error');
        } finally {
            if (token === this.renderToken) {
                content.removeAttribute('aria-busy');
                content.classList.remove('is-transitioning');
            }
        }
    },

    /* ── Toast Notifications ────────────────────────────────────────── */

    toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="#30d158" stroke-width="2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff3b30" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="#5b8fb9" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffd04a" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.innerHTML = icons[type] || icons.info;
        const text = document.createElement('span');
        text.textContent = message;
        toast.append(icon, text);
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
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    modal.remove();
                }
                return;
            }

            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

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
                case '7': this.showTab('cards'); break;
                case '8': this.showTab('settings'); break;
            }
        });
    },

    /* ── Monitor Status ─────────────────────────────────────────────── */

    async checkMonitor() {
        try {
            const data = await this.api('/api/status');
            const el = document.getElementById('monitor-status');
            const text = el.querySelector('.status-text');
            if (data.monitor_running) {
                el.classList.remove('hud-status--offline');
                text.textContent = 'Monitoring';
            } else {
                el.classList.add('hud-status--offline');
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
            this.refreshFocusMode();
        }, 30000);
    },

    /* ── Init ───────────────────────────────────────────────────────── */

    init() {
        this.initTheme();

        document.querySelectorAll('[data-tab]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTab(el.dataset.tab);
            });
        });

        this.initKeyboardShortcuts();
        this.showTab('dashboard');
        if (window.HUD) HUD.init();
        this.checkMonitor();
        this.refreshFocusMode();
        this.startAutoRefresh();
    }
};

function chartsAvailable() {
    return typeof Chart !== 'undefined';
}

function destroyCharts() {
    if (!chartsAvailable() || !Chart.instances) return;
    Object.keys(Chart.instances).forEach(key => {
        Chart.instances[key].destroy();
    });
}

document.addEventListener('DOMContentLoaded', () => App.init());
