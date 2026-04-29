/* HUD — currency counters, help overlay, monitor status. */

const HUD = {
    refreshIntervalId: null,
    changelogLoaded: false,
    helpTourIndex: 0,
    helpTourIntervalId: null,
    lastFocusedElement: null,
    motionMedia: null,
    motionListenerBound: false,
    tourSteps: [
        ['The Isle', 'Start here for live weather, top residents, and the current state of your day.'],
        ['Residents', 'Open the registry to inspect every tracked app, assign categories, and set per-app decrees.'],
        ['Chronicle', 'Review daily and weekly patterns as parchment ledgers and pixel charts.'],
        ['Charter', 'Set the daily goal, resident limits, and bedtime bell from the town charter.'],
        ['Rule Board', 'Banish distracting apps, whitelist essentials, or enable full lockdown.'],
        ['Market', 'Spend earned Sunlight and Starshards on owned items. No real money is accepted.'],
        ['Postcards', 'Stamp a shareable snapshot of a day on the Isle.'],
        ['Study', 'Tune settings, categories, exports, theme, and keyboard reminders.'],
    ],

    init() {
        this.refresh();
        // Poll every 30 seconds; no push channel yet.
        this.refreshIntervalId = setInterval(() => this.refresh(), 30000);
        window.addEventListener('focus', () => this.refresh());
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.refresh();
        });

        document.addEventListener('keydown', (e) => {
            if (this.isHelpOpen()) {
                this.handleHelpKeydown(e);
                return;
            }
            if (e.key === '?' && !this.isTyping(e.target)) {
                e.preventDefault();
                this.openHelp();
            }
        });

        if (!localStorage.getItem('detox-help-seen')) {
            setTimeout(() => this.openHelp('tour'), 700);
        }
        this.bindMotionPreference();
    },

    isTyping(el) {
        const tag = el && el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || (el && el.isContentEditable);
    },

    async refresh() {
        const [balanceResult, weatherResult] = await Promise.allSettled([
            App.api('/api/rewards/balance'),
            App.api(`/api/dashboard?date=${App.currentDate}`),
        ]);

        if (balanceResult.status === 'fulfilled') {
            this.updateCurrencies(balanceResult.value);
        } else {
            // Counters stay at their last known value; monitor status dot
            // already surfaces agent health separately.
        }

        if (weatherResult.status === 'fulfilled') {
            this.updateWeather(App.describeGoalWeather(weatherResult.value));
        } else {
            // Leave the previous weather chip visible if the dashboard route is unavailable.
        }
    },

    updateCurrencies(balance) {
        const sunlightToday = balance.sunlight_today || 0;
        const sunlightCap = balance.sunlight_cap || 120;
        const sunlightLifetime = balance.sunlight || 0;
        const starshards = balance.starshards || 0;

        this.setChipValue('hudSunlight', `${sunlightToday} / ${sunlightCap}`);
        this.setChipTitle('hudSunlight', `${sunlightLifetime} ☀ in lifetime balance`);
        this.setChipValue('hudShards', starshards);
        this.setChipTitle('hudShards', 'Starshards earned through streaks and milestones');
    },

    setChipValue(id, n) {
        const el = document.querySelector(`#${id} [data-role="value"]`);
        if (el) el.textContent = String(n);
    },

    setChipTitle(id, title) {
        const el = document.getElementById(id);
        if (el) el.title = title;
    },

    updateWeather(weather) {
        const chip = document.getElementById('hudWeather');
        if (!chip || !weather) return;

        chip.dataset.weather = weather.key;
        chip.title = weather.detail;

        const glyph = chip.querySelector('[data-role="glyph"]');
        const label = chip.querySelector('[data-role="label"]');
        if (glyph) glyph.textContent = weather.glyph;
        if (label) label.textContent = weather.label;
    },

    isHelpOpen() {
        return document.getElementById('helpOverlay')?.classList.contains('is-open');
    },

    openHelp(tab = 'tour') {
        const overlay = document.getElementById('helpOverlay');
        const panel = overlay?.querySelector('.help-overlay__panel');
        if (!overlay || !panel) return;

        this.lastFocusedElement = document.activeElement;
        overlay.classList.add('is-open');
        localStorage.setItem('detox-help-seen', '1');
        this.selectHelpTab(tab);
        requestAnimationFrame(() => panel.focus());
    },

    bindMotionPreference() {
        if (!this.motionMedia) {
            this.motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
        }
        if (this.motionListenerBound) return;

        const onChange = () => {
            if (App.prefersReducedMotion()) {
                this.stopTourTimer();
            } else if (this.isHelpOpen()) {
                const activeTab = document.querySelector('[data-help-tab].is-active');
                if (activeTab?.dataset.helpTab === 'tour') this.startTourTimer();
            }
        };
        if (this.motionMedia.addEventListener) {
            this.motionMedia.addEventListener('change', onChange);
        } else if (this.motionMedia.addListener) {
            this.motionMedia.addListener(onChange);
        }
        this.motionListenerBound = true;
    },

    closeHelp() {
        const overlay = document.getElementById('helpOverlay');
        if (!overlay) return;
        overlay.classList.remove('is-open');
        this.stopTourTimer();
        if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
            this.lastFocusedElement.focus();
        }
    },

    selectHelpTab(tab) {
        document.querySelectorAll('[data-help-tab]').forEach(button => {
            const active = button.dataset.helpTab === tab;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        document.querySelectorAll('[data-help-panel]').forEach(panel => {
            const active = panel.dataset.helpPanel === tab;
            panel.classList.toggle('is-active', active);
            panel.hidden = !active;
        });

        if (tab === 'tour') {
            this.renderTourStep();
            this.startTourTimer();
        } else {
            this.stopTourTimer();
        }

        if (tab === 'news') {
            this.loadChangelog();
        }
    },

    renderTourStep() {
        const step = this.tourSteps[this.helpTourIndex];
        const stepEl = document.getElementById('helpTourStep');
        const titleEl = document.getElementById('helpTourTitle');
        const bodyEl = document.getElementById('helpTourBody');
        const progressEl = document.getElementById('helpTourProgress');
        if (!stepEl || !titleEl || !bodyEl || !progressEl) return;

        stepEl.textContent = `Step ${this.helpTourIndex + 1} of ${this.tourSteps.length}`;
        titleEl.textContent = step[0];
        bodyEl.textContent = step[1];
        progressEl.innerHTML = this.tourSteps.map((_, index) => (
            `<span class="${index === this.helpTourIndex ? 'is-active' : ''}"></span>`
        )).join('');
    },

    nextTourStep() {
        this.helpTourIndex = (this.helpTourIndex + 1) % this.tourSteps.length;
        this.renderTourStep();
        this.restartTourTimer();
    },

    prevTourStep() {
        this.helpTourIndex = (this.helpTourIndex - 1 + this.tourSteps.length) % this.tourSteps.length;
        this.renderTourStep();
        this.restartTourTimer();
    },

    startTourTimer() {
        if (App.prefersReducedMotion()) return;
        this.stopTourTimer();
        this.helpTourIntervalId = setInterval(() => this.nextTourStep(), 6000);
    },

    restartTourTimer() {
        const activeTab = document.querySelector('[data-help-tab].is-active');
        if (activeTab?.dataset.helpTab === 'tour') {
            this.startTourTimer();
        }
    },

    stopTourTimer() {
        if (this.helpTourIntervalId) {
            clearInterval(this.helpTourIntervalId);
            this.helpTourIntervalId = null;
        }
    },

    async loadChangelog() {
        if (this.changelogLoaded) return;
        const list = document.getElementById('helpNewsList');
        if (!list) return;

        try {
            const entries = await App.api('/api/changelog');
            this.changelogLoaded = true;
            list.innerHTML = entries.map(entry => `
                <article class="help-news">
                    <time>${App.escapeHtml(App.formatDate(entry.date))}</time>
                    <strong>${App.escapeHtml(entry.title)}</strong>
                    <span>${App.escapeHtml(entry.body)}</span>
                </article>
            `).join('');
        } catch (e) {
            list.innerHTML = `<div class="help-news-empty">Unable to load changelog.</div>`;
        }
    },

    handleHelpKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.closeHelp();
            return;
        }

        if (e.key === 'Tab') {
            this.trapHelpFocus(e);
            return;
        }

        const activeTab = document.querySelector('[data-help-tab].is-active');

        if (e.key === 'ArrowRight' && activeTab?.dataset.helpTab === 'tour') {
            e.preventDefault();
            this.nextTourStep();
            return;
        }

        if (e.key === 'ArrowLeft' && activeTab?.dataset.helpTab === 'tour') {
            e.preventDefault();
            this.prevTourStep();
            return;
        }

        if (e.key === '?' && !this.isTyping(e.target)) {
            e.preventDefault();
            this.closeHelp();
        }
    },

    trapHelpFocus(e) {
        const overlay = document.getElementById('helpOverlay');
        if (!overlay) return;
        const focusable = [...overlay.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )].filter(el => !el.disabled && el.offsetParent !== null);
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    },
};

window.HUD = HUD;
