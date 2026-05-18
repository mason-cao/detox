/* ── The Market ─────────────────────────────────────────────────────── */

const Market = {
    COLLAPSE_KEY: 'detox.market.collapsedSections',

    async render(container) {
        destroyCharts();
        const [balance, catalog, inventory, awards] = await Promise.all([
            App.api('/api/rewards/balance'),
            App.api('/api/market/catalog'),
            App.api('/api/market/inventory'),
            App.api('/api/rewards/awards'),
        ]);

        const ownedKeys = new Set(inventory.map(item => item.item_key));

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-bar">
                    ${App.backToIsleButton()}
                    <h1 class="page-heading">The Market</h1>
                </div>
                ${this.renderBalance(balance)}
                <div class="market-section">
                    <div class="charter-section__header">
                        <h2 class="charter-section__title">STALLS</h2>
                    </div>
                    <div class="market-shelves">
                        ${this.renderCatalogSections(catalog, balance, ownedKeys)}
                    </div>
                </div>
                <div class="market-section">
                    <div class="charter-section__header">
                        <h2 class="charter-section__title">INVENTORY</h2>
                    </div>
                    ${inventory.length > 0 ? `
                        <div class="market-list">
                            ${inventory.map(item => this.renderInventoryItem(item)).join('')}
                        </div>
                    ` : `
                        <div class="market-empty">No purchases yet. Spend Sunlight in the Stalls above.</div>
                    `}
                </div>
                <div class="market-section">
                    <div class="charter-section__header">
                        <h2 class="charter-section__title">HALL OF HONOR</h2>
                    </div>
                    ${this.renderHonor(awards)}
                </div>
            </div>
        `;
    },

    sectionMeta(category) {
        const map = {
            decor: {
                title: 'Decor',
                detail: 'Paths, lights, shore pieces, and village dressing.',
                glyph: '✦',
            },
            outfit: {
                title: 'Villagers',
                detail: 'Simple clothes and details for resident villagers.',
                glyph: '♙',
            },
            weather: {
                title: 'Weather',
                detail: 'Sky, ocean, light, and atmosphere upgrades.',
                glyph: '☼',
            },
            building: {
                title: 'Buildings',
                detail: 'Roof, facade, and town structure upgrades.',
                glyph: '⌂',
            },
            map: {
                title: 'Map',
                detail: 'New paths, shore features, and future annex markers.',
                glyph: '◇',
            },
        };
        return map[category] || {
            title: category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Other',
            detail: 'Miscellaneous market goods.',
            glyph: '•',
        };
    },

    renderCatalogSections(catalog, balance, ownedKeys) {
        const order = ['decor', 'outfit', 'weather', 'building', 'map'];
        const groups = new Map();
        catalog.forEach(item => {
            const key = item.category || 'other';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });

        const sortedKeys = [
            ...order.filter(key => groups.has(key)),
            ...[...groups.keys()].filter(key => !order.includes(key)).sort(),
        ];
        const collapsed = this.collapsedSections(sortedKeys);

        return sortedKeys.map(category => {
            const items = groups.get(category) || [];
            const meta = this.sectionMeta(category);
            const panelId = `market-section-${this.domId(category)}`;
            const isCollapsed = collapsed.has(category);
            return `
                <section class="market-shelf ${isCollapsed ? 'is-collapsed' : ''}" data-category="${App.escapeAttr(category)}">
                    <button class="market-shelf__header" type="button"
                        aria-expanded="${isCollapsed ? 'false' : 'true'}"
                        aria-controls="${App.escapeAttr(panelId)}"
                        onclick="Market.toggleSection(${App.inlineArg(category)})">
                        <div class="market-shelf__glyph" aria-hidden="true">${App.escapeHtml(meta.glyph)}</div>
                        <div>
                            <h3>${App.escapeHtml(meta.title)}</h3>
                            <p>${App.escapeHtml(meta.detail)}</p>
                        </div>
                        <span class="market-shelf__count">${items.length} items</span>
                        <span class="market-shelf__chevron" aria-hidden="true">⌄</span>
                    </button>
                    <div class="stall-grid" id="${App.escapeAttr(panelId)}" ${isCollapsed ? 'hidden' : ''}>
                        ${items.map(item => this.renderStall(item, balance, ownedKeys)).join('')}
                    </div>
                </section>
            `;
        }).join('');
    },

    collapsedSections(categories) {
        const saved = this.readCollapsedSections();
        if (saved) return saved;
        return new Set(categories.filter((category, index) => index > 0 && category !== 'decor'));
    },

    readCollapsedSections() {
        try {
            const raw = localStorage.getItem(this.COLLAPSE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? new Set(parsed) : null;
        } catch (_) {
            return null;
        }
    },

    persistCollapsedSections(collapsed) {
        try {
            localStorage.setItem(this.COLLAPSE_KEY, JSON.stringify([...collapsed]));
        } catch (_) { /* localStorage unavailable */ }
    },

    toggleSection(category) {
        const shelves = [...document.querySelectorAll('.market-shelf[data-category]')];
        const categories = shelves.map(node => node.dataset.category).filter(Boolean);
        const collapsed = this.collapsedSections(categories);
        const shelf = shelves.find(node => node.dataset.category === category);
        const currentlyCollapsed = shelf?.classList.contains('is-collapsed');

        if (currentlyCollapsed) collapsed.delete(category);
        else collapsed.add(category);

        this.persistCollapsedSections(collapsed);
        if (!shelf) return;

        const isCollapsed = collapsed.has(category);
        const panel = shelf.querySelector('.stall-grid');
        const button = shelf.querySelector('.market-shelf__header');
        shelf.classList.toggle('is-collapsed', isCollapsed);
        if (panel) panel.hidden = isCollapsed;
        if (button) button.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    },

    renderBalance(balance) {
        return `
            <div class="market-balance pixel-panel">
                <div class="market-balance__item">
                    <span class="market-balance__glyph">☀</span>
                    <span class="market-balance__value">${balance.sunlight_today || 0} / ${balance.sunlight_cap || 120}</span>
                    <span class="market-balance__label">today (${balance.sunlight || 0} lifetime)</span>
                </div>
                <div class="market-balance__item">
                    <span class="market-balance__glyph market-balance__glyph--shard">✦</span>
                    <span class="market-balance__value">${balance.starshards || 0}</span>
                    <span class="market-balance__label">starshards</span>
                </div>
                <div class="market-balance__pledge">No real money. Every item has a fixed price and a refund window.</div>
            </div>
        `;
    },

    renderStall(item, balance, ownedKeys) {
        const balanceKey = item.currency === 'sunlight' ? 'sunlight' : 'starshards';
        const owned = ownedKeys.has(item.key);
        const insufficient = (balance[balanceKey] || 0) < item.price;
        const disabled = owned || insufficient;
        const title = owned
            ? 'Already owned'
            : insufficient
                ? `Need ${this.price(item)}`
                : `Buy ${item.name}`;

        return `
            <div class="stall-row" data-item-key="${App.escapeAttr(item.key)}" data-currency="${App.escapeAttr(item.currency)}">
                <div class="stall-row__preview" aria-hidden="true">${this.previewSvg(item)}</div>
                <div class="stall-row__content">
                    <div class="stall-row__top">
                        <span class="stall-row__category">${App.escapeHtml(item.category)}</span>
                        <span class="stall-row__price">${this.price(item)}</span>
                    </div>
                    <div class="stall-row__body">
                        <div class="stall-row__name">${App.escapeHtml(item.name)}</div>
                        <div class="stall-row__desc">${App.escapeHtml(item.description)}</div>
                    </div>
                </div>
                <button class="pixel-button pixel-button--primary"
                    ${disabled ? 'disabled' : ''}
                    title="${App.escapeAttr(title)}"
                    onclick="Market.buy(${App.inlineArg(item.key)})">
                    ${owned ? 'OWNED' : 'BUY'}
                </button>
            </div>
        `;
    },

    previewSvg(item) {
        const category = String(item.category || 'decor').toLowerCase();
        const key = String(item.key || item.item_key || item.name || category);
        const hue = Math.floor(this.hash(key) * 360);
        const accent = `hsl(${hue}, 54%, 62%)`;
        const ink = '#2a1e2a';
        const sand = '#f6d39b';
        const parchment = '#fff4d6';
        const moss = '#6b8e4e';

        if (category === 'outfit') {
            return `
                <svg class="stall-preview" viewBox="0 0 64 54" role="presentation">
                    <ellipse cx="32" cy="45" rx="22" ry="6" fill="rgba(42,30,42,.22)"/>
                    <path d="M23 28 Q32 20 41 28 L38 44 H26 Z" fill="${accent}" stroke="${ink}" stroke-width="2"/>
                    <circle cx="32" cy="19" r="8" fill="#d8a56e" stroke="${ink}" stroke-width="2"/>
                    <path d="M18 17 Q32 4 46 17 Z" fill="#d6bd72" stroke="${ink}" stroke-width="2"/>
                    <path d="M17 18 H47" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
                </svg>
            `;
        }
        if (category === 'weather') {
            return `
                <svg class="stall-preview" viewBox="0 0 64 54" role="presentation">
                    <rect x="4" y="7" width="56" height="40" fill="#7fc8df" stroke="${ink}" stroke-width="2"/>
                    <circle cx="19" cy="20" r="9" fill="#ffd04a" stroke="${ink}" stroke-width="2"/>
                    <path d="M24 32 C31 24 43 25 48 33 C53 33 57 36 57 41 H18 C18 35 20 32 24 32 Z" fill="${parchment}" stroke="${ink}" stroke-width="2"/>
                    <path d="M7 43 C17 39 27 47 37 43 S54 41 60 44" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
                </svg>
            `;
        }
        if (category === 'building') {
            return `
                <svg class="stall-preview" viewBox="0 0 64 54" role="presentation">
                    <ellipse cx="32" cy="45" rx="24" ry="6" fill="rgba(42,30,42,.22)"/>
                    <rect x="18" y="22" width="28" height="21" fill="${sand}" stroke="${ink}" stroke-width="2"/>
                    <polygon points="14,23 50,23 32,8" fill="${accent}" stroke="${ink}" stroke-width="2"/>
                    <rect x="28" y="31" width="8" height="12" fill="${ink}"/>
                    <rect x="21" y="28" width="6" height="6" fill="${parchment}" stroke="${ink}" stroke-width="1.4"/>
                    <rect x="37" y="28" width="6" height="6" fill="${parchment}" stroke="${ink}" stroke-width="1.4"/>
                </svg>
            `;
        }
        if (category === 'map') {
            return `
                <svg class="stall-preview" viewBox="0 0 64 54" role="presentation">
                    <path d="M8 36 C13 18 32 10 49 20 C59 27 53 41 36 45 C21 49 4 43 8 36 Z" fill="${sand}" stroke="${ink}" stroke-width="2"/>
                    <path d="M22 33 L33 21 L45 32 L34 41 Z" fill="${moss}" stroke="${ink}" stroke-width="1.6"/>
                    <path d="M17 37 C26 31 35 36 47 31" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="48" cy="14" r="7" fill="${parchment}" stroke="${ink}" stroke-width="1.6"/>
                    <path d="M48 9 L51 14 L48 19 L45 14 Z" fill="#ffd04a" stroke="${ink}" stroke-width="1"/>
                </svg>
            `;
        }
        return `
            <svg class="stall-preview" viewBox="0 0 64 54" role="presentation">
                <ellipse cx="32" cy="45" rx="24" ry="6" fill="rgba(42,30,42,.22)"/>
                <path d="M12 36 C16 21 32 15 48 24 C55 29 50 40 35 43 C22 46 8 42 12 36 Z" fill="${moss}" stroke="${ink}" stroke-width="2"/>
                <path d="M18 38 C27 31 38 34 47 28" fill="none" stroke="${sand}" stroke-width="4" stroke-linecap="round"/>
                <circle cx="24" cy="28" r="4" fill="${accent}" stroke="${ink}" stroke-width="1.4"/>
                <path d="M44 23 V13 M39 17 H49" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
                <circle cx="44" cy="12" r="3" fill="#ffd04a" stroke="${ink}" stroke-width="1.2"/>
            </svg>
        `;
    },

    renderInventoryItem(item) {
        const fullRefund = item.refund_pct === 100;
        const title = `Refund: ${this.currency(item.refund_amount, item.currency)} ${fullRefund ? '(within 24h)' : '(50%)'}`;
        const purchaseId = item.inventory_id ?? item.spend_id;
        const purchasedAt = item.purchased_at ?? item.acquired_at;
        return `
            <div class="inventory-row pixel-panel">
                <div class="inventory-row__preview" aria-hidden="true">${this.previewSvg(item)}</div>
                <div>
                    <div class="inventory-row__name">${App.escapeHtml(item.name)}</div>
                    <div class="inventory-row__meta">Purchased ${this.formatDateTime(purchasedAt)}</div>
                </div>
                <div class="inventory-row__refund" title="${App.escapeAttr(title)}">
                    ${this.currency(item.refund_amount, item.currency)}
                    <span>${fullRefund ? 'within 24h' : '50%'}</span>
                </div>
                <button class="pixel-button" onclick="Market.refund(${App.inlineArg(purchaseId)})" title="${App.escapeAttr(title)}" ${purchaseId ? '' : 'disabled'}>REFUND</button>
            </div>
        `;
    },

    renderHonor(awards) {
        if (!awards.length) {
            return `<div class="market-empty">No milestones yet. Stay under your daily goal to begin a streak.</div>`;
        }

        const groups = new Map();
        awards.forEach(award => {
            const key = this.monthTitle(award.awarded_for_date);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(award);
        });

        return [...groups.entries()].map(([month, rows]) => `
            <div class="honor-month-group">
                <h3>${App.escapeHtml(month)}</h3>
                <div class="market-list">
                    ${rows.map(award => this.renderAward(award)).join('')}
                </div>
            </div>
        `).join('');
    },

    renderAward(award) {
        return `
            <div class="honor-row pixel-panel">
                <div>
                    <div class="honor-row__kind">${App.escapeHtml(this.awardKind(award.kind))}</div>
                    <div class="honor-row__detail">${App.escapeHtml(this.awardDetail(award.detail))}</div>
                </div>
                <div class="honor-row__date">${App.formatDate(award.awarded_for_date)}</div>
                <div class="honor-row__amount">${this.currency(award.amount, award.currency)}</div>
            </div>
        `;
    },

    async buy(itemKey) {
        const card = document.querySelector(`.stall-row[data-item-key="${CSS.escape(itemKey)}"]`);
        try {
            await App.api('/api/market/buy', {
                method: 'POST',
                body: { item_key: itemKey },
            });
            const currency = card?.dataset.currency || 'sunlight';
            const hudId = currency === 'starshard' ? 'hudShards' : 'hudSunlight';
            const hud = document.getElementById(hudId);
            if (card && hud) Effects.currencyFloat(card, hud);
            App.toast('Market purchase added to inventory', 'success');
            await this.refresh();
        } catch (e) {
            App.toast(this.errorMessage(e.message), 'error');
        }
    },

    async refund(purchaseId) {
        try {
            const id = String(purchaseId ?? '').trim();
            const numericId = Number(id);
            const body = Number.isInteger(numericId) && String(numericId) === id
                ? { spend_id: numericId }
                : { inventory_id: id };
            const result = await App.api('/api/market/refund', {
                method: 'POST',
                body,
            });
            if (result.refunded !== undefined && result.currency) {
                App.toast(`Refunded ${this.currency(result.refunded, result.currency)}`, 'success');
            } else {
                App.toast('Refund processed', 'success');
            }
            await this.refresh();
        } catch (e) {
            App.toast(this.errorMessage(e.message), 'error');
        }
    },

    async refresh() {
        await this.render(document.getElementById('content'));
        if (window.HUD) HUD.refresh();
    },

    errorMessage(code) {
        const messages = {
            unknown_item: 'That market item is no longer available.',
            insufficient_funds: 'Not enough currency for that purchase.',
            already_owned: 'That item is already in your inventory.',
            unknown_spend: 'That inventory item could not be found.',
            unknown_inventory: 'That inventory item could not be found.',
            already_refunded: 'That item has already been refunded.',
        };
        return messages[code] || code || 'Market action failed.';
    },

    price(item) {
        return this.currency(item.price, item.currency);
    },

    hash(value) {
        let h = 2166136261;
        const str = String(value || '');
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0) / 4294967295;
    },

    domId(value) {
        return String(value || 'other').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    },

    currency(amount, currency) {
        const glyph = currency === 'starshard' ? '✦' : '☀';
        return `${amount} ${glyph}`;
    },

    formatDateTime(timestamp) {
        const value = String(timestamp ?? '').trim();
        const isNumeric = value !== '' && !Number.isNaN(Number(value));
        const date = isNumeric ? new Date(Number(value) * 1000) : new Date(value);
        if (Number.isNaN(date.getTime())) return 'unknown date';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    monthTitle(dateStr) {
        const date = new Date(`${dateStr}T12:00:00`);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    },

    awardKind(kind) {
        const labels = {
            streak_day: 'STREAK DAY',
            clean_week: 'CLEAN WEEK',
            milestone: 'MILESTONE',
        };
        return labels[kind] || kind;
    },

    awardDetail(detail) {
        const labels = {
            first_7_streak: 'First 7-day streak',
            first_14_streak: 'First 14-day streak',
            first_30_streak: 'First 30-day streak',
            first_clean_month: 'First clean month',
        };
        return labels[detail] || detail;
    },
};
