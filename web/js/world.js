/* SVG world scaffold. Owns sky, celestial body, weather layer, ground tiles,
   plus building and resident layer mount points. Sky/celestial logic moved
   from isle.js verbatim. */

const World = {
    _skyInterval: null,
    _motionMedia: null,
    _motionListenerBound: false,

    // Mount the SVG world into the given parent. Returns the root SVG element.
    // Caller is responsible for emptying the parent before calling mount().
    mount(parent, weather) {
        const w = Iso.worldW();
        const h = Iso.worldH() + 80; // +80px sky headroom above the ground

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'world');
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
        svg.setAttribute('aria-hidden', 'true');
        svg.innerHTML = `
            <g id="worldSky">
                <rect class="world__sky-rect" x="0" y="0" width="${w}" height="${h}"></rect>
                <g id="worldStars"></g>
                <circle id="worldCelestial" r="14"></circle>
            </g>
            <g id="worldWeather"></g>
            <g id="worldGround">${this.groundTiles()}</g>
            <rect id="worldNightDim" x="0" y="0" width="${w}" height="${h}" pointer-events="none"></rect>
            <g id="worldBuildings"></g>
            <g id="worldResidents"></g>
            <g id="worldEffects"></g>
        `;
        parent.appendChild(svg);

        this.bindMotionPreference();
        this.applyWeather(weather);
        this.updateSky();
        this.syncSkyTimer();
        return svg;
    },

    // Diamond polygons for the WORLD_TX × WORLD_TY ground grid.
    // Alternates two greens for a checker visible at iso angle.
    groundTiles() {
        let out = '';
        for (let ty = 0; ty < Iso.WORLD_TY; ty++) {
            for (let tx = 0; tx < Iso.WORLD_TX; tx++) {
                const { x, y } = Iso.tileToScreen(tx, ty);
                const cy = y + Iso.TILE_H + 80; // shift down by sky headroom
                const cls = (tx + ty) % 2 === 0 ? 'world__tile world__tile--a' : 'world__tile world__tile--b';
                out += `<polygon class="${cls}" points="${Iso.tileDiamond(x, cy)}"></polygon>`;
            }
        }
        return out;
    },

    applyWeather(weather) {
        const layer = document.getElementById('worldWeather');
        if (!layer) return;

        const cloud = (cx, cy, scale = 1) => `
            <g class="weather-cloud" transform="translate(${cx} ${cy}) scale(${scale})">
                <ellipse cx="0" cy="0" rx="22" ry="8"></ellipse>
                <ellipse cx="-12" cy="-4" rx="10" ry="6"></ellipse>
                <ellipse cx="14" cy="-2" rx="12" ry="6"></ellipse>
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
