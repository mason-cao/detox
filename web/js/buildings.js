/* Programmatic SVG buildings. Each generator returns an SVG <g> string
   anchored at (0, 0) with the building's base on the x-axis. World
   placement applies a translate() at mount time. */

const Buildings = {
    /* ── Configuration ─────────────────────────────────────────────────
       Each building has: tab id, label, tile coords (top-left of footprint),
       size class ('major' | 'minor'), and a generator function. */
    catalog: [
        { id: 'townHall',  tab: 'dashboard', label: 'Town Hall',   tx: 5, ty: 1, size: 'major' },
        { id: 'registry',  tab: 'apps',      label: 'Registry',    tx: 1, ty: 2, size: 'major' },
        { id: 'market',    tab: 'market',    label: 'Market',      tx: 9, ty: 2, size: 'major' },
        { id: 'chronicle', tab: 'stats',     label: 'Chronicle',   tx: 5, ty: 5, size: 'major' },
        { id: 'charter',   tab: 'goals',     label: 'Charter',     tx: 3, ty: 0, size: 'minor' },
        { id: 'ruleBoard', tab: 'blocker',   label: 'Rule Board',  tx: 8, ty: 5, size: 'minor' },
        { id: 'postcards', tab: 'cards',     label: 'Postcards',   tx: 2, ty: 6, size: 'minor' },
        { id: 'study',     tab: 'settings',  label: 'Mayor Study', tx: 10, ty: 0, size: 'minor' },
    ],

    /* ── Generators — return inner markup of a <g> ─────────────────── */

    townHall() {
        return `
            <rect x="-30" y="-44" width="60" height="44" fill="#c4a47a" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-34,-44 34,-44 0,-72" fill="#8b3a2a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-8" y="-28" width="16" height="28" fill="#2a1e2a"/>
            <circle cx="0" cy="-58" r="3" fill="#ffd04a"/>
            <rect x="-22" y="-32" width="10" height="10" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="12" y="-32" width="10" height="10" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
        `;
    },

    registry() {
        return `
            <rect x="-26" y="-44" width="52" height="44" fill="#a87a4a" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-30,-44 30,-44 0,-66" fill="#5a3a2a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-6" y="-26" width="12" height="26" fill="#2a1e2a"/>
            <rect x="-20" y="-36" width="8" height="14" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="12" y="-36" width="8" height="14" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
        `;
    },

    market() {
        return `
            <rect x="-28" y="-40" width="56" height="40" fill="#8b5e3c" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-32,-40 32,-40 0,-58" fill="#c4453a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-32" y="-58" width="64" height="6" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="-28" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="-20" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="-12" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="-4" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="4" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="12" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="20" y="-58" width="4" height="6" fill="#c4453a"/>
            <rect x="-6" y="-22" width="12" height="22" fill="#2a1e2a"/>
        `;
    },

    chronicle() {
        return `
            <rect x="-28" y="-44" width="56" height="44" fill="#9b7a4a" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-32,-44 32,-44 0,-68" fill="#5a3a2a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-6" y="-26" width="12" height="26" fill="#2a1e2a"/>
            <rect x="-22" y="-38" width="14" height="12" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="8" y="-38" width="14" height="12" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="-22" y1="-32" x2="-8" y2="-32" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="-15" y1="-38" x2="-15" y2="-26" stroke="#2a1e2a" stroke-width="1"/>
        `;
    },

    charter() {
        return `
            <rect x="-20" y="-32" width="40" height="32" fill="#6b8e4e" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-22,-32 22,-32 0,-50" fill="#4a6b3a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-5" y="-20" width="10" height="20" fill="#2a1e2a"/>
        `;
    },

    ruleBoard() {
        return `
            <rect x="-22" y="-30" width="44" height="30" fill="#3a3a3a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-18" y="-26" width="36" height="22" fill="#1a1a1a" stroke="#5a4a3a" stroke-width="1"/>
            <line x1="-12" y1="-20" x2="12" y2="-20" stroke="#fff4d6" stroke-width="0.6" opacity="0.8"/>
            <line x1="-12" y1="-14" x2="6" y2="-14" stroke="#fff4d6" stroke-width="0.6" opacity="0.8"/>
            <line x1="-12" y1="-8" x2="10" y2="-8" stroke="#fff4d6" stroke-width="0.6" opacity="0.8"/>
        `;
    },

    postcards() {
        return `
            <rect x="-20" y="-26" width="40" height="26" fill="#7a5c3a" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-22,-26 22,-26 0,-44" fill="#5a3a2a" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-12" y="-20" width="24" height="14" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="-12" y1="-13" x2="12" y2="-13" stroke="#2a1e2a" stroke-width="0.6"/>
        `;
    },

    study() {
        return `
            <rect x="-20" y="-32" width="40" height="32" fill="#3a2a4a" stroke="#2a1e2a" stroke-width="2"/>
            <polygon points="-22,-32 22,-32 0,-50" fill="#241a3d" stroke="#2a1e2a" stroke-width="2"/>
            <rect x="-5" y="-20" width="10" height="20" fill="#1a1330"/>
            <circle cx="0" cy="-38" r="2" fill="#ffd04a"/>
            <rect x="10" y="-26" width="6" height="10" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
        `;
    },

    /* ── Helpers ─────────────────────────────────────────────────────── */

    // Get the inner SVG markup for a building by id.
    markup(id) {
        const fn = this[id];
        if (typeof fn !== 'function') return '';
        return fn.call(this);
    },

    // Anchor offset (in pixels) for a footprint at tile (tx, ty).
    // Building base sits at the south corner of the southernmost tile —
    // i.e. at the bottom of the footprint diamond.
    anchor(tx, ty, size) {
        const span = size === 'major' ? 1 : 0; // major occupies tx..tx+1
        const { x, y } = Iso.tileToScreen(tx + span, ty + span);
        return { x, y: y + Iso.TILE_H / 2 + 80 }; // +80 for sky headroom
    },
};

window.Buildings = Buildings;
