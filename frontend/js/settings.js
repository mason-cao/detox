/* ── Settings View ────────────────────────────────────────────────── */

const Settings = {
    async render(container) {
        destroyCharts();
        const [settings, categories] = await Promise.all([
            App.api('/api/settings'),
            App.api('/api/categories'),
        ]);

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const parsedIdleTimeout = parseInt(settings.idle_timeout_minutes ?? '5', 10);
        const idleTimeout = Number.isFinite(parsedIdleTimeout) ? Math.min(120, Math.max(0, parsedIdleTimeout)) : 5;

        // Group categories
        const catGroups = {};
        categories.forEach(c => {
            if (!catGroups[c.category]) catGroups[c.category] = [];
            catGroups[c.category].push(c.app_name);
        });

        const today = toLocalDateString();
        const weekAgoDate = new Date();
        weekAgoDate.setDate(weekAgoDate.getDate() - 7);
        const weekAgo = toLocalDateString(weekAgoDate);

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-header">
                    <h1>Settings</h1>
                </div>

                <!-- Appearance -->
                <div class="section-header">
                    <h2>Appearance</h2>
                </div>
                <div class="card" style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 600; font-size: 15px;">Dark Mode</div>
                            <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
                                Switch between light and dark themes
                            </div>
                        </div>
                        <label class="toggle">
                            <input type="checkbox" ${isDark ? 'checked' : ''} onchange="App.toggleDarkMode()">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <!-- Tracking -->
                <div class="section-header">
                    <h2>Tracking</h2>
                </div>
                <div class="card" style="margin-bottom: 24px;">
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">Idle Detection</div>
                    <div style="color: var(--text-muted); font-size: 13px;">
                        Stop counting screen time after no keyboard or pointer activity.
                    </div>
                    <div class="export-row">
                        <div class="form-group">
                            <label>Idle Timeout</label>
                            <input type="number" id="idleTimeoutMinutes" min="0" max="120" value="${idleTimeout}">
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="App.runAction(() => Settings.saveIdleTimeout())">Save</button>
                    </div>
                    <div style="color: var(--text-muted); font-size: 12px; margin-top: 10px;">Use 0 minutes to disable idle detection.</div>
                </div>

                <!-- Data Export -->
                <div class="section-header">
                    <h2>Data Export</h2>
                </div>
                <div class="card" style="margin-bottom: 24px;">
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">Export Your Data</div>
                    <div style="color: var(--text-muted); font-size: 13px;">
                        Download your screen time data as CSV or JSON.
                    </div>
                    <div class="export-row">
                        <div class="form-group">
                            <label>Start Date</label>
                            <input type="date" id="exportStart" value="${weekAgo}">
                        </div>
                        <div class="form-group">
                            <label>End Date</label>
                            <input type="date" id="exportEnd" value="${today}">
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="App.runAction(() => Settings.exportData('csv'))">Export CSV</button>
                        <button class="btn btn-secondary btn-sm" onclick="App.runAction(() => Settings.exportData('json'))">Export JSON</button>
                    </div>
                </div>

                <!-- App Categories -->
                <div class="section-header">
                    <h2>App Categories</h2>
                    <button class="btn btn-primary btn-sm" onclick="App.runAction(() => Settings.addCategory())">Categorize App</button>
                </div>
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
                    Assign apps to categories for better organization and category-based blocking.
                </p>
                <div class="cards-grid" style="margin-bottom: 32px;">
                    ${Object.entries(catGroups).map(([cat, apps]) => `
                        <div class="card">
                            <div class="card-header">
                                <span class="card-title" style="color: ${App.categoryColor(cat)}">${App.escapeHtml(cat)}</span>
                                <span style="font-size: 12px; color: var(--text-muted);">${apps.length} apps</span>
                            </div>
                            <div style="font-size: 13px; color: var(--text-muted); line-height: 1.8;">
                                ${apps.slice(0, 8).map(app => App.escapeHtml(app)).join(', ')}${apps.length > 8 ? `, +${apps.length - 8} more` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Keyboard Shortcuts -->
                <div class="section-header">
                    <h2>Keyboard Shortcuts</h2>
                </div>
                <div class="kbd-grid" style="margin-bottom: 32px;">
                    <div class="kbd-item"><kbd>←</kbd><kbd>→</kbd> <span class="kbd-desc">Navigate dates</span></div>
                    <div class="kbd-item"><kbd>D</kbd> <span class="kbd-desc">Toggle dark mode</span></div>
                    <div class="kbd-item"><kbd>/</kbd> <span class="kbd-desc">Search apps</span></div>
                    <div class="kbd-item"><kbd>1</kbd>-<kbd>7</kbd> <span class="kbd-desc">Switch tabs</span></div>
                    <div class="kbd-item"><kbd>Esc</kbd> <span class="kbd-desc">Close modals</span></div>
                </div>

                <!-- About -->
                <div class="section-header">
                    <h2>About Detox</h2>
                </div>
                <div class="card">
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 12px;">🧘</div>
                        <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Detox</div>
                        <div style="color: var(--text-muted); font-size: 13px;">
                            Screen Time Tracker for macOS<br>
                            Take control of your digital habits.
                        </div>
                        <div style="margin-top: 16px; color: var(--text-muted); font-size: 12px;">
                            Monitor polls active app every 2 seconds.<br>
                            Data stored locally in SQLite.
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async exportData(format) {
        const start = document.getElementById('exportStart').value;
        const end = document.getElementById('exportEnd').value;
        if (!start || !end) {
            App.toast('Please select both start and end dates', 'warning');
            return;
        }
        if (start > end) {
            App.toast('Start date must be before end date', 'warning');
            return;
        }

        const url = `/api/export/${format}?start=${start}&end=${end}`;

        if (format === 'csv') {
            const a = document.createElement('a');
            a.href = url;
            a.download = `detox-export-${start}-to-${end}.csv`;
            a.click();
            App.toast('CSV download started', 'success');
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = `detox-export-${start}-to-${end}.json`;
            a.click();
            App.toast('JSON download started', 'success');
        }
    },

    async saveIdleTimeout() {
        const input = document.getElementById('idleTimeoutMinutes');
        const minutes = Math.min(120, Math.max(0, parseInt(input.value, 10) || 0));
        await App.api('/api/settings', {
            method: 'POST',
            body: { idle_timeout_minutes: String(minutes) },
        });
        input.value = minutes;
        App.toast(minutes === 0 ? 'Idle detection disabled' : `Idle timeout set to ${minutes}m`, 'success');
    },

    async addCategory(prefillAppName = '') {
        const [appNames, categories] = await Promise.all([
            App.getAppSuggestions(),
            App.api('/api/categories'),
        ]);
        const categoryOptions = [...new Set([
            'Productivity',
            'Communication',
            'Social',
            'Entertainment',
            'Utilities',
            ...categories.map(c => c.category),
        ])];
        const existing = categories.find(c => c.app_name === prefillAppName);
        const selectedCategory = existing ? existing.category : 'Productivity';

        App.openModal(`
            <div class="modal">
                <h2>Categorize App</h2>
                <div class="form-group">
                    <label>App Name</label>
                    <input type="text" id="catAppName" list="categoryAppOptions" placeholder="Choose or type an app" value="${App.escapeAttr(prefillAppName)}">
                    ${App.appDatalist('categoryAppOptions', appNames)}
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <input type="text" id="catCategory" list="categoryOptions" value="${App.escapeAttr(selectedCategory)}">
                    ${App.datalist('categoryOptions', categoryOptions)}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="App.runAction(() => Settings.saveCategory())">Save</button>
                </div>
            </div>
        `, '#catAppName');
    },

    async saveCategory() {
        const appName = document.getElementById('catAppName').value.trim();
        const category = document.getElementById('catCategory').value.trim();
        if (!appName || !category) return;

        await App.api('/api/categories', {
            method: 'POST',
            body: { app_name: appName, category },
        });
        App.invalidateAppSuggestions();
        document.querySelector('.modal-overlay').remove();
        App.toast(`${appName} categorized as ${category}`, 'success');
        if (App.currentTab === 'settings') {
            this.render(document.getElementById('content'));
        } else {
            App.refresh();
        }
    },
};
