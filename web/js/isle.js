/* Isle — orchestrates the SVG world. Date bar, weather badge, and
   signboards stay as HTML overlays positioned above the SVG. */

const Isle = {
    async render(container) {
        const data = await App.api(`/api/dashboard?date=${App.currentDate}`);
        const apps = data.apps || [];
        const weather = App.describeGoalWeather(data);

        if (window.HUD) HUD.updateWeather(weather);

        container.innerHTML = this.scaffold(data, weather);
        const stage = container.querySelector('[data-role="world-stage"]');
        if (stage) {
            World.mount(stage, weather);
            World.mountBuildings();
            World.placeResidents(apps);
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
                    ${this.renderSignboard('Tracked', App.formatTime(total), 'Total tracked screen time on the selected day.')}
                    ${this.renderSignboard('Goal', goal ? App.formatTime(goal) : 'Set one', 'Active daily-total goal.')}
                    ${this.renderSignboard('Left', this.remainingLabel(remaining), weather.detail)}
                </div>
            </section>
        `;
    },

    renderSignboard(label, value, title) {
        return `
            <div class="isle-signboard" title="${App.escapeAttr(title)}">
                <span>${App.escapeHtml(label)}</span>
                <strong>${App.escapeHtml(value)}</strong>
            </div>
        `;
    },

    remainingLabel(remaining) {
        if (remaining === null) return 'No goal';
        if (remaining < 0) return `${App.formatTime(Math.abs(remaining))} over`;
        return App.formatTime(remaining);
    },
};

window.Isle = Isle;
