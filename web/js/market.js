/* ── The Market (placeholder - economy lands in Phase 1d) ───────────── */

const Market = {
    async render(container) {
        destroyCharts();
        container.innerHTML = `
            <div class="fade-in">
                <h1 class="page-heading">The Market</h1>
                <div class="market-placeholder">
                    <div class="market-placeholder__seal">🏪</div>
                    <div class="market-placeholder__title">THE STALLS ARE CLOSED</div>
                    <div class="market-placeholder__body">
                        The mayor is still building the economy.<br>
                        Return when Sunlight can be earned and spent.
                    </div>
                </div>
            </div>
        `;
    },
};
