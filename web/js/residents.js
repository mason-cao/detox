/* Residents - calm app markers + frontmost-glow binding.
   Residents glide along eased routes with requestAnimationFrame so the Isle
   stays alive without the old low-frame-rate sprite run cycle. */

const Residents = {
    // Eight archetypes. These map categories to villager styling.
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

    _spreadAnchors: [
        { tx: 0, ty: 1 }, { tx: 4, ty: 1 }, { tx: 8, ty: 1 }, { tx: 11, ty: 3 },
        { tx: 0, ty: 6 }, { tx: 4, ty: 7 }, { tx: 7, ty: 7 }, { tx: 11, ty: 7 },
    ],

    // Mount resident markers into the world's #worldResidents <g>.
    // Replaces any existing children. Idempotent across re-renders.
    mount(apps) {
        const layer = document.getElementById('worldResidents');
        if (!layer) return;

        const openTiles = this._walkableTiles(this._openTiles());
        const claimed = new Set();
        const residents = this.build(apps);
        const built = residents.map((r, i) => {
            const route = this._routeFor(r.appName, i, residents.length, openTiles, claimed);
            route.forEach(tile => claimed.add(this._tileKey(tile)));
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

    _routeFor(appName, index, total, openTiles, claimed) {
        const fallback = openTiles[0] || { tx: 0, ty: 0 };
        const start = this._pickStartTile(appName, index, total, openTiles, claimed) || fallback;
        const route = [start];
        const local = new Set([this._tileKey(start)]);

        for (let step = 0; step < 4; step++) {
            const current = route[route.length - 1];
            const candidates = openTiles
                .filter(tile => {
                    const key = this._tileKey(tile);
                    const distance = this._distance(tile, current);
                    return !local.has(key)
                        && !claimed.has(key)
                        && distance >= 1
                        && distance <= 2.4;
                })
                .sort((a, b) => this._routeScore(b, current, appName, index, step, claimed)
                    - this._routeScore(a, current, appName, index, step, claimed));

            const next = candidates[0] || openTiles
                .filter(tile => {
                    const key = this._tileKey(tile);
                    const distance = this._distance(tile, current);
                    return !local.has(key) && distance >= 1 && distance <= 2.4;
                })
                .sort((a, b) => this._routeScore(b, current, appName, index, step, claimed)
                    - this._routeScore(a, current, appName, index, step, claimed))[0];
            if (!next) break;
            route.push(next);
            local.add(this._tileKey(next));
        }

        if (route.length < 2) {
            const neighbor = openTiles
                .filter(tile => this._tileKey(tile) !== this._tileKey(start)
                    && this._distance(tile, start) >= 1
                    && this._distance(tile, start) <= 2.4)
                .sort((a, b) => this._distance(a, start) - this._distance(b, start))[0];
            if (neighbor) route.push(neighbor);
        }

        return route;
    },

    _pickStartTile(appName, index, total, openTiles, claimed) {
        const anchor = this._anchorFor(index, total);
        return openTiles
            .filter(tile => !claimed.has(this._tileKey(tile)))
            .sort((a, b) => this._startScore(b, anchor, appName, index, claimed)
                - this._startScore(a, anchor, appName, index, claimed))[0] || null;
    },

    _anchorFor(index, total) {
        const presets = total <= 4
            ? [0, 2, 4, 7]
            : total <= 6
                ? [0, 2, 3, 4, 5, 7]
                : [0, 1, 2, 3, 4, 5, 6, 7];
        return this._spreadAnchors[presets[index % presets.length]];
    },

    _startScore(tile, anchor, appName, index, claimed) {
        const anchorDistance = this._distance(tile, anchor);
        const spread = this._minClaimDistance(tile, claimed);
        const stableRandom = this._stableRandom(appName, tile.tx, tile.ty, index);
        return spread * 1.15 - anchorDistance * 1.4 + stableRandom * 2.6;
    },

    _routeScore(tile, current, appName, index, step, claimed) {
        const routeDistance = this._distance(tile, current);
        const spread = this._minClaimDistance(tile, claimed);
        const stableRandom = this._stableRandom(appName, tile.tx, tile.ty, index + step + 31);
        return stableRandom * 2.4 + spread * 0.28 - Math.abs(routeDistance - 1.5) * 0.9;
    },

    _blockedTiles() {
        const blocked = new Set();
        if (!window.Buildings || !Buildings.catalog) return blocked;

        Buildings.catalog.forEach(b => {
            const span = b.size === 'major' ? 1 : 0;
            for (let dx = 0; dx <= span; dx++) {
                for (let dy = 0; dy <= span; dy++) {
                    const tx = b.tx + dx;
                    const ty = b.ty + dy;
                    if (tx < 0 || ty < 0 || tx >= Iso.WORLD_TX || ty >= Iso.WORLD_TY) continue;
                    blocked.add(`${tx},${ty}`);
                }
            }
        });
        return blocked;
    },

    _openTiles() {
        const blocked = this._blockedTiles();
        const tiles = [];
        for (let ty = 0; ty < Iso.WORLD_TY; ty++) {
            for (let tx = 0; tx < Iso.WORLD_TX; tx++) {
                if (blocked.has(`${tx},${ty}`)) continue;
                tiles.push({ tx, ty });
            }
        }
        return tiles.length ? tiles : [{ tx: 0, ty: 0 }];
    },

    _walkableTiles(openTiles) {
        const walkable = openTiles.filter(tile => openTiles.some(other => {
            if (this._tileKey(other) === this._tileKey(tile)) return false;
            const distance = this._distance(tile, other);
            return distance >= 1 && distance <= 2.4;
        }));
        return walkable.length ? walkable : openTiles;
    },

    _tileKey(tile) {
        return `${tile.tx},${tile.ty}`;
    },

    _distance(a, b) {
        return Math.hypot(a.tx - b.tx, a.ty - b.ty);
    },

    _minClaimDistance(tile, claimed) {
        if (!claimed.size) return 8;
        let min = 99;
        claimed.forEach(key => {
            const [tx, ty] = key.split(',').map(Number);
            min = Math.min(min, Math.hypot(tile.tx - tx, tile.ty - ty));
        });
        return min;
    },

    _stableRandom(...parts) {
        const str = parts.join('|');
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0) / 4294967295;
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

    // Render one resident as a simple villager. No sprite atlas or walk cycle.
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
                <circle class="effect-halo" cx="0" cy="-17" r="22" style="display: none;"></circle>
                <ellipse class="world__resident-shadow" cx="0" cy="2" rx="13" ry="4"></ellipse>
                <g class="world__resident-villager">
                    <path class="world__resident-legs" d="M-4,-5 L-7,1 M4,-5 L7,1"></path>
                    <path class="world__resident-arms" d="M-8,-15 L-13,-9 M8,-15 L13,-9"></path>
                    <path class="world__resident-tunic" d="M-9,-18 Q0,-23 9,-18 L7,-6 L-7,-6 Z"></path>
                    <circle class="world__resident-head" cx="0" cy="-27" r="7"></circle>
                    <path class="world__resident-hat" d="M-12,-29 Q0,-40 12,-29 Z"></path>
                    <path class="world__resident-brim" d="M-14,-29 H14"></path>
                    <circle class="world__resident-eye" cx="-2.4" cy="-27" r="0.7"></circle>
                    <circle class="world__resident-eye" cx="2.4" cy="-27" r="0.7"></circle>
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
