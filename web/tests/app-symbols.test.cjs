const test = require('node:test');
const assert = require('node:assert/strict');

const AppSymbols = require('../js/app-symbols.js');

test('inferCategory keeps explicit categories and infers common uncategorized apps', () => {
    assert.equal(AppSymbols.inferCategory({ app_name: 'Slack', category: 'Communication' }), 'Communication');
    assert.equal(AppSymbols.inferCategory({ app_name: 'Visual Studio Code', category: 'Uncategorized' }), 'Development');
    assert.equal(AppSymbols.inferCategory({ app_name: 'Spotify', category: '' }), 'Media');
    assert.equal(AppSymbols.inferCategory({ app_name: 'Unknown Thing', category: null }), 'Uncategorized');
});

test('symbolForCategory returns stable display symbols and labels', () => {
    const productivity = AppSymbols.symbolForCategory('Productivity');
    const development = AppSymbols.symbolForCategory('Development');
    const fallback = AppSymbols.symbolForCategory('Uncategorized');

    assert.equal(productivity.label, 'Productivity');
    assert.equal(productivity.symbol, 'book');
    assert.equal(development.symbol, 'hammer');
    assert.equal(fallback.symbol, 'compass');
});

test('badge renders an accessible inline SVG symbol', () => {
    const badge = AppSymbols.badge({ app_name: 'Safari', category: 'Uncategorized' });

    assert.match(badge, /resident-symbol/);
    assert.match(badge, /aria-label="Productivity"/);
    assert.match(badge, /<svg/);
    assert.doesNotMatch(badge, />S<\/span>|>SA<\/span>/);
});
