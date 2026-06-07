const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadResidents(extra = {}) {
    const context = {
        window: null,
        document: {},
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
            formatTime(minutes) {
                return `${minutes}m`;
            },
        },
        Iso: {
            TILE_H: 32,
            WORLD_TX: 12,
            WORLD_TY: 8,
            tileToScreen(tx, ty) {
                return { x: tx * 32, y: ty * 16 };
            },
        },
        ...extra,
    };
    context.window = context;
    vm.createContext(context);
    const source = fs.readFileSync(path.join(__dirname, '../js/residents.js'), 'utf8');
    vm.runInContext(source, context);
    return context.Residents;
}

test('resident renderer produces inline svg villagers without external sprite images', () => {
    const Residents = loadResidents();
    const [resident] = Residents.build([
        { app_name: 'Code', category: 'Development', minutes: 42 },
    ]);

    resident.tile = { tx: 4, ty: 3 };
    const markup = Residents._render(resident);

    assert.match(markup, /world__resident-villager/);
    assert.match(markup, /world__resident-head/);
    assert.match(markup, /world__resident-tunic/);
    assert.match(markup, /world__resident-tool--builder/);
    assert.doesNotMatch(markup, /<image\b/);
    assert.doesNotMatch(markup, /assets\/(?:sprites|market\/pixel\/residents)/);
    assert.doesNotMatch(markup, /world__resident-sprite/);
});

test('resident walking routes close into local loops and avoid building footprints', () => {
    const buildings = [
        { id: 'townHall', tx: 5, ty: 1, size: 'major', footprint: { w: 2, h: 2 } },
        { id: 'market', tx: 8, ty: 5, size: 'major', footprint: { w: 2, h: 2 } },
        { id: 'ruleBoard', tx: 1, ty: 3, size: 'minor', footprint: { w: 1, h: 1 } },
        { id: 'study', tx: 4, ty: 5, size: 'major', footprint: { w: 2, h: 2 } },
    ];
    const Residents = loadResidents({
        Buildings: {
            catalog: buildings,
            anchorFor(building) {
                const footprint = building.footprint || { w: building.size === 'major' ? 2 : 1, h: building.size === 'major' ? 2 : 1 };
                return {
                    x: ((building.tx + footprint.w - 1) - (building.ty + footprint.h - 1)) * 32,
                    y: ((building.tx + footprint.w - 1) + (building.ty + footprint.h - 1)) * 16,
                };
            },
        },
        IslandState: {
            occupiedCells(sourceBuildings) {
                const occupied = new Set();
                sourceBuildings.forEach(building => {
                    const footprint = building.footprint || { w: building.size === 'major' ? 2 : 1, h: building.size === 'major' ? 2 : 1 };
                    for (let dx = 0; dx < footprint.w; dx++) {
                        for (let dy = 0; dy < footprint.h; dy++) {
                            occupied.add(`${building.tx + dx},${building.ty + dy}`);
                        }
                    }
                });
                return occupied;
            },
            walkableTiles(sourceBuildings) {
                const occupied = this.occupiedCells(sourceBuildings);
                const tiles = [];
                for (let ty = 0; ty < 8; ty++) {
                    for (let tx = 0; tx < 12; tx++) {
                        if (!occupied.has(`${tx},${ty}`)) tiles.push({ tx, ty });
                    }
                }
                return tiles;
            },
        },
    });

    const occupied = Residents._blockedTiles();
    const openTiles = Residents._walkableTiles(Residents._openTiles());
    const claimed = new Set();
    Residents.previewApps().forEach((app, index, apps) => {
        const route = Residents._routeFor(app.app_name, index, apps.length, openTiles, claimed);
        route.forEach(tile => claimed.add(Residents._tileKey(tile)));

        assert.ok(route.length >= 3, `${app.app_name} should have a readable loop`);
        route.forEach((tile, tileIndex) => {
            assert.equal(occupied.has(Residents._tileKey(tile)), false, `${app.app_name} route tile ${tileIndex} crosses a building`);
            const next = route[(tileIndex + 1) % route.length];
            assert.ok(
                Residents._distance(tile, next) <= 2.4,
                `${app.app_name} route has a jumpy ${Residents._distance(tile, next).toFixed(2)}-tile leg`,
            );
        });
    });
});
