/* HUD — currency counters, help overlay, monitor status. */

const HUD = {
    refreshIntervalId: null,

    init() {
        this.refresh();
        // Poll every 30 seconds; no push channel yet.
        this.refreshIntervalId = setInterval(() => this.refresh(), 30000);

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
            const [dashboard, stats] = await Promise.all([
                App.api('/api/dashboard'),
                App.api('/api/stats/daily'),
            ]);
            this.updateCurrencies(dashboard, stats);
        } catch (_) {
            // Counters stay at their last known value; monitor status dot
            // already surfaces agent health separately.
        }
    },

    updateCurrencies(dashboard, stats) {
        const budget = dashboard.goal_target || 0;
        const used = dashboard.total_minutes || 0;
        // Sunlight: every minute under budget earns 1 ☀, capped at 120/day.
        // If no budget is set, pay 0 — can't reward against an undefined goal.
        const sunlight = budget > 0 ? Math.max(0, Math.min(120, Math.floor(budget - used))) : 0;
        // Starshards: 1 per hour of longest detox today. Cheap proxy until
        // Plan 4 introduces the real streak/milestone ledger.
        const shards = Math.floor((stats.longest_detox_minutes || 0) / 60);

        this.setChipValue('hudSunlight', sunlight);
        this.setChipValue('hudShards', shards);
    },

    setChipValue(id, n) {
        const el = document.querySelector(`#${id} [data-role="value"]`);
        if (el) el.textContent = String(n);
    },

    openHelp() {
        document.getElementById('helpOverlay').classList.add('is-open');
    },

    closeHelp() {
        document.getElementById('helpOverlay').classList.remove('is-open');
    },
};

window.HUD = HUD;
