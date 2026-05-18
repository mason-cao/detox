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
        const buildingBoxes = this._buildingBoxes();
        const tiles = [];
        for (let ty = 0; ty < Iso.WORLD_TY; ty++) {
            for (let tx = 0; tx < Iso.WORLD_TX; tx++) {
                if (blocked.has(`${tx},${ty}`)) continue;
                if (this._tileOverlapsBuilding({ tx, ty }, buildingBoxes)) continue;
                tiles.push({ tx, ty });
            }
        }
        return tiles.length ? tiles : [{ tx: 0, ty: 0 }];
    },

    _buildingBoxes() {
        if (!window.Buildings || !Buildings.catalog) return [];
        return Buildings.catalog.map(b => {
            const { x, y } = Buildings.anchor(b.tx, b.ty, b.size);
            const major = b.size === 'major';
            return {
                id: b.id,
                left: x - (major ? 58 : 42),
                right: x + (major ? 66 : 50),
                top: y - (major ? 90 : 68),
                bottom: y + (major ? 24 : 20),
            };
        });
    },

    _tileOverlapsBuilding(tile, buildingBoxes) {
        const { x, y } = Iso.tileToScreen(tile.tx, tile.ty);
        const cy = y + Iso.TILE_H / 2 + 80;
        return buildingBoxes.some(box => (
            x >= box.left
            && x <= box.right
            && cy >= box.top
            && cy <= box.bottom
        ));
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
            if (title) title.textContent = `${app.app_name}${app.preview ? ' preview' : ''} - ${this.roleLabelFor(r.archetype)} - ${App.formatTime(r.minutes)}`;
        });
    },

    roleLabelFor(archetype) {
        const labels = {
            scribe: 'registry scribe',
            builder: 'dock builder',
            jester: 'social jester',
            banished: 'banished rower',
            farmer: 'field keeper',
            musician: 'harbor musician',
            wanderer: 'isle wanderer',
            sheriff: 'rule sheriff',
        };
        return labels[archetype] || 'isle villager';
    },

    boatFor(archetype) {
        if (archetype !== 'banished') return '';
        return `
            <path class="world__resident-boat" d="M-22,-2 C-13,7 13,7 22,-2 L16,8 H-16 Z"></path>
            <path class="world__resident-boat-line" d="M-14,1 H14 M-18,-2 L-25,-12 M18,-2 L25,-12"></path>
        `;
    },

    cloakFor(archetype) {
        if (archetype === 'wanderer') {
            return `<path class="world__resident-cloak" d="M-14,-19 Q0,-30 14,-19 L16,-2 Q0,5 -16,-2 Z"></path>`;
        }
        if (archetype === 'banished') {
            return `<path class="world__resident-cloak" d="M-12,-18 Q0,-26 12,-18 L10,-4 Q0,1 -10,-4 Z"></path>`;
        }
        return `<path class="world__resident-cloak" d="M-11,-18 Q0,-27 11,-18 L14,-4 Q0,2 -14,-4 Z"></path>`;
    },

    headwearFor(archetype) {
        const hats = {
            builder: '<path class="world__resident-hardhat" d="M-10,-31 Q0,-40 10,-31 H-10 Z"></path><path class="world__resident-brim" d="M-13,-31 H13"></path><path class="world__resident-hardhat-line" d="M0,-38 V-31"></path>',
            scribe: '<path class="world__resident-hair" d="M-7,-29 Q-1,-37 8,-31 Q3,-34 -5,-28 Z"></path><path class="world__resident-cap" d="M-9,-32 Q0,-39 9,-32 L4,-36 Q0,-38 -4,-36 Z"></path>',
            jester: '<path class="world__resident-jester-cap" d="M-9,-31 Q-16,-42 -4,-35 Q0,-42 5,-35 Q16,-42 10,-31 Z"></path><circle class="world__resident-bell" cx="-15" cy="-42" r="2"></circle><circle class="world__resident-bell" cx="15" cy="-42" r="2"></circle>',
            farmer: '<path class="world__resident-hat" d="M-14,-31 Q0,-43 14,-31 Z"></path><path class="world__resident-brim" d="M-18,-31 H18"></path><path class="world__resident-hat-band" d="M-8,-32 H8"></path>',
            musician: '<path class="world__resident-cap" d="M-11,-31 Q0,-41 11,-31 Z"></path><path class="world__resident-feather" d="M7,-36 C16,-46 18,-33 9,-31"></path><path class="world__resident-brim" d="M-13,-31 H13"></path>',
            wanderer: '<path class="world__resident-hood" d="M-11,-28 Q0,-42 11,-28 Q6,-35 0,-35 Q-6,-35 -11,-28 Z"></path>',
            sheriff: '<path class="world__resident-sheriff-hat" d="M-14,-31 Q0,-42 14,-31 Z"></path><path class="world__resident-brim" d="M-19,-31 H19"></path><path class="world__resident-hat-band" d="M-9,-32 H9"></path>',
            banished: '<path class="world__resident-hair" d="M-7,-29 Q0,-34 7,-29 Q1,-31 -5,-27 Z"></path>',
        };
        return hats[archetype] || hats.wanderer;
    },

    faceDetailFor(archetype) {
        if (archetype === 'scribe') {
            return `<circle class="world__resident-glasses" cx="-3" cy="-27" r="2.2"></circle><circle class="world__resident-glasses" cx="3" cy="-27" r="2.2"></circle><path class="world__resident-glasses" d="M-1,-27 H1"></path>`;
        }
        if (archetype === 'sheriff') {
            return `<path class="world__resident-brow" d="M-5,-29 L-2,-28 M2,-28 L5,-29"></path>`;
        }
        if (archetype === 'jester') {
            return `<circle class="world__resident-cheek" cx="-5" cy="-25" r="1.5"></circle><circle class="world__resident-cheek" cx="5" cy="-25" r="1.5"></circle>`;
        }
        return '';
    },

    torsoDetailFor(archetype) {
        if (archetype === 'jester') {
            return `<path class="world__resident-diamond" d="M0,-17 L4,-13 L0,-9 L-4,-13 Z"></path>`;
        }
        if (archetype === 'sheriff') {
            return `<path class="world__resident-badge" d="M0,-18 L2,-15 L5,-15 L3,-13 L4,-10 L0,-12 L-4,-10 L-3,-13 L-5,-15 L-2,-15 Z"></path>`;
        }
        if (archetype === 'banished') {
            return `<path class="world__resident-patch" d="M-4,-17 H4 L3,-12 H-3 Z"></path>`;
        }
        return '';
    },

    toolFor(archetype) {
        const tools = {
            builder: '<g class="world__resident-tool world__resident-tool--builder"><path d="M11,-17 L20,-26"></path><rect x="18" y="-30" width="8" height="6"></rect></g>',
            scribe: '<g class="world__resident-tool world__resident-tool--scribe"><rect x="-18" y="-20" width="10" height="13"></rect><path d="M-16,-16 H-10 M-16,-12 H-11"></path><path d="M-7,-21 L-1,-28"></path></g>',
            musician: '<g class="world__resident-tool world__resident-tool--musician"><path d="M12,-18 C23,-21 24,-8 12,-9 Z"></path><path d="M15,-18 V-28"></path><path d="M16,-25 H23"></path></g>',
            farmer: '<g class="world__resident-tool world__resident-tool--farmer"><path d="M13,-17 C21,-24 26,-18 20,-10"></path><path d="M16,-20 C16,-13 21,-12 24,-15"></path></g>',
            sheriff: '<g class="world__resident-tool world__resident-tool--sheriff"><path d="M14,-18 V-31"></path><rect x="10" y="-33" width="8" height="10"></rect><circle cx="14" cy="-28" r="5"></circle></g>',
            jester: '<g class="world__resident-tool world__resident-tool--jester"><path d="M12,-18 Q20,-23 23,-15 Q19,-10 13,-13"></path><circle cx="22" cy="-15" r="2"></circle></g>',
            wanderer: '<g class="world__resident-tool world__resident-tool--wanderer"><path d="M-11,-17 L-20,-8"></path><rect x="-23" y="-12" width="8" height="10"></rect></g>',
            banished: '<g class="world__resident-tool world__resident-tool--banished"><path d="M-18,-5 L-28,-18 M18,-5 L28,-18"></path></g>',
        };
        return tools[archetype] || '';
    },

    spriteFor(archetype) {
        const roles = new Set(['scribe', 'builder', 'jester', 'banished', 'farmer', 'musician', 'wanderer', 'sheriff']);
        const role = roles.has(archetype) ? archetype : 'wanderer';
        return `/assets/market/pixel/residents/${role}.png`;
    },

    // Render one resident as a full-body pixel sprite marker.
    _render(r) {
        const { x, y } = Iso.tileToScreen(r.tile.tx, r.tile.ty);
        const cy = y + Iso.TILE_H / 2 + 80; // sky headroom + tile-center
        const role = this.roleLabelFor(r.archetype);
        const sprite = this.spriteFor(r.archetype);
        return `
            <g class="world__resident" transform="translate(${x.toFixed(1)} ${cy.toFixed(1)})"
               data-app="${App.escapeAttr(r.appName)}"
               data-archetype="${r.archetype}"
               data-role="${App.escapeAttr(role)}"
               data-minutes="${Math.round(r.minutes)}"
               data-preview="${r.preview ? 'true' : 'false'}"
               data-active="false"
               style="--tint: ${r.tint};">
                <title>${App.escapeHtml(r.appName)}${r.preview ? ' preview' : ''} - ${App.escapeHtml(role)} - ${App.escapeHtml(App.formatTime(r.minutes))}</title>
                <circle class="effect-halo" cx="0" cy="-17" r="22" style="display: none;"></circle>
                <ellipse class="world__resident-shadow" cx="0" cy="4" rx="17" ry="5"></ellipse>
                ${this.boatFor(r.archetype)}
                <g class="world__resident-villager world__resident-villager--${r.archetype}">
                    <image class="world__resident-sprite"
                        href="${App.escapeAttr(sprite)}"
                        x="-24" y="-58" width="48" height="66"
                        preserveAspectRatio="xMidYMax meet"></image>
                </g>
                <text class="world__resident-name" text-anchor="middle" y="25">${App.escapeHtml(r.appName)}</text>
                <text class="world__resident-minutes" text-anchor="middle" y="38">${App.escapeHtml(App.formatTime(r.minutes))}</text>
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
