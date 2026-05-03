/* ── The Market ─────────────────────────────────────────────────────── */

const Market = {
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
                    <div class="stall-grid">
                        ${catalog.map(item => this.renderStall(item, balance, ownedKeys)).join('')}
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
            <div class="stall-row pixel-panel" data-item-key="${App.escapeAttr(item.key)}" data-currency="${App.escapeAttr(item.currency)}">
                <div class="stall-row__category">${App.escapeHtml(item.category)}</div>
                <div class="stall-row__body">
                    <div class="stall-row__name">${App.escapeHtml(item.name)}</div>
                    <div class="stall-row__desc">${App.escapeHtml(item.description)}</div>
                </div>
                <div class="stall-row__price">${this.price(item)}</div>
                <button class="pixel-button pixel-button--primary"
                    ${disabled ? 'disabled' : ''}
                    title="${App.escapeAttr(title)}"
                    onclick="Market.buy(${App.inlineArg(item.key)})">
                    ${owned ? 'OWNED' : 'BUY'}
                </button>
            </div>
        `;
    },

    renderInventoryItem(item) {
        const fullRefund = item.refund_pct === 100;
        const title = `Refund: ${this.currency(item.refund_amount, item.currency)} ${fullRefund ? '(within 24h)' : '(50%)'}`;
        return `
            <div class="inventory-row pixel-panel">
                <div>
                    <div class="inventory-row__name">${App.escapeHtml(item.name)}</div>
                    <div class="inventory-row__meta">Purchased ${this.formatDateTime(item.purchased_at)}</div>
                </div>
                <div class="inventory-row__refund" title="${App.escapeAttr(title)}">
                    ${this.currency(item.refund_amount, item.currency)}
                    <span>${fullRefund ? 'within 24h' : '50%'}</span>
                </div>
                <button class="pixel-button" onclick="Market.refund(${Number(item.spend_id)})" title="${App.escapeAttr(title)}">REFUND</button>
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

    async refund(spendId) {
        try {
            const result = await App.api('/api/market/refund', {
                method: 'POST',
                body: { spend_id: spendId },
            });
            App.toast(`Refunded ${this.currency(result.refunded, result.currency)}`, 'success');
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
            already_refunded: 'That item has already been refunded.',
        };
        return messages[code] || code || 'Market action failed.';
    },

    price(item) {
        return this.currency(item.price, item.currency);
    },

    currency(amount, currency) {
        const glyph = currency === 'starshard' ? '✦' : '☀';
        return `${amount} ${glyph}`;
    },

    formatDateTime(timestamp) {
        const date = new Date(Number(timestamp) * 1000);
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
