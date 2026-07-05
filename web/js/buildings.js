/* Pixel-art buildings. Each generator returns inner SVG for a <g>
 * anchored at (0, 0) with the building's base on the x-axis. Sprites come
 * from the Px grid engine (pixel-sprites.js) — crisp rect runs only.
 * World placement applies a translate() at mount time. */

const Buildings = {
    /* ── Configuration ───────────────────────────────────────────────── */
    defaultCatalog: [
        { id: 'townHall',  tab: 'dashboard', label: 'Town Hall',   tx: 5, ty: 1, size: 'major' },
        { id: 'registry',  tab: 'apps',      label: 'Registry',    tx: 1, ty: 2, size: 'major' },
        { id: 'market',    tab: 'market',    label: 'Market',      tx: 9, ty: 2, size: 'major' },
        { id: 'chronicle', tab: 'stats',     label: 'Chronicle',   tx: 5, ty: 5, size: 'major' },
        { id: 'charter',   tab: 'goals',     label: 'Charter',     tx: 3, ty: 0, size: 'minor' },
        { id: 'ruleBoard', tab: 'blocker',   label: 'Rule Board',  tx: 8, ty: 5, size: 'minor' },
        { id: 'postcards', tab: 'cards',     label: 'Postcards',   tx: 2, ty: 6, size: 'minor' },
        { id: 'study',     tab: 'settings',  label: 'Mayor Study', tx: 10, ty: 0, size: 'minor' },
    ],
    catalog: [],

    setCatalog(buildings) {
        const source = Array.isArray(buildings) && buildings.length ? buildings : this.defaultCatalog;
        this.catalog = source.map(building => ({
            ...building,
            kind: building.kind || building.id,
            footprint: building.footprint || (building.size === 'major' ? { w: 2, h: 2 } : { w: 1, h: 1 }),
        }));
        return this.catalog;
    },

    resetCatalog() {
        const source = window.IslandState?.coreBuildings || this.defaultCatalog;
        return this.setCatalog(source);
    },

    /* ── Helpers ─────────────────────────────────────────────────────── */

    baseShadow(halfWidth, depth = 4) {
        return Px.baseShadow(halfWidth + 6, depth);
    },

    /* ── Generators (pixel sprites) ──────────────────────────────────── */

    townHall()  { return `${Px.baseShadow(48, 6)}${Px.buildings.townHall()}`; },
    registry()  { return `${Px.baseShadow(44, 5)}${Px.buildings.registry()}`; },
    market()    { return `${Px.baseShadow(50, 6)}${Px.buildings.market()}`; },
    chronicle() { return `${Px.baseShadow(44, 5)}${Px.buildings.chronicle()}`; },
    charter()   { return `${Px.baseShadow(32, 4)}${Px.buildings.charter()}`; },
    ruleBoard() { return `${Px.baseShadow(38, 5)}${Px.buildings.ruleBoard()}`; },
    postcards() { return `${Px.baseShadow(32, 4)}${Px.buildings.postcards()}`; },
    study()     { return `${Px.baseShadow(32, 4)}${Px.buildings.study()}`; },

    marketBuilding(building = {}) {
        const key = String(building.itemKey || building.id || '');
        const accent = key.includes('bath') ? '#4e86a0'
            : key.includes('bakery') ? '#d14b3d'
                : key.includes('apothecary') ? '#3f6d31'
                    : key.includes('tea') ? '#b8862e'
                        : '#8a4a34';
        return `${Px.baseShadow(36, 4)}${Px.buildings.genericShop(accent)}`;
    },

    dock()       { return `${Px.baseShadow(32, 4)}${Px.buildings.dock()}`; },
    bridge()     { return `${Px.baseShadow(36, 4)}${Px.buildings.bridge()}`; },
    lighthouse() { return `${Px.baseShadow(24, 4)}${Px.buildings.lighthouse()}`; },
    greenhouse() { return `${Px.baseShadow(34, 4)}${Px.buildings.greenhouse()}`; },
    grove()      { return `${Px.baseShadow(28, 4)}${Px.buildings.grove()}`; },
    lookout()    { return `${Px.baseShadow(26, 4)}${Px.buildings.lookout()}`; },
    shore()      { return `${Px.baseShadow(30, 4)}${Px.buildings.shore()}`; },

    mapFeature(building = {}) {
        const key = String(building.itemKey || '');
        if (key.includes('dock') || key.includes('pier')) return this.dock(building);
        if (key.includes('bridge')) return this.bridge(building);
        if (key.includes('lighthouse')) return this.lighthouse(building);
        if (key.includes('grove') || key.includes('orchard') || key.includes('garden')) return this.grove(building);
        if (key.includes('spring') || key.includes('beach') || key.includes('reef')) return this.shore(building);
        if (key.includes('tower') || key.includes('overlook') || key.includes('plateau')) return this.lookout(building);
        return this.grove(building);
    },

    bakery(building) { return this.marketBuilding(building); },
    bathhouse(building) { return this.marketBuilding(building); },
    workshop(building) { return this.marketBuilding(building); },
    inn(building) { return this.marketBuilding(building); },
    schoolhouse(building) { return this.marketBuilding(building); },
    teaShop(building) { return this.marketBuilding(building); },
    apothecary(building) { return this.marketBuilding(building); },
    observatory(building) { return this.marketBuilding(building); },
    cave(building) { return this.mapFeature(building); },

    /* ── Plumbing ────────────────────────────────────────────────────── */

    markup(id, building = {}) {
        const fn = this[id] || this[building.kind] || this.marketBuilding;
        if (typeof fn !== 'function') return '';
        return fn.call(this, building);
    },

    anchor(tx, ty, size) {
        const span = size === 'major' ? 1 : 0;
        const { x, y } = Iso.tileToScreen(tx + span, ty + span);
        return { x, y: y + Iso.TILE_H / 2 + 80 };
    },

    anchorFor(building) {
        const footprint = building.footprint || (building.size === 'major' ? { w: 2, h: 2 } : { w: 1, h: 1 });
        const { x, y } = Iso.tileToScreen(building.tx + footprint.w - 1, building.ty + footprint.h - 1);
        return { x, y: y + Iso.TILE_H / 2 + 80 };
    },
};

Buildings.resetCatalog();
window.Buildings = Buildings;
