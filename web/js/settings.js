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
        const ghostMode = String(settings.ghost_mode ?? '0') === '1';

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
                <div class="page-bar">
                    ${App.backToIsleButton()}
                    <h1 class="page-heading">The Mayor's Study</h1>
                </div>

                <div class="study-section">
                    <div class="study-section__header">
                        <h2 class="study-section__title">APPEARANCE</h2>
                    </div>
                    <div class="study-panel">
                        <div class="study-row">
                            <div>
                                <div class="study-row__label">CANDLELIGHT</div>
                                <div class="study-row__detail">Switch between dawn and midnight palettes.</div>
                            </div>
                            <span class="study-candle" data-role="candle" aria-hidden="true">
                                <svg viewBox="0 0 16 24" width="16" height="24">
                                    <rect x="6" y="10" width="4" height="12" fill="#c4a47a" stroke="#2a1e2a" stroke-width="1"/>
                                    <path data-role="flame" d="M8 10c-2-2-2-5 0-7 2 2 2 5 0 7z" fill="#ffd04a" stroke="#b8860b" stroke-width="0.5"/>
                                </svg>
                            </span>
                            <label class="rule-board__toggle" aria-label="Toggle candlelight">
                                <input type="checkbox" ${isDark ? 'checked' : ''} onchange="App.toggleDarkMode()">
                                <span class="rule-board__knob" aria-hidden="true"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="study-section">
                    <div class="study-section__header">
                        <h2 class="study-section__title">TRACKING</h2>
                    </div>
                    <div class="study-panel">
                        <div class="study-row">
                            <div>
                                <div class="study-row__label">IDLE DETECTION</div>
                                <div class="study-row__detail">Stop counting screen time after no keyboard or pointer activity.</div>
                            </div>
                        </div>
                        <div class="study-form">
                            <div class="pixel-modal__group">
                                <label class="pixel-modal__label">IDLE TIMEOUT (min)</label>
                                <input class="pixel-modal__input" type="number" id="idleTimeoutMinutes" min="0" max="120" value="${idleTimeout}">
                            </div>
                            <button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Settings.saveIdleTimeout())">SAVE</button>
                        </div>
                        <div class="study-row__detail">Use 0 minutes to disable idle detection.</div>
                    </div>
                </div>

                <div class="study-section">
                    <div class="study-section__header">
                        <h2 class="study-section__title">PRIVACY</h2>
                    </div>
                    <div class="study-panel">
                        <div class="study-row">
                            <div>
                                <div class="study-row__label">GHOST MODE</div>
                                <div class="study-row__detail">Hash app names before they leave this Mac. The cloud sees opaque tokens; this dashboard still shows real names because it reads the local file.</div>
                            </div>
                            <label class="rule-board__toggle" aria-label="Toggle Ghost Mode">
                                <input type="checkbox" id="ghostModeToggle" ${ghostMode ? 'checked' : ''} onchange="App.runAction(() => Settings.toggleGhostMode(this.checked))">
                                <span class="rule-board__knob" aria-hidden="true"></span>
                            </label>
                        </div>
                        <div class="study-row__detail">Salt stays on this device — see <a href="/docs/privacy.md" target="_blank" rel="noopener">privacy policy</a> for trade-offs.</div>
                    </div>
                </div>

                <div class="study-section">
                    <div class="study-section__header">
                        <h2 class="study-section__title">DATA EXPORT</h2>
                    </div>
                    <div class="study-panel">
                        <div class="study-row">
                            <div>
                                <div class="study-row__label">EXPORT YOUR DATA</div>
                                <div class="study-row__detail">Download a CSV or JSON dump of your sessions.</div>
                            </div>
                        </div>
                        <div class="study-form">
                            <div class="pixel-modal__group">
                                <label class="pixel-modal__label">START DATE</label>
                                <input class="pixel-modal__input" type="date" id="exportStart" value="${weekAgo}">
                            </div>
                            <div class="pixel-modal__group">
                                <label class="pixel-modal__label">END DATE</label>
                                <input class="pixel-modal__input" type="date" id="exportEnd" value="${today}">
                            </div>
                            <button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Settings.exportData('csv'))">EXPORT CSV</button>
                            <button class="pixel-button" onclick="App.runAction(() => Settings.exportData('json'))">EXPORT JSON</button>
                        </div>
                        <div class="study-row">
                            <div>
                                <div class="study-row__label">FULL ARCHIVE</div>
                                <div class="study-row__detail">Download every row stored for this account in one JSON file.</div>
                            </div>
                            <button class="pixel-button" onclick="App.runAction(() => Settings.exportFull())">DOWNLOAD ARCHIVE</button>
                        </div>
                    </div>
                </div>

                <div class="study-section">
                    <div class="study-section__header">
                        <h2 class="study-section__title">DANGER ZONE</h2>
                    </div>
                    <div class="study-panel">
                        <div class="study-row">
                            <div>
                                <div class="study-row__label">DELETE ALL DATA</div>
                                <div class="study-row__detail">Wipe every session, decree, and reward this account holds. This cannot be undone.</div>
                            </div>
                            <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => Settings.confirmDelete())">DELETE EVERYTHING</button>
                        </div>
                    </div>
                </div>

                <div class="study-section">
                    <div class="study-section__header">
                        <h2 class="study-section__title">CATEGORIES</h2>
                        <button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Settings.addCategory())">CATEGORIZE</button>
                    </div>
                    <p class="rule-board__copy">Assign residents to categories for decrees and the Chronicle breakdown.</p>
                    <div class="category-catalog">
                        ${Object.entries(catGroups).map(([cat, apps]) => {
                            const categoryName = App.escapeHtml(cat);
                            const appList = apps.slice(0, 8).map(app => App.escapeHtml(app)).join(', ');
                            const overflow = apps.length > 8 ? `, +${apps.length - 8} more` : '';
                            return `
                                <div class="category-card">
                                    <div class="category-card__header">
                                        <span class="category-card__name" style="color: ${App.categoryColor(cat)}">${categoryName}</span>
                                        <span class="category-card__count">${apps.length} apps</span>
                                    </div>
                                    <div class="category-card__apps">${appList}${overflow}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="study-section">
                    <div class="study-section__header">
                        <h2 class="study-section__title">SHORTCUTS</h2>
                    </div>
                    <div class="kbd-scroll">
                        <div class="kbd-scroll__row">
                            <span class="kbd-scroll__keys"><span class="kbd-scroll__key">←</span><span class="kbd-scroll__key">→</span></span>
                            <span>Navigate dates</span>
                        </div>
                        <div class="kbd-scroll__row">
                            <span class="kbd-scroll__keys"><span class="kbd-scroll__key">D</span></span>
                            <span>Toggle candlelight</span>
                        </div>
                        <div class="kbd-scroll__row">
                            <span class="kbd-scroll__keys"><span class="kbd-scroll__key">/</span></span>
                            <span>Search residents</span>
                        </div>
                        <div class="kbd-scroll__row">
                            <span class="kbd-scroll__keys"><span class="kbd-scroll__key">1</span>-<span class="kbd-scroll__key">8</span></span>
                            <span>Switch tabs</span>
                        </div>
                        <div class="kbd-scroll__row">
                            <span class="kbd-scroll__keys"><span class="kbd-scroll__key">Esc</span></span>
                            <span>Close modals</span>
                        </div>
                    </div>
                </div>

                <div class="study-section">
                    <div class="study-section__header">
                        <h2 class="study-section__title">ABOUT</h2>
                    </div>
                    <div class="about-study">
                        <div class="about-study__sigil">🏛</div>
                        <div class="about-study__title">DETOX ISLE</div>
                        <div class="about-study__copy">
                            A private screen-time tracker for macOS.<br>
                            Monitor polls every 2 seconds. Data stays on this Mac.
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

    async exportFull() {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const a = document.createElement('a');
        a.href = '/api/export/full';
        a.download = `detox-full-export-${stamp}.json`;
        a.click();
        App.toast('Archive download started', 'success');
    },

    async confirmDelete() {
        App.openModal(`
            <div class="pixel-modal">
                <h2 class="pixel-modal__title">DELETE EVERYTHING?</h2>
                <p class="rule-board__copy">Every session, decree, reward, and inventory item tied to this account will be erased. The Mayor cannot recover them. Type <code>DELETE</code> below to proceed.</p>
                <div class="pixel-modal__group">
                    <label class="pixel-modal__label">CONFIRMATION</label>
                    <input class="pixel-modal__input" type="text" id="deleteConfirm" placeholder="DELETE" autocomplete="off">
                </div>
                <div class="pixel-modal__actions">
                    <button class="pixel-button" onclick="this.closest('.modal-overlay').remove()">CANCEL</button>
                    <button class="pixel-button pixel-button--danger" onclick="App.runAction(() => Settings.runDelete())">DELETE</button>
                </div>
            </div>
        `, '#deleteConfirm');
    },

    async runDelete() {
        const value = document.getElementById('deleteConfirm').value.trim();
        if (value !== 'DELETE') {
            App.toast('Type DELETE exactly to proceed', 'warning');
            return;
        }
        await App.api('/api/data/delete', {
            method: 'POST',
            body: { confirmation: 'DELETE' },
        });
        document.querySelector('.modal-overlay')?.remove();
        App.toast('All data wiped. Reloading.', 'success');
        setTimeout(() => window.location.reload(), 800);
    },

    async toggleGhostMode(enabled) {
        await App.api('/api/settings', {
            method: 'POST',
            body: { ghost_mode: enabled ? '1' : '0' },
        });
        App.toast(enabled ? 'Ghost Mode on — app names hashed before leaving' : 'Ghost Mode off — app names sent in cleartext', 'success');
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
            <div class="pixel-modal">
                <h2 class="pixel-modal__title">CATEGORIZE RESIDENT</h2>
                <div class="pixel-modal__group">
                    <label class="pixel-modal__label">RESIDENT</label>
                    <input class="pixel-modal__input" type="text" id="catAppName" list="categoryAppOptions" placeholder="choose or type an app" value="${App.escapeAttr(prefillAppName)}">
                    ${App.appDatalist('categoryAppOptions', appNames)}
                </div>
                <div class="pixel-modal__group">
                    <label class="pixel-modal__label">CATEGORY</label>
                    <input class="pixel-modal__input" type="text" id="catCategory" list="categoryOptions" value="${App.escapeAttr(selectedCategory)}">
                    ${App.datalist('categoryOptions', categoryOptions)}
                </div>
                <div class="pixel-modal__actions">
                    <button class="pixel-button" onclick="this.closest('.modal-overlay').remove()">CANCEL</button>
                    <button class="pixel-button pixel-button--primary" onclick="App.runAction(() => Settings.saveCategory())">SAVE</button>
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
