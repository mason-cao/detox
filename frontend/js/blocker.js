/* ── App Blocker View ─────────────────────────────────────────────── */

const Blocker = {
    async render(container) {
        destroyCharts();
        const [blocks, settings] = await Promise.all([
            App.api('/api/blocks'),
            App.api('/api/settings'),
        ]);

        const whitelistMode = settings.whitelist_mode === '1';
        const blocked = blocks.filter(b => b.block_type === 'blocked');
        const whitelisted = blocks.filter(b => b.block_type === 'whitelisted');

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-header">
                    <h1>App Blocker</h1>
                </div>

                <!-- Whitelist Mode Toggle -->
                <div class="card" style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 600; font-size: 15px;">Focus Mode (Whitelist)</div>
                            <div style="color: var(--text-dim); font-size: 13px; margin-top: 4px;">
                                Block ALL apps except those in your whitelist
                            </div>
                        </div>
                        <label class="toggle">
                            <input type="checkbox" ${whitelistMode ? 'checked' : ''} onchange="Blocker.toggleWhitelist(this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <!-- Blocked Apps -->
                <div class="section-header">
                    <h2>Blocked Apps</h2>
                    <button class="btn btn-primary btn-sm" onclick="Blocker.addBlock()">Block App</button>
                </div>
                <p style="color: var(--text-dim); font-size: 13px; margin-bottom: 16px;">
                    These apps will be force-quit when opened (or after their time limit).
                </p>
                ${blocked.length > 0 ? blocked.map(b => `
                    <div class="block-item">
                        <div class="block-item-info">
                            <div class="app-icon" style="background: ${App.appColor(b.app_name)}; width: 32px; height: 32px; font-size: 13px;">
                                ${b.app_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="block-item-name">${b.app_name}</div>
                                <div class="block-item-detail">
                                    ${b.daily_limit_minutes ? `After ${App.formatTime(b.daily_limit_minutes)}` : 'Always blocked'}
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="Blocker.removeBlock('${b.app_name.replace(/'/g, "\\'")}')">Unblock</button>
                    </div>
                `).join('') : `
                    <div class="card" style="margin-bottom: 24px; text-align: center; padding: 32px;">
                        <p style="color: var(--text-dim);">No apps blocked.</p>
                    </div>
                `}

                <!-- Whitelisted Apps -->
                <div class="section-header" style="margin-top: 32px;">
                    <h2>Whitelisted Apps</h2>
                    <button class="btn btn-primary btn-sm" onclick="Blocker.addWhitelist()">Add to Whitelist</button>
                </div>
                <p style="color: var(--text-dim); font-size: 13px; margin-bottom: 16px;">
                    These apps are always allowed, even in Focus Mode.
                </p>
                ${whitelisted.length > 0 ? whitelisted.map(b => `
                    <div class="block-item">
                        <div class="block-item-info">
                            <div class="app-icon" style="background: var(--green); width: 32px; height: 32px; font-size: 13px;">
                                ${b.app_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="block-item-name">${b.app_name}</div>
                                <div class="block-item-detail">Always allowed</div>
                            </div>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="Blocker.removeBlock('${b.app_name.replace(/'/g, "\\'")}')">Remove</button>
                    </div>
                `).join('') : `
                    <div class="card" style="text-align: center; padding: 32px;">
                        <p style="color: var(--text-dim);">No whitelisted apps. Add apps here to allow them during Focus Mode.</p>
                    </div>
                `}

                <!-- Block by Category -->
                <div class="section-header" style="margin-top: 32px;">
                    <h2>Block by Category</h2>
                </div>
                <p style="color: var(--text-dim); font-size: 13px; margin-bottom: 16px;">
                    Block all apps in a category at once.
                </p>
                <div class="cards-grid">
                    ${['Social', 'Entertainment', 'Communication'].map(cat => {
                        const isBlocked = blocked.some(b => b.app_name === `__category__${cat}`);
                        return `
                        <div class="card" style="cursor: pointer;" onclick="Blocker.toggleCategory('${cat}', ${!isBlocked})">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div>
                                    <div style="font-weight: 600;">${cat}</div>
                                    <div style="color: var(--text-dim); font-size: 12px;">${isBlocked ? 'Blocked' : 'Allowed'}</div>
                                </div>
                                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${isBlocked ? 'var(--red)' : 'var(--green)'};"></div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    },

    async toggleWhitelist(enabled) {
        await App.api('/api/settings', {
            method: 'POST',
            body: { whitelist_mode: enabled ? '1' : '0' },
        });
    },

    addBlock() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <h2>Block App</h2>
                <div class="form-group">
                    <label>App Name</label>
                    <input type="text" id="blockAppName" placeholder="e.g., Instagram, TikTok">
                </div>
                <div class="form-group">
                    <label>Block Type</label>
                    <select id="blockType" onchange="document.getElementById('limitFields').style.display = this.value === 'limit' ? 'flex' : 'none'">
                        <option value="always">Always block</option>
                        <option value="limit">After time limit</option>
                    </select>
                </div>
                <div class="form-row" id="limitFields" style="display: none;">
                    <div class="form-group">
                        <label>Hours</label>
                        <input type="number" id="blockHours" min="0" max="23" value="1">
                    </div>
                    <div class="form-group">
                        <label>Minutes</label>
                        <input type="number" id="blockMinutes" min="0" max="59" value="0">
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="Blocker.saveBlock()">Block</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async saveBlock() {
        const appName = document.getElementById('blockAppName').value.trim();
        if (!appName) return;
        const blockType = document.getElementById('blockType').value;
        let limit = null;
        if (blockType === 'limit') {
            const h = parseInt(document.getElementById('blockHours').value) || 0;
            const m = parseInt(document.getElementById('blockMinutes').value) || 0;
            limit = h * 60 + m;
            if (limit <= 0) return;
        }
        await App.api('/api/blocks', {
            method: 'POST',
            body: { app_name: appName, block_type: 'blocked', daily_limit_minutes: limit },
        });
        document.querySelector('.modal-overlay').remove();
        this.render(document.getElementById('content'));
    },

    addWhitelist() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <h2>Add to Whitelist</h2>
                <div class="form-group">
                    <label>App Name</label>
                    <input type="text" id="whitelistAppName" placeholder="e.g., Notes, Calendar">
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="Blocker.saveWhitelist()">Add</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async saveWhitelist() {
        const appName = document.getElementById('whitelistAppName').value.trim();
        if (!appName) return;
        await App.api('/api/blocks', {
            method: 'POST',
            body: { app_name: appName, block_type: 'whitelisted' },
        });
        document.querySelector('.modal-overlay').remove();
        this.render(document.getElementById('content'));
    },

    async removeBlock(appName) {
        await App.api(`/api/blocks/${encodeURIComponent(appName)}`, { method: 'DELETE' });
        this.render(document.getElementById('content'));
    },

    async toggleCategory(category, block) {
        const name = `__category__${category}`;
        if (block) {
            await App.api('/api/blocks', {
                method: 'POST',
                body: { app_name: name, block_type: 'blocked' },
            });
        } else {
            await App.api(`/api/blocks/${encodeURIComponent(name)}`, { method: 'DELETE' });
        }
        this.render(document.getElementById('content'));
    },
};
