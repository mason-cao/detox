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
                    <div class="market-placeholder__pledge">
                        The mayor does not accept gold from the outside world.
                    </div>
                    <div class="market-placeholder__body">
                        Sunlight and Starshards will open this bazaar for decorations,
                        building skins, weather charms, outfits, maps, and sounds.
                    </div>
                    <div class="market-placeholder__categories" aria-label="Planned market categories">
                        <span>DECOR</span>
                        <span>BUILDINGS</span>
                        <span>WEATHER</span>
                        <span>OUTFITS</span>
                        <span>MAPS</span>
                        <span>SOUNDS</span>
                    </div>
                </div>
            </div>
        `;
    },
};
