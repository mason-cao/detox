const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function appStub() {
    return {
        currentDate: '2026-06-03',
        currentTab: '',
        backToIsleButton: () => '<button class="back-to-isle">ISLE</button>',
        formatDate: value => value,
        getWeekStart: () => '2026-06-01',
        formatDayShort: value => value.slice(5),
        formatTime: minutes => `${minutes}m`,
        chartAnimation: () => false,
        chartTickColor: () => '#2a1e2a',
        chartGridColor: () => 'rgba(42,30,42,0.2)',
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
        inlineArg(value) {
            return JSON.stringify(value);
        },
        categoryColor: () => '#5b8fb9',
        appColor: () => '#5b8fb9',
        appDatalist: () => '',
        datalist: () => '',
        api(route) {
            const fixtures = {
                '/api/goals': [
                    { id: 1, type: 'daily_total', target_minutes: 120 },
                    { id: 2, type: 'app_limit', app_name: 'Chrome', target_minutes: 45 },
                    { id: 3, type: 'bedtime', bedtime_hour: 22, bedtime_minute: 30 },
                ],
                '/api/settings': { idle_timeout_minutes: '5', ghost_mode: '1' },
                '/api/categories': [
                    { category: 'Productivity', app_name: 'Chrome' },
                    { category: 'Development', app_name: 'Terminal' },
                ],
                '/api/blocks': [
                    { app_name: 'Roblox', block_type: 'blocked', daily_limit_minutes: null },
                    { app_name: 'Terminal', block_type: 'whitelisted', daily_limit_minutes: null },
                ],
                '/api/category-blocks': [{ category_name: 'Entertainment' }],
                '/api/stats/daily?date=2026-06-03': {
                    total_minutes: 180,
                    pickups_count: 8,
                    checking_every_minutes: 22,
                    longest_detox_minutes: 95,
                    continuous_use_minutes: 48,
                    first_pickup: '08:10',
                    last_pickup: '19:20',
                    most_used_app: 'Chrome',
                },
            };
            return Promise.resolve(fixtures[route] ?? {});
        },
    };
}

function loadModule(file, name, extra = {}) {
    const context = {
        console,
        window: {},
        document: {},
        App: appStub(),
        Effects: { waxSeal() {}, slamIn() {}, chalkDust() {} },
        destroyCharts() {},
        chartsAvailable: () => false,
        Chart: function Chart() {},
        setTimeout(fn) { fn(); },
        toLocalDateString: () => '2026-06-03',
        ...extra,
    };
    context.window = context;
    vm.createContext(context);
    const pxSource = fs.readFileSync(path.join(__dirname, '../js/pixel-sprites.js'), 'utf8');
    vm.runInContext(pxSource, context);
    const source = fs.readFileSync(path.join(__dirname, `../js/${file}`), 'utf8');
    vm.runInContext(`${source}\nglobalThis.${name} = ${name};`, context);
    return { module: context[name], context };
}

function container() {
    return { innerHTML: '' };
}

test('major tabs render distinct polished shells', async () => {
    const { module: Goals } = loadModule('goals.js', 'Goals');
    const goalsContainer = container();
    await Goals.render(goalsContainer);
    assert.match(goalsContainer.innerHTML, /charter-scroll/);
    assert.match(goalsContainer.innerHTML, /charter-section--daily/);
    assert.match(goalsContainer.innerHTML, /charter-section__sigil/);
    assert.match(goalsContainer.innerHTML, /decree__seal/);
    assert.doesNotMatch(goalsContainer.innerHTML, /Chrome —/);

    const { module: Cards } = loadModule('cards.js', 'Cards');
    const cardsContainer = container();
    await Cards.render(cardsContainer);
    assert.match(cardsContainer.innerHTML, /postcard-workbench/);
    assert.match(cardsContainer.innerHTML, /postcard-stamp-sheet/);
    assert.match(cardsContainer.innerHTML, /postcard-compose__pixel-grid/);

    const symbolsSource = fs.readFileSync(path.join(__dirname, '../js/app-symbols.js'), 'utf8');
    const blockerContext = {};
    vm.createContext(blockerContext);
    vm.runInContext(symbolsSource, blockerContext);
    const { module: Blocker } = loadModule('blocker.js', 'Blocker', { AppSymbols: blockerContext.AppSymbols });
    const blockerContainer = container();
    await Blocker.render(blockerContainer);
    assert.match(blockerContainer.innerHTML, /rule-board-shell/);
    assert.match(blockerContainer.innerHTML, /rule-board-section--blocked/);
    assert.match(blockerContainer.innerHTML, /rule-entry__symbol/);
    assert.doesNotMatch(blockerContainer.innerHTML, /charter-section__header/);

    const { module: Stats } = loadModule('stats.js', 'Stats');
    const statsContainer = container();
    await Stats.render(statsContainer);
    assert.match(statsContainer.innerHTML, /chronicle-ledger/);
    assert.match(statsContainer.innerHTML, /chronicle-map-strip/);
    assert.match(statsContainer.innerHTML, /chronicle-tile__stamp/);

    const { module: Settings } = loadModule('settings.js', 'Settings');
    const settingsContainer = container();
    await Settings.render(settingsContainer);
    assert.match(settingsContainer.innerHTML, /study-room/);
    assert.match(settingsContainer.innerHTML, /study-room__grid/);
    assert.match(settingsContainer.innerHTML, /study-section--tracking/);
    assert.match(settingsContainer.innerHTML, /study-form--export/);
    assert.doesNotMatch(settingsContainer.innerHTML, /🏛/);
    assert.doesNotMatch(settingsContainer.innerHTML, /Salt stays on this device —/);
});
