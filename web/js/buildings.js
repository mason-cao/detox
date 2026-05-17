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
        const wall = '#8b5e3c', wallSide = '#5e3e25', trim = '#3d2618';
        const stripeA = '#c4453a', stripeB = '#fff4d6';
        return `
            ${this.baseShadow(42, 6)}
            <!-- rear wall and right depth make this a full stall building, not a cutaway counter -->
            ${this.sideWall({ x: -34, y: -45, w: 68, h: 45, depth: 10, fill: wallSide })}
            <polygon points="-38,-46 38,-46 18,-70 -18,-70" fill="${stripeB}" stroke="#2a1e2a" stroke-width="1.4"/>
            <polygon points="38,-46 48,-53 26,-77 18,-70" fill="#7f2c25" stroke="#2a1e2a" stroke-width="1.1"/>
            <g class="b-stripe">
                ${[-32, -20, -8, 4, 16, 28].map(x => `<polygon points="${x},-46 ${x + 8},-46 ${x - 12},-70 ${x - 20},-70" fill="${stripeA}"/>`).join('')}
            </g>
            <rect x="-34" y="-45" width="68" height="45" fill="${wall}" stroke="#2a1e2a" stroke-width="1.5"/>
            <rect x="-34" y="-45" width="68" height="8" fill="#a77748" stroke="#2a1e2a" stroke-width="0.8"/>
            <rect x="-30" y="-39" width="6" height="39" fill="${trim}" stroke="#2a1e2a" stroke-width="0.6"/>
            <rect x="24" y="-39" width="6" height="39" fill="${trim}" stroke="#2a1e2a" stroke-width="0.6"/>
            <rect x="-20" y="-32" width="40" height="21" fill="#2f2118" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="-17" y="-29" width="34" height="15" fill="#f1c77d" stroke="#2a1e2a" stroke-width="0.8"/>
            <line x1="-12" y1="-29" x2="-12" y2="-14" stroke="#2a1e2a" stroke-width="0.45" opacity="0.55"/>
            <line x1="-1" y1="-29" x2="-1" y2="-14" stroke="#2a1e2a" stroke-width="0.45" opacity="0.55"/>
            <line x1="10" y1="-29" x2="10" y2="-14" stroke="#2a1e2a" stroke-width="0.45" opacity="0.55"/>
            <rect x="-34" y="-12" width="68" height="8" fill="${trim}" stroke="#2a1e2a" stroke-width="1"/>
            <g class="b-produce">
                <ellipse cx="-24" cy="-12" rx="3.2" ry="2.2" fill="#c4453a" stroke="#2a1e2a" stroke-width="0.45"/>
                <ellipse cx="-15" cy="-12" rx="3.2" ry="2.2" fill="#ffd04a" stroke="#2a1e2a" stroke-width="0.45"/>
                <ellipse cx="-6" cy="-12" rx="3.2" ry="2.2" fill="#6b8e4e" stroke="#2a1e2a" stroke-width="0.45"/>
                <ellipse cx="5" cy="-12" rx="3.2" ry="2.2" fill="#b59cff" stroke="#2a1e2a" stroke-width="0.45"/>
                <ellipse cx="16" cy="-12" rx="3.2" ry="2.2" fill="#c4453a" stroke="#2a1e2a" stroke-width="0.45"/>
                <ellipse cx="26" cy="-12" rx="3.2" ry="2.2" fill="#6b8e4e" stroke="#2a1e2a" stroke-width="0.45"/>
            </g>
            <rect x="-39" y="-53" width="78" height="8" fill="${stripeB}" stroke="#2a1e2a" stroke-width="1.1"/>
            ${[-35, -23, -11, 1, 13, 25].map(x => `<rect x="${x}" y="-53" width="6" height="8" fill="${stripeA}"/>`).join('')}
            <!-- swinging market sign tucked under the front eave -->
            <line x1="-23" y1="-53" x2="-23" y2="-44" stroke="#2a1e2a" stroke-width="0.8"/>
            <rect x="-30" y="-44" width="14" height="9" fill="#ffd04a" stroke="#2a1e2a" stroke-width="0.8"/>
            <text x="-23" y="-37.5" text-anchor="middle" font-size="6" fill="#2a1e2a">$</text>
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
        const post = '#5a4030', siding = '#795533', sidingSide = '#4b3321';
        return `
            ${this.baseShadow(32, 5)}
            ${this.sideWall({ x: -29, y: -39, w: 58, h: 39, depth: 7, fill: sidingSide })}
            <polygon points="-34,-39 34,-39 20,-57 -20,-57" fill="#5a4030" stroke="#2a1e2a" stroke-width="1.3"/>
            <polygon points="34,-39 41,-44 27,-62 20,-57" fill="#3d2a1e" stroke="#2a1e2a" stroke-width="1"/>
            <rect x="-29" y="-39" width="58" height="39" fill="${siding}" stroke="#2a1e2a" stroke-width="1.4"/>
            <line x1="-18" y1="-39" x2="-18" y2="0" stroke="#5a4030" stroke-width="0.6"/>
            <line x1="-6" y1="-39" x2="-6" y2="0" stroke="#5a4030" stroke-width="0.6"/>
            <line x1="6" y1="-39" x2="6" y2="0" stroke="#5a4030" stroke-width="0.6"/>
            <line x1="18" y1="-39" x2="18" y2="0" stroke="#5a4030" stroke-width="0.6"/>
            <rect x="-25" y="-39" width="4" height="39" fill="${post}" stroke="#2a1e2a" stroke-width="0.6"/>
            <rect x="21" y="-39" width="4" height="39" fill="${post}" stroke="#2a1e2a" stroke-width="0.6"/>
            <!-- framed chalk board inset into a small rule kiosk -->
            <polygon points="25,-32 31,-36 31,-8 25,-4" fill="#242424" stroke="#2a1e2a" stroke-width="0.9"/>
            <rect x="-25" y="-32" width="50" height="28" fill="#3a3a3a" stroke="#2a1e2a" stroke-width="1.4"/>
            <rect x="-21" y="-28" width="42" height="20" fill="#1a1a1a" stroke="#5a4a3a" stroke-width="1"/>
            <line x1="-16" y1="-23" x2="16" y2="-23" stroke="#fff4d6" stroke-width="0.7" opacity="0.85"/>
            <line x1="-16" y1="-17" x2="7" y2="-17" stroke="#fff4d6" stroke-width="0.7" opacity="0.85"/>
            <line x1="-16" y1="-11" x2="12" y2="-11" stroke="#fff4d6" stroke-width="0.7" opacity="0.85"/>
            <!-- chalk piece on a ledge -->
            <rect x="-28" y="-5" width="56" height="5" fill="#4b3321" stroke="#2a1e2a" stroke-width="0.7"/>
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

    /* ── Plumbing ────────────────────────────────────────────────────── */

    markup(id) {
        const fn = this[id];
        if (typeof fn !== 'function') return '';
        return fn.call(this);
    },

    anchor(tx, ty, size) {
        const span = size === 'major' ? 1 : 0;
        const { x, y } = Iso.tileToScreen(tx + span, ty + span);
        return { x, y: y + Iso.TILE_H / 2 + 80 };
    },
};

window.Buildings = Buildings;
