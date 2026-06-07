const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMarket() {
    const context = {
        console,
        window: null,
        App: {
            escapeHtml(value) {
                return String(value ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            },
            escapeAttr(value) {
                return this.escapeHtml(value).replace(/`/g, '&#96;');
            },
        },
    };
    context.window = context;
    vm.createContext(context);
    const source = fs.readFileSync(path.join(__dirname, '../js/market.js'), 'utf8');
    vm.runInContext(source, context);
    return context.Market;
}

test('assetPreview renders item-specific SVG art instead of shared category images', () => {
    const Market = loadMarket();
    const lantern = Market.assetPreview({
        key: 'lantern_path',
        category: 'decor',
        name: 'Lantern Path',
        currency: 'sunlight',
    });
    const flowers = Market.assetPreview({
        key: 'flower_boxes',
        category: 'decor',
        name: 'Flower Boxes',
        currency: 'sunlight',
    });

    assert.match(lantern, /<svg class="stall-preview"/);
    assert.match(flowers, /<svg class="stall-preview"/);
    assert.doesNotMatch(lantern, /<img|items\.png|bazaar\.png/);
    assert.doesNotMatch(flowers, /<img|items\.png|bazaar\.png/);
    assert.notEqual(lantern, flowers);
});

test('every market category uses generated keyed preview scenes', () => {
    const Market = loadMarket();
    const items = [
        { key: 'harbor_lanterns', category: 'decor', name: 'Harbor Lanterns', currency: 'sunlight' },
        { key: 'scholar_specs', category: 'outfit', name: 'Scholar Specs', currency: 'sunlight' },
        { key: 'rainbow_prism', category: 'weather', name: 'Rainbow Prism', currency: 'starshard' },
        { key: 'greenhouse_frame', category: 'building', name: 'Greenhouse Frame', currency: 'starshard' },
        { key: 'south_dock', category: 'map', name: 'South Dock', currency: 'starshard' },
    ];

    for (const item of items) {
        const markup = Market.assetPreview(item);
        assert.match(markup, new RegExp(`market-asset-preview--${item.category}`));
        assert.match(markup, /<svg class="stall-preview"/);
        assert.doesNotMatch(markup, /<img|items\.png|bazaar\.png|characters\.png/);
    }
});

test('every configured market item has a named hand-drawn preview treatment', () => {
    const Market = loadMarket();
    const config = fs.readFileSync(path.join(__dirname, '../../agent/config.py'), 'utf8');
    const keys = [...config.matchAll(/\("([^"]+)",\s*"[^"]+",\s*"[^"]+",\s*"(?:sunlight|starshard)",\s*\d+\)/g)]
        .map(match => match[1]);

    assert.ok(keys.length > 80, 'catalog fixture should cover the full market');
    for (const key of keys) {
        assert.notEqual(Market.previewSceneKey(key), 'generic', `${key} needs a specific preview scene`);
        const markup = Market.assetPreview({ key, item_key: key, category: 'decor', name: key, currency: 'sunlight' });
        assert.match(markup, /data-preview-scene="/);
    }
});
