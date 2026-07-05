/* SVG world scaffold. Owns sky, celestial body, weather layer, ground tiles,
   plus building and resident layer mount points. Sky/celestial logic moved
   from isle.js verbatim. */

const World = {
    _skyInterval: null,
    _motionMedia: null,
    _motionListenerBound: false,
    _pan: { x: 0, y: 0, max: { x: 0, y: 0 } },
    VIEW_PAD_X: 96,
    VIEW_PAD_BOTTOM: 56,

    // Mount the SVG world into the given parent. Returns the root SVG element.
    // Caller is responsible for emptying the parent before calling mount().
    mount(parent, weather) {
        const w = Iso.worldW();
        const h = Iso.worldH() + 80; // +80px sky headroom above the ground
        const view = this.viewBox(w, h);
        this._pan.x = 0;
        this._pan.y = 0;
        // How far the camera can drift before the island runs off-stage.
        // Roughly one third of the world dimensions in each axis.
        this._pan.max = { x: Math.round(w * 0.32), y: Math.round(h * 0.22) };

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'world');
        svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
        svg.setAttribute('aria-hidden', 'true');
        // Oversized night-dim rect so the camera can pan without revealing the edge.
        const dimW = w * 3;
        const dimH = h * 3;
        const dimX = -w;
        const dimY = -h;
        svg.innerHTML = `
            <defs>
                <radialGradient id="vignette" cx="50%" cy="55%" r="80%">
                    <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
                    <stop offset="100%" stop-color="rgba(0,0,0,0.18)"/>
                </radialGradient>
                <linearGradient id="seaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="rgba(121, 197, 214, 0.30)"/>
                    <stop offset="50%" stop-color="rgba(47, 126, 166, 0.78)"/>
                    <stop offset="100%" stop-color="rgba(22, 69, 96, 0.96)"/>
                </linearGradient>
                <radialGradient id="islandAura" cx="50%" cy="42%" r="58%">
                    <stop offset="0%" stop-color="rgba(255, 248, 232, 0.38)"/>
                    <stop offset="72%" stop-color="rgba(255, 248, 232, 0.08)"/>
                    <stop offset="100%" stop-color="rgba(255, 248, 232, 0)"/>
                </radialGradient>
            </defs>
            <g id="worldSky">
                <rect class="world__sky-rect" x="${view.x}" y="${view.y}" width="${view.width}" height="${view.height}"></rect>
                <g id="worldStars"></g>
                <g id="worldCelestial"></g>
            </g>
            ${this.seaLayer(w, h, view)}
            <g id="worldWeather"></g>
            <g id="worldPan" transform="translate(0 0)">
                ${this.islandBackdrop()}
                <g id="worldGround">${this.groundTiles()}</g>
                <g id="worldPlacementGrid">${this.placementGrid()}</g>
                <g id="worldGroundDecor">${this.groundDecor()}</g>
                <rect id="worldNightDim" x="${dimX}" y="${dimY}" width="${dimW}" height="${dimH}" pointer-events="none"></rect>
                <g id="worldLanterns"></g>
                <g id="worldBuildings"></g>
                <g id="worldResidents"></g>
                <g id="worldEffects"></g>
            </g>
            <rect class="world__vignette" x="${view.x}" y="${view.y}" width="${view.width}" height="${view.height}" pointer-events="none"></rect>
        `;
        parent.appendChild(svg);

        this.bindPan(parent, svg);
        this.bindMotionPreference();
        this.applyWeather(weather);
        this.updateSky();
        this.syncSkyTimer();
        return svg;
    },

    viewBox(w = Iso.worldW(), h = Iso.worldH() + 80) {
        return {
            x: -this.VIEW_PAD_X,
            y: 0,
            width: w + this.VIEW_PAD_X * 2,
            height: h + this.VIEW_PAD_BOTTOM,
        };
    },

    setEditMode(enabled) {
        const root = document.querySelector('.isle');
        const svg = document.querySelector('.isle__stage svg.world');
        root?.classList.toggle('isle--editing', Boolean(enabled));
        svg?.classList.toggle('world--editing', Boolean(enabled));
    },

    seaLayer(w, h, view = this.viewBox(w, h)) {
        const horizon = Math.round(h * 0.48);
        const seaX = view.x - view.width;
        const seaW = view.width * 3;
        return `
            <g id="worldSea" aria-hidden="true">
                <rect class="world__sea" x="${seaX}" y="${horizon}" width="${seaW}" height="${view.height - horizon}"></rect>
                <path class="world__sea-current world__sea-current--a" d="M${seaX - 52} ${horizon + 112} C104 ${horizon + 64}, 250 ${horizon + 126}, 402 ${horizon + 88} S624 ${horizon + 72}, ${seaX + seaW + 72} ${horizon + 130}"></path>
                <path class="world__sea-current world__sea-current--b" d="M${seaX - 70} ${horizon + 190} C126 ${horizon + 152}, 266 ${horizon + 214}, 434 ${horizon + 176} S636 ${horizon + 160}, ${seaX + seaW + 88} ${horizon + 212}"></path>
                <path class="world__sea-line world__sea-line--a" d="M${seaX + 28} ${horizon + 52} C118 ${horizon + 38}, 196 ${horizon + 70}, 286 ${horizon + 52} S476 ${horizon + 48}, ${seaX + seaW - 44} ${horizon + 66}"></path>
                <path class="world__sea-line world__sea-line--b" d="M${seaX + 18} ${horizon + 108} C110 ${horizon + 90}, 206 ${horizon + 126}, 326 ${horizon + 106} S526 ${horizon + 94}, ${seaX + seaW - 26} ${horizon + 124}"></path>
                <path class="world__sea-line world__sea-line--c" d="M${seaX + 58} ${horizon + 158} C152 ${horizon + 144}, 254 ${horizon + 170}, 366 ${horizon + 152} S580 ${horizon + 140}, ${seaX + seaW - 66} ${horizon + 166}"></path>
                ${this.seaSparkles(w, horizon)}
                <ellipse class="world__island-aura" cx="${w / 2}" cy="${horizon + 76}" rx="${w * 0.46}" ry="92"></ellipse>
            </g>
        `;
    },

    // Small diamond glints scattered on the water, twinkling via CSS.
    seaSparkles(w, horizon) {
        const seeds = [
            [0.06, 34], [0.14, 96], [0.22, 58], [0.30, 148], [0.38, 40],
            [0.52, 170], [0.62, 52], [0.72, 128], [0.82, 74], [0.90, 160],
            [0.10, 196], [0.46, 88], [0.68, 200], [0.94, 44], [0.26, 104],
        ];
        return seeds.map(([px, dy], i) => {
            const x = (px * w * 1.4 - w * 0.2).toFixed(0);
            const y = horizon + dy;
            const r = 1.4 + (i % 3) * 0.5;
            return `<path class="world__sea-sparkle" d="M${x} ${y - r} L${Number(x) + r} ${y} L${x} ${y + r} L${Number(x) - r} ${y} Z"></path>`;
        }).join('');
    },

    islandBackdrop() {
        return `
            <g id="worldIslandBackdrop" aria-hidden="true">
                <path class="world__island-shadow" d="M10 276 C50 214 160 154 312 142 C476 130 612 174 682 244 C730 294 650 354 502 390 C336 428 166 392 72 334 C30 306 -12 288 10 276 Z"></path>
                <path class="world__shore-foam" d="M-2 260 C42 198 158 134 314 122 C488 110 634 160 704 232 C752 288 660 348 508 382 C340 420 168 384 72 326 C28 298 -26 272 -2 260 Z"></path>
                <path class="world__shore world__shore--outer" d="M6 262 C48 202 160 140 314 128 C484 116 628 164 696 234 C742 288 654 344 504 376 C340 412 172 378 78 320 C36 294 -18 274 6 262 Z"></path>
                <path class="world__shore world__shore--inner" d="M54 258 C94 210 186 170 318 158 C458 146 578 182 634 236 C672 276 604 318 484 346 C342 378 202 354 112 312 C78 292 34 272 54 258 Z"></path>
            </g>
        `;
    },

    // ── Drag-to-pan ─────────────────────────────────────────────────────
    //
    // Translate the worldPan group on pointer drag. Drag distance is
    // converted from screen pixels to viewBox units so the gesture stays
    // 1:1 with the cursor regardless of the SVG's responsive scale.
    bindPan(parent, svg) {
        const panGroup = svg.querySelector('#worldPan');
        const seaGroup = svg.querySelector('#worldSea');
        if (!panGroup) return;
        parent.classList.add('isle__stage--pannable');

        let dragging = false;
        let startClient = { x: 0, y: 0 };
        let startPan = { x: 0, y: 0 };
        let activePointerId = null;

        const apply = () => {
            panGroup.setAttribute(
                'transform',
                `translate(${this._pan.x.toFixed(1)} ${this._pan.y.toFixed(1)})`,
            );
            if (seaGroup) {
                seaGroup.setAttribute(
                    'transform',
                    `translate(${(this._pan.x * 0.32).toFixed(1)} ${(this._pan.y * 0.14).toFixed(1)})`,
                );
            }
        };

        const onPointerDown = (e) => {
            // Don't hijack clicks on buildings, residents, or interactive overlays.
            if (e.target.closest && e.target.closest('.world__building, .world__resident, button, a, input')) {
                return;
            }
            if (e.button !== undefined && e.button !== 0) return;
            dragging = true;
            activePointerId = e.pointerId;
            startClient = { x: e.clientX, y: e.clientY };
            startPan = { x: this._pan.x, y: this._pan.y };
            parent.classList.add('isle__stage--grabbing');
            try { svg.setPointerCapture(e.pointerId); } catch (_) {}
            e.preventDefault();
        };

        const onPointerMove = (e) => {
            if (!dragging) return;
            // Convert client-space delta to viewBox-space delta using the
            // SVG's bounding rect. Dragging right moves the camera right,
            // so the world content translates left under the pointer.
            const rect = svg.getBoundingClientRect();
            const view = this.viewBox();
            const scaleX = rect.width  > 0 ? view.width / rect.width  : 1;
            const scaleY = rect.height > 0 ? view.height / rect.height : 1;
            const dx = (e.clientX - startClient.x) * scaleX;
            const dy = (e.clientY - startClient.y) * scaleY;
            const cx = Math.max(-this._pan.max.x, Math.min(this._pan.max.x, startPan.x - dx));
            const cy = Math.max(-this._pan.max.y, Math.min(this._pan.max.y, startPan.y - dy));
            this._pan.x = cx;
            this._pan.y = cy;
            apply();
        };

        const onPointerUp = (e) => {
            if (!dragging) return;
            dragging = false;
            parent.classList.remove('isle__stage--grabbing');
            if (activePointerId !== null) {
                try { svg.releasePointerCapture(activePointerId); } catch (_) {}
                activePointerId = null;
            }
        };

        const onDoubleClick = () => {
            // Reset camera to the centered home view.
            this._pan.x = 0;
            this._pan.y = 0;
            apply();
        };

        svg.addEventListener('pointerdown', onPointerDown);
        svg.addEventListener('pointermove', onPointerMove);
        svg.addEventListener('pointerup', onPointerUp);
        svg.addEventListener('pointercancel', onPointerUp);
        svg.addEventListener('lostpointercapture', onPointerUp);
        svg.addEventListener('dblclick', onDoubleClick);
    },

    // Diamond polygons for the WORLD_TX × WORLD_TY ground grid.
    // Four green variants distributed by deterministic tile hash so the
    // field reads as natural meadow rather than a checkerboard, plus a
    // south-east shadow wedge per tile that fakes elevation under iso.
    groundTiles() {
        let out = '';
        for (let ty = 0; ty < Iso.WORLD_TY; ty++) {
            for (let tx = 0; tx < Iso.WORLD_TX; tx++) {
                const { x, y } = Iso.tileToScreen(tx, ty);
                const cy = y + Iso.TILE_H + 80; // shift down by sky headroom
                const variant = Math.floor(Iso.tileHash(tx, ty, 1) * 4); // 0..3
                const tone = ['a', 'b', 'c', 'd'][variant];
                out += `<polygon class="world__tile world__tile--${tone}" points="${Iso.tileDiamond(x, cy)}"></polygon>`;
                // South-east shadow wedge for fake elevation. ~3px offset.
                out += `<polygon class="world__tile-shadow" points="${Iso.tileShadowWedge(x, cy, 3)}"></polygon>`;
            }
        }
        return out;
    },

    placementGrid() {
        let out = '';
        for (let ty = 0; ty < Iso.WORLD_TY; ty++) {
            for (let tx = 0; tx < Iso.WORLD_TX; tx++) {
                const { x, y } = Iso.tileToScreen(tx, ty);
                const cy = y + Iso.TILE_H + 80;
                out += `<polygon class="world__placement-tile" data-tile="${tx},${ty}" points="${Iso.tileDiamond(x, cy)}"></polygon>`;
            }
        }
        return out;
    },

    // Sparse ground decorations — daisies, pebble clusters, grass tufts —
    // distributed via deterministic hashes so the look is stable. Avoids
    // tiles that hold buildings (Buildings.catalog footprints).
    groundDecor() {
        const occupied = window.IslandState
            ? IslandState.occupiedCells(Buildings.catalog)
            : new Set();
        if (!window.IslandState) {
            for (const b of Buildings.catalog) {
                const span = b.size === 'major' ? 1 : 0;
                for (let dx = 0; dx <= span; dx++) {
                    for (let dy = 0; dy <= span; dy++) {
                        occupied.add(`${b.tx + dx},${b.ty + dy}`);
                    }
                }
            }
        }

        const decor = [];
        for (let ty = 0; ty < Iso.WORLD_TY; ty++) {
            for (let tx = 0; tx < Iso.WORLD_TX; tx++) {
                if (occupied.has(`${tx},${ty}`)) continue;
                const roll = Iso.tileHash(tx, ty, 7);
                if (roll > 0.32) continue; // 68% of tiles stay bare

                const { x, y } = Iso.tileToScreen(tx, ty);
                const cy = y + Iso.TILE_H + 80;
                // Jitter the sprite within the diamond (within ~22px square).
                const jx = (Iso.tileHash(tx, ty, 13) - 0.5) * 18;
                const jy = (Iso.tileHash(tx, ty, 17) - 0.5) * 8;
                const px = x + jx;
                const py = cy + jy;

                // Pick a sprite kind from the same hash space. Trees stay
                // rare so the meadow keeps its sightlines.
                const kind = Math.floor(Iso.tileHash(tx, ty, 23) * 12);
                if (kind === 0) decor.push(this.spriteTree(px, py, Iso.tileHash(tx, ty, 29) > 0.5));
                else if (kind <= 2) decor.push(this.spriteDaisy(px, py));
                else if (kind <= 4) decor.push(this.spritePebble(px, py));
                else if (kind <= 7) decor.push(this.spriteGrass(px, py));
                else if (kind <= 9) decor.push(this.spriteTulip(px, py, Iso.tileHash(tx, ty, 37)));
                else decor.push(this.spriteBush(px, py));
            }
        }
        return decor.join('');
    },

    spriteDaisy(cx, cy) {
        return `<g class="world__decor" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">${Px.decor.daisy()}</g>`;
    },

    spritePebble(cx, cy) {
        return `<g class="world__decor" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">${Px.decor.pebble()}</g>`;
    },

    spriteGrass(cx, cy) {
        return `<g class="world__decor" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">${Px.decor.grassTuft()}</g>`;
    },

    spriteBush(cx, cy) {
        return `<g class="world__decor" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">${Px.decor.bush()}</g>`;
    },

    spriteTree(cx, cy, fruited = false) {
        return `<g class="world__decor" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">${Px.decor.tree(fruited)}</g>`;
    },

    spriteTulip(cx, cy, roll = 0.5) {
        const hues = ['#e0708f', '#ffc93c', '#a48bf5', '#ff8d5c'];
        const bloom = hues[Math.floor(roll * hues.length) % hues.length];
        return `<g class="world__decor" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">${Px.decor.tulip(bloom)}</g>`;
    },

    applyWeather(weather) {
        const layer = document.getElementById('worldWeather');
        if (!layer) return;

        const cloud = (cx, cy, scale = 1, storm = false) => `
            <g class="weather-cloud" transform="translate(${cx} ${cy})">
                <g class="weather-cloud__puff">${Px.cloud(scale, storm)}</g>
            </g>
        `;

        if (weather.key === 'storm') {
            layer.innerHTML = cloud(120, 60, 1.2, true) + cloud(360, 80, 1.4, true);
            layer.setAttribute('class', 'weather-layer--storm');
            return;
        }
        if (weather.key === 'cloudy') {
            layer.innerHTML = cloud(120, 60) + cloud(280, 90, 0.9) + cloud(440, 50, 1.1);
            layer.setAttribute('class', 'weather-layer--cloudy');
            return;
        }
        if (weather.key === 'sunny') {
            layer.innerHTML = '<circle class="weather-sunbeam" cx="280" cy="80" r="200"></circle>';
            layer.setAttribute('class', 'weather-layer--sunny');
            return;
        }
        layer.innerHTML = '';
        layer.setAttribute('class', 'weather-layer--calm');
    },

    bindMotionPreference() {
        if (!this._motionMedia) {
            this._motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
        }
        if (this._motionListenerBound) return;
        const onChange = () => {
            this.updateSky();
            this.syncSkyTimer();
        };
        if (this._motionMedia.addEventListener) this._motionMedia.addEventListener('change', onChange);
        else if (this._motionMedia.addListener) this._motionMedia.addListener(onChange);
        this._motionListenerBound = true;
    },

    syncSkyTimer() {
        if (this._skyInterval) {
            clearInterval(this._skyInterval);
            this._skyInterval = null;
        }
        if (App.prefersReducedMotion()) return;
        this._skyInterval = setInterval(() => this.updateSky(), 60000);
    },

    updateSky() {
        const now = new Date();
        const hours = now.getHours() + now.getMinutes() / 60;
        const phase = this.hourToPhase(hours);

        document.documentElement.style.setProperty('--sky-top', phase.top);
        document.documentElement.style.setProperty('--sky-bottom', phase.bottom);
        document.documentElement.style.setProperty('--ground-tint', phase.ground);

        const skyGroup = document.getElementById('worldSky');
        if (skyGroup) skyGroup.classList.toggle('is-night', phase.isNight);

        const svg = document.querySelector('.isle__stage svg.world');
        if (svg) {
            const isDusk = !phase.isNight && hours >= 17 && hours < 19;
            svg.classList.toggle('is-night', phase.isNight);
            svg.classList.toggle('is-dusk', isDusk);
        }

        const stars = document.getElementById('worldStars');
        if (stars) stars.innerHTML = phase.isNight ? this.starField() : '';

        const celestial = document.getElementById('worldCelestial');
        if (celestial) {
            const t = App.prefersReducedMotion() ? 0.64 : ((hours - 6 + 24) % 12) / 12;
            const w = Iso.worldW();
            const x = t * w;
            const y = 80 - Math.sin(t * Math.PI) * 56;
            const wantMoon = phase.isNight;
            const isMoon = celestial.classList.contains('world__celestial--moon');
            if (!celestial.firstChild || wantMoon !== isMoon) {
                celestial.innerHTML = wantMoon ? Px.moon() : Px.sun();
            }
            celestial.setAttribute('transform', `translate(${x.toFixed(1)} ${(y + 12).toFixed(1)})`);
            celestial.classList.toggle('world__celestial--moon', wantMoon);
        }
    },

    starField() {
        const out = [];
        // 18 fixed-position twinkles inside the sky band (y < 80).
        const seeds = [[0.08,12],[0.16,38],[0.24,18],[0.31,46],[0.39,8],[0.46,32],[0.54,14],[0.62,40],[0.70,22],
                       [0.78,48],[0.86,16],[0.94,36],[0.12,62],[0.28,68],[0.44,54],[0.60,72],[0.76,58],[0.92,66]];
        const w = Iso.worldW();
        for (const [px, y] of seeds) {
            out.push(`<circle class="world__star" cx="${(px * w).toFixed(1)}" cy="${y}" r="1"></circle>`);
        }
        return out.join('');
    },

    hourToPhase(h) {
        if (h >= 5 && h < 7)   return { top: '#ff9d6b', bottom: '#ffdd94', ground: '#e8d5a5', isNight: false };
        if (h >= 7 && h < 16)  return { top: '#66b3e8', bottom: '#c8ecf4', ground: '#e8d5a5', isNight: false };
        if (h >= 16 && h < 17) return { top: '#7fb2dd', bottom: '#ffd98a', ground: '#e8d5a5', isNight: false };
        if (h >= 17 && h < 19) return { top: '#c25a86', bottom: '#ff9d6b', ground: '#d1a97e', isNight: false };
        return { top: '#171c38', bottom: '#2c3560', ground: '#4a4060', isNight: true };
    },

    // Mount all buildings from Buildings.catalog into the buildings layer.
    // Each becomes a clickable <g class="world__building" data-tab=...>.
    mountBuildings() {
        const layer = document.getElementById('worldBuildings');
        if (!layer) return;
        layer.innerHTML = Buildings.catalog.map(b => {
            const { x, y } = Buildings.anchorFor ? Buildings.anchorFor(b) : Buildings.anchor(b.tx, b.ty, b.size);
            const tab = b.tab || '';
            const movable = b.movable !== false;
            const major = b.size === 'major';
            const hitbox = {
                x: major ? -72 : -54,
                y: major ? -108 : -82,
                width: major ? 148 : 112,
                height: major ? 134 : 108,
            };
            return `
                <g class="world__building world__building--${b.size} world__building--${App.escapeAttr(b.source || 'core')}"
                   data-building-id="${App.escapeAttr(b.id)}"
                   data-tab="${App.escapeAttr(tab)}"
                   data-kind="${App.escapeAttr(b.kind || b.id)}"
                   data-movable="${movable ? 'true' : 'false'}"
                   transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"
                   role="button" tabindex="0" aria-label="${b.label}">
                    <rect class="world__building-hitbox"
                        x="${hitbox.x}" y="${hitbox.y}"
                        width="${hitbox.width}" height="${hitbox.height}"
                        pointer-events="all"></rect>
                    <g class="world__building-shape">${Buildings.markup(b.id, b)}</g>
                    <text class="world__building-label" x="0" y="14" text-anchor="middle">${App.escapeHtml(b.label)}</text>
                </g>
            `;
        }).join('');

        // Click + keyboard activation routes to App.showTab.
        layer.querySelectorAll('.world__building').forEach(node => {
            const tab = node.dataset.tab;
            const go = () => {
                if (window.Isle?.editMode) return;
                if (tab) App.showTab(tab);
                else App.showTab('market');
            };
            node.addEventListener('click', go);
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    go();
                }
            });
            this.bindBuildingPlacement(node);
        });
    },

    bindBuildingPlacement(node) {
        if (!node || node.dataset.placementBound === 'true') return;
        node.dataset.placementBound = 'true';

        node.addEventListener('pointerdown', (e) => {
            if (!window.Isle?.editMode || node.dataset.movable !== 'true') return;
            if (e.button !== undefined && e.button !== 0) return;
            const building = Buildings.catalog.find(candidate => candidate.id === node.dataset.buildingId);
            if (!building) return;

            let latestTile = { tx: building.tx, ty: building.ty };
            let latestValid = true;
            const original = { tx: building.tx, ty: building.ty };
            const activePointerId = e.pointerId;

            const preview = (event) => {
                const tile = this.tileFromPointer(event, building);
                latestTile = tile;
                latestValid = Boolean(window.IslandState?.canPlace(Buildings.catalog, building.id, tile));
                const previewBuilding = { ...building, tx: tile.tx, ty: tile.ty };
                const { x, y } = Buildings.anchorFor(previewBuilding);
                node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
                node.dataset.placement = latestValid ? 'valid' : 'invalid';
            };

            const end = () => {
                node.classList.remove('is-dragging');
                delete node.dataset.placement;
                node.removeEventListener('pointermove', preview);
                node.removeEventListener('pointerup', end);
                node.removeEventListener('pointercancel', cancel);
                node.removeEventListener('lostpointercapture', cancel);
                try { node.releasePointerCapture(activePointerId); } catch (_) {}
                if (latestValid) Isle.moveBuilding(building.id, latestTile);
                else {
                    const { x, y } = Buildings.anchorFor({ ...building, tx: original.tx, ty: original.ty });
                    node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
                    App.toast('That spot is already occupied', 'warning');
                }
            };

            const cancel = () => {
                latestValid = false;
                end();
            };

            node.classList.add('is-dragging');
            try { node.setPointerCapture(activePointerId); } catch (_) {}
            node.addEventListener('pointermove', preview);
            node.addEventListener('pointerup', end);
            node.addEventListener('pointercancel', cancel);
            node.addEventListener('lostpointercapture', cancel);
            preview(e);
            e.preventDefault();
            e.stopPropagation();
        });
    },

    tileFromPointer(event, building = {}) {
        const panGroup = document.getElementById('worldPan');
        const local = this.pointerToWorld(event, panGroup);
        const raw = Iso.screenToTile(local.x, local.y - 80 - Iso.TILE_H / 2);
        const footprint = window.IslandState?.footprintFor
            ? IslandState.footprintFor(building)
            : (building.size === 'major' ? { w: 2, h: 2 } : { w: 1, h: 1 });
        const maxTx = Math.max(0, Iso.WORLD_TX - footprint.w);
        const maxTy = Math.max(0, Iso.WORLD_TY - footprint.h);
        return {
            tx: Math.max(0, Math.min(maxTx, Math.round(raw.tx))),
            ty: Math.max(0, Math.min(maxTy, Math.round(raw.ty))),
        };
    },

    pointerToWorld(event, target) {
        const svg = event.currentTarget?.ownerSVGElement || document.querySelector('.isle__stage svg.world');
        if (!svg) return { x: 0, y: 0 };
        const matrixTarget = target || svg;
        const matrix = matrixTarget.getScreenCTM ? matrixTarget.getScreenCTM() : svg.getScreenCTM();
        if (!matrix) return { x: 0, y: 0 };
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        return point.matrixTransform(matrix.inverse());
    },

    // Add a single soft lantern circle above each building. The is-night /
    // is-dusk class on the SVG root fades them in via CSS.
    mountLanterns() {
        const layer = document.getElementById('worldLanterns') || document.getElementById('worldBuildings');
        if (!layer) return;
        layer.innerHTML = '';
        Buildings.catalog.forEach(b => {
            const { x, y } = Buildings.anchorFor ? Buildings.anchorFor(b) : Buildings.anchor(b.tx, b.ty, b.size);
            const lanternY = y - (b.size === 'major' ? 76 : 56);
            const lantern = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            lantern.setAttribute('class', 'world__lantern');
            lantern.setAttribute('cx', x.toFixed(1));
            lantern.setAttribute('cy', String(lanternY));
            lantern.setAttribute('r', '6');
            layer.appendChild(lantern);
        });
    },

    applyMarketInventory(inventory = []) {
        const root = document.querySelector('.isle');
        const layer = document.getElementById('worldEffects');
        if (!root || !layer) return;

        [...root.classList].forEach(cls => {
            if (cls === 'market-has-inventory' || cls.startsWith('market-owned-') || cls.startsWith('market-category-')) {
                root.classList.remove(cls);
            }
        });

        const owned = (Array.isArray(inventory) ? inventory : [])
            .filter(item => !item.refunded)
            .filter(item => item.item_key || item.key)
            .slice(0, 48);
        const propItems = owned.filter(item => !window.IslandState?.placeableTemplateForItem(item));

        root.classList.toggle('market-has-inventory', owned.length > 0);
        owned.forEach(item => {
            const key = this.safeClass(item.item_key || item.key);
            const category = this.safeClass(item.category || 'decor');
            if (key) root.classList.add(`market-owned-${key}`);
            if (category) root.classList.add(`market-category-${category}`);
        });

        layer.innerHTML = this.marketProps(propItems);
    },

    marketProps(owned) {
        if (!owned.length) return '';
        const tiles = this.marketPropTiles();
        if (!tiles.length) return '';

        return owned.map((item, index) => {
            const key = String(item.item_key || item.key || item.name || index);
            const tile = tiles[index % tiles.length];
            const { x, y } = Iso.tileToScreen(tile.tx, tile.ty);
            const jx = (Iso.tileHash(tile.tx, tile.ty, index + 41) - 0.5) * 18;
            const jy = (Iso.tileHash(tile.tx, tile.ty, index + 59) - 0.5) * 8;
            const px = x + jx;
            const py = y + Iso.TILE_H + 76 + jy;
            const cat = this.safeClass(item.category || 'decor');
            return `
                <g class="world__market-prop world__market-prop--${cat}" data-key="${App.escapeAttr(key)}"
                   transform="translate(${px.toFixed(1)} ${py.toFixed(1)})">
                    <title>${App.escapeHtml(item.name || key)}</title>
                    ${this.marketPropSprite(item, index)}
                </g>
            `;
        }).join('');
    },

    marketPropTiles() {
        const walkable = window.IslandState
            ? IslandState.walkableTiles(Buildings.catalog)
            : [];
        const walkableKeys = new Set(walkable.map(tile => `${tile.tx},${tile.ty}`));
        const blocked = window.IslandState ? null : new Set();
        if (!window.IslandState) {
            Buildings.catalog.forEach(b => {
                const span = b.size === 'major' ? 1 : 0;
                for (let dx = 0; dx <= span; dx++) {
                    for (let dy = 0; dy <= span; dy++) {
                        blocked.add(`${b.tx + dx},${b.ty + dy}`);
                    }
                }
            });
        }

        const preferred = [
            { tx: 0, ty: 0 }, { tx: 2, ty: 0 }, { tx: 6, ty: 0 }, { tx: 8, ty: 0 }, { tx: 11, ty: 0 },
            { tx: 0, ty: 2 }, { tx: 3, ty: 2 }, { tx: 7, ty: 2 }, { tx: 11, ty: 2 },
            { tx: 1, ty: 4 }, { tx: 4, ty: 4 }, { tx: 7, ty: 4 }, { tx: 10, ty: 4 },
            { tx: 0, ty: 7 }, { tx: 3, ty: 7 }, { tx: 6, ty: 7 }, { tx: 9, ty: 7 }, { tx: 11, ty: 7 },
        ].filter(tile => this.inWorld(tile)
            && (window.IslandState ? walkableKeys.has(`${tile.tx},${tile.ty}`) : !blocked.has(`${tile.tx},${tile.ty}`)));

        const rest = window.IslandState ? walkable.slice() : [];
        if (!window.IslandState) {
            for (let ty = 0; ty < Iso.WORLD_TY; ty++) {
                for (let tx = 0; tx < Iso.WORLD_TX; tx++) {
                    if (!blocked.has(`${tx},${ty}`)) rest.push({ tx, ty });
                }
            }
        }
        rest.sort((a, b) => Iso.tileHash(a.tx, a.ty, 31) - Iso.tileHash(b.tx, b.ty, 31));
        return [...preferred, ...rest];
    },

    marketPropSprite(item, index) {
        const key = String(item.item_key || item.key || item.name || index);
        const hue = Math.floor(Iso.tileHash(index + 1, key.length, 83) * 360);
        const accent = `hsl(${hue}, 54%, 58%)`;
        return `
            <ellipse class="market-prop__shadow" cx="0" cy="3" rx="10" ry="3"></ellipse>
            ${Px.itemGlyph(key, item.category, accent, { scale: 2, dy: 2 })}
        `;
    },

    inWorld(tile) {
        return tile.tx >= 0 && tile.ty >= 0 && tile.tx < Iso.WORLD_TX && tile.ty < Iso.WORLD_TY;
    },

    safeClass(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    },

};

window.World = World;
