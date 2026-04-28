/* Isle — isometric dashboard. Replaces Dashboard.render for the 'dashboard' tab. */

const Isle = {
    _motionMedia: null,
    _motionListenerBound: false,

    async render(container) {
        const data = await App.api(`/api/dashboard?date=${App.currentDate}`);
        const apps = data.apps || [];

        container.innerHTML = this.scaffold();
        this.bindMotionPreference();
        this.updateSky();
        this.renderPlots(apps);
        this.syncSkyTimer();
    },

    scaffold() {
        return `
            <section class="isle">
                <div class="isle__sky" id="isleSky">
                    <div class="isle__stars"></div>
                    <div class="isle__celestial" id="isleCelestial"></div>
                </div>
                <div class="isle__ground" id="isleGround"></div>
            </section>
        `;
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
        if (this._motionMedia.addEventListener) {
            this._motionMedia.addEventListener('change', onChange);
        } else if (this._motionMedia.addListener) {
            this._motionMedia.addListener(onChange);
        }
        this._motionListenerBound = true;
    },

    syncSkyTimer() {
        if (this._skyInterval) {
            clearInterval(this._skyInterval);
            this._skyInterval = null;
        }

        const sky = document.getElementById('isleSky');
        if (sky) {
            sky.classList.toggle('is-reduced-motion', App.prefersReducedMotion());
        }

        if (!App.prefersReducedMotion()) {
            // Update sky every minute for users who have not asked motion to be reduced.
            this._skyInterval = setInterval(() => this.updateSky(), 60000);
        }
    },

    updateSky() {
        const sky = document.getElementById('isleSky');
        if (!sky) return;
        const now = new Date();
        const hours = now.getHours() + now.getMinutes() / 60;
        const phase = this.hourToPhase(hours);

        document.documentElement.style.setProperty('--sky-top', phase.top);
        document.documentElement.style.setProperty('--sky-bottom', phase.bottom);
        document.documentElement.style.setProperty('--ground-tint', phase.ground);
        sky.classList.toggle('is-night', phase.isNight);

        const celestial = document.getElementById('isleCelestial');
        if (celestial) {
            // Sun arcs 6am → 6pm, moon 6pm → 6am. Horizontal = time, vertical = parabolic.
            const t = App.prefersReducedMotion() ? 0.64 : ((hours - 6 + 24) % 12) / 12;
            const rect = sky.getBoundingClientRect();
            const x = t * (rect.width - 48);
            const y = rect.height - 48 - Math.sin(t * Math.PI) * (rect.height * 0.6);
            celestial.style.left = `${x}px`;
            celestial.style.top = `${y}px`;
            celestial.classList.toggle('isle__celestial--moon', phase.isNight);
        }
    },

    hourToPhase(h) {
        // Dawn 5-7, day 7-17, dusk 17-19, night 19-5.
        if (h >= 5 && h < 7) return { top: '#ffb27a', bottom: '#ffd98a', ground: '#e8c896', isNight: false };
        if (h >= 7 && h < 17) return { top: '#7bb8e8', bottom: '#ffd98a', ground: '#e8c896', isNight: false };
        if (h >= 17 && h < 19) return { top: '#d16a8f', bottom: '#ffb27a', ground: '#c89677', isNight: false };
        return { top: '#1a1f3a', bottom: '#2a3050', ground: '#4a4060', isNight: true };
    },

    renderPlots(apps) {
        const ground = document.getElementById('isleGround');
        if (!ground) return;

        if (!apps.length) {
            ground.innerHTML = `
                <div class="isle__empty">
                    Your isle is quiet today.<br>
                    Use any app for 2+ seconds and they'll move in.
                </div>
            `;
            return;
        }

        const top = apps.slice(0, 8);
        ground.innerHTML = top.map((app, i) => {
            const tier = i === 0 ? 1 : i < 3 ? 2 : 3;
            const glyph = this.glyphFor(app.app_name);
            const time = App.formatTime(app.minutes);
            return `
                <div class="plot plot--tier-${tier}" data-app="${App.escapeHtml(app.app_name)}" onclick="App.showTab('apps')">
                    <span class="plot__icon" aria-hidden="true">${glyph}</span>
                    <span class="plot__name">${App.escapeHtml(app.app_name)}</span>
                    <span class="plot__time">${time}</span>
                </div>
            `;
        }).join('');
    },

    glyphFor(name) {
        const map = {
            'Safari': '🌐', 'Google Chrome': '🌐', 'Firefox': '🦊',
            'Mail': '✉', 'Messages': '💬', 'Slack': '💬', 'Discord': '💬',
            'Instagram': '📷', 'Twitter': '🐦', 'TikTok': '🎵', 'Reddit': '💭',
            'YouTube': '▶', 'Netflix': '🎬', 'Spotify': '♪', 'Music': '♪',
            'Terminal': '⌨', 'iTerm2': '⌨', 'Visual Studio Code': '⌨', 'Code': '⌨',
            'Xcode': '🔨', 'Finder': '📁', 'Calendar': '📅', 'Notes': '📝',
        };
        return map[name] || '🏠';
    },
};

window.Isle = Isle;
