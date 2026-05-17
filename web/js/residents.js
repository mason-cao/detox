/* Residents - calm app markers + frontmost-glow binding.
   The Isle is the focus, so residents are static presence markers rather
   than moving sprite actors. */

const Residents = {
    // Eight archetypes. These map categories to marker styling, not sprite art.
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

    initialsFor(appName) {
        const words = String(appName || '').trim().split(/[\s._-]+/).filter(Boolean);
        if (!words.length) return '?';
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
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
            initials: this.initialsFor(app.app_name),
            minutes: Number(app.minutes || app.total_minutes || 0),
            category: app.category || 'Uncategorized',
            tile: { tx: 0, ty: 0 },
            isFrontmost: false,
        }));
    },

    // Internal cache of the mounted residents, keyed by app_name.
    _state: new Map(),
    _mountedSignature: '',

    // Open ground row at ty=4 plus two corners.
    _initialSlots: [
        { tx: 0, ty: 4 }, { tx: 2, ty: 4 }, { tx: 4, ty: 4 },
        { tx: 6, ty: 4 }, { tx: 8, ty: 4 }, { tx: 10, ty: 4 },
        { tx: 1, ty: 7 }, { tx: 11, ty: 7 },
    ],

    // Mount resident markers into the world's #worldResidents <g>.
    // Replaces any existing children. Idempotent across re-renders.
    mount(apps) {
        const layer = document.getElementById('worldResidents');
        if (!layer) return;

        const built = this.build(apps).map((r, i) => ({
            ...r,
            tile: this._initialSlots[i] || { tx: 5, ty: 4 },
        }));

        this._state.clear();
        this._mountedSignature = built.map(r => r.appName).join('\u0000');
        layer.innerHTML = built.map(r => this._render(r)).join('');
        built.forEach(r => this._state.set(r.appName, r));

        layer.querySelectorAll('.world__resident').forEach(node => {
            node.addEventListener('click', () => App.showTab('apps'));
        });

        this.startTicker();
    },

    update(apps) {
        const nextSignature = (apps || []).slice(0, 8).map(app => app.app_name).join('\u0000');
        if (nextSignature !== this._mountedSignature) {
            this.mount(apps);
            if (this._frontmostAppName) this._setGlow(this._frontmostAppName, true);
            return;
        }

        (apps || []).slice(0, 8).forEach(app => {
            const r = this._state.get(app.app_name);
            if (!r) return;
            r.minutes = Number(app.minutes || app.total_minutes || 0);
            const node = this._nodeFor(app.app_name);
            if (!node) return;
            node.dataset.minutes = String(Math.round(r.minutes));
            const label = node.querySelector('.world__resident-minutes');
            if (label) label.textContent = App.formatTime(r.minutes);
        });
    },

    // Render one resident as an SVG marker. No sprite atlas or walk cycle.
    _render(r) {
        const { x, y } = Iso.tileToScreen(r.tile.tx, r.tile.ty);
        const cy = y + Iso.TILE_H / 2 + 80; // sky headroom + tile-center
        return `
            <g class="world__resident" transform="translate(${x.toFixed(1)} ${cy.toFixed(1)})"
               data-app="${App.escapeAttr(r.appName)}"
               data-archetype="${r.archetype}"
               data-minutes="${Math.round(r.minutes)}"
               data-active="false"
               style="--tint: ${r.tint};">
                <title>${App.escapeHtml(r.appName)} - ${App.escapeHtml(App.formatTime(r.minutes))}</title>
                <circle class="effect-halo" cx="0" cy="-16" r="22" style="display: none;"></circle>
                <ellipse class="world__resident-shadow" cx="0" cy="1" rx="18" ry="5"></ellipse>
                <g class="world__resident-token">
                    <circle class="world__resident-ring" cx="0" cy="-18" r="16"></circle>
                    <circle class="world__resident-core" cx="0" cy="-18" r="11"></circle>
                    <text class="world__resident-initial" text-anchor="middle" x="0" y="-14">${App.escapeHtml(r.initials)}</text>
                </g>
                <text class="world__resident-name" text-anchor="middle" y="14">${App.escapeHtml(r.appName)}</text>
                <text class="world__resident-minutes" text-anchor="middle" y="27">${App.escapeHtml(App.formatTime(r.minutes))}</text>
            </g>
        `;
    },

    _tickInterval: null,

    startTicker() {
        this.stopTicker();
        // Static markers replaced the wandering sprite loop. Keeping this
        // method preserves the App.showTab contract without starting timers.
    },

    stopTicker() {
        if (this._tickInterval) clearInterval(this._tickInterval);
        this._tickInterval = null;
    },

    _nodeFor(appName) {
        return [...document.querySelectorAll('.world__resident')]
            .find(node => node.dataset.app === appName) || null;
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

        const node = this._nodeFor(appName);
        if (!node) return;

        node.setAttribute('data-active', on ? 'true' : 'false');

        const halo = node.querySelector('.effect-halo');
        if (halo) {
            halo.style.display = on ? '' : 'none';
            halo.classList.toggle('is-active', on);
        }

        // When turning on, snap the resident to home tile (their archetype's
        // first waypoint) no longer applies because residents are static.
        if (on) {
            node.parentNode?.appendChild(node);
        }
    },
};

window.Residents = Residents;
