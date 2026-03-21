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
                <div class="page-header">
                    <h1>Goals & Limits</h1>
                </div>

                <!-- Daily Screen Time Goal -->
                <div class="section-header">
                    <h2>Daily Screen Time Goal</h2>
                    ${dailyGoals.length === 0 ? `<button class="btn btn-primary btn-sm" onclick="Goals.addDailyGoal()">Set Goal</button>` : ''}
                </div>
                ${dailyGoals.length > 0 ? dailyGoals.map(g => `
                    <div class="goal-item">
                        <div class="goal-info">
                            <div class="goal-type">Daily Limit</div>
                            <div class="goal-desc">${App.formatTime(g.target_minutes)} per day</div>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="Goals.removeGoal(${g.id})">Remove</button>
                    </div>
                `).join('') : `
                    <div class="card" style="margin-bottom: 24px; text-align: center; padding: 32px;">
                        <p style="color: var(--text-dim);">No daily goal set. Set a target to get notified when you exceed it.</p>
                    </div>
                `}

                <!-- Per-App Limits -->
                <div class="section-header" style="margin-top: 32px;">
                    <h2>Per-App Limits</h2>
                    <button class="btn btn-primary btn-sm" onclick="Goals.addAppLimit()">Add Limit</button>
                </div>
                ${appGoals.length > 0 ? appGoals.map(g => `
                    <div class="goal-item">
                        <div class="goal-info">
                            <div class="goal-type">App Limit</div>
                            <div class="goal-desc">${g.app_name}: ${App.formatTime(g.target_minutes)} per day</div>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="Goals.removeGoal(${g.id})">Remove</button>
                    </div>
                `).join('') : `
                    <div class="card" style="margin-bottom: 24px; text-align: center; padding: 32px;">
                        <p style="color: var(--text-dim);">No per-app limits set.</p>
                    </div>
                `}

                <!-- Bedtime Reminder -->
                <div class="section-header" style="margin-top: 32px;">
                    <h2>Bedtime Reminder</h2>
                    ${bedtimeGoals.length === 0 ? `<button class="btn btn-primary btn-sm" onclick="Goals.addBedtime()">Set Bedtime</button>` : ''}
                </div>
                ${bedtimeGoals.length > 0 ? bedtimeGoals.map(g => {
                    const hr = g.bedtime_hour;
                    const min = (g.bedtime_minute || 0).toString().padStart(2, '0');
                    const ampm = hr >= 12 ? 'PM' : 'AM';
                    const h12 = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr);
                    return `
                    <div class="goal-item">
                        <div class="goal-info">
                            <div class="goal-type">Bedtime</div>
                            <div class="goal-desc">${h12}:${min} ${ampm}</div>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="Goals.removeGoal(${g.id})">Remove</button>
                    </div>`;
                }).join('') : `
                    <div class="card" style="margin-bottom: 24px; text-align: center; padding: 32px;">
                        <p style="color: var(--text-dim);">No bedtime reminder set.</p>
                    </div>
                `}
            </div>
        `;
    },

    addDailyGoal() {
        const content = document.getElementById('content');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
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
                    <button class="btn btn-primary" onclick="Goals.saveDailyGoal()">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
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
        this.render(document.getElementById('content'));
    },

    addAppLimit() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <h2>Add App Limit</h2>
                <div class="form-group">
                    <label>App Name</label>
                    <input type="text" id="limitAppName" placeholder="e.g., Safari, Instagram">
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
                    <button class="btn btn-primary" onclick="Goals.saveAppLimit()">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
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
        document.querySelector('.modal-overlay').remove();
        this.render(document.getElementById('content'));
    },

    addBedtime() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
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
                    <button class="btn btn-primary" onclick="Goals.saveBedtime()">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
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
        this.render(document.getElementById('content'));
    },

    async removeGoal(id) {
        await App.api(`/api/goals/${id}`, { method: 'DELETE' });
        this.render(document.getElementById('content'));
    },
};
