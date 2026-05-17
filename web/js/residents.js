/* Residents - calm app markers + frontmost-glow binding.
   Residents glide along eased routes with requestAnimationFrame so the Isle
   stays alive without the old low-frame-rate sprite run cycle. */

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

    previewApps() {
        return [
            { app_name: 'Finder', category: 'Utilities', minutes: 0, preview: true },
            { app_name: 'Safari', category: 'Productivity', minutes: 0, preview: true },
            { app_name: 'Code', category: 'Development', minutes: 0, preview: true },
            { app_name: 'Music', category: 'Music', minutes: 0, preview: true },
        ];
    },

    sourceApps(apps) {
        return apps && apps.length ? apps : this.previewApps();
    },

    // Build the resident objects from /api/dashboard's `apps` array.
    // Residents are stable per app_name across renders so frontmost-binding
    // can target a known DOM node.
    build(apps) {
        return this.sourceApps(apps).slice(0, 8).map(app => ({
            appName: app.app_name,
            archetype: this.archetypeFor(app.category),
            tint: this.tintFor(app.app_name),
            initials: this.initialsFor(app.app_name),
            minutes: Number(app.minutes || app.total_minutes || 0),
            category: app.category || 'Uncategorized',
            preview: Boolean(app.preview),
            tile: { tx: 0, ty: 0 },
            route: [],
            cycleMs: 24000,
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

    _routes: [
        [{ tx: 0, ty: 4 }, { tx: 1, ty: 5 }, { tx: 2, ty: 4 }, { tx: 1, ty: 4 }],
        [{ tx: 2, ty: 4 }, { tx: 3, ty: 5 }, { tx: 4, ty: 4 }, { tx: 3, ty: 4 }],
        [{ tx: 4, ty: 4 }, { tx: 4, ty: 6 }, { tx: 3, ty: 7 }, { tx: 2, ty: 7 }],
        [{ tx: 6, ty: 4 }, { tx: 7, ty: 5 }, { tx: 7, ty: 7 }, { tx: 5, ty: 7 }],
        [{ tx: 8, ty: 4 }, { tx: 9, ty: 4 }, { tx: 9, ty: 7 }, { tx: 8, ty: 6 }],
        [{ tx: 10, ty: 4 }, { tx: 11, ty: 4 }, { tx: 11, ty: 7 }, { tx: 10, ty: 6 }],
        [{ tx: 1, ty: 7 }, { tx: 2, ty: 6 }, { tx: 4, ty: 7 }, { tx: 2, ty: 7 }],
        [{ tx: 11, ty: 7 }, { tx: 10, ty: 6 }, { tx: 8, ty: 7 }, { tx: 10, ty: 7 }],
    ],

    // Mount resident markers into the world's #worldResidents <g>.
    // Replaces any existing children. Idempotent across re-renders.
    mount(apps) {
        const layer = document.getElementById('worldResidents');
        if (!layer) return;

        const built = this.build(apps).map((r, i) => {
            const route = this._routes[i] || [this._initialSlots[i] || { tx: 5, ty: 4 }];
            return {
                ...r,
                tile: route[0],
                route,
                cycleMs: 22000 + (this.tintFor(r.appName) % 9) * 1200,
            };
        });

        this._state.clear();
        this._mountedSignature = built.map(r => `${r.preview ? 'preview' : 'app'}:${r.appName}`).join('\u0000');
        layer.innerHTML = built.map(r => this._render(r)).join('');
        built.forEach(r => this._state.set(r.appName, r));

        layer.querySelectorAll('.world__resident').forEach(node => {
            node.addEventListener('click', () => App.showTab('apps'));
        });

        this.startTicker();
    },

    update(apps) {
        const source = this.sourceApps(apps);
        const nextSignature = source.slice(0, 8)
            .map(app => `${app.preview ? 'preview' : 'app'}:${app.app_name}`)
            .join('\u0000');
        if (nextSignature !== this._mountedSignature) {
            this.mount(apps);
            if (this._frontmostAppName) this._setGlow(this._frontmostAppName, true);
            return;
        }

        source.slice(0, 8).forEach(app => {
            const r = this._state.get(app.app_name);
            if (!r) return;
            r.minutes = Number(app.minutes || app.total_minutes || 0);
            const node = this._nodeFor(app.app_name);
            if (!node) return;
            node.dataset.minutes = String(Math.round(r.minutes));
            const label = node.querySelector('.world__resident-minutes');
            if (label) label.textContent = App.formatTime(r.minutes);
            const title = node.querySelector('title');
            if (title) title.textContent = `${app.app_name}${app.preview ? ' preview' : ''} - ${App.formatTime(r.minutes)}`;
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
               data-preview="${r.preview ? 'true' : 'false'}"
               data-active="false"
               style="--tint: ${r.tint};">
                <title>${App.escapeHtml(r.appName)}${r.preview ? ' preview' : ''} - ${App.escapeHtml(App.formatTime(r.minutes))}</title>
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

    _animationFrame: null,

    startTicker() {
        this.stopTicker();
        if (App.prefersReducedMotion()) return;
        const step = (ts) => {
            this._tick(ts);
            this._animationFrame = requestAnimationFrame(step);
        };
        this._animationFrame = requestAnimationFrame(step);
    },

    stopTicker() {
        if (this._animationFrame) cancelAnimationFrame(this._animationFrame);
        this._animationFrame = null;
    },

    _nodeFor(appName) {
        return [...document.querySelectorAll('.world__resident')]
            .find(node => node.dataset.app === appName) || null;
    },

    _tick(now) {
        const layer = document.getElementById('worldResidents');
        if (!layer) return this.stopTicker();

        this._state.forEach((r, appName) => {
            if (!r.route || r.route.length < 2) return;
            const offset = this.tintFor(appName) * 137;
            const cycle = r.cycleMs || 26000;
            const t = ((now + offset) % cycle) / cycle;
            const legFloat = t * r.route.length;
            const leg = Math.floor(legFloat);
            const progress = this._smoothstep(legFloat - leg);
            const a = r.route[leg];
            const b = r.route[(leg + 1) % r.route.length];
            const tx = a.tx + (b.tx - a.tx) * progress;
            const ty = a.ty + (b.ty - a.ty) * progress;
            const bob = Math.sin((now + offset) / 850) * 1.4;
            this._setPosition(appName, tx, ty, bob);
        });
    },

    _smoothstep(t) {
        return t * t * (3 - 2 * t);
    },

    _setPosition(appName, tx, ty, bob = 0) {
        const node = this._nodeFor(appName);
        if (!node) return;
        const { x, y } = Iso.tileToScreen(tx, ty);
        const cy = y + Iso.TILE_H / 2 + 80 + bob;
        node.setAttribute('transform', `translate(${x.toFixed(1)} ${cy.toFixed(1)})`);
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

        // Keep the active app visually readable above neighboring residents.
        if (on) {
            node.parentNode?.appendChild(node);
        }
    },
};

window.Residents = Residents;
