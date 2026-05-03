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

        this.startTicker();
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

    // Three-waypoint loops, in tile coords. Walks are slow — 4 s per leg.
    // Tuned to keep residents on open ground (ty=3..6, tx=0..11) and away
    // from the major-building 2x2 footprints.
    paths: {
        // All waypoints clear of major footprints — Town Hall (5-6, 1-2),
        // Registry (1-2, 2-3), Market (9-10, 2-3), Chronicle (5-6, 5-6) —
        // and minor footprints Charter (3,0), Rule Board (8,5), Postcards (2,6),
        // Mayor Study (10,0). Open ground is ty=4 and ty=7.
        scribe:    [{ tx: 0, ty: 4 }, { tx: 3, ty: 4 }, { tx: 3, ty: 7 }],
        builder:   [{ tx: 6, ty: 4 }, { tx: 8, ty: 4 }, { tx: 7, ty: 7 }],
        jester:    [{ tx: 4, ty: 4 }, { tx: 4, ty: 7 }, { tx: 1, ty: 7 }],
        farmer:    [{ tx: 11, ty: 4 }, { tx: 11, ty: 7 }, { tx: 9, ty: 7 }],
        musician:  [{ tx: 5, ty: 4 }, { tx: 5, ty: 7 }, { tx: 6, ty: 7 }],
        wanderer:  [{ tx: 7, ty: 4 }, { tx: 0, ty: 7 }, { tx: 11, ty: 7 }],
        sheriff:   [{ tx: 4, ty: 4 }, { tx: 7, ty: 4 }, { tx: 9, ty: 4 }],
        // Banished sits offshore; never walks.
        banished:  null,
    },

    _tickInterval: null,
    _legDurationMs: 4000,

    startTicker() {
        this.stopTicker();
        if (App.prefersReducedMotion()) return; // residents stand still
        this._tickInterval = setInterval(() => this._tick(), 1000 / 6); // 6 fps
    },

    stopTicker() {
        if (this._tickInterval) clearInterval(this._tickInterval);
        this._tickInterval = null;
    },

    _tick() {
        const layer = document.getElementById('worldResidents');
        if (!layer) return this.stopTicker();
        const now = performance.now();

        this._state.forEach((r, appName) => {
            // Frontmost residents stand at their home tile and don't walk.
            if (r.isFrontmost) return;

            const path = this.paths[r.archetype];
            if (!path) return; // banished — no walk

            // Use an app-name-keyed offset so the 8 residents don't march in lockstep.
            const offset = this.tintFor(appName) * 13;
            const cycleMs = path.length * this._legDurationMs;
            const t = ((now + offset) % cycleMs) / cycleMs;
            const legCount = path.length;
            const leg = Math.floor(t * legCount);
            const legProgress = (t * legCount) - leg;
            const a = path[leg];
            const b = path[(leg + 1) % legCount];
            const tx = a.tx + (b.tx - a.tx) * legProgress;
            const ty = a.ty + (b.ty - a.ty) * legProgress;

            // Walk-frame advances by one every 167ms; mod 4.
            const frame = Math.floor(now / 167) % 4;

            this._reposition(appName, tx, ty, frame);
        });
    },

    _reposition(appName, tx, ty, frame) {
        const node = document.querySelector(`.world__resident[data-app="${App.escapeAttr(appName)}"]`);
        if (!node) return;
        const { x, y } = Iso.tileToScreen(tx, ty);
        const cy = y + Iso.TILE_H / 2 + 80;
        node.setAttribute('transform', `translate(${x.toFixed(1)} ${cy.toFixed(1)})`);
        const img = node.querySelector('.world__resident-sprite');
        if (img) img.setAttribute('x', String(-frame * 32 - 16));
    },

    _pollInterval: null,
    _pollMs: 3000,
    _frontmostAppName: null,

    startPoll() {
        this.stopPoll();
        this._poll();
        this._pollInterval = setInterval(() => this._poll(), this._pollMs);
    },

    stopPoll() {
        if (this._pollInterval) clearInterval(this._pollInterval);
        this._pollInterval = null;
    },

    async _poll() {
        try {
            const res = await App.api('/api/dashboard/now');
            this.applyFrontmost(res && res.app_name ? res.app_name : null);
        } catch (e) {
            // Network blip; leave glow state untouched.
        }
    },

    applyFrontmost(appName) {
        if (this._frontmostAppName === appName) return;
        const prev = this._frontmostAppName;
        this._frontmostAppName = appName;

        if (prev) this._setGlow(prev, false);
        if (appName) this._setGlow(appName, true);
    },

    _setGlow(appName, on) {
        const r = this._state.get(appName);
        if (!r) return;
        r.isFrontmost = on;

        const node = document.querySelector(`.world__resident[data-app="${App.escapeAttr(appName)}"]`);
        if (!node) return;

        node.setAttribute('data-active', on ? 'true' : 'false');

        const halo = node.querySelector('.effect-halo');
        if (halo) {
            halo.style.display = on ? '' : 'none';
            halo.classList.toggle('is-active', on);
        }

        // When turning on, snap the resident to home tile (their archetype's
        // first waypoint) so the glow appears at a stable, readable spot.
        if (on) {
            const path = this.paths[r.archetype];
            if (path && path.length) {
                this._reposition(appName, path[0].tx, path[0].ty, 0);
            }
        }
    },
};

window.Residents = Residents;
