/* HUD — currency counters, help overlay, monitor status. */

const HUD = {
    refreshIntervalId: null,

    init() {
        this.refresh();
        // Poll every 30 seconds; no push channel yet.
        this.refreshIntervalId = setInterval(() => this.refresh(), 30000);
        window.addEventListener('focus', () => this.refresh());
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.refresh();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === '?' && !this.isTyping(e.target)) {
                e.preventDefault();
                this.openHelp();
            } else if (e.key === 'Escape') {
                this.closeHelp();
            }
        });
    },

    isTyping(el) {
        const tag = el && el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || (el && el.isContentEditable);
    },

    async refresh() {
        try {
            const balance = await App.api('/api/rewards/balance');
            this.updateCurrencies(balance);
        } catch (_) {
            // Counters stay at their last known value; monitor status dot
            // already surfaces agent health separately.
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

    openHelp() {
        document.getElementById('helpOverlay').classList.add('is-open');
    },

    closeHelp() {
        document.getElementById('helpOverlay').classList.remove('is-open');
    },
};

window.HUD = HUD;
