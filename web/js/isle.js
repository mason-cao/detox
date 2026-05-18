/* Isle — orchestrates the SVG world. Date bar, weather badge, and
   signboards stay as HTML overlays positioned above the SVG. */

const Isle = {
    async render(container) {
        const [data, inventory] = await Promise.all([
            App.api(`/api/dashboard?date=${App.currentDate}`),
            this.marketInventory(),
        ]);
        const apps = data.apps || [];
        const weather = App.describeGoalWeather(data);

        if (window.HUD) HUD.updateWeather(weather);

        container.innerHTML = this.scaffold(data, weather);
        const stage = container.querySelector('[data-role="world-stage"]');
        if (stage) {
            World.mount(stage, weather);
            World.mountBuildings();
            World.mountLanterns();
            Residents.mount(apps);
            World.applyMarketInventory(inventory);
        }
    },

    async refreshLive() {
        const root = document.querySelector('.isle');
        if (!root) return;

        try {
            const [data, inventory] = await Promise.all([
                App.api(`/api/dashboard?date=${App.currentDate}`),
                this.marketInventory(),
            ]);
            const weather = App.describeGoalWeather(data);
            const total = Number(data.total_minutes || 0);
            const goal = Number(data.goal_target || 0);
            const remaining = goal ? goal - total : null;

            if (window.HUD) HUD.updateWeather(weather);
            if (window.World) World.applyWeather(weather);
            root.dataset.weather = weather.key;

            this.updateWeatherBadge(root, weather);
            this.updateSignboard(root, 'tracked', App.formatTime(total), 'Total tracked screen time on the selected day.');
            this.updateSignboard(root, 'goal', goal ? App.formatTime(goal) : 'Set one', 'Active daily-total goal.');
            this.updateSignboard(root, 'left', this.remainingLabel(remaining), weather.detail);

            if (window.Residents) Residents.update(data.apps || []);
            if (window.World) World.applyMarketInventory(inventory);
        } catch (e) {
            // Keep the current Isle painted if a refresh request fails.
        }
    },

    async marketInventory() {
        try {
            return await App.api('/api/market/inventory');
        } catch (_) {
            return [];
        }
    },

    scaffold(data, weather) {
        const date = data.date || App.currentDate;
        const total = Number(data.total_minutes || 0);
        const goal = Number(data.goal_target || 0);
        const remaining = goal ? goal - total : null;
        const nextDisabled = date >= toLocalDateString() ? 'disabled' : '';

        return `
            <section class="isle" data-weather="${App.escapeAttr(weather.key)}">
                <div class="isle__stage" data-role="world-stage"></div>
                <div class="isle__datebar" aria-label="Date navigation">
                    <button class="isle__date-button" type="button" onclick="App.prevDate()" aria-label="Previous day">←</button>
                    <div class="isle__date-label">
                        <span>The Isle</span>
                        <strong>${App.escapeHtml(App.formatDate(date))}</strong>
                    </div>
                    <button class="isle__date-button" type="button" onclick="App.nextDate()" aria-label="Next day" ${nextDisabled}>→</button>
                </div>
                <div class="isle__weather-badge" title="${App.escapeAttr(weather.detail)}">
                    <span aria-hidden="true">${weather.glyph}</span>
                    <strong>${App.escapeHtml(weather.label)}</strong>
                    <em>${App.escapeHtml(weather.tone)}</em>
                </div>
                <div class="isle__signboards">
                    ${this.renderSignboard('tracked', 'Tracked', App.formatTime(total), 'Total tracked screen time on the selected day.')}
                    ${this.renderSignboard('goal', 'Goal', goal ? App.formatTime(goal) : 'Set one', 'Active daily-total goal.')}
                    ${this.renderSignboard('left', 'Left', this.remainingLabel(remaining), weather.detail)}
                </div>
            </section>
        `;
    },

    renderSignboard(key, label, value, title) {
        return `
            <div class="isle-signboard" data-stat="${App.escapeAttr(key)}" title="${App.escapeAttr(title)}">
                <span>${App.escapeHtml(label)}</span>
                <strong data-role="value">${App.escapeHtml(value)}</strong>
            </div>
        `;
    },

    updateSignboard(root, key, value, title) {
        const node = root.querySelector(`[data-stat="${App.escapeAttr(key)}"]`);
        if (!node) return;
        const valueNode = node.querySelector('[data-role="value"]');
        if (valueNode) valueNode.textContent = value;
        node.title = title;
    },

    updateWeatherBadge(root, weather) {
        const badge = root.querySelector('.isle__weather-badge');
        if (!badge || !weather) return;
        badge.title = weather.detail;
        const glyph = badge.querySelector('span');
        const label = badge.querySelector('strong');
        const tone = badge.querySelector('em');
        if (glyph) glyph.textContent = weather.glyph;
        if (label) label.textContent = weather.label;
        if (tone) tone.textContent = weather.tone;
    },

    remainingLabel(remaining) {
        if (remaining === null) return 'No goal';
        if (remaining < 0) return `${App.formatTime(Math.abs(remaining))} over`;
        return App.formatTime(remaining);
    },
};

window.Isle = Isle;
