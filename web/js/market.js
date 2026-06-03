/* ── The Market ─────────────────────────────────────────────────────── */

const Market = {
    COLLAPSE_KEY: 'detox.market.collapsedSections',
    ASSET_BASE: '/assets/market/pixel',

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

    assetForItem(item = {}) {
        const category = String(item.category || 'decor').toLowerCase();
        const key = String(item.key || item.item_key || item.name || category).toLowerCase();
        const rare = item.currency === 'starshard' || key.includes('star') || key.includes('moon') || key.includes('aurora') || key.includes('comet');
        const asset = path => `${this.ASSET_BASE}/${path}`;
        const itemSprite = () => asset('items.png');
        const bazaarSprite = () => asset('bazaar.png');
        const characterSheet = () => asset('characters.png');
        const residentSprite = role => `/assets/sprites/residents/${role}.png`;

        if (category === 'outfit') {
            const roles = {
                mayors_hat: 'sheriff',
                resident_sashes: 'scribe',
                straw_hats: 'farmer',
                explorer_cloaks: 'wanderer',
                work_aprons: 'builder',
                scholar_specs: 'scribe',
                rain_capes: 'wanderer',
                festival_masks: 'jester',
                wool_scarves: 'musician',
                sailor_caps: 'musician',
                gardening_gloves: 'farmer',
                messenger_bags: 'scribe',
                music_vests: 'musician',
                night_hoods: 'wanderer',
                brass_badges: 'sheriff',
                ribbon_belts: 'jester',
                boot_polish: 'builder',
                travel_pouches: 'wanderer',
                pocket_watches: 'scribe',
                star_pins: 'sheriff',
            };
            return { src: residentSprite(roles[key] || 'wanderer'), kind: 'outfit' };
        }

        if (category === 'building') return { src: bazaarSprite(), kind: 'building' };
        if (key.includes('fence') || key.includes('dock') || key.includes('pier') || key.includes('bridge') || key.includes('booth') || key.includes('point')) {
            return { src: itemSprite(), kind: 'building' };
        }
        if (rare) return { src: itemSprite(), kind: 'gem' };
        if (key.includes('lantern') || key.includes('light') || key.includes('charm') || key.includes('bell') || key.includes('chime') || category === 'weather') {
            return { src: itemSprite(), kind: 'weather' };
        }
        if (key.includes('fence') || key.includes('dock') || key.includes('pier') || key.includes('bridge') || key.includes('lighthouse') || category === 'building') {
            return { src: itemSprite(), kind: 'building' };
        }
        if (key.includes('sapling') || key.includes('plant') || key.includes('garden') || key.includes('grove') || key.includes('orchard') || key.includes('flower') || key.includes('herb') || key.includes('tree')) {
            return { src: itemSprite(), kind: 'plant' };
        }
        if (key.includes('path') || key.includes('lane') || key.includes('loop') || key.includes('meadow') || key.includes('marsh') || key.includes('steps') || key.includes('spring') || category === 'map') {
            return { src: itemSprite(), kind: 'map' };
        }

        const byCategory = {
            decor: itemSprite(),
            weather: itemSprite(),
            building: bazaarSprite(),
            map: itemSprite(),
            outfit: characterSheet(),
        };
        return { src: byCategory[category] || itemSprite(), kind: category };
    },

    assetPreview(item = {}) {
        const asset = this.assetForItem(item);
        const category = String(item.category || 'reward').toLowerCase();
        const rare = item.currency === 'starshard';
        const itemKey = String(item.key || item.item_key || item.name || 'reward').toLowerCase();
        const itemName = item.name || category;
        return `
            <div class="market-asset-preview market-asset-preview--${App.escapeAttr(category)} market-asset-preview--kind-${App.escapeAttr(asset.kind)} ${rare ? 'market-asset-preview--rare' : ''}" data-item-key="${App.escapeAttr(itemKey)}">
                <div class="market-asset-preview__frame">
                    ${this.vectorPreviewSvg({ ...item, key: item.key || item.item_key || itemName })}
                </div>
                <span class="market-asset-preview__coin">${rare ? '✦' : '☀'}</span>
                <span class="market-asset-preview__category">${App.escapeHtml(category)}</span>
            </div>
        `;
    },

    sectionIcon(icon) {
        const assets = {
            decor: `${this.ASSET_BASE}/items.png`,
            outfit: '/assets/sprites/residents/sheriff.png',
            weather: `${this.ASSET_BASE}/items.png`,
            building: `${this.ASSET_BASE}/bazaar.png`,
            map: `${this.ASSET_BASE}/items.png`,
            other: `${this.ASSET_BASE}/items.png`,
        };
        return `<img src="${App.escapeAttr(assets[icon] || assets.other)}" alt="" loading="lazy">`;
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
        const accent = `hsl(${hue}, 54%, 62%)`;
        const palette = this.previewPalette();

        const scene = this.previewScene(category, key, accent, palette);
        return `
            <svg class="stall-preview" viewBox="0 0 112 84" role="presentation">
                <rect x="4" y="5" width="104" height="74" fill="${palette.parchment}" stroke="${palette.ink}" stroke-width="2.5"/>
                <path d="M10 13 H102 M10 72 H102" stroke="${palette.sand}" stroke-width="3" opacity=".65"/>
                <path d="M4 5 H18 V10 H9 V20 H4 Z M108 5 H94 V10 H103 V20 H108 Z M4 79 H18 V74 H9 V64 H4 Z M108 79 H94 V74 H103 V64 H108 Z" fill="${item.currency === 'starshard' ? palette.shard : palette.coin}" stroke="${palette.ink}" stroke-width="1.4"/>
                <path d="M14 58 C32 48 42 68 59 56 S87 50 102 62" fill="none" stroke="${palette.sea}" stroke-width="3.4" stroke-linecap="round" opacity="0.72"/>
                <ellipse cx="56" cy="69" rx="36" ry="6" fill="rgba(42,30,42,.18)"/>
                <g transform="translate(8 6)">${scene}</g>
                <g class="stall-preview__badge" transform="translate(82 9)">
                    <rect x="0" y="0" width="20" height="14" fill="${item.currency === 'starshard' ? palette.shard : palette.coin}" stroke="${palette.ink}" stroke-width="1.4"/>
                    <path d="${item.currency === 'starshard' ? 'M10 2 L13 7 L10 12 L7 7 Z' : 'M10 3 A4 4 0 1 1 9.9 3'}" fill="${palette.parchment}" stroke="${palette.ink}" stroke-width="1"/>
                </g>
            </svg>
        `;
    },

    previewPalette() {
        return {
            ink: '#2a1e2a',
            sand: '#f6d39b',
            parchment: '#fff4d6',
            moss: '#6b8e4e',
            mossDark: '#4a6b3a',
            sea: '#3f8fba',
            coin: '#ffd04a',
            coral: '#c4453a',
            wood: '#7b5635',
            night: '#2a3050',
            shard: '#b59cff',
        };
    },

    previewScene(category, key, accent, p) {
        const normalizedCategory = String(category || '').toLowerCase();
        const normalizedKey = String(key || '').toLowerCase();
        if (normalizedCategory === 'decor') return this.decorPreview(normalizedKey, accent, p);
        if (normalizedCategory === 'outfit') return this.outfitPreview(normalizedKey, accent, p);
        if (normalizedCategory === 'weather') return this.weatherPreview(normalizedKey, accent, p);
        if (normalizedCategory === 'building') return this.buildingPreview(normalizedKey, accent, p);
        if (normalizedCategory === 'map') return this.mapPreview(normalizedKey, accent, p);
        return this.decorPreview(normalizedKey, accent, p);
    },

    decorPreview(key, accent, p) {
        const base = `<path d="M18 48 C24 29 48 21 70 33 C82 40 75 54 54 57 C34 60 14 55 18 48 Z" fill="${p.moss}" stroke="${p.ink}" stroke-width="2"/>`;
        if (key.includes('lantern')) return `${base}<path d="M36 48 V25 M60 49 V22" stroke="${p.ink}" stroke-width="2"/><path d="M29 25 H43 L40 38 H32 Z M53 22 H67 L64 36 H56 Z" fill="${p.coin}" stroke="${p.ink}" stroke-width="2"/><circle cx="36" cy="33" r="8" fill="${p.coin}" opacity=".35"/><circle cx="60" cy="31" r="8" fill="${p.coin}" opacity=".35"/>`;
        if (key.includes('bunting') || key.includes('banner')) return `${base}<path d="M23 25 C36 18 56 18 73 25" fill="none" stroke="${p.ink}" stroke-width="2"/><path d="M28 26 L34 37 L40 26 M45 24 L51 36 L57 24 M62 25 L68 36 L74 25" fill="${accent}" stroke="${p.ink}" stroke-width="1.5"/>`;
        if (key.includes('pool') || key.includes('mirror')) return `${base}<ellipse cx="50" cy="42" rx="20" ry="9" fill="${key.includes('moon') ? p.night : p.sea}" stroke="${p.ink}" stroke-width="2"/><path d="M36 41 C43 36 56 36 64 42" fill="none" stroke="${p.parchment}" stroke-width="2" opacity=".8"/><circle cx="58" cy="34" r="4" fill="${key.includes('moon') ? p.shard : p.coin}"/>`;
        if (key.includes('flower') || key.includes('herb')) return `${base}<g fill="${accent}" stroke="${p.ink}" stroke-width="1.2"><circle cx="35" cy="38" r="4"/><circle cx="50" cy="34" r="4"/><circle cx="63" cy="41" r="4"/></g><path d="M35 50 V39 M50 50 V35 M63 51 V42" stroke="${p.mossDark}" stroke-width="2"/><rect x="26" y="49" width="45" height="8" fill="${p.wood}" stroke="${p.ink}" stroke-width="2"/>`;
        if (key.includes('pebble') || key.includes('shell')) return `${base}<g stroke="${p.ink}" stroke-width="1.2"><ellipse cx="32" cy="45" rx="7" ry="4" fill="${p.sand}"/><ellipse cx="47" cy="39" rx="6" ry="3.5" fill="${accent}"/><ellipse cx="63" cy="46" rx="8" ry="4" fill="${p.parchment}"/></g><path d="M24 52 C38 44 58 53 74 44" fill="none" stroke="${p.sand}" stroke-width="3"/>`;
        if (key.includes('fountain') || key.includes('birdbath')) return `${base}<rect x="37" y="44" width="24" height="10" fill="${p.sand}" stroke="${p.ink}" stroke-width="2"/><ellipse cx="49" cy="42" rx="18" ry="7" fill="${p.sea}" stroke="${p.ink}" stroke-width="2"/><path d="M49 35 C42 28 56 28 49 20" fill="none" stroke="${p.sea}" stroke-width="3" stroke-linecap="round"/><circle cx="49" cy="20" r="3" fill="${accent}"/>`;
        if (key.includes('cloth') || key.includes('tea')) return `${base}<path d="M30 40 L57 30 L75 42 L47 53 Z" fill="${key.includes('tea') ? p.sand : accent}" stroke="${p.ink}" stroke-width="2"/><path d="M39 38 L57 48 M50 33 L67 45" stroke="${p.parchment}" stroke-width="2"/><circle cx="57" cy="38" r="4" fill="${p.parchment}" stroke="${p.ink}" stroke-width="1.4"/>`;
        if (key.includes('chime')) return `${base}<path d="M48 18 V50 M35 25 H61" stroke="${p.ink}" stroke-width="2"/><g fill="${accent}" stroke="${p.ink}" stroke-width="1.4"><rect x="34" y="28" width="6" height="18"/><rect x="46" y="25" width="6" height="22"/><rect x="58" y="29" width="6" height="17"/></g>`;
        if (key.includes('steps')) return `${base}<g fill="${p.sand}" stroke="${p.ink}" stroke-width="1.5"><path d="M27 50 L39 44 L53 50 L40 57 Z"/><path d="M38 42 L50 36 L64 42 L51 49 Z"/><path d="M49 34 L61 28 L75 34 L62 41 Z"/></g>`;
        if (key.includes('crate')) return `${base}<g fill="${p.wood}" stroke="${p.ink}" stroke-width="1.5"><rect x="30" y="42" width="18" height="13"/><rect x="50" y="36" width="18" height="13"/></g><circle cx="39" cy="38" r="4" fill="${accent}" stroke="${p.ink}"/><circle cx="59" cy="33" r="4" fill="${p.coin}" stroke="${p.ink}"/>`;
        if (key.includes('sign')) return `${base}<path d="M34 52 V31 M62 52 V28" stroke="${p.ink}" stroke-width="2"/><g fill="${accent}" stroke="${p.ink}" stroke-width="1.5"><path d="M25 30 H51 L56 36 L51 42 H25 Z"/><path d="M48 25 H76 L81 31 L76 37 H48 Z"/></g>`;
        if (key.includes('dial')) return `${base}<circle cx="49" cy="39" r="17" fill="${p.coin}" stroke="${p.ink}" stroke-width="2"/><path d="M49 39 L58 27 L54 42 Z" fill="${p.ink}"/><path d="M34 39 H64 M49 24 V54" stroke="${p.ink}" stroke-width="1.2"/>`;
        return `${base}<path d="M28 43 C38 34 56 37 70 30" fill="none" stroke="${p.sand}" stroke-width="4" stroke-linecap="round"/><circle cx="33" cy="37" r="5" fill="${accent}" stroke="${p.ink}" stroke-width="1.5"/><path d="M66 32 V20 M59 25 H73" stroke="${p.ink}" stroke-width="2"/><circle cx="66" cy="18" r="4" fill="${p.coin}" stroke="${p.ink}" stroke-width="1.4"/>`;
    },

    outfitPreview(key, accent, p) {
        const villager = `<ellipse cx="48" cy="58" rx="22" ry="5" fill="rgba(42,30,42,.22)"/><path d="M35 36 Q48 27 61 36 L58 55 H38 Z" fill="${accent}" stroke="${p.ink}" stroke-width="2"/><circle cx="48" cy="25" r="9" fill="#d8a56e" stroke="${p.ink}" stroke-width="2"/>`;
        const hat = key.includes('hat') || key.includes('cap') ? `<path d="M31 23 Q48 8 65 23 Z" fill="${p.sand}" stroke="${p.ink}" stroke-width="2"/><path d="M29 24 H67" stroke="${p.ink}" stroke-width="3"/>` : '';
        const cloak = key.includes('cloak') || key.includes('cape') || key.includes('hood') ? `<path d="M31 35 Q48 24 65 35 L70 58 H26 Z" fill="${key.includes('night') ? p.night : p.sea}" stroke="${p.ink}" stroke-width="2" opacity=".92"/>` : '';
        const specs = key.includes('spec') || key.includes('watch') ? `<circle cx="44" cy="25" r="3" fill="none" stroke="${p.ink}" stroke-width="1.5"/><circle cx="52" cy="25" r="3" fill="none" stroke="${p.ink}" stroke-width="1.5"/><path d="M47 25 H49" stroke="${p.ink}" stroke-width="1"/>` : '';
        const sash = key.includes('sash') || key.includes('belt') || key.includes('scarf') ? `<path d="M37 38 L60 53" stroke="${p.coin}" stroke-width="5"/><path d="M37 38 L60 53" stroke="${p.ink}" stroke-width="1.2"/>` : '';
        const bag = key.includes('bag') || key.includes('pouch') ? `<path d="M37 34 L59 54" stroke="${p.ink}" stroke-width="1.5"/><rect x="55" y="44" width="12" height="10" fill="${p.wood}" stroke="${p.ink}" stroke-width="1.5"/>` : '';
        const tool = key.includes('glove') || key.includes('apron') || key.includes('boot') ? `<path d="M62 38 L75 30" stroke="${p.ink}" stroke-width="2"/><rect x="72" y="25" width="7" height="8" fill="${p.wood}" stroke="${p.ink}" stroke-width="1.4"/>` : '';
        const badge = key.includes('badge') || key.includes('pin') || key.includes('mask') || key.includes('vest') ? `<circle cx="55" cy="39" r="4" fill="${p.coin}" stroke="${p.ink}" stroke-width="1.5"/><path d="M41 24 Q48 18 55 24" fill="none" stroke="${key.includes('mask') ? p.coral : p.ink}" stroke-width="2"/>` : '';
        return `${villager}${cloak}${hat}${specs}${sash}${bag}${tool}${badge}<path d="M38 55 L32 62 M58 55 L64 62" stroke="${p.ink}" stroke-width="2" stroke-linecap="round"/>`;
    },

    weatherPreview(key, accent, p) {
        const sky = `<rect x="10" y="12" width="76" height="42" fill="${key.includes('night') || key.includes('moon') || key.includes('aurora') || key.includes('comet') ? p.night : '#7fc8df'}" stroke="${p.ink}" stroke-width="2"/><circle cx="24" cy="25" r="8" fill="${key.includes('moon') || key.includes('night') ? p.shard : p.coin}" stroke="${p.ink}" stroke-width="2"/><path d="M39 35 C45 27 59 28 64 36 C70 36 75 40 75 45 H30 C30 39 33 35 39 35 Z" fill="${p.parchment}" stroke="${p.ink}" stroke-width="2"/>`;
        if (key.includes('kite')) return `${sky}<path d="M58 17 L75 28 L59 39 L43 28 Z" fill="${accent}" stroke="${p.ink}" stroke-width="2"/><path d="M59 39 C54 45 61 50 52 56" fill="none" stroke="${p.ink}" stroke-width="1.5"/>`;
        if (key.includes('bell') || key.includes('chime')) return `${sky}<path d="M47 18 V53" stroke="${p.ink}" stroke-width="2"/><path d="M35 31 H59 L55 48 H39 Z" fill="${p.coin}" stroke="${p.ink}" stroke-width="2"/><circle cx="47" cy="51" r="3" fill="${accent}" stroke="${p.ink}" stroke-width="1.2"/>`;
        if (key.includes('prism') || key.includes('aurora')) return `${sky}<path d="M31 50 L50 19 L69 50 Z" fill="${p.parchment}" stroke="${p.ink}" stroke-width="2"/><path d="M54 28 L81 18 M55 36 L82 36 M54 43 L79 55" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`;
        if (key.includes('drum') || key.includes('thunder')) return `${sky}<ellipse cx="49" cy="42" rx="17" ry="8" fill="${p.wood}" stroke="${p.ink}" stroke-width="2"/><rect x="32" y="32" width="34" height="13" fill="${p.coral}" stroke="${p.ink}" stroke-width="2"/><path d="M31 24 L47 34 M66 24 L51 34" stroke="${p.ink}" stroke-width="2"/>`;
        if (key.includes('sock') || key.includes('vane') || key.includes('sail')) return `${sky}<path d="M35 54 V18" stroke="${p.ink}" stroke-width="2"/><path d="M35 20 C48 16 58 19 70 24 C58 30 48 26 35 31 Z" fill="${accent}" stroke="${p.ink}" stroke-width="2"/>`;
        if (key.includes('fountain') || key.includes('dew')) return `${sky}<ellipse cx="49" cy="48" rx="21" ry="7" fill="${p.sea}" stroke="${p.ink}" stroke-width="2"/><path d="M49 45 C42 34 56 34 49 23" fill="none" stroke="${p.parchment}" stroke-width="3" stroke-linecap="round"/>`;
        if (key.includes('comet')) return `${sky}<path d="M28 26 C44 18 55 17 72 16" stroke="${p.coin}" stroke-width="4" stroke-linecap="round"/><circle cx="73" cy="16" r="5" fill="${accent}" stroke="${p.ink}" stroke-width="1.5"/>`;
        return `${sky}<path d="M15 51 C27 46 40 56 54 50 S77 47 87 52" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`;
    },

    buildingPreview(key, accent, p) {
        const roofColor = key.includes('market') || key.includes('roof') ? p.coral : accent;
        const body = `<ellipse cx="48" cy="58" rx="28" ry="6" fill="rgba(42,30,42,.22)"/><rect x="28" y="30" width="38" height="26" fill="${p.sand}" stroke="${p.ink}" stroke-width="2"/><path d="M23 31 L48 12 L73 31 Z" fill="${roofColor}" stroke="${p.ink}" stroke-width="2"/><rect x="43" y="42" width="10" height="14" fill="${p.ink}"/>`;
        if (key.includes('lighthouse')) return `<ellipse cx="48" cy="58" rx="25" ry="5" fill="rgba(42,30,42,.22)"/><path d="M38 54 L43 18 H58 L63 54 Z" fill="${p.parchment}" stroke="${p.ink}" stroke-width="2"/><rect x="40" y="15" width="21" height="9" fill="${accent}" stroke="${p.ink}" stroke-width="2"/><path d="M61 19 L84 12 M40 19 L14 12" stroke="${p.coin}" stroke-width="3" opacity=".8"/>`;
        if (key.includes('dome') || key.includes('observatory')) return `${body}<path d="M34 28 Q48 8 62 28 Z" fill="${p.coin}" stroke="${p.ink}" stroke-width="2"/><circle cx="48" cy="18" r="4" fill="${p.shard}" stroke="${p.ink}" stroke-width="1.2"/>`;
        if (key.includes('shelf') || key.includes('archive') || key.includes('apothecary')) return `${body}<rect x="31" y="35" width="13" height="16" fill="${p.wood}" stroke="${p.ink}" stroke-width="1.5"/><path d="M32 40 H43 M32 46 H43" stroke="${p.parchment}" stroke-width="1.5"/><circle cx="60" cy="36" r="3" fill="${p.shard}" stroke="${p.ink}"/>`;
        if (key.includes('bell') || key.includes('clock')) return `${body}<circle cx="48" cy="24" r="6" fill="${p.parchment}" stroke="${p.ink}" stroke-width="1.5"/><path d="M48 24 V20 M48 24 H52" stroke="${p.ink}" stroke-width="1.2"/><path d="M41 10 H55 L52 17 H44 Z" fill="${p.coin}" stroke="${p.ink}" stroke-width="1.5"/>`;
        if (key.includes('awning') || key.includes('shutter') || key.includes('facade')) return `${body}<rect x="24" y="31" width="48" height="10" fill="${p.parchment}" stroke="${p.ink}" stroke-width="1.5"/><path d="M27 31 V41 M36 31 V41 M45 31 V41 M54 31 V41 M63 31 V41" stroke="${p.coral}" stroke-width="4"/>`;
        if (key.includes('pillar') || key.includes('balcony')) return `${body}<path d="M27 56 V31 M69 56 V31" stroke="${p.parchment}" stroke-width="5"/><path d="M31 43 H65" stroke="${p.ink}" stroke-width="2"/>`;
        if (key.includes('chimney') || key.includes('stack')) return `${body}<rect x="58" y="12" width="9" height="18" fill="${p.wood}" stroke="${p.ink}" stroke-width="1.5"/><path d="M64 11 C56 3 71 0 63 -7" fill="none" stroke="${p.parchment}" stroke-width="2" stroke-linecap="round"/>`;
        if (key.includes('greenhouse')) return `<ellipse cx="48" cy="58" rx="30" ry="6" fill="rgba(42,30,42,.22)"/><path d="M20 55 H76 V34 Q48 12 20 34 Z" fill="rgba(127,200,223,.55)" stroke="${p.ink}" stroke-width="2"/><path d="M30 55 V30 M48 55 V18 M66 55 V30 M24 42 H72" stroke="${p.ink}" stroke-width="1.4"/>`;
        return body;
    },

    mapPreview(key, accent, p) {
        const island = `<path d="M16 49 C22 25 52 15 74 31 C88 40 76 57 51 61 C30 64 11 57 16 49 Z" fill="${p.sand}" stroke="${p.ink}" stroke-width="2"/><path d="M34 45 L48 29 L67 42 L51 55 Z" fill="${p.moss}" stroke="${p.ink}" stroke-width="1.8"/>`;
        if (key.includes('bridge')) return `${island}<path d="M19 42 C35 28 59 28 76 42" fill="none" stroke="${p.wood}" stroke-width="5"/><path d="M25 40 V48 M48 31 V42 M70 40 V48" stroke="${p.ink}" stroke-width="1.5"/>`;
        if (key.includes('dock') || key.includes('pier')) return `${island}<path d="M52 54 L78 65" stroke="${p.wood}" stroke-width="7"/><path d="M58 56 L62 65 M68 60 L72 68" stroke="${p.ink}" stroke-width="1.5"/>`;
        if (key.includes('grove') || key.includes('orchard') || key.includes('garden')) return `${island}<g fill="${p.mossDark}" stroke="${p.ink}" stroke-width="1.2"><circle cx="32" cy="34" r="6"/><circle cx="45" cy="30" r="6"/><circle cx="61" cy="37" r="6"/></g><circle cx="45" cy="29" r="2" fill="${accent}"/>`;
        if (key.includes('overlook') || key.includes('tower') || key.includes('plateau')) return `${island}<path d="M56 48 L66 20 L76 48 Z" fill="${p.wood}" stroke="${p.ink}" stroke-width="2"/><rect x="61" y="17" width="10" height="8" fill="${accent}" stroke="${p.ink}" stroke-width="1.5"/>`;
        if (key.includes('spring') || key.includes('beach') || key.includes('reef')) return `${island}<ellipse cx="50" cy="45" rx="18" ry="7" fill="${p.sea}" stroke="${p.ink}" stroke-width="1.6"/><path d="M22 53 C38 48 55 58 78 49" fill="none" stroke="${accent}" stroke-width="3"/>`;
        if (key.includes('buoy') || key.includes('marker')) return `${island}<path d="M75 48 V25" stroke="${p.ink}" stroke-width="2"/><path d="M66 27 H84 L79 37 H71 Z" fill="${accent}" stroke="${p.ink}" stroke-width="2"/><circle cx="75" cy="50" r="6" fill="${p.coral}" stroke="${p.ink}" stroke-width="1.5"/>`;
        if (key.includes('cave') || key.includes('quarry')) return `${island}<path d="M31 53 Q48 28 66 53 Z" fill="#6a6862" stroke="${p.ink}" stroke-width="2"/><path d="M42 53 Q49 39 57 53 Z" fill="${p.night}"/>`;
        if (key.includes('walkway') || key.includes('steps') || key.includes('loop') || key.includes('lane')) return `${island}<path d="M24 51 C34 40 47 53 58 42 S72 35 78 45" fill="none" stroke="${p.wood}" stroke-width="5" stroke-linecap="round"/><path d="M31 43 L36 51 M47 47 L52 55 M64 37 L69 45" stroke="${p.ink}" stroke-width="1.2"/>`;
        return `${island}<path d="M26 52 C38 38 55 50 72 35" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round"/><circle cx="72" cy="35" r="6" fill="${p.coin}" stroke="${p.ink}" stroke-width="1.5"/>`;
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
