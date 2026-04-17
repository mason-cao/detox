/* ── App Blocker View ─────────────────────────────────────────────── */

const Blocker = {
    async render(container) {
        destroyCharts();
        const [blocks, settings, categories] = await Promise.all([
            App.api('/api/blocks'),
            App.api('/api/settings'),
            App.api('/api/categories'),
        ]);

        const whitelistMode = settings.whitelist_mode === '1';
        const blocked = blocks.filter(b => b.block_type === 'blocked');
        const blockedApps = blocked.filter(b => !b.app_name.startsWith('__category__'));
        const whitelisted = blocks.filter(b => b.block_type === 'whitelisted');
        const categoryNames = [...new Set([
            'Social',
            'Entertainment',
            'Communication',
            ...categories.map(c => c.category),
        ])].sort((a, b) => a.localeCompare(b));

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-header">
                    <h1>App Blocker</h1>
                </div>

                ${whitelistMode ? `
                    <div class="focus-mode-card">
                        <div>
                            <div class="focus-mode-card-title">Full Lockdown Active</div>
                            <div class="focus-mode-card-detail">Non-whitelisted apps are being closed automatically.</div>
                        </div>
                        <button class="focus-exit-btn" onclick="App.runAction(() => App.exitFocusMode())">Exit Focus Mode</button>
                    </div>
                ` : ''}

                <!-- Whitelist Mode Toggle -->
                <div class="card" style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 600; font-size: 15px;">Full Lockdown (Focus Mode)</div>
                            <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
                                Block ALL apps except those in your whitelist
                            </div>
                        </div>
                        <label class="toggle">
                            <input type="checkbox" ${whitelistMode ? 'checked' : ''} onchange="App.runAction(() => Blocker.toggleWhitelist(event.target.checked))">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <!-- Blocked Apps -->
                <div class="section-header">
                    <h2>Blocked Apps</h2>
                    <button class="btn btn-primary btn-sm" onclick="App.runAction(() => Blocker.addBlock())">Block App</button>
                </div>
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
                    These apps will be force-quit when opened (or after their time limit).
                </p>
                ${blockedApps.length > 0 ? blockedApps.map(b => {
                    const appName = App.escapeHtml(b.app_name);
                    const firstLetter = App.escapeHtml(b.app_name.charAt(0).toUpperCase());
                    return `
                    <div class="block-item">
                        <div class="block-item-info">
                            <div class="app-icon" style="background: ${App.appColor(b.app_name)}; width: 32px; height: 32px; font-size: 13px;">
                                ${firstLetter}
                            </div>
                            <div>
                                <div class="block-item-name">${appName}</div>
                                <div class="block-item-detail">
                                    ${b.daily_limit_minutes ? `After ${App.formatTime(b.daily_limit_minutes)}` : 'Always blocked'}
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="App.runAction(() => Blocker.removeBlock(${App.inlineArg(b.app_name)}))">Unblock</button>
                    </div>
                `;
                }).join('') : `
                    <div class="card" style="margin-bottom: 24px; text-align: center; padding: 32px;">
                        <p style="color: var(--text-muted);">No apps blocked.</p>
                    </div>
                `}

                <!-- Whitelisted Apps -->
                <div class="section-header" style="margin-top: 32px;">
                    <h2>Whitelisted Apps</h2>
                    <button class="btn btn-primary btn-sm" onclick="App.runAction(() => Blocker.addWhitelist())">Add to Whitelist</button>
                </div>
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
                    These apps are always allowed, even in Focus Mode.
                </p>
                ${whitelisted.length > 0 ? whitelisted.map(b => {
                    const appName = App.escapeHtml(b.app_name);
                    const firstLetter = App.escapeHtml(b.app_name.charAt(0).toUpperCase());
                    return `
                    <div class="block-item">
                        <div class="block-item-info">
                            <div class="app-icon" style="background: var(--green); width: 32px; height: 32px; font-size: 13px;">
                                ${firstLetter}
                            </div>
                            <div>
                                <div class="block-item-name">${appName}</div>
                                <div class="block-item-detail">Always allowed</div>
                            </div>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="App.runAction(() => Blocker.removeBlock(${App.inlineArg(b.app_name)}))">Remove</button>
                    </div>
                `;
                }).join('') : `
                    <div class="card" style="text-align: center; padding: 32px;">
                        <p style="color: var(--text-muted);">No whitelisted apps. Add apps here to allow them during Focus Mode.</p>
                    </div>
                `}

                <!-- Block by Category -->
                <div class="section-header" style="margin-top: 32px;">
                    <h2>Block by Category</h2>
                </div>
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
                    Block all apps in a category at once.
                </p>
                <div class="cards-grid">
                    ${categoryNames.map(cat => {
                        const isBlocked = blocked.some(b => b.app_name === `__category__${cat}`);
                        const catArg = App.inlineArg(cat);
                        return `
                        <div class="card cat-card" onclick="App.runAction(() => Blocker.toggleCategory(${catArg}, ${!isBlocked}))">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div>
                                    <div style="font-weight: 600;">${App.escapeHtml(cat)}</div>
                                    <div style="color: var(--text-muted); font-size: 12px;">${isBlocked ? 'Blocked' : 'Allowed'}</div>
                                </div>
                                <div class="cat-status-dot" style="background: ${isBlocked ? 'var(--red)' : 'var(--green)'};"></div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    },

    async toggleWhitelist(enabled) {
        if (enabled) {
            const result = await App.api('/api/focus-mode/enable', {
                method: 'POST',
                body: {},
            });
            App.setFocusModeActive(true);
            const suffix = result.allowed_app ? `; ${result.allowed_app} stays allowed` : '';
            App.toast(`Focus Mode enabled${suffix}`, 'warning');
            this.render(document.getElementById('content'));
            return;
        }

        if (await App.exitFocusMode({ refresh: false })) {
            this.render(document.getElementById('content'));
        }
    },

    async addBlock(prefillAppName = '') {
        const appNames = await App.getAppSuggestions();
        App.openModal(`
            <div class="modal">
                <h2>Block App</h2>
                <div class="form-group">
                    <label>App Name</label>
                    <input type="text" id="blockAppName" list="blockAppOptions" placeholder="Choose or type an app" value="${App.escapeAttr(prefillAppName)}">
                    ${App.appDatalist('blockAppOptions', appNames)}
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
                    <button class="btn btn-primary" onclick="App.runAction(() => Blocker.saveBlock())">Block</button>
                </div>
            </div>
        `, '#blockAppName');
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
        App.invalidateAppSuggestions();
        document.querySelector('.modal-overlay').remove();
        App.toast(`${appName} has been blocked`, 'success');
        this.render(document.getElementById('content'));
    },

    async addWhitelist(prefillAppName = '') {
        const appNames = await App.getAppSuggestions();
        App.openModal(`
            <div class="modal">
                <h2>Add to Whitelist</h2>
                <div class="form-group">
                    <label>App Name</label>
                    <input type="text" id="whitelistAppName" list="whitelistAppOptions" placeholder="Choose or type an app" value="${App.escapeAttr(prefillAppName)}">
                    ${App.appDatalist('whitelistAppOptions', appNames)}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="App.runAction(() => Blocker.saveWhitelist())">Add</button>
                </div>
            </div>
        `, '#whitelistAppName');
    },

    async saveWhitelist() {
        const appName = document.getElementById('whitelistAppName').value.trim();
        if (!appName) return;
        await App.api('/api/blocks', {
            method: 'POST',
            body: { app_name: appName, block_type: 'whitelisted' },
        });
        App.invalidateAppSuggestions();
        document.querySelector('.modal-overlay').remove();
        App.toast(`${appName} added to whitelist`, 'success');
        this.render(document.getElementById('content'));
    },

    async removeBlock(appName) {
        await App.api(`/api/blocks/${encodeURIComponent(appName)}`, { method: 'DELETE' });
        App.invalidateAppSuggestions();
        const label = appName.startsWith('__category__') ? appName.replace('__category__', '') : appName;
        App.toast(`${label} unblocked`, 'info');
        this.render(document.getElementById('content'));
    },

    async toggleCategory(category, block) {
        const name = `__category__${category}`;
        if (block) {
            await App.api('/api/blocks', {
                method: 'POST',
                body: { app_name: name, block_type: 'blocked' },
            });
            App.toast(`${category} apps blocked`, 'warning');
        } else {
            await App.api(`/api/blocks/${encodeURIComponent(name)}`, { method: 'DELETE' });
            App.toast(`${category} apps unblocked`, 'info');
        }
        this.render(document.getElementById('content'));
    },
};
