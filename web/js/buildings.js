/* Programmatic SVG buildings with iso depth — front face, right side
 * panel, and a layered roof slope so each structure reads as a real
 * volume under the iso projection. Each generator returns inner SVG
 * for a <g> anchored at (0, 0) with the building's base on the x-axis.
 * World placement applies a translate() at mount time.
 *
 * Common scaffolding (base shadow, side panel, roof side slope, door,
 * windows) lives in helpers below — generators just describe the
 * silhouette + ornament that distinguishes each building. */

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

    // Drop-shadow ellipse beneath each building base.
    baseShadow(halfWidth, depth = 4) {
        return `<ellipse class="b-shadow" cx="0" cy="2" rx="${halfWidth + 6}" ry="${depth}"/>`;
    },

    // Right-side wall panel — the iso "depth" face. Renders behind the
    // front face since the front draws on top.
    sideWall({ x, y, w, h, depth = 7, fill, stroke = '#2a1e2a' }) {
        const rx = x + w; // right edge of front face
        const ry = y;
        const points = [
            [rx, ry],
            [rx + depth, ry - depth],
            [rx + depth, ry + h - depth],
            [rx, ry + h],
        ].map(p => p.join(',')).join(' ');
        return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    },

    // Hipped roof side slope — the right-hand triangle that emerges
    // beside the front roof under the iso projection.
    roofSide({ apex, eaveLeft, eaveRight, depth = 7, fill, stroke = '#2a1e2a' }) {
        const points = [
            [apex.x, apex.y],
            [apex.x + depth, apex.y - depth * 0.6],
            [eaveRight.x + depth, eaveRight.y - depth],
            [eaveRight.x, eaveRight.y],
        ].map(p => p.join(',')).join(' ');
        void eaveLeft;
        return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    },

    // Window with a cross mullion. (cx, cy) is its top-left.
    window(cx, cy, w = 10, h = 10) {
        return `
            <g class="b-window" transform="translate(${cx} ${cy})">
                <rect width="${w}" height="${h}" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
                <line x1="${w / 2}" y1="0" x2="${w / 2}" y2="${h}" stroke="#2a1e2a" stroke-width="0.6"/>
                <line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="#2a1e2a" stroke-width="0.6"/>
            </g>
        `;
    },

    // Door with a small handle dot.
    door(cx, cy, w = 12, h = 22) {
        return `
            <g class="b-door" transform="translate(${cx} ${cy})">
                <rect width="${w}" height="${h}" fill="#2a1e2a"/>
                <rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#5a4030" stroke-width="0.6"/>
                <circle cx="${w - 3}" cy="${h / 2}" r="0.8" fill="#ffd04a"/>
            </g>
        `;
    },

    /* ── Generators ──────────────────────────────────────────────────── */

    townHall() {
        const wall = '#c4a47a', wallSide = '#9a7d5a';
        const roof = '#8b3a2a', roofSide = '#67281e';
        return `
            ${this.baseShadow(34, 5)}
            ${this.sideWall({ x: -30, y: -44, w: 60, h: 44, depth: 8, fill: wallSide })}
            ${this.roofSide({
                apex: { x: 0, y: -72 },
                eaveLeft: { x: -34, y: -44 },
                eaveRight: { x: 34, y: -44 },
                depth: 8,
                fill: roofSide,
            })}
            <rect x="-30" y="-44" width="60" height="44" fill="${wall}" stroke="#2a1e2a" stroke-width="1.5"/>
            <polygon points="-34,-44 34,-44 0,-72" fill="${roof}" stroke="#2a1e2a" stroke-width="1.5"/>
            <!-- column accents on the front -->
            <rect x="-26" y="-44" width="2" height="44" fill="#2a1e2a" opacity="0.35"/>
            <rect x="24" y="-44" width="2" height="44" fill="#2a1e2a" opacity="0.35"/>
            <!-- clock face under gable -->
            <circle cx="0" cy="-58" r="5" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="0" y1="-58" x2="0" y2="-62" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="0" y1="-58" x2="3" y2="-58" stroke="#2a1e2a" stroke-width="1"/>
            ${this.window(-22, -34, 10, 12)}
            ${this.window(12, -34, 10, 12)}
            ${this.door(-6, -22, 12, 22)}
            <!-- weather-vane finial -->
            <line x1="0" y1="-72" x2="0" y2="-80" stroke="#2a1e2a" stroke-width="1"/>
            <polygon points="0,-80 4,-78 0,-76 -4,-78" fill="#ffd04a" stroke="#2a1e2a" stroke-width="0.6"/>
        `;
    },

    registry() {
        const wall = '#a87a4a', wallSide = '#7d5530';
        const roof = '#5a3a2a', roofSide = '#3d2618';
        return `
            ${this.baseShadow(30, 4)}
            ${this.sideWall({ x: -26, y: -44, w: 52, h: 44, depth: 7, fill: wallSide })}
            ${this.roofSide({
                apex: { x: 0, y: -66 },
                eaveLeft: { x: -30, y: -44 },
                eaveRight: { x: 30, y: -44 },
                depth: 7,
                fill: roofSide,
            })}
            <rect x="-26" y="-44" width="52" height="44" fill="${wall}" stroke="#2a1e2a" stroke-width="1.5"/>
            <polygon points="-30,-44 30,-44 0,-66" fill="${roof}" stroke="#2a1e2a" stroke-width="1.5"/>
            <!-- timber beams across the front -->
            <line x1="-26" y1="-30" x2="26" y2="-30" stroke="#5a3a2a" stroke-width="0.8"/>
            <line x1="-26" y1="-16" x2="26" y2="-16" stroke="#5a3a2a" stroke-width="0.8"/>
            <!-- ledger sign hanging beside the door -->
            <line x1="14" y1="-44" x2="14" y2="-36" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="10" y="-36" width="14" height="9" fill="#fff4d6" stroke="#2a1e2a" stroke-width="0.8"/>
            <line x1="12" y1="-33" x2="22" y2="-33" stroke="#2a1e2a" stroke-width="0.4"/>
            <line x1="12" y1="-31" x2="20" y2="-31" stroke="#2a1e2a" stroke-width="0.4"/>
            ${this.window(-20, -36, 9, 13)}
            ${this.door(-6, -22, 12, 22)}
        `;
    },

    market() {
        const wall = '#9a643d', wallSide = '#664127', trim = '#3d2618';
        const roof = '#9f342b', roofSide = '#6f241e', stripeA = '#c4453a', stripeB = '#fff4d6';
        return `
            ${this.baseShadow(42, 6)}
            ${this.sideWall({ x: -34, y: -42, w: 68, h: 42, depth: 10, fill: wallSide })}
            ${this.roofSide({
                apex: { x: 0, y: -72 },
                eaveLeft: { x: -40, y: -42 },
                eaveRight: { x: 40, y: -42 },
                depth: 10,
                fill: roofSide,
            })}
            <rect x="-34" y="-42" width="68" height="42" fill="${wall}" stroke="#2a1e2a" stroke-width="1.5"/>
            <polygon points="-40,-42 40,-42 0,-72" fill="${roof}" stroke="#2a1e2a" stroke-width="1.5"/>
            <line x1="-28" y1="-51" x2="28" y2="-51" stroke="#6f241e" stroke-width="1.2" opacity="0.7"/>
            <rect x="-42" y="-43" width="84" height="12" fill="${stripeB}" stroke="#2a1e2a" stroke-width="1.2"/>
            <polygon points="42,-43 52,-49 52,-37 42,-31" fill="#7f2c25" stroke="#2a1e2a" stroke-width="1"/>
            ${[-38, -26, -14, -2, 10, 22, 34].map(x => `<rect x="${x}" y="-43" width="6" height="12" fill="${stripeA}"/>`).join('')}
            <rect x="-31" y="-31" width="62" height="26" fill="#6f4729" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="-28" y="-28" width="56" height="16" fill="#f1c77d" stroke="#2a1e2a" stroke-width="0.8"/>
            <line x1="-14" y1="-28" x2="-14" y2="-12" stroke="#2a1e2a" stroke-width="0.45" opacity="0.55"/>
            <line x1="0" y1="-28" x2="0" y2="-12" stroke="#2a1e2a" stroke-width="0.45" opacity="0.55"/>
            <line x1="14" y1="-28" x2="14" y2="-12" stroke="#2a1e2a" stroke-width="0.45" opacity="0.55"/>
            <rect x="-34" y="-10" width="68" height="7" fill="${trim}" stroke="#2a1e2a" stroke-width="1"/>
            <g class="b-produce">
                <ellipse cx="-24" cy="-10" rx="3.2" ry="2.2" fill="#c4453a" stroke="#2a1e2a" stroke-width="0.45"/>
                <ellipse cx="-15" cy="-10" rx="3.2" ry="2.2" fill="#ffd04a" stroke="#2a1e2a" stroke-width="0.45"/>
                <ellipse cx="-6" cy="-10" rx="3.2" ry="2.2" fill="#6b8e4e" stroke="#2a1e2a" stroke-width="0.45"/>
                <ellipse cx="5" cy="-10" rx="3.2" ry="2.2" fill="#b59cff" stroke="#2a1e2a" stroke-width="0.45"/>
                <ellipse cx="16" cy="-10" rx="3.2" ry="2.2" fill="#c4453a" stroke="#2a1e2a" stroke-width="0.45"/>
                <ellipse cx="26" cy="-10" rx="3.2" ry="2.2" fill="#6b8e4e" stroke="#2a1e2a" stroke-width="0.45"/>
            </g>
            <rect x="19" y="-29" width="7" height="19" fill="${trim}" stroke="#2a1e2a" stroke-width="0.7"/>
            <line x1="-23" y1="-43" x2="-23" y2="-34" stroke="#2a1e2a" stroke-width="0.8"/>
            <rect x="-30" y="-34" width="14" height="9" fill="#ffd04a" stroke="#2a1e2a" stroke-width="0.8"/>
            <text x="-23" y="-27.5" text-anchor="middle" font-size="6" fill="#2a1e2a">$</text>
        `;
    },

    chronicle() {
        const wall = '#9b7a4a', wallSide = '#705333';
        const roof = '#5a3a2a', roofSide = '#3d2618';
        return `
            ${this.baseShadow(32, 5)}
            ${this.sideWall({ x: -28, y: -44, w: 56, h: 44, depth: 7, fill: wallSide })}
            ${this.roofSide({
                apex: { x: 0, y: -68 },
                eaveLeft: { x: -32, y: -44 },
                eaveRight: { x: 32, y: -44 },
                depth: 7,
                fill: roofSide,
            })}
            <rect x="-28" y="-44" width="56" height="44" fill="${wall}" stroke="#2a1e2a" stroke-width="1.5"/>
            <polygon points="-32,-44 32,-44 0,-68" fill="${roof}" stroke="#2a1e2a" stroke-width="1.5"/>
            <!-- bookshelf shapes hint at the chronicle -->
            <g class="b-shelf">
                <rect x="-22" y="-38" width="14" height="12" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
                <line x1="-22" y1="-32" x2="-8" y2="-32" stroke="#2a1e2a" stroke-width="0.6"/>
                <line x1="-15" y1="-38" x2="-15" y2="-26" stroke="#2a1e2a" stroke-width="0.6"/>
                <rect x="8" y="-38" width="14" height="12" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
                <line x1="8" y1="-32" x2="22" y2="-32" stroke="#2a1e2a" stroke-width="0.6"/>
                <line x1="15" y1="-38" x2="15" y2="-26" stroke="#2a1e2a" stroke-width="0.6"/>
            </g>
            ${this.door(-6, -22, 12, 22)}
            <!-- chimney with thin smoke -->
            <rect x="14" y="-62" width="6" height="10" fill="#5a3a2a" stroke="#2a1e2a" stroke-width="0.8"/>
            <g class="b-smoke-stack" aria-hidden="true">
                <path class="b-smoke b-smoke--a" d="M17,-63 q-4,-7 0,-13 q4,-5 0,-11"/>
                <path class="b-smoke b-smoke--b" d="M19,-65 q5,-7 1,-13 q-3,-5 1,-10"/>
                <path class="b-smoke b-smoke--c" d="M15,-64 q-5,-8 -1,-14 q5,-5 1,-11"/>
            </g>
        `;
    },

    charter() {
        const wall = '#6b8e4e', wallSide = '#4a6b35';
        const roof = '#4a6b3a', roofSide = '#314821';
        return `
            ${this.baseShadow(22, 4)}
            ${this.sideWall({ x: -20, y: -32, w: 40, h: 32, depth: 6, fill: wallSide })}
            ${this.roofSide({
                apex: { x: 0, y: -50 },
                eaveLeft: { x: -22, y: -32 },
                eaveRight: { x: 22, y: -32 },
                depth: 6,
                fill: roofSide,
            })}
            <rect x="-20" y="-32" width="40" height="32" fill="${wall}" stroke="#2a1e2a" stroke-width="1.5"/>
            <polygon points="-22,-32 22,-32 0,-50" fill="${roof}" stroke="#2a1e2a" stroke-width="1.5"/>
            <!-- scroll inset on the front -->
            <rect x="-12" y="-26" width="24" height="14" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="-9" y1="-21" x2="9" y2="-21" stroke="#2a1e2a" stroke-width="0.5"/>
            <line x1="-9" y1="-17" x2="6" y2="-17" stroke="#2a1e2a" stroke-width="0.5"/>
            ${this.door(-5, -12, 10, 12)}
        `;
    },

    ruleBoard() {
        const siding = '#795533', sidingSide = '#4b3321';
        const roof = '#5a3a2a', roofSide = '#3d2618';
        return `
            ${this.baseShadow(32, 5)}
            ${this.sideWall({ x: -28, y: -38, w: 56, h: 38, depth: 8, fill: sidingSide })}
            ${this.roofSide({
                apex: { x: 0, y: -62 },
                eaveLeft: { x: -34, y: -38 },
                eaveRight: { x: 34, y: -38 },
                depth: 8,
                fill: roofSide,
            })}
            <rect x="-28" y="-38" width="56" height="38" fill="${siding}" stroke="#2a1e2a" stroke-width="1.4"/>
            <polygon points="-34,-38 34,-38 0,-62" fill="${roof}" stroke="#2a1e2a" stroke-width="1.4"/>
            <line x1="-23" y1="-38" x2="-23" y2="0" stroke="#5a4030" stroke-width="0.6"/>
            <line x1="23" y1="-38" x2="23" y2="0" stroke="#5a4030" stroke-width="0.6"/>
            <line x1="-17" y1="-47" x2="17" y2="-47" stroke="#3d2618" stroke-width="1" opacity="0.6"/>
            <!-- framed chalk board inset into a complete rule hut -->
            <polygon points="22,-31 28,-35 28,-8 22,-4" fill="#242424" stroke="#2a1e2a" stroke-width="0.9"/>
            <rect x="-22" y="-31" width="44" height="27" fill="#3a3a3a" stroke="#2a1e2a" stroke-width="1.4"/>
            <rect x="-18" y="-27" width="36" height="19" fill="#1a1a1a" stroke="#5a4a3a" stroke-width="1"/>
            <line x1="-16" y1="-23" x2="16" y2="-23" stroke="#fff4d6" stroke-width="0.7" opacity="0.85"/>
            <line x1="-14" y1="-17" x2="7" y2="-17" stroke="#fff4d6" stroke-width="0.7" opacity="0.85"/>
            <line x1="-14" y1="-11" x2="12" y2="-11" stroke="#fff4d6" stroke-width="0.7" opacity="0.85"/>
            <!-- chalk piece on a ledge -->
            <rect x="-24" y="-5" width="48" height="5" fill="#4b3321" stroke="#2a1e2a" stroke-width="0.7"/>
            <rect x="-2" y="-7" width="7" height="2" fill="#fff4d6" stroke="#2a1e2a" stroke-width="0.4"/>
        `;
    },

    postcards() {
        const wall = '#7a5c3a', wallSide = '#52391f';
        const roof = '#5a3a2a', roofSide = '#3d2618';
        return `
            ${this.baseShadow(22, 4)}
            ${this.sideWall({ x: -20, y: -26, w: 40, h: 26, depth: 6, fill: wallSide })}
            ${this.roofSide({
                apex: { x: 0, y: -44 },
                eaveLeft: { x: -22, y: -26 },
                eaveRight: { x: 22, y: -26 },
                depth: 6,
                fill: roofSide,
            })}
            <rect x="-20" y="-26" width="40" height="26" fill="${wall}" stroke="#2a1e2a" stroke-width="1.5"/>
            <polygon points="-22,-26 22,-26 0,-44" fill="${roof}" stroke="#2a1e2a" stroke-width="1.5"/>
            <!-- mounted postcard above the door -->
            <rect x="-12" y="-20" width="24" height="14" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="-12" y1="-13" x2="12" y2="-13" stroke="#2a1e2a" stroke-width="0.6"/>
            <rect x="-10" y="-18" width="6" height="4" fill="#c4453a" stroke="#2a1e2a" stroke-width="0.4"/>
            <!-- mailbox flag -->
            <rect x="14" y="-6" width="6" height="6" fill="#c4453a" stroke="#2a1e2a" stroke-width="0.6"/>
            <line x1="20" y1="-6" x2="22" y2="-9" stroke="#c4453a" stroke-width="1.5"/>
        `;
    },

    study() {
        const wall = '#3a2a4a', wallSide = '#241a3d';
        const roof = '#241a3d', roofSide = '#150e26';
        return `
            ${this.baseShadow(22, 4)}
            ${this.sideWall({ x: -20, y: -32, w: 40, h: 32, depth: 6, fill: wallSide })}
            ${this.roofSide({
                apex: { x: 0, y: -50 },
                eaveLeft: { x: -22, y: -32 },
                eaveRight: { x: 22, y: -32 },
                depth: 6,
                fill: roofSide,
            })}
            <rect x="-20" y="-32" width="40" height="32" fill="${wall}" stroke="#2a1e2a" stroke-width="1.5"/>
            <polygon points="-22,-32 22,-32 0,-50" fill="${roof}" stroke="#2a1e2a" stroke-width="1.5"/>
            <!-- arched stained-glass window -->
            <path d="M-7,-26 L-7,-18 A7,7 0 0 1 7,-18 L7,-26 Z" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="0" y1="-26" x2="0" y2="-12" stroke="#2a1e2a" stroke-width="0.6"/>
            <line x1="-7" y1="-19" x2="7" y2="-19" stroke="#2a1e2a" stroke-width="0.6"/>
            ${this.door(-5, -12, 10, 12)}
            <!-- finial lamp on roof -->
            <line x1="0" y1="-50" x2="0" y2="-56" stroke="#2a1e2a" stroke-width="1"/>
            <circle cx="0" cy="-58" r="2" fill="#ffd04a" stroke="#2a1e2a" stroke-width="0.6"/>
        `;
    },

    marketBuilding(building = {}) {
        const key = String(building.itemKey || building.id || '');
        const wall = key.includes('tea') ? '#b78352'
            : key.includes('inn') ? '#9f7a55'
                : key.includes('school') ? '#b98f56'
                    : '#8d6848';
        const wallSide = key.includes('tea') ? '#765436'
            : key.includes('inn') ? '#6c5036'
                : key.includes('school') ? '#735438'
                    : '#5f4630';
        const roof = key.includes('bath') ? '#4e86a0'
            : key.includes('bakery') ? '#c4453a'
                : key.includes('apothecary') ? '#4a6b3a'
                    : '#7b3f31';
        const roofSide = key.includes('bath') ? '#356272'
            : key.includes('bakery') ? '#862f29'
                : key.includes('apothecary') ? '#314821'
                    : '#512a24';
        return `
            ${this.baseShadow(27, 4)}
            ${this.sideWall({ x: -24, y: -36, w: 48, h: 36, depth: 7, fill: wallSide })}
            ${this.roofSide({
                apex: { x: 0, y: -60 },
                eaveLeft: { x: -29, y: -36 },
                eaveRight: { x: 29, y: -36 },
                depth: 7,
                fill: roofSide,
            })}
            <rect x="-24" y="-36" width="48" height="36" fill="${wall}" stroke="#2a1e2a" stroke-width="1.5"/>
            <polygon points="-29,-36 29,-36 0,-60" fill="${roof}" stroke="#2a1e2a" stroke-width="1.5"/>
            <rect x="-22" y="-34" width="44" height="8" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <path d="M-19,-34 V-26 M-9,-34 V-26 M1,-34 V-26 M11,-34 V-26 M21,-34 V-26" stroke="${roof}" stroke-width="3"/>
            ${this.window(-17, -22, 9, 10)}
            ${this.window(8, -22, 9, 10)}
            ${this.door(-5, -14, 10, 14)}
            <rect x="-10" y="-47" width="20" height="9" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1"/>
            <line x1="-6" y1="-43" x2="6" y2="-43" stroke="#2a1e2a" stroke-width="0.7"/>
        `;
    },

    dock(building = {}) {
        void building;
        return `
            ${this.baseShadow(26, 4)}
            <path d="M-30,-4 L-10,-16 L32,5 L12,17 Z" fill="#7b5635" stroke="#2a1e2a" stroke-width="1.6"/>
            <path d="M-22,-4 L-2,-15 M-12,1 L8,-10 M-2,6 L18,-5 M8,11 L28,0" stroke="#4b3321" stroke-width="1.1"/>
            <path d="M-20,-12 V-27 M8,-7 V-25 M25,1 V-17" stroke="#2a1e2a" stroke-width="2"/>
            <path d="M8,-25 H25 L21,-17 H8 Z" fill="#c4453a" stroke="#2a1e2a" stroke-width="1.2"/>
        `;
    },

    bridge(building = {}) {
        void building;
        return `
            ${this.baseShadow(30, 4)}
            <path d="M-34,-2 C-16,-20 16,-20 34,-2 L25,10 C12,-4 -12,-4 -25,10 Z" fill="#8d6848" stroke="#2a1e2a" stroke-width="1.6"/>
            <path d="M-28,-4 C-13,-15 13,-15 28,-4" fill="none" stroke="#fff4d6" stroke-width="2"/>
            <path d="M-22,1 V-11 M0,-7 V-20 M22,1 V-11" stroke="#2a1e2a" stroke-width="1.4"/>
        `;
    },

    lighthouse(building = {}) {
        void building;
        return `
            ${this.baseShadow(20, 4)}
            <path d="M-14,0 L-9,-50 H9 L14,0 Z" fill="#fff4d6" stroke="#2a1e2a" stroke-width="1.5"/>
            <path d="M-10,-31 H10 M-12,-15 H12" stroke="#c4453a" stroke-width="5"/>
            <rect x="-12" y="-60" width="24" height="12" fill="#5b8fb9" stroke="#2a1e2a" stroke-width="1.4"/>
            <polygon points="-16,-60 16,-60 0,-72" fill="#c4453a" stroke="#2a1e2a" stroke-width="1.4"/>
            <path d="M12,-54 L38,-63 M-12,-54 L-38,-63" stroke="#ffd04a" stroke-width="3" opacity="0.78"/>
            ${this.door(-5, -12, 10, 12)}
        `;
    },

    greenhouse(building = {}) {
        void building;
        return `
            ${this.baseShadow(30, 4)}
            <path d="M-28,0 H28 V-30 Q0,-58 -28,-30 Z" fill="rgba(127,200,223,.58)" stroke="#2a1e2a" stroke-width="1.6"/>
            <path d="M-16,0 V-41 M0,0 V-54 M16,0 V-41 M-24,-22 H24" stroke="#2a1e2a" stroke-width="1.1"/>
            <path d="M-18,-4 Q0,-20 18,-4" fill="#6b8e4e" stroke="#2a1e2a" stroke-width="1.2"/>
            <circle cx="-7" cy="-14" r="3" fill="#ffd04a" stroke="#2a1e2a" stroke-width="0.8"/>
            <circle cx="10" cy="-16" r="3" fill="#c4453a" stroke="#2a1e2a" stroke-width="0.8"/>
        `;
    },

    grove(building = {}) {
        void building;
        return `
            ${this.baseShadow(24, 4)}
            <g stroke="#2a1e2a" stroke-width="1.2">
                <rect x="-2" y="-24" width="5" height="24" fill="#7b5635"/>
                <circle cx="0" cy="-28" r="15" fill="#4a6b3a"/>
                <circle cx="-13" cy="-19" r="9" fill="#6b8e4e"/>
                <circle cx="13" cy="-19" r="9" fill="#6b8e4e"/>
                <circle cx="6" cy="-31" r="3" fill="#ffd04a"/>
                <circle cx="-8" cy="-24" r="3" fill="#c4453a"/>
            </g>
        `;
    },

    lookout(building = {}) {
        void building;
        return `
            ${this.baseShadow(24, 4)}
            <path d="M-18,0 L-11,-46 H11 L18,0 Z" fill="#7b5635" stroke="#2a1e2a" stroke-width="1.5"/>
            <rect x="-18" y="-52" width="36" height="12" fill="#b98f56" stroke="#2a1e2a" stroke-width="1.5"/>
            <path d="M-16,-44 H16 M-12,-34 H12" stroke="#fff4d6" stroke-width="1.4"/>
            <path d="M-24,-50 H24" stroke="#2a1e2a" stroke-width="2"/>
        `;
    },

    shore(building = {}) {
        void building;
        return `
            ${this.baseShadow(26, 4)}
            <path d="M-28,-4 C-12,-22 12,-23 28,-4 C15,10 -16,10 -28,-4 Z" fill="#f6d39b" stroke="#2a1e2a" stroke-width="1.5"/>
            <ellipse cx="0" cy="-3" rx="18" ry="7" fill="#5b8fb9" stroke="#2a1e2a" stroke-width="1.2"/>
            <path d="M-12,-3 C-4,-8 7,-8 14,-2" fill="none" stroke="#fff4d6" stroke-width="2"/>
            <circle cx="18" cy="-12" r="4" fill="#ffd04a" stroke="#2a1e2a" stroke-width="1"/>
        `;
    },

    mapFeature(building = {}) {
        const key = String(building.itemKey || '');
        if (key.includes('dock') || key.includes('pier')) return this.dock(building);
        if (key.includes('bridge')) return this.bridge(building);
        if (key.includes('lighthouse')) return this.lighthouse(building);
        if (key.includes('grove') || key.includes('orchard') || key.includes('garden')) return this.grove(building);
        if (key.includes('spring') || key.includes('beach') || key.includes('reef')) return this.shore(building);
        if (key.includes('tower') || key.includes('overlook') || key.includes('plateau')) return this.lookout(building);
        return `
            ${this.baseShadow(20, 4)}
            <path d="M-20,-4 L0,-22 L20,-4 L0,12 Z" fill="#6b8e4e" stroke="#2a1e2a" stroke-width="1.5"/>
            <path d="M-8,-4 C-2,-12 8,-12 14,-5" fill="none" stroke="#f6d39b" stroke-width="4" stroke-linecap="round"/>
            <path d="M3,-16 V-34" stroke="#2a1e2a" stroke-width="2"/>
            <path d="M3,-34 H20 L16,-25 H3 Z" fill="#ffd04a" stroke="#2a1e2a" stroke-width="1.3"/>
        `;
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
