/* Residents — sprite-atlas walk + frontmost-glow binding.
   Foundation: archetype assignment from app category. */

const Residents = {
    // Eight archetypes, each backed by a 128×32 PNG atlas under
    // web/assets/sprites/residents/. Order is the enumeration order
    // used when no app maps to a given archetype.
    archetypes: ['scribe', 'builder', 'jester', 'banished', 'farmer', 'musician', 'wanderer', 'sheriff'],

    // Map an app's category (from agent/config.py) to an archetype.
    // Categories that don't appear here fall through to 'wanderer'.
    archetypeFor(category) {
        const map = {
            productivity: 'scribe',
            'dev tools': 'builder',
            development: 'builder',
            entertainment: 'jester',
            social: 'jester',
            utilities: 'farmer',
            media: 'musician',
            music: 'musician',
            enforcement: 'sheriff',
        };
        return map[(category || '').toLowerCase()] || 'wanderer';
    },

    // Hash an app name to a stable 0-359 hue rotation for per-app uniqueness.
    // Two apps in the same archetype get distinguishable shirt tints.
    tintFor(appName) {
        let h = 0;
        for (let i = 0; i < appName.length; i++) {
            h = ((h << 5) - h + appName.charCodeAt(i)) | 0;
        }
        return Math.abs(h) % 360;
    },

    // Build the resident objects from /api/dashboard's `apps` array.
    // Residents are stable per app_name across renders so frontmost-binding
    // can target a known DOM node.
    build(apps) {
        if (!apps || !apps.length) return [];
        return apps.slice(0, 8).map(app => ({
            appName: app.app_name,
            archetype: this.archetypeFor(app.category),
            tint: this.tintFor(app.app_name),
            tile: { tx: 0, ty: 0 },     // assigned by walk-path init in Task 5
            progress: 0,                 // 0-1 within the current path leg
            frame: 0,                    // 0-3 walk-cycle frame
            isFrontmost: false,
        }));
    },

    // Internal cache of the mounted residents, keyed by app_name.
    _state: new Map(),

    // Slots reused from 1e — open ground row at ty=4 plus two corners.
    _initialSlots: [
        { tx: 0, ty: 4 }, { tx: 2, ty: 4 }, { tx: 4, ty: 4 },
        { tx: 6, ty: 4 }, { tx: 8, ty: 4 }, { tx: 10, ty: 4 },
        { tx: 1, ty: 7 }, { tx: 11, ty: 7 },
    ],

    // Mount sprite residents into the world's #worldResidents <g>.
    // Replaces any existing children. Idempotent across re-renders.
    mount(apps) {
        const layer = document.getElementById('worldResidents');
        if (!layer) return;

        const built = this.build(apps).map((r, i) => ({
            ...r,
            tile: this._initialSlots[i] || { tx: 5, ty: 4 },
        }));

        this._state.clear();
        layer.innerHTML = built.map(r => this._render(r)).join('');
        built.forEach(r => this._state.set(r.appName, r));

        layer.querySelectorAll('.world__resident').forEach(node => {
            node.addEventListener('click', () => App.showTab('apps'));
        });
    },

    // Render one resident as an SVG <g>. The <image>'s x attribute is
    // -frame*32 so the same atlas serves all four walk frames.
    _render(r) {
        const { x, y } = Iso.tileToScreen(r.tile.tx, r.tile.ty);
        const cy = y + Iso.TILE_H / 2 + 80; // sky headroom + tile-center
        const ix = -r.frame * 32;
        const clipId = `resClip-${this._slug(r.appName)}`;
        return `
            <g class="world__resident" transform="translate(${x.toFixed(1)} ${cy.toFixed(1)})"
               data-app="${App.escapeAttr(r.appName)}"
               data-archetype="${r.archetype}"
               data-active="false"
               style="--tint: ${r.tint};">
                <defs>
                    <clipPath id="${clipId}"><rect x="-16" y="-32" width="32" height="32"/></clipPath>
                </defs>
                <circle class="effect-halo" cx="0" cy="-16" r="22" style="display: none;"></circle>
                <image class="world__resident-sprite"
                       href="/assets/sprites/residents/${r.archetype}.png"
                       x="${ix - 16}" y="-32" width="128" height="32"
                       clip-path="url(#${clipId})"
                       style="filter: hue-rotate(${r.tint}deg);"></image>
                <text class="world__resident-name" text-anchor="middle" y="14">${App.escapeHtml(r.appName)}</text>
            </g>
        `;
    },

    _slug(s) { return s.replace(/[^a-z0-9]/gi, '_'); },
};

window.Residents = Residents;
