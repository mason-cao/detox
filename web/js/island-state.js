(function (root) {
    const STORAGE_KEY = 'detox.island.layout.v1';
    const WORLD_TX = 12;
    const WORLD_TY = 8;

    const coreBuildings = [
        { id: 'townHall', tab: 'dashboard', label: 'Town Hall', tx: 5, ty: 1, size: 'major', kind: 'townHall', source: 'core', movable: true },
        { id: 'registry', tab: 'apps', label: 'Registry', tx: 1, ty: 2, size: 'major', kind: 'registry', source: 'core', movable: true },
        { id: 'market', tab: 'market', label: 'Market', tx: 9, ty: 2, size: 'major', kind: 'market', source: 'core', movable: true },
        { id: 'chronicle', tab: 'stats', label: 'Chronicle', tx: 5, ty: 5, size: 'major', kind: 'chronicle', source: 'core', movable: true },
        { id: 'charter', tab: 'goals', label: 'Charter', tx: 3, ty: 0, size: 'minor', kind: 'charter', source: 'core', movable: true },
        { id: 'ruleBoard', tab: 'blocker', label: 'Rule Board', tx: 8, ty: 5, size: 'minor', kind: 'ruleBoard', source: 'core', movable: true },
        { id: 'postcards', tab: 'cards', label: 'Postcards', tx: 2, ty: 6, size: 'minor', kind: 'postcards', source: 'core', movable: true },
        { id: 'study', tab: 'settings', label: 'Mayor Study', tx: 10, ty: 0, size: 'minor', kind: 'study', source: 'core', movable: true },
    ];

    function cloneBuilding(building) {
        return {
            ...building,
            footprint: footprintFor(building),
        };
    }

    function storageFor(options = {}) {
        if (options.storage) return options.storage;
        try {
            if (root.localStorage) return root.localStorage;
        } catch (_) {
            return null;
        }
        return null;
    }

    function readSaved(storage) {
        if (!storage) return { version: 1, positions: {} };
        try {
            const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '');
            if (!parsed || typeof parsed !== 'object') return { version: 1, positions: {} };
            return {
                version: 1,
                positions: parsed.positions && typeof parsed.positions === 'object' ? parsed.positions : {},
            };
        } catch (_) {
            return { version: 1, positions: {} };
        }
    }

    function writeSaved(layout, storage) {
        if (!storage) return;
        const positions = {};
        layout.buildings.forEach(building => {
            positions[building.id] = { tx: building.tx, ty: building.ty };
        });
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, positions }));
    }

    function reset(options = {}) {
        const storage = storageFor(options);
        if (storage) storage.removeItem(STORAGE_KEY);
    }

    function footprintFor(building = {}) {
        if (building.footprint && Number.isFinite(building.footprint.w) && Number.isFinite(building.footprint.h)) {
            return {
                w: Math.max(1, Math.round(building.footprint.w)),
                h: Math.max(1, Math.round(building.footprint.h)),
            };
        }
        return building.size === 'major' ? { w: 2, h: 2 } : { w: 1, h: 1 };
    }

    function footprintCells(building, position = building) {
        const footprint = footprintFor(building);
        const cells = [];
        for (let dx = 0; dx < footprint.w; dx++) {
            for (let dy = 0; dy < footprint.h; dy++) {
                cells.push({ tx: position.tx + dx, ty: position.ty + dy });
            }
        }
        return cells;
    }

    function occupiedCells(buildings = [], options = {}) {
        const occupied = new Set();
        buildings.forEach(building => {
            if (!building || building.id === options.exceptId) return;
            footprintCells(building).forEach(cell => occupied.add(`${cell.tx},${cell.ty}`));
        });
        return occupied;
    }

    function inBounds(building, position, world = {}) {
        const footprint = footprintFor(building);
        const maxTx = Number.isFinite(world.tx) ? world.tx : WORLD_TX;
        const maxTy = Number.isFinite(world.ty) ? world.ty : WORLD_TY;
        return position.tx >= 0
            && position.ty >= 0
            && position.tx + footprint.w <= maxTx
            && position.ty + footprint.h <= maxTy;
    }

    function normalizedPosition(position) {
        return {
            tx: Math.round(Number(position?.tx ?? 0)),
            ty: Math.round(Number(position?.ty ?? 0)),
        };
    }

    function canPlace(buildings = [], id, position, options = {}) {
        const building = buildings.find(candidate => candidate.id === id);
        if (!building) return false;
        const pos = normalizedPosition(position);
        if (!inBounds(building, pos, options.world)) return false;
        const occupied = occupiedCells(buildings, { exceptId: id });
        return footprintCells(building, pos).every(cell => !occupied.has(`${cell.tx},${cell.ty}`));
    }

    function hash(value) {
        let h = 2166136261;
        const str = String(value || '');
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function safeKey(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_ -]+/g, '')
            .replace(/\s+/g, '_')
            .replace(/-+/g, '_');
    }

    function titleize(value) {
        return String(value || '')
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function marketKindFor(key, category) {
        if (key.includes('dock') || key.includes('pier')) return 'dock';
        if (key.includes('bridge')) return 'bridge';
        if (key.includes('lighthouse')) return 'lighthouse';
        if (key.includes('bakery')) return 'bakery';
        if (key.includes('bathhouse')) return 'bathhouse';
        if (key.includes('greenhouse')) return 'greenhouse';
        if (key.includes('workshop')) return 'workshop';
        if (key.includes('inn')) return 'inn';
        if (key.includes('schoolhouse')) return 'schoolhouse';
        if (key.includes('tea_shop') || key.includes('tea')) return 'teaShop';
        if (key.includes('apothecary')) return 'apothecary';
        if (key.includes('observatory')) return 'observatory';
        if (key.includes('cave') || key.includes('quarry')) return 'cave';
        if (key.includes('grove') || key.includes('orchard') || key.includes('garden')) return 'grove';
        if (key.includes('spring') || key.includes('beach') || key.includes('reef')) return 'shore';
        if (key.includes('tower') || key.includes('overlook') || key.includes('plateau')) return 'lookout';
        return category === 'map' ? 'mapFeature' : 'marketBuilding';
    }

    function marketSizeFor(key, kind) {
        if (['bakery', 'bathhouse', 'greenhouse', 'workshop', 'inn', 'schoolhouse', 'apothecary'].includes(kind)) {
            return 'major';
        }
        if (key.includes('annex') || key.includes('expansion')) return 'major';
        return 'minor';
    }

    function placeableTemplateForItem(item = {}) {
        if (item.refunded) return null;
        const category = String(item.category || '').toLowerCase();
        if (category !== 'building' && category !== 'map') return null;

        const itemKey = safeKey(item.item_key || item.key || item.name);
        if (!itemKey) return null;
        const kind = marketKindFor(itemKey, category);
        const size = marketSizeFor(itemKey, kind);
        const seed = hash(`${category}:${itemKey}`);
        return cloneBuilding({
            id: `market-${itemKey}`,
            itemKey,
            tab: null,
            label: item.name || titleize(itemKey),
            tx: seed % WORLD_TX,
            ty: Math.floor(seed / WORLD_TX) % WORLD_TY,
            size,
            kind,
            source: 'market',
            category,
            movable: true,
        });
    }

    function nextOpenPosition(buildings, id, preferred) {
        const building = buildings.find(candidate => candidate.id === id);
        if (!building) return { tx: 0, ty: 0 };
        const candidates = [];
        if (preferred) candidates.push(normalizedPosition(preferred));

        const seed = hash(id);
        for (let i = 0; i < WORLD_TX * WORLD_TY; i++) {
            const n = (seed + i * 7) % (WORLD_TX * WORLD_TY);
            candidates.push({ tx: n % WORLD_TX, ty: Math.floor(n / WORLD_TX) });
        }

        return candidates.find(candidate => canPlace(buildings, id, candidate)) || { tx: 0, ty: 0 };
    }

    function buildTemplatesFromInventory(inventory = []) {
        const seen = new Set();
        const placeables = [];
        inventory.forEach(item => {
            const template = placeableTemplateForItem(item);
            if (!template || seen.has(template.id)) return;
            seen.add(template.id);
            placeables.push(template);
        });
        return [
            ...coreBuildings.map(cloneBuilding),
            ...placeables,
        ];
    }

    function layoutFromInventory(inventory = [], options = {}) {
        const storage = storageFor(options);
        const saved = readSaved(storage);
        const templates = buildTemplatesFromInventory(Array.isArray(inventory) ? inventory : []);
        const placed = [];

        templates.forEach(template => {
            const working = [...placed, cloneBuilding(template)];
            const savedPosition = saved.positions[template.id];
            const defaultPosition = { tx: template.tx, ty: template.ty };
            const candidate = [savedPosition, defaultPosition]
                .filter(Boolean)
                .map(normalizedPosition)
                .find(position => canPlace(working, template.id, position));
            const position = candidate || nextOpenPosition(working, template.id, defaultPosition);
            placed.push({
                ...template,
                tx: position.tx,
                ty: position.ty,
                footprint: footprintFor(template),
            });
        });

        return {
            version: 1,
            buildings: placed,
        };
    }

    function moveBuilding(layout, id, position, options = {}) {
        if (!layout || !Array.isArray(layout.buildings)) return layout;
        const target = layout.buildings.find(building => building.id === id);
        if (!target || !target.movable) return layout;
        const pos = normalizedPosition(position);
        const nextBuildings = layout.buildings.map(building => (
            building.id === id ? { ...building, tx: pos.tx, ty: pos.ty } : { ...building }
        ));
        if (!canPlace(nextBuildings, id, pos)) return layout;

        const nextLayout = { ...layout, buildings: nextBuildings };
        writeSaved(nextLayout, storageFor(options));
        return nextLayout;
    }

    function serialize(layout) {
        const positions = {};
        (layout?.buildings || []).forEach(building => {
            positions[building.id] = { tx: building.tx, ty: building.ty };
        });
        return { version: 1, positions };
    }

    const IslandState = {
        STORAGE_KEY,
        WORLD_TX,
        WORLD_TY,
        coreBuildings: coreBuildings.map(cloneBuilding),
        footprintFor,
        footprintCells,
        occupiedCells,
        canPlace,
        placeableTemplateForItem,
        layoutFromInventory,
        moveBuilding,
        serialize,
        reset,
    };

    root.IslandState = IslandState;
    if (typeof module !== 'undefined' && module.exports) module.exports = IslandState;
})(typeof window !== 'undefined' ? window : globalThis);
