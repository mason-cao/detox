/* ── Settings View ────────────────────────────────────────────────── */

const Settings = {
    async render(container) {
        destroyCharts();
        const [settings, categories] = await Promise.all([
            App.api('/api/settings'),
            App.api('/api/categories'),
        ]);

        // Group categories
        const catGroups = {};
        categories.forEach(c => {
            if (!catGroups[c.category]) catGroups[c.category] = [];
            catGroups[c.category].push(c.app_name);
        });

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-header">
                    <h1>Settings</h1>
                </div>

                <!-- App Categories -->
                <div class="section-header">
                    <h2>App Categories</h2>
                    <button class="btn btn-primary btn-sm" onclick="Settings.addCategory()">Categorize App</button>
                </div>
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
                    Assign apps to categories for better organization and category-based blocking.
                </p>
                <div class="cards-grid" style="margin-bottom: 32px;">
                    ${Object.entries(catGroups).map(([cat, apps]) => `
                        <div class="card">
                            <div class="card-header">
                                <span class="card-title" style="color: ${App.categoryColor(cat)}">${cat}</span>
                                <span style="font-size: 12px; color: var(--text-muted);">${apps.length} apps</span>
                            </div>
                            <div style="font-size: 13px; color: var(--text-muted); line-height: 1.8;">
                                ${apps.slice(0, 8).join(', ')}${apps.length > 8 ? `, +${apps.length - 8} more` : ''}
                            </div>
                        </div>
                    `).join('')}
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

    addCategory() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <h2>Categorize App</h2>
                <div class="form-group">
                    <label>App Name</label>
                    <input type="text" id="catAppName" placeholder="e.g., Notion">
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select id="catCategory">
                        <option value="Productivity">Productivity</option>
                        <option value="Communication">Communication</option>
                        <option value="Social">Social</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Utilities">Utilities</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="Settings.saveCategory()">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async saveCategory() {
        const appName = document.getElementById('catAppName').value.trim();
        const category = document.getElementById('catCategory').value;
        if (!appName) return;

        await App.api('/api/categories', {
            method: 'POST',
            body: { app_name: appName, category },
        });
        document.querySelector('.modal-overlay').remove();
        this.render(document.getElementById('content'));
    },
};
