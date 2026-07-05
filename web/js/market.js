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
                icon: 'decor',
            },
            outfit: {
                title: 'Villagers',
                detail: 'Simple clothes and details for resident villagers.',
                icon: 'outfit',
            },
            weather: {
                title: 'Weather',
                detail: 'Sky, ocean, light, and atmosphere upgrades.',
                icon: 'weather',
            },
            building: {
                title: 'Buildings',
                detail: 'Roof, facade, and town structure upgrades.',
                icon: 'building',
            },
            map: {
                title: 'Map',
                detail: 'New paths, shore features, and future annex markers.',
                icon: 'map',
            },
        };
        return map[category] || {
            title: category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Other',
            detail: 'Miscellaneous market goods.',
            icon: 'other',
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
                        <div class="market-shelf__glyph" aria-hidden="true">${this.sectionIcon(meta.icon)}</div>
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

    kindForItem(item = {}) {
        const category = String(item.category || 'decor').toLowerCase();
        const key = String(item.key || item.item_key || item.name || category).toLowerCase();
        const rare = item.currency === 'starshard' || key.includes('star') || key.includes('moon') || key.includes('aurora') || key.includes('comet');

        if (category === 'outfit') {
            return 'outfit';
        }

        if (category === 'building') return 'building';
        if (key.includes('fence') || key.includes('dock') || key.includes('pier') || key.includes('bridge') || key.includes('booth') || key.includes('point')) {
            return 'building';
        }
        if (rare) return 'gem';
        if (key.includes('lantern') || key.includes('light') || key.includes('charm') || key.includes('bell') || key.includes('chime') || category === 'weather') {
            return 'weather';
        }
        if (key.includes('fence') || key.includes('dock') || key.includes('pier') || key.includes('bridge') || key.includes('lighthouse') || category === 'building') {
            return 'building';
        }
        if (key.includes('sapling') || key.includes('plant') || key.includes('garden') || key.includes('grove') || key.includes('orchard') || key.includes('flower') || key.includes('herb') || key.includes('tree')) {
            return 'plant';
        }
        if (key.includes('path') || key.includes('lane') || key.includes('loop') || key.includes('meadow') || key.includes('marsh') || key.includes('steps') || key.includes('spring') || category === 'map') {
            return 'map';
        }

        return category || 'reward';
    },

    assetPreview(item = {}) {
        const kind = this.kindForItem(item);
        const category = String(item.category || 'reward').toLowerCase();
        const rare = item.currency === 'starshard';
        const itemKey = String(item.key || item.item_key || item.name || 'reward').toLowerCase();
        const itemName = item.name || category;
        const sceneKey = this.previewSceneKey(itemKey);
        return `
            <div class="market-asset-preview market-asset-preview--${App.escapeAttr(category)} market-asset-preview--kind-${App.escapeAttr(kind)} ${rare ? 'market-asset-preview--rare' : ''}" data-item-key="${App.escapeAttr(itemKey)}" data-preview-scene="${App.escapeAttr(sceneKey)}">
                <div class="market-asset-preview__frame">
                    ${this.vectorPreviewSvg({ ...item, key: item.key || item.item_key || itemName })}
                </div>
                <span class="market-asset-preview__coin">${rare ? '✦' : '☀'}</span>
                <span class="market-asset-preview__category">${App.escapeHtml(category)}</span>
            </div>
        `;
    },

    sectionIcon(icon) {
        return `
            <svg class="market-shelf__icon" viewBox="0 0 64 64" role="presentation" focusable="false">
                ${Px.categoryIcon(icon)}
            </svg>
        `;
    },

    renderStall(item, balance, ownedKeys) {
        const balanceKey = item.currency === 'sunlight' ? 'sunlight' : 'starshards';
        const owned = ownedKeys.has(item.key);
        const insufficient = (balance[balanceKey] || 0) < item.price;
        const disabled = owned || insufficient;
        const status = owned ? 'OWNED' : insufficient ? `NEED ${this.price(item)}` : 'READY';
        const title = owned
            ? 'Already owned'
            : insufficient
                ? `Need ${this.price(item)}`
                : `Buy ${item.name}`;

        return `
            <div class="stall-row ${item.currency === 'starshard' ? 'stall-row--rare' : ''}" data-item-key="${App.escapeAttr(item.key)}" data-currency="${App.escapeAttr(item.currency)}">
                <div class="stall-row__preview" aria-hidden="true">${this.assetPreview(item)}</div>
                <div class="stall-row__content">
                    <div class="stall-row__top">
                        <span class="stall-row__category">${App.escapeHtml(item.category)}</span>
                        <span class="stall-row__price">${this.price(item)}</span>
                    </div>
                    <div class="stall-row__body">
                        <div class="stall-row__name">${App.escapeHtml(item.name)}</div>
                        <div class="stall-row__desc">${App.escapeHtml(item.description)}</div>
                        <div class="stall-row__chips">
                            <span class="stall-row__impact">${App.escapeHtml(this.impactLabel(item))}</span>
                            <span class="stall-row__status">${App.escapeHtml(status)}</span>
                        </div>
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
        return this.assetPreview(item);
    },

    vectorPreviewSvg(item) {
        const category = String(item.category || 'decor').toLowerCase();
        const key = String(item.key || item.item_key || item.name || category);
        const hue = Math.floor(this.hash(key) * 360);
        const accent = `hsl(${hue}, 58%, 55%)`;
        const sceneKey = this.previewSceneKey(key);
        const rare = item.currency === 'starshard';

        // Category-tinted backdrop behind a single crisp pixel glyph.
        const backdrops = {
            decor:    ['#fdf4dc', '#e9efce'],
            outfit:   ['#fdeecb', '#f4d9a8'],
            weather:  rare ? ['#3a3f6b', '#232946'] : ['#c3e6f3', '#e8f7fc'],
            building: ['#f7e8c8', '#e9d2a0'],
            map:      ['#d2eaf3', '#a9d4e5'],
        };
        const [c1, c2] = backdrops[category] || backdrops.decor;
        const gid = `pv-${this.domId(key)}`;

        return `
            <svg class="stall-preview" viewBox="0 0 112 84" role="presentation" data-preview-scene="${App.escapeAttr(sceneKey)}">
                <defs>
                    <linearGradient id="${App.escapeAttr(gid)}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${c1}"/>
                        <stop offset="100%" stop-color="${c2}"/>
                    </linearGradient>
                </defs>
                <rect x="2" y="3" width="108" height="78" fill="url(#${App.escapeAttr(gid)})" stroke="#2b2138" stroke-width="2.5"/>
                <ellipse cx="56" cy="72" rx="30" ry="4.5" fill="rgba(43,33,56,.16)"/>
                ${Px.itemGlyph(key, category, accent, { scale: 6, dx: 56, dy: 71 })}
            </svg>
        `;
    },

    previewSceneKey(key) {
        const scenes = {
            lantern_path: 'decor-lantern-road',
            harbor_lanterns: 'decor-harbor-lanterns',
            market_bunting: 'decor-market-bunting',
            tide_pool_garden: 'decor-tide-pool-garden',
            flower_boxes: 'decor-flower-boxes',
            pebble_mosaics: 'decor-pebble-mosaic',
            fountain_tile: 'decor-fountain-tile',
            picnic_cloth: 'decor-picnic-cloth',
            wind_chimes: 'decor-wind-chimes',
            shell_border: 'decor-shell-border',
            herb_planters: 'decor-herb-planters',
            village_banners: 'decor-village-banners',
            firefly_jars: 'decor-firefly-jars',
            mossy_steps: 'decor-mossy-steps',
            tea_table: 'decor-tea-table',
            orchard_crates: 'decor-orchard-crates',
            birdbath: 'decor-birdbath',
            moon_mirror: 'decor-moon-mirror',
            painted_signposts: 'decor-painted-signposts',
            sun_dial: 'decor-sun-dial',
            mayors_hat: 'outfit-mayor-hat',
            resident_sashes: 'outfit-resident-sashes',
            straw_hats: 'outfit-straw-hats',
            explorer_cloaks: 'outfit-explorer-cloaks',
            work_aprons: 'outfit-work-aprons',
            scholar_specs: 'outfit-scholar-specs',
            rain_capes: 'outfit-rain-capes',
            festival_masks: 'outfit-festival-masks',
            wool_scarves: 'outfit-wool-scarves',
            sailor_caps: 'outfit-sailor-caps',
            gardening_gloves: 'outfit-gardening-gloves',
            messenger_bags: 'outfit-messenger-bags',
            music_vests: 'outfit-music-vests',
            night_hoods: 'outfit-night-hoods',
            brass_badges: 'outfit-brass-badges',
            ribbon_belts: 'outfit-ribbon-belts',
            boot_polish: 'outfit-boot-polish',
            travel_pouches: 'outfit-travel-pouches',
            pocket_watches: 'outfit-pocket-watches',
            star_pins: 'outfit-star-pins',
            sunbeam_charm: 'weather-sunbeam-charm',
            cloud_kite: 'weather-cloud-kite',
            rain_bell: 'weather-rain-bell',
            breeze_streamers: 'weather-breeze-streamers',
            rainbow_prism: 'weather-rainbow-prism',
            fog_lantern: 'weather-fog-lantern',
            storm_drums: 'weather-storm-drums',
            dew_collectors: 'weather-dew-collectors',
            aurora_glass: 'weather-aurora-glass',
            tide_whistle: 'weather-tide-whistle',
            noon_chimes: 'weather-noon-chimes',
            dusk_filter: 'weather-dusk-filter',
            cloud_seeds: 'weather-cloud-seeds',
            wind_sock: 'weather-wind-sock',
            thunder_jars: 'weather-thunder-jars',
            mist_fountain: 'weather-mist-fountain',
            comet_lens: 'weather-comet-lens',
            moonbeam_charm: 'weather-moonbeam-charm',
            weather_vane: 'weather-vane',
            sun_sail: 'weather-sun-sail',
            lighthouse_skin: 'building-lighthouse-skin',
            observatory_roof: 'building-observatory-roof',
            market_roof_tiles: 'building-market-roof-tiles',
            ruleboard_roof_cap: 'building-ruleboard-roof-cap',
            registry_archives: 'building-registry-archives',
            townhall_bell: 'building-townhall-bell',
            study_lamplight: 'building-study-lamplight',
            postcard_awning: 'building-postcard-awning',
            charter_pillars: 'building-charter-pillars',
            chronicle_stacks: 'building-chronicle-stacks',
            bakery_facade: 'building-bakery-facade',
            bathhouse_tiles: 'building-bathhouse-tiles',
            greenhouse_frame: 'building-greenhouse-frame',
            workshop_chimney: 'building-workshop-chimney',
            inn_windowboxes: 'building-inn-windowboxes',
            schoolhouse_clock: 'building-schoolhouse-clock',
            dockmaster_booth: 'building-dockmaster-booth',
            library_balcony: 'building-library-balcony',
            tea_shop_shutters: 'building-tea-shop-shutters',
            apothecary_shelves: 'building-apothecary-shelves',
            cove_expansion: 'map-cove-expansion',
            north_isle_bridge: 'map-north-bridge',
            south_dock: 'map-south-dock',
            west_grove_path: 'map-west-grove-path',
            east_overlook: 'map-east-overlook',
            orchard_corner: 'map-orchard-corner',
            hidden_spring: 'map-hidden-spring',
            shell_beach: 'map-shell-beach',
            watchtower_hill: 'map-watchtower-hill',
            ferry_marker: 'map-ferry-marker',
            tidal_steps: 'map-tidal-steps',
            cave_gate: 'map-cave-gate',
            marsh_walkway: 'map-marsh-walkway',
            lighthouse_point: 'map-lighthouse-point',
            meadow_loop: 'map-meadow-loop',
            quarry_nook: 'map-quarry-nook',
            garden_lane: 'map-garden-lane',
            stargaze_plateau: 'map-stargaze-plateau',
            fishing_pier: 'map-fishing-pier',
            reef_marker: 'map-reef-marker',
        };
        return scenes[String(key || '').toLowerCase()] || 'generic';
    },

    impactLabel(item) {
        const category = String(item.category || '').toLowerCase();
        const map = {
            decor: 'VISIBLE ISLE DECOR',
            outfit: 'VILLAGER STYLE',
            weather: 'ATMOSPHERE UPGRADE',
            building: 'BUILDING UPGRADE',
            map: 'ISLE EXPANSION',
        };
        return map[category] || 'ISLE REWARD';
    },

    renderInventoryItem(item) {
        const fullRefund = item.refund_pct === 100;
        const title = `Refund: ${this.currency(item.refund_amount, item.currency)} ${fullRefund ? '(within 24h)' : '(50%)'}`;
        const purchaseId = item.inventory_id ?? item.spend_id;
        const purchasedAt = item.purchased_at ?? item.acquired_at;
        return `
            <div class="inventory-row pixel-panel">
                <div class="inventory-row__preview" aria-hidden="true">${this.assetPreview(item)}</div>
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

window.Market = Market;
