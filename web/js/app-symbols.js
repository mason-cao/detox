(function (root) {
    const CATEGORY_META = {
        Productivity: {
            symbol: 'book',
            color: '#5b8fb9',
            path: '<path d="M5 5h7a3 3 0 0 1 3 3v11H8a3 3 0 0 0-3 3V5z"/><path d="M15 8h4v14h-7a3 3 0 0 0-3-3"/>',
        },
        Development: {
            symbol: 'hammer',
            color: '#7b8fbf',
            path: '<path d="M13 5l6 6"/><path d="M11 7l2-2 6 6-2 2"/><path d="M11 13l-6 6 2 2 6-6"/><path d="M4 8l4-4 3 3-4 4z"/>',
        },
        Communication: {
            symbol: 'chat',
            color: '#b59cff',
            path: '<path d="M5 6h14v10H9l-4 4V6z"/><path d="M8 10h8M8 13h5"/>',
        },
        Social: {
            symbol: 'people',
            color: '#d16a8f',
            path: '<circle cx="9" cy="9" r="3"/><circle cx="16" cy="10" r="2.5"/><path d="M4 20c1-4 9-4 10 0"/><path d="M13 18c1-2 6-2 7 0"/>',
        },
        Entertainment: {
            symbol: 'ticket',
            color: '#ffd04a',
            path: '<path d="M5 8h14v4a2 2 0 0 0 0 4v4H5v-4a2 2 0 0 0 0-4V8z"/><path d="M10 9v10"/>',
        },
        Media: {
            symbol: 'music',
            color: '#d6a44e',
            path: '<path d="M9 18a3 3 0 1 1-2-2.83V6l10-2v12"/><path d="M17 16a3 3 0 1 1-2-2.83"/>',
        },
        Utilities: {
            symbol: 'wrench',
            color: '#6b8e4e',
            path: '<path d="M15 6a5 5 0 0 0 6 6L12 21 5 14l9-9z"/><path d="M8 17l-3 3"/>',
        },
        Enforcement: {
            symbol: 'shield',
            color: '#c4453a',
            path: '<path d="M12 4l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V7l8-3z"/><path d="M9 12l2 2 5-5"/>',
        },
        Design: {
            symbol: 'brush',
            color: '#c783b7',
            path: '<path d="M17 4l3 3-9 9H8v-3l9-9z"/><path d="M7 15c-3 1-4 3-4 5 2 0 4-1 5-4"/>',
        },
        Uncategorized: {
            symbol: 'compass',
            color: '#8f8487',
            path: '<circle cx="12" cy="12" r="9"/><path d="M12 4l3 8-3 8-3-8 3-8z"/><path d="M4 12h16"/>',
        },
    };

    const RULES = [
        ['Development', /\b(code|visual studio code|xcode|terminal|iterm|sublime|vim|emacs|github|docker|postman|fig|cursor|zed|electron|script editor)\b/i],
        ['Communication', /\b(mail|messages|slack|teams|zoom|facetime|signal|telegram|whatsapp|outlook|gmail)\b/i],
        ['Social', /\b(discord|instagram|twitter|x\.app|facebook|tiktok|reddit|snapchat|mastodon|threads)\b/i],
        ['Media', /\b(spotify|music|podcasts|garageband|logic|audacity)\b/i],
        ['Entertainment', /\b(youtube|netflix|twitch|tv|prime video|hulu|disney|steam|epic games|minecraft|roblox|robloxplayer|lunar client|java)\b/i],
        ['Design', /\b(figma|sketch|photoshop|illustrator|indesign|canva|affinity|blender)\b/i],
        ['Utilities', /\b(system settings|settings|activity monitor|finder|preview|calculator|keychain|textedit|notes|reminders|calendar|numbers|pages|keynote)\b/i],
        ['Productivity', /\b(safari|chrome|firefox|arc|brave|edge|notion|obsidian|word|excel|powerpoint|sheets|docs|lockdown browser)\b/i],
    ];

    function cleanCategory(category) {
        const value = String(category || '').trim();
        if (!value || value.toLowerCase() === 'uncategorized') return '';
        const lower = value.toLowerCase();
        const match = Object.keys(CATEGORY_META).find(key => key.toLowerCase() === lower);
        return match || value.charAt(0).toUpperCase() + value.slice(1);
    }

    function inferCategory(app = {}) {
        const explicit = cleanCategory(app.category);
        if (explicit) return explicit;
        const name = String(app.app_name || app.name || '').trim();
        const rule = RULES.find(([, pattern]) => pattern.test(name));
        return rule ? rule[0] : 'Uncategorized';
    }

    function symbolForCategory(category) {
        const label = cleanCategory(category) || 'Uncategorized';
        const meta = CATEGORY_META[label] || CATEGORY_META.Uncategorized;
        return { label, ...meta };
    }

    function safeClass(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function badge(app = {}) {
        const meta = symbolForCategory(inferCategory(app));
        const cls = safeClass(meta.label);
        return `
            <span class="resident-symbol resident-symbol--${cls}" aria-label="${escapeHtml(meta.label)}" title="${escapeHtml(meta.label)}" style="--resident-symbol-color: ${meta.color}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    ${meta.path}
                </svg>
            </span>
        `;
    }

    const AppSymbols = {
        CATEGORY_META,
        inferCategory,
        symbolForCategory,
        badge,
    };

    root.AppSymbols = AppSymbols;
    if (typeof module !== 'undefined' && module.exports) module.exports = AppSymbols;
})(typeof window !== 'undefined' ? window : globalThis);
