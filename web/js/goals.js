/* ── Goals & Limits View ──────────────────────────────────────────── */

const Goals = {
    async render(container) {
        destroyCharts();
        const goals = await App.api('/api/goals');

        const dailyGoals = goals.filter(g => g.type === 'daily_total');
        const appGoals = goals.filter(g => g.type === 'app_limit');
        const bedtimeGoals = goals.filter(g => g.type === 'bedtime');

        container.innerHTML = `
            <div class="fade-in">
                <h1 class="page-heading">The Town Charter</h1>

                <div class="charter-section">
                    <div class="charter-section__header">
                        <h2 class="charter-section__title">DAILY SCREEN-TIME DECREE</h2>
                        ${dailyGoals.length === 0 ? `<button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Goals.addDailyGoal())">ISSUE</button>` : ''}
                    </div>
                    ${dailyGoals.length > 0 ? dailyGoals.map(g => `
                        <div class="decree">
                            <div>
                                <div class="decree__kind">DAILY LIMIT</div>
                                <div class="decree__body">${App.formatTime(g.target_minutes)} per day</div>
                            </div>
                            <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => Goals.removeGoal(${g.id}))">REPEAL</button>
                        </div>
                    `).join('') : `<div class="decree-empty">No daily decree. Issue one to be warned when you exceed it.</div>`}
                </div>

                <div class="charter-section">
                    <div class="charter-section__header">
                        <h2 class="charter-section__title">PER-RESIDENT DECREES</h2>
                        <button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Goals.addAppLimit())">ADD</button>
                    </div>
                    ${appGoals.length > 0 ? appGoals.map(g => `
                        <div class="decree">
                            <div>
                                <div class="decree__kind">APP LIMIT</div>
                                <div class="decree__body">${App.escapeHtml(g.app_name)} — ${App.formatTime(g.target_minutes)}/day</div>
                            </div>
                            <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => Goals.removeGoal(${g.id}))">REPEAL</button>
                        </div>
                    `).join('') : `<div class="decree-empty">No per-resident decrees in effect.</div>`}
                </div>

                <div class="charter-section">
                    <div class="charter-section__header">
                        <h2 class="charter-section__title">BEDTIME BELL</h2>
                        ${bedtimeGoals.length === 0 ? `<button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Goals.addBedtime())">SET</button>` : ''}
                    </div>
                    ${bedtimeGoals.length > 0 ? bedtimeGoals.map(g => {
                        const hr = g.bedtime_hour;
                        const min = (g.bedtime_minute || 0).toString().padStart(2, '0');
                        const ampm = hr >= 12 ? 'PM' : 'AM';
                        const h12 = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr);
                        return `
                        <div class="decree">
                            <div>
                                <div class="decree__kind">BEDTIME</div>
                                <div class="decree__body">${h12}:${min} ${ampm}</div>
                            </div>
                            <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => Goals.removeGoal(${g.id}))">REPEAL</button>
                        </div>`;
                    }).join('') : `<div class="decree-empty">No bedtime bell set.</div>`}
                </div>
            </div>
        `;
    },

    addDailyGoal() {
        App.openModal(`
            <div class="modal">
                <h2>Set Daily Goal</h2>
                <div class="form-row">
                    <div class="form-group">
                        <label>Hours</label>
                        <input type="number" id="goalHours" min="0" max="23" value="2">
                    </div>
                    <div class="form-group">
                        <label>Minutes</label>
                        <input type="number" id="goalMinutes" min="0" max="59" value="0">
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="App.runAction(() => Goals.saveDailyGoal())">Save</button>
                </div>
            </div>
        `, '#goalHours');
    },

    async saveDailyGoal() {
        const hours = parseInt(document.getElementById('goalHours').value) || 0;
        const minutes = parseInt(document.getElementById('goalMinutes').value) || 0;
        const total = hours * 60 + minutes;
        if (total <= 0) return;

        await App.api('/api/goals', {
            method: 'POST',
            body: { type: 'daily_total', target_minutes: total },
        });
        document.querySelector('.modal-overlay').remove();
        App.toast(`Daily goal set to ${App.formatTime(total)}`, 'success');
        this.render(document.getElementById('content'));
    },

    async addAppLimit(prefillAppName = '') {
        const appNames = await App.getAppSuggestions();
        App.openModal(`
            <div class="modal">
                <h2>Add App Limit</h2>
                <div class="form-group">
                    <label>App Name</label>
                    <input type="text" id="limitAppName" list="limitAppOptions" placeholder="Choose or type an app" value="${App.escapeAttr(prefillAppName)}">
                    ${App.appDatalist('limitAppOptions', appNames)}
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Hours</label>
                        <input type="number" id="limitHours" min="0" max="23" value="1">
                    </div>
                    <div class="form-group">
                        <label>Minutes</label>
                        <input type="number" id="limitMinutes" min="0" max="59" value="0">
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="App.runAction(() => Goals.saveAppLimit())">Save</button>
                </div>
            </div>
        `, '#limitAppName');
    },

    async saveAppLimit() {
        const appName = document.getElementById('limitAppName').value.trim();
        const hours = parseInt(document.getElementById('limitHours').value) || 0;
        const minutes = parseInt(document.getElementById('limitMinutes').value) || 0;
        const total = hours * 60 + minutes;
        if (!appName || total <= 0) return;

        await App.api('/api/goals', {
            method: 'POST',
            body: { type: 'app_limit', app_name: appName, target_minutes: total },
        });
        App.invalidateAppSuggestions();
        document.querySelector('.modal-overlay').remove();
        App.toast(`Limit set: ${appName} — ${App.formatTime(total)}/day`, 'success');
        if (App.currentTab === 'goals') {
            this.render(document.getElementById('content'));
        } else {
            App.refresh();
        }
    },

    addBedtime() {
        App.openModal(`
            <div class="modal">
                <h2>Set Bedtime Reminder</h2>
                <div class="form-row">
                    <div class="form-group">
                        <label>Hour (24h format)</label>
                        <input type="number" id="bedHour" min="0" max="23" value="22">
                    </div>
                    <div class="form-group">
                        <label>Minute</label>
                        <input type="number" id="bedMinute" min="0" max="59" value="0">
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="App.runAction(() => Goals.saveBedtime())">Save</button>
                </div>
            </div>
        `, '#bedHour');
    },

    async saveBedtime() {
        const hour = parseInt(document.getElementById('bedHour').value);
        const minute = parseInt(document.getElementById('bedMinute').value) || 0;
        if (isNaN(hour)) return;

        await App.api('/api/goals', {
            method: 'POST',
            body: { type: 'bedtime', bedtime_hour: hour, bedtime_minute: minute },
        });
        document.querySelector('.modal-overlay').remove();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        App.toast(`Bedtime reminder set for ${h12}:${minute.toString().padStart(2,'0')} ${ampm}`, 'success');
        this.render(document.getElementById('content'));
    },

    async removeGoal(id) {
        await App.api(`/api/goals/${id}`, { method: 'DELETE' });
        App.toast('Goal removed', 'info');
        this.render(document.getElementById('content'));
    },
};
