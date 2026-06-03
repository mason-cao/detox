const test = require('node:test');
const assert = require('node:assert/strict');

const IslandState = require('../js/island-state.js');

function memoryStorage(seed = {}) {
    const data = new Map(Object.entries(seed));
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
    };
}

test('layoutFromInventory returns core buildings with stable footprints', () => {
    const layout = IslandState.layoutFromInventory([], { storage: memoryStorage() });

    const townHall = layout.buildings.find(building => building.id === 'townHall');
    const study = layout.buildings.find(building => building.id === 'study');

    assert.equal(layout.version, 1);
    assert.equal(townHall.label, 'Town Hall');
    assert.equal(townHall.footprint.w, 2);
    assert.equal(townHall.footprint.h, 2);
    assert.equal(study.movable, true);
});

test('layoutFromInventory turns owned building and map items into placeable buildings', () => {
    const layout = IslandState.layoutFromInventory([
        { item_key: 'bakery_facade', category: 'building', name: 'Bakery Facade' },
        { item_key: 'south_dock', category: 'map', name: 'South Dock' },
        { item_key: 'lantern_path', category: 'decor', name: 'Lantern Path' },
    ], { storage: memoryStorage() });

    const bakery = layout.buildings.find(building => building.id === 'market-bakery_facade');
    const dock = layout.buildings.find(building => building.id === 'market-south_dock');
    const lantern = layout.buildings.find(building => building.id === 'market-lantern_path');

    assert.equal(bakery.label, 'Bakery Facade');
    assert.equal(bakery.source, 'market');
    assert.equal(bakery.movable, true);
    assert.equal(dock.kind, 'dock');
    assert.equal(lantern, undefined);
});

test('canPlace rejects collisions and out-of-bounds footprints', () => {
    const layout = IslandState.layoutFromInventory([], { storage: memoryStorage() });

    assert.equal(IslandState.canPlace(layout.buildings, 'study', { tx: 0, ty: 0 }), true);
    assert.equal(IslandState.canPlace(layout.buildings, 'study', { tx: 5, ty: 1 }), false);
    assert.equal(IslandState.canPlace(layout.buildings, 'townHall', { tx: 11, ty: 7 }), false);
    assert.equal(IslandState.canPlace(layout.buildings, 'townHall', { tx: -1, ty: 0 }), false);
});

test('moveBuilding persists valid moves and ignores invalid moves', () => {
    const storage = memoryStorage();
    const layout = IslandState.layoutFromInventory([], { storage });

    const moved = IslandState.moveBuilding(layout, 'study', { tx: 0, ty: 0 }, { storage });
    const movedStudy = moved.buildings.find(building => building.id === 'study');
    const saved = JSON.parse(storage.getItem(IslandState.STORAGE_KEY));

    assert.equal(movedStudy.tx, 0);
    assert.equal(movedStudy.ty, 0);
    assert.equal(saved.positions.study.tx, 0);
    assert.equal(saved.positions.study.ty, 0);

    const rejected = IslandState.moveBuilding(moved, 'study', { tx: 5, ty: 1 }, { storage });
    const rejectedStudy = rejected.buildings.find(building => building.id === 'study');

    assert.equal(rejectedStudy.tx, 0);
    assert.equal(rejectedStudy.ty, 0);
});

test('occupiedCells returns every tile in every building footprint', () => {
    const layout = IslandState.layoutFromInventory([], { storage: memoryStorage() });
    const occupied = IslandState.occupiedCells(layout.buildings);

    assert.equal(occupied.has('5,1'), true);
    assert.equal(occupied.has('6,2'), true);
    assert.equal(occupied.has('10,0'), true);
    assert.equal(occupied.has('11,0'), false);
});

test('walkableTiles excludes moved building footprints', () => {
    const storage = memoryStorage();
    const layout = IslandState.layoutFromInventory([], { storage });
    const moved = IslandState.moveBuilding(layout, 'study', { tx: 0, ty: 0 }, { storage });
    const walkable = IslandState.walkableTiles(moved.buildings);
    const keys = new Set(walkable.map(tile => `${tile.tx},${tile.ty}`));

    assert.equal(keys.has('0,0'), false);
    assert.equal(keys.has('1,0'), true);
    assert.equal(keys.has('5,1'), false);
});

test('placeable market buildings participate in collision and walking rules', () => {
    const layout = IslandState.layoutFromInventory([
        { item_key: 'bakery_facade', category: 'building', name: 'Bakery Facade' },
    ], { storage: memoryStorage() });
    const bakery = layout.buildings.find(building => building.id === 'market-bakery_facade');
    const occupied = IslandState.occupiedCells(layout.buildings);
    const walkable = new Set(IslandState.walkableTiles(layout.buildings).map(tile => `${tile.tx},${tile.ty}`));

    assert.equal(occupied.has(`${bakery.tx},${bakery.ty}`), true);
    assert.equal(occupied.has(`${bakery.tx + 1},${bakery.ty + 1}`), bakery.size === 'major');
    assert.equal(walkable.has(`${bakery.tx},${bakery.ty}`), false);
});
