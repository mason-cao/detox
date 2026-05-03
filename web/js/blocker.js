/* ── App Blocker View ─────────────────────────────────────────────── */

const Blocker = {
    async render(container) {
        destroyCharts();
        const [blocks, settings, categories, categoryBlocks] = await Promise.all([
            App.api('/api/blocks'),
            App.api('/api/settings'),
            App.api('/api/categories'),
            App.api('/api/category-blocks'),
        ]);

        const whitelistMode = settings.whitelist_mode === '1';
        const blocked = blocks.filter(b => b.block_type === 'blocked');
        const blockedApps = blocked;
        const whitelisted = blocks.filter(b => b.block_type === 'whitelisted');
        const blockedCategories = new Set(categoryBlocks.map(block => block.category_name));
        const categoryNames = [...new Set([
            'Social',
            'Entertainment',
            'Communication',
            ...categories.map(c => c.category),
        ].filter(Boolean))].sort((a, b) => a.localeCompare(b));

        const ruleEntry = (block, { allow = false } = {}) => {
            const appName = App.escapeHtml(block.app_name);
            const firstLetter = App.escapeHtml(block.app_name.charAt(0).toUpperCase());
            const detail = allow
                ? 'Gate stays open during lockdown'
                : block.daily_limit_minutes
                    ? `Daily ration expires after ${App.formatTime(block.daily_limit_minutes)}`
                    : 'Always banished';
            const portraitStyle = allow ? '' : ` style="background: ${App.appColor(block.app_name)}"`;

            return `
                <div class="rule-entry${allow ? ' rule-entry--allow' : ''}">
                    <div class="rule-entry__portrait"${portraitStyle}>${firstLetter}</div>
                    <div>
                        <div class="rule-entry__name">${appName}</div>
                        <div class="rule-entry__detail">${detail}</div>
                    </div>
                    <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => Blocker.removeBlock(${App.inlineArg(block.app_name)}))">
                        ${allow ? 'REMOVE' : 'LIFT'}
                    </button>
                </div>
            `;
        };

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-bar">
                    ${App.backToIsleButton()}
                    <h1 class="page-heading">The Rule Board</h1>
                </div>

                ${whitelistMode ? `
                    <div class="lockdown-banner">
                        <div>
                            <div class="lockdown-banner__title">FULL LOCKDOWN</div>
                            <div class="lockdown-banner__detail">Non-whitelisted residents are being escorted home.</div>
                        </div>
                        <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => App.exitFocusMode())">EXIT</button>
                    </div>
                ` : ''}

                <div class="rule-toggle-panel">
                    <div>
                        <div class="rule-toggle-panel__title">FULL LOCKDOWN</div>
                        <div class="rule-toggle-panel__detail">Close every resident except whitelisted ones.</div>
                    </div>
                    <label class="rule-board__toggle" aria-label="Toggle full lockdown">
                        <input type="checkbox" ${whitelistMode ? 'checked' : ''} onchange="App.runAction(() => Blocker.toggleWhitelist(event.target.checked))">
                        <span class="rule-board__knob" aria-hidden="true"></span>
                    </label>
                </div>

                <div class="charter-section__header">
                    <h2 class="charter-section__title">BLOCKED RESIDENTS</h2>
                    <button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Blocker.addBlock())">ADD</button>
                </div>
                <p class="rule-board__copy">These residents are sent home on sight.</p>
                ${blockedApps.length > 0 ? `
                    <div class="rule-list">
                        ${blockedApps.map(b => ruleEntry(b)).join('')}
                    </div>
                ` : `
                    <div class="rule-empty">No residents are banished.</div>
                `}

                <div class="charter-section__header">
                    <h2 class="charter-section__title">WHITELISTED RESIDENTS</h2>
                    <button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Blocker.addWhitelist())">ADD</button>
                </div>
                <p class="rule-board__copy">These residents are always allowed, even in lockdown.</p>
                ${whitelisted.length > 0 ? `
                    <div class="rule-list">
                        ${whitelisted.map(b => ruleEntry(b, { allow: true })).join('')}
                    </div>
                ` : `
                    <div class="rule-empty">No residents are cleared for lockdown.</div>
                `}

                <div class="charter-section__header">
                    <h2 class="charter-section__title">CATEGORY DECREES</h2>
                </div>
                <p class="rule-board__copy">Block every resident in a category at once.</p>
                <div class="category-grid">
                    ${categoryNames.map(cat => {
                        const isBlocked = blockedCategories.has(cat);
                        const catArg = App.inlineArg(cat);
                        return `
                        <button type="button" class="category-tile${isBlocked ? ' category-tile--blocked' : ''}" onclick="App.runAction(() => Blocker.toggleCategory(${catArg}, ${!isBlocked}))">
                            <div>
                                <div class="category-tile__name">${App.escapeHtml(cat)}</div>
                                <div class="category-tile__state">${isBlocked ? 'BLOCKED' : 'ALLOWED'}</div>
                            </div>
                            <div class="category-tile__dot"></div>
                        </button>`;
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
            <div class="pixel-modal">
                <h2 class="pixel-modal__title">BANISH A RESIDENT</h2>
                <div class="pixel-modal__group">
                    <label class="pixel-modal__label">RESIDENT</label>
                    <input class="pixel-modal__input" type="text" id="blockAppName" list="blockAppOptions" placeholder="choose or type an app" value="${App.escapeAttr(prefillAppName)}">
                    ${App.appDatalist('blockAppOptions', appNames)}
                </div>
                <div class="pixel-modal__group">
                    <label class="pixel-modal__label">DECREE</label>
                    <select class="pixel-modal__input" id="blockType" onchange="document.getElementById('limitFields').style.display = this.value === 'limit' ? 'grid' : 'none'">
                        <option value="always">Always banished</option>
                        <option value="limit">After time limit</option>
                    </select>
                </div>
                <div class="pixel-modal__row" id="limitFields" style="display: none;">
                    <div class="pixel-modal__group">
                        <label class="pixel-modal__label">HOURS</label>
                        <input class="pixel-modal__input" type="number" id="blockHours" min="0" max="23" value="1">
                    </div>
                    <div class="pixel-modal__group">
                        <label class="pixel-modal__label">MINUTES</label>
                        <input class="pixel-modal__input" type="number" id="blockMinutes" min="0" max="59" value="0">
                    </div>
                </div>
                <div class="pixel-modal__actions">
                    <button class="pixel-button" onclick="this.closest('.modal-overlay').remove()">CANCEL</button>
                    <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => Blocker.saveBlock())">BANISH</button>
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
        App.toast(`${appName} banished`, 'success');
        this.render(document.getElementById('content'));
    },

    async addWhitelist(prefillAppName = '') {
        const appNames = await App.getAppSuggestions();
        App.openModal(`
            <div class="pixel-modal">
                <h2 class="pixel-modal__title">WHITELIST A RESIDENT</h2>
                <div class="pixel-modal__group">
                    <label class="pixel-modal__label">RESIDENT</label>
                    <input class="pixel-modal__input" type="text" id="whitelistAppName" list="whitelistAppOptions" placeholder="choose or type an app" value="${App.escapeAttr(prefillAppName)}">
                    ${App.appDatalist('whitelistAppOptions', appNames)}
                </div>
                <div class="pixel-modal__actions">
                    <button class="pixel-button" onclick="this.closest('.modal-overlay').remove()">CANCEL</button>
                    <button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Blocker.saveWhitelist())">ALLOW</button>
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
        App.toast(`${appName} decree lifted`, 'info');
        this.render(document.getElementById('content'));
    },

    async toggleCategory(category, block) {
        if (block) {
            await App.api('/api/category-blocks', {
                method: 'POST',
                body: { category_name: category },
            });
            App.toast(`${category} residents banished`, 'warning');
        } else {
            await App.api(`/api/category-blocks/${encodeURIComponent(category)}`, { method: 'DELETE' });
            App.toast(`${category} residents pardoned`, 'info');
        }
        this.render(document.getElementById('content'));
    },
};
