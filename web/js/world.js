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
                    <stop offset="0%" stop-color="rgba(127, 200, 223, 0.24)"/>
                    <stop offset="50%" stop-color="rgba(91, 143, 185, 0.72)"/>
                    <stop offset="100%" stop-color="rgba(46, 124, 166, 0.94)"/>
                </linearGradient>
                <radialGradient id="islandAura" cx="50%" cy="42%" r="58%">
                    <stop offset="0%" stop-color="rgba(255, 244, 214, 0.36)"/>
                    <stop offset="72%" stop-color="rgba(255, 244, 214, 0.08)"/>
                    <stop offset="100%" stop-color="rgba(255, 244, 214, 0)"/>
                </radialGradient>
            </defs>
            <g id="worldSky">
                <rect class="world__sky-rect" x="${view.x}" y="${view.y}" width="${view.width}" height="${view.height}"></rect>
                <g id="worldStars"></g>
                <circle id="worldCelestial" r="14"></circle>
            </g>
            ${this.seaLayer(w, h, view)}
            <g id="worldWeather"></g>
            <g id="worldPan" transform="translate(0 0)">
                ${this.islandBackdrop()}
                <g id="worldGround">${this.groundTiles()}</g>
                <g id="worldGroundDecor">${this.groundDecor()}</g>
                <rect id="worldNightDim" x="${dimX}" y="${dimY}" width="${dimW}" height="${dimH}" pointer-events="none"></rect>
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

    seaLayer(w, h, view = this.viewBox(w, h)) {
        const horizon = Math.round(h * 0.48);
        return `
            <g id="worldSea" aria-hidden="true">
                <rect class="world__sea" x="${view.x}" y="${horizon}" width="${view.width}" height="${view.height - horizon}"></rect>
                <path class="world__sea-line world__sea-line--a" d="M${view.x + 16} ${horizon + 52} C118 ${horizon + 36}, 182 ${horizon + 70}, 280 ${horizon + 50} S470 ${horizon + 46}, ${view.x + view.width - 18} ${horizon + 66}"></path>
                <path class="world__sea-line world__sea-line--b" d="M${view.x - 10} ${horizon + 108} C94 ${horizon + 88}, 194 ${horizon + 128}, 318 ${horizon + 106} S520 ${horizon + 92}, ${view.x + view.width + 26} ${horizon + 124}"></path>
                <path class="world__sea-line world__sea-line--c" d="M${view.x + 42} ${horizon + 158} C144 ${horizon + 142}, 246 ${horizon + 170}, 358 ${horizon + 150} S574 ${horizon + 138}, ${view.x + view.width - 48} ${horizon + 166}"></path>
                <ellipse class="world__island-aura" cx="${w / 2}" cy="${horizon + 76}" rx="${w * 0.46}" ry="92"></ellipse>
            </g>
        `;
    },

    islandBackdrop() {
        return `
            <g id="worldIslandBackdrop" aria-hidden="true">
                <path class="world__island-shadow" d="M10 276 C50 214 160 154 312 142 C476 130 612 174 682 244 C730 294 650 354 502 390 C336 428 166 392 72 334 C30 306 -12 288 10 276 Z"></path>
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

    // Sparse ground decorations — daisies, pebble clusters, grass tufts —
    // distributed via deterministic hashes so the look is stable. Avoids
    // tiles that hold buildings (Buildings.catalog footprints).
    groundDecor() {
        const occupied = new Set();
        for (const b of Buildings.catalog) {
            const span = b.size === 'major' ? 1 : 0;
            for (let dx = 0; dx <= span; dx++) {
                for (let dy = 0; dy <= span; dy++) {
                    occupied.add(`${b.tx + dx},${b.ty + dy}`);
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

                // Pick a sprite kind from the same hash space.
                const kind = Math.floor(Iso.tileHash(tx, ty, 23) * 4);
                if (kind === 0) decor.push(this.spriteDaisy(px, py));
                else if (kind === 1) decor.push(this.spritePebble(px, py));
                else if (kind === 2) decor.push(this.spriteGrass(px, py));
                else decor.push(this.spriteBush(px, py));
            }
        }
        return decor.join('');
    },

    spriteDaisy(cx, cy) {
        return `
            <g class="world__decor world__decor--daisy" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">
                <circle cx="-2" cy="-1" r="1"/><circle cx="2" cy="-1" r="1"/>
                <circle cx="0" cy="-3" r="1"/><circle cx="-2" cy="2" r="1"/><circle cx="2" cy="2" r="1"/>
                <circle class="world__decor-core" cx="0" cy="0" r="1"/>
            </g>
        `;
    },

    spritePebble(cx, cy) {
        return `
            <g class="world__decor world__decor--pebble" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">
                <ellipse cx="-3" cy="0" rx="2.2" ry="1.4"/>
                <ellipse cx="2" cy="-1" rx="1.8" ry="1.1"/>
                <ellipse cx="3" cy="2" rx="1.5" ry="1"/>
            </g>
        `;
    },

    spriteGrass(cx, cy) {
        return `
            <g class="world__decor world__decor--grass" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">
                <path d="M-3,2 L-3,-3 M0,2 L0,-4 M3,2 L3,-3" stroke-linecap="round"/>
            </g>
        `;
    },

    spriteBush(cx, cy) {
        return `
            <g class="world__decor world__decor--bush" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">
                <ellipse cx="0" cy="0" rx="6" ry="3.5"/>
                <ellipse cx="-3" cy="-2" rx="3" ry="2.4"/>
                <ellipse cx="3" cy="-2" rx="3" ry="2.4"/>
                <ellipse class="world__decor-shadow" cx="0" cy="2.2" rx="6" ry="1.3"/>
            </g>
        `;
    },

    applyWeather(weather) {
        const layer = document.getElementById('worldWeather');
        if (!layer) return;

        const cloud = (cx, cy, scale = 1) => `
            <g class="weather-cloud" transform="translate(${cx} ${cy}) scale(${scale})">
                <g class="weather-cloud__puff">
                    <ellipse cx="0" cy="0" rx="22" ry="8"></ellipse>
                    <ellipse cx="-12" cy="-4" rx="10" ry="6"></ellipse>
                    <ellipse cx="14" cy="-2" rx="12" ry="6"></ellipse>
                </g>
            </g>
        `;

        if (weather.key === 'storm') {
            layer.innerHTML = cloud(120, 60, 1.2) + cloud(360, 80, 1.4);
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
            celestial.setAttribute('cx', String(x));
            celestial.setAttribute('cy', String(y));
            celestial.classList.toggle('world__celestial--moon', phase.isNight);
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
        if (h >= 5 && h < 7) return { top: '#ffb27a', bottom: '#ffd98a', ground: '#e8c896', isNight: false };
        if (h >= 7 && h < 17) return { top: '#7bb8e8', bottom: '#ffd98a', ground: '#e8c896', isNight: false };
        if (h >= 17 && h < 19) return { top: '#d16a8f', bottom: '#ffb27a', ground: '#c89677', isNight: false };
        return { top: '#1a1f3a', bottom: '#2a3050', ground: '#4a4060', isNight: true };
    },

    // Mount all buildings from Buildings.catalog into the buildings layer.
    // Each becomes a clickable <g class="world__building" data-tab=...>.
    mountBuildings() {
        const layer = document.getElementById('worldBuildings');
        if (!layer) return;
        layer.innerHTML = Buildings.catalog.map(b => {
            const { x, y } = Buildings.anchor(b.tx, b.ty, b.size);
            return `
                <g class="world__building world__building--${b.size}" data-tab="${b.tab}"
                   transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"
                   role="button" tabindex="0" aria-label="${b.label}">
                    <g class="world__building-shape">${Buildings.markup(b.id)}</g>
                    <text class="world__building-label" x="0" y="14" text-anchor="middle">${b.label}</text>
                </g>
            `;
        }).join('');

        // Click + keyboard activation routes to App.showTab.
        layer.querySelectorAll('.world__building').forEach(node => {
            const tab = node.dataset.tab;
            const go = () => App.showTab(tab);
            node.addEventListener('click', go);
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    go();
                }
            });
        });
    },

    // Add a single soft lantern circle above each building. The is-night /
    // is-dusk class on the SVG root fades them in via CSS.
    mountLanterns() {
        const layer = document.getElementById('worldBuildings');
        if (!layer) return;
        Buildings.catalog.forEach(b => {
            const { x, y } = Buildings.anchor(b.tx, b.ty, b.size);
            const lanternY = y - (b.size === 'major' ? 76 : 56);
            const lantern = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            lantern.setAttribute('class', 'world__lantern');
            lantern.setAttribute('cx', x.toFixed(1));
            lantern.setAttribute('cy', String(lanternY));
            lantern.setAttribute('r', '6');
            layer.appendChild(lantern);
        });
    },

};

window.World = World;
