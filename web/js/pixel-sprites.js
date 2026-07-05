/* Px — pixel-art sprite engine. Every sprite is a character grid rendered
   as merged-run SVG rects with crisp edges: no paths, no curves, no
   hand-drawn strokes. Consumers: buildings.js, residents.js, world.js,
   market.js, cards.js. */

const Px = (() => {
    const INK = '#2b2138';

    /* ── Grid primitives ─────────────────────────────────────────────── */

    function grid(w, h, fill = '.') {
        return Array.from({ length: h }, () => Array(w).fill(fill));
    }

    function set(g, x, y, ch) {
        if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch;
    }

    function fillRect(g, x, y, w, h, ch) {
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) set(g, x + i, y + j, ch);
        }
    }

    function hline(g, x, y, w, ch) { fillRect(g, x, y, w, 1, ch); }
    function vline(g, x, y, h, ch) { fillRect(g, x, y, 1, h, ch); }

    // Stamp ASCII art (array of strings) onto a grid; '.' is transparent.
    function stamp(g, x, y, art) {
        art.forEach((row, j) => {
            for (let i = 0; i < row.length; i++) {
                if (row[i] !== '.') set(g, x + i, y + j, row[i]);
            }
        });
    }

    function rows(g) { return g.map(r => r.join('')); }

    /* ── Rendering ───────────────────────────────────────────────────── */

    // Merge horizontal runs of the same char into single rects.
    // Palette values: fill string, or { fill, cls } for classed cells.
    function rectsMarkup(rowsArr, palette) {
        let out = '';
        rowsArr.forEach((row, y) => {
            let x = 0;
            while (x < row.length) {
                const ch = row[x];
                if (ch === '.' || ch === ' ') { x += 1; continue; }
                let run = 1;
                while (x + run < row.length && row[x + run] === ch) run += 1;
                const p = palette[ch];
                if (p) {
                    const fill = typeof p === 'string' ? p : p.fill;
                    const cls = (typeof p === 'object' && p.cls) ? ` class="${p.cls}"` : '';
                    // +0.05 bleed hides sub-pixel seams between adjacent runs.
                    out += `<rect${cls} x="${x}" y="${y}" width="${run + 0.05}" height="1.05" fill="${fill}"/>`;
                }
                x += run;
            }
        });
        return out;
    }

    // Bottom-center anchored sprite group at (dx, dy).
    function sprite(rowsArr, palette, { scale = 2, cls = '', dx = 0, dy = 0 } = {}) {
        const w = Math.max(...rowsArr.map(r => r.length));
        const h = rowsArr.length;
        const tx = (dx - (w * scale) / 2).toFixed(1);
        const ty = (dy - h * scale).toFixed(1);
        return `<g class="px ${cls}" shape-rendering="crispEdges" transform="translate(${tx} ${ty}) scale(${scale})">${rectsMarkup(rowsArr, palette)}</g>`;
    }

    /* ── Building kit ────────────────────────────────────────────────── */
    //
    // Front-facing pixel structures. Chars:
    //   O ink   R roof   r roof light   w wall   s wall shade
    //   W window (glows at night)      d door    G gold
    //   A/B awning stripes             plus per-building extras.

    function houseGrid({ wallW, wallH, roofH, overhang = 2, flatRoof = false }) {
        const W = wallW + overhang * 2;
        const H = roofH + wallH + 1;
        const g = grid(W, H);
        const wallX = overhang;

        if (flatRoof) {
            fillRect(g, 1, 0, W - 2, roofH, 'R');
            hline(g, 1, 1, W - 2, 'r');
            hline(g, 0, roofH - 1, W, 'O');
        } else {
            // Gable: each row up shrinks by 2 per side.
            for (let i = 0; i < roofH; i++) {
                const y = roofH - 1 - i;
                const inset = Math.min(i * 2, Math.floor(W / 2) - 1);
                const x = inset;
                const w = W - inset * 2;
                if (w <= 0) continue;
                fillRect(g, x, y, w, 1, i === roofH - 1 ? 'r' : 'R');
                set(g, x, y, 'O');
                set(g, x + w - 1, y, 'O');
            }
            hline(g, 0, roofH - 1, W, 'O'); // eave line
        }

        // Walls with right-side shade and ink footer.
        fillRect(g, wallX, roofH, wallW, wallH, 'w');
        fillRect(g, wallX + wallW - 2, roofH, 2, wallH, 's');
        vline(g, wallX, roofH, wallH, 'O');
        vline(g, wallX + wallW - 1, roofH, wallH, 'O');
        hline(g, wallX, roofH + wallH, wallW, 'O');
        return g;
    }

    const WINDOW = [
        'OOOOO',
        'OWWWO',
        'OWWWO',
        'OOOOO',
    ];

    function doorArt(h = 7) {
        const art = ['OOOOO'];
        for (let i = 0; i < h - 1; i++) art.push(i === Math.floor(h / 2) - 1 ? 'OddGO' : 'OdddO');
        return art;
    }

    const BUILDING_PALETTES = {
        townHall:  { wall: '#f0dcae', shade: '#cbb078', roof: '#c0472f', roofLight: '#d8664a' },
        registry:  { wall: '#d8ab6e', shade: '#b0854c', roof: '#7a4e2c', roofLight: '#94643c' },
        market:    { wall: '#cf9455', shade: '#a87140', roof: '#c23a2e', roofLight: '#d85a48' },
        chronicle: { wall: '#cfa568', shade: '#a87f49', roof: '#4a6178', roofLight: '#5f7b96' },
        charter:   { wall: '#86b25c', shade: '#648a41', roof: '#3f6d31', roofLight: '#528a42' },
        ruleBoard: { wall: '#9a6b47', shade: '#775033', roof: '#5e3f2a', roofLight: '#755138' },
        postcards: { wall: '#e8b06a', shade: '#c08c4c', roof: '#d14b3d', roofLight: '#e0685a' },
        study:     { wall: '#57407a', shade: '#42305e', roof: '#2b2148', roofLight: '#3d3060' },
        generic:   { wall: '#c39868', shade: '#9c7649', roof: '#8a4a34', roofLight: '#a35e44' },
    };

    function buildingPalette(kind, extra = {}) {
        const p = BUILDING_PALETTES[kind] || BUILDING_PALETTES.generic;
        return {
            O: INK,
            R: p.roof,
            r: p.roofLight,
            w: p.wall,
            s: p.shade,
            W: { fill: '#fdf3d8', cls: 'px-window' },
            d: '#3d2e4a',
            G: '#ffc93c',
            ...extra,
        };
    }

    function baseShadow(halfWidth, depth = 4) {
        return `<ellipse class="b-shadow" cx="0" cy="2" rx="${halfWidth}" ry="${depth}"/>`;
    }

    /* ── The eight civic buildings ───────────────────────────────────── */

    function townHall() {
        const g = houseGrid({ wallW: 30, wallH: 13, roofH: 9 });
        // Finial
        stamp(g, 16, 0, ['G', 'G']);
        // Clock in gable
        stamp(g, 14, 3, [
            '.OOO.',
            'OWWWO',
            'OWOWO',
            'OWWWO',
            '.OOO.',
        ]);
        stamp(g, 5, 11, WINDOW);
        stamp(g, 24, 11, WINDOW);
        // Column accents
        vline(g, 4, 9, 13, 's');
        vline(g, 29, 9, 13, 's');
        // Double door
        stamp(g, 13, 15, [
            'OOOOOOOO',
            'OdddOddO',
            'OdddOddO',
            'OddGOGdO',
            'OdddOddO',
            'OdddOddO',
            'OdddOddO',
        ]);
        return sprite(rows(g), buildingPalette('townHall'), { scale: 3.1, cls: 'px-building' });
    }

    function registry() {
        const g = houseGrid({ wallW: 26, wallH: 12, roofH: 8 });
        // Ledger sign
        stamp(g, 11, 9, [
            'OOOOOOOO',
            'OWWWWWWO',
            'OWOOOWWO',
            'OWWWWWWO',
            'OWOOOOWO',
            'OOOOOOOO',
        ]);
        stamp(g, 4, 10, WINDOW);
        stamp(g, 23, 10, WINDOW);
        stamp(g, 12, 15, doorArt(6));
        return sprite(rows(g), buildingPalette('registry'), { scale: 3.1, cls: 'px-building' });
    }

    function market() {
        const g = houseGrid({ wallW: 30, wallH: 13, roofH: 8 });
        // Striped awning over the stall front
        for (let i = 0; i < 32; i++) {
            const ch = Math.floor(i / 4) % 2 === 0 ? 'A' : 'B';
            set(g, 1 + i, 8, ch);
            set(g, 1 + i, 9, ch);
            if (Math.floor(i / 4) % 2 === 0) set(g, 1 + i, 10, ch);
        }
        // Counter with produce
        stamp(g, 5, 15, [
            'OOOOOOOOOOOOOOOOOOOOOOOO',
            'OppOqqOppOqqOppOqqOppOqO',
            'OOOOOOOOOOOOOOOOOOOOOOOO',
            'OwwwwwwwwwwwwwwwwwwwwwwO',
        ]);
        stamp(g, 14, 11, [
            'OOOO',
            'OGGO',
            'OOOO',
        ]);
        return sprite(rows(g), buildingPalette('market', {
            A: '#d14b3d',
            B: '#fff8e8',
            p: '#e56b4a',
            q: '#86b25c',
        }), { scale: 3.1, cls: 'px-building' });
    }

    function chronicle() {
        const g = houseGrid({ wallW: 26, wallH: 12, roofH: 8 });
        // Chimney
        stamp(g, 23, 1, [
            'OOO',
            'ORO',
            'ORO',
        ]);
        // Twin book spines in the window
        stamp(g, 5, 10, [
            'OOOOOOO',
            'OMMONNO',
            'OMMONNO',
            'OMMONNO',
            'OOOOOOO',
        ]);
        stamp(g, 20, 10, WINDOW);
        stamp(g, 12, 15, doorArt(6));
        return sprite(rows(g), buildingPalette('chronicle', {
            M: '#d14b3d',
            N: '#2f7ea6',
        }), { scale: 3.1, cls: 'px-building' });
    }

    function charter() {
        const g = houseGrid({ wallW: 18, wallH: 10, roofH: 6 });
        // Scroll plaque
        stamp(g, 6, 8, [
            'OOOOOOOO',
            'OWWWWWWO',
            'OWOOOOWO',
            'OWWWWWWO',
            'OWOOOWWO',
            'OOOOOOOO',
        ]);
        stamp(g, 8, 14, doorArt(3));
        return sprite(rows(g), buildingPalette('charter'), { scale: 2.9, cls: 'px-building' });
    }

    function ruleBoard() {
        const g = houseGrid({ wallW: 24, wallH: 12, roofH: 6, flatRoof: true });
        // Chalkboard face with chalk lines
        stamp(g, 4, 8, [
            'OOOOOOOOOOOOOOOOOOOO',
            'OkkkkkkkkkkkkkkkkkkO',
            'OkccccccccccccccckkO',
            'OkkkkkkkkkkkkkkkkkkO',
            'OkcccccccccckkkkkkkO',
            'OkkkkkkkkkkkkkkkkkkO',
            'OkccccccccccccccckkO',
            'OkkkkkkkkkkkkkkkkkkO',
            'OOOOOOOOOOOOOOOOOOOO',
        ]);
        // Chalk ledge
        stamp(g, 10, 17, ['OOOOO', 'OWWWO', 'OOOOO']);
        return sprite(rows(g), buildingPalette('ruleBoard', {
            k: '#22352e',
            c: '#e8e2d4',
        }), { scale: 2.9, cls: 'px-building' });
    }

    function postcards() {
        const g = houseGrid({ wallW: 18, wallH: 10, roofH: 6 });
        // Envelope emblem
        stamp(g, 5, 8, [
            'OOOOOOOOOO',
            'OWWWWWWWWO',
            'OWOWWWWOWO',
            'OWWOOOOWWO',
            'OWWWWWWWWO',
            'OOOOOOOOOO',
        ]);
        stamp(g, 8, 14, doorArt(3));
        // Flag
        stamp(g, 20, 4, [
            'OMM',
            'OMM',
            'O..',
            'O..',
        ]);
        return sprite(rows(g), buildingPalette('postcards', { M: '#d14b3d' }), { scale: 2.9, cls: 'px-building' });
    }

    function study() {
        const g = houseGrid({ wallW: 18, wallH: 11, roofH: 7 });
        // Star finial
        stamp(g, 10, 0, ['.G.', 'GGG', '.G.']);
        // Arched gold window
        stamp(g, 6, 9, [
            '.OOOOOO.',
            'OWWWWWWO',
            'OWWOOWWO',
            'OWWWWWWO',
            'OOOOOOOO',
        ]);
        stamp(g, 8, 15, doorArt(4));
        return sprite(rows(g), buildingPalette('study'), { scale: 2.9, cls: 'px-building' });
    }

    /* ── Purchased / map structures ──────────────────────────────────── */

    function genericShop(accent = '#8a4a34') {
        const g = houseGrid({ wallW: 20, wallH: 11, roofH: 6 });
        stamp(g, 5, 8, ['OOOOOOOOOOOOOO', 'OWWWWWWWWWWWWO', 'OOOOOOOOOOOOOO']);
        stamp(g, 4, 12, WINDOW);
        stamp(g, 15, 12, WINDOW);
        stamp(g, 9, 14, doorArt(4));
        const pal = buildingPalette('generic');
        pal.R = accent;
        pal.r = accent;
        return sprite(rows(g), pal, { scale: 2.9, cls: 'px-building' });
    }

    function lighthouse() {
        const g = grid(13, 26);
        stamp(g, 3, 0, ['OOOOOOO', 'OGGGGGO', 'OOOOOOO']);
        for (let y = 3; y < 25; y++) {
            const band = Math.floor((y - 3) / 4) % 2 === 0;
            fillRect(g, 2, y, 9, 1, band ? 'L' : 'M');
            set(g, 2, y, 'O');
            set(g, 10, y, 'O');
        }
        hline(g, 2, 25, 9, 'O');
        stamp(g, 4, 19, doorArt(5));
        return sprite(rows(g), { O: INK, G: '#ffc93c', L: '#fff8e8', M: '#d14b3d', d: '#3d2e4a' }, { scale: 2.6, cls: 'px-building' });
    }

    function grove() {
        const g = grid(15, 18);
        stamp(g, 2, 0, [
            '..TTTTTTT..',
            '.TTTTTTTTT.',
            'TTTTUUTTTTT',
            'TTUTTTTTUTT',
            'TTTTTTTTTTT',
            '.TTTUUTTTT.',
            '..TTTTTTT..',
        ]);
        fillRect(g, 6, 7, 3, 9, 'K');
        hline(g, 4, 16, 7, 'O');
        return sprite(rows(g), { T: '#4d8a3c', U: '#d14b3d', K: '#7b5635', O: INK }, { scale: 2.6, cls: 'px-building' });
    }

    function dock() {
        const g = grid(22, 12);
        fillRect(g, 1, 4, 20, 3, 'K');
        hline(g, 1, 4, 20, 'k');
        for (let x = 2; x < 21; x += 4) fillRect(g, x, 7, 2, 4, 'O');
        stamp(g, 15, 0, ['OMM', 'OMM', 'O..', 'O..']);
        return sprite(rows(g), { K: '#7b5635', k: '#94684a', O: INK, M: '#d14b3d' }, { scale: 2.6, cls: 'px-building' });
    }

    function bridge() {
        const g = grid(24, 10);
        fillRect(g, 0, 4, 24, 3, 'K');
        hline(g, 0, 4, 24, 'k');
        for (let x = 1; x < 23; x += 5) fillRect(g, x, 1, 2, 4, 'O');
        hline(g, 0, 1, 24, 'O');
        return sprite(rows(g), { K: '#8a6142', k: '#a37a54', O: INK }, { scale: 2.6, cls: 'px-building' });
    }

    function greenhouse() {
        const g = grid(20, 14);
        for (let i = 0; i < 5; i++) hline(g, 2 + i, 4 - Math.min(i, 4) + 0, 16 - i * 0, 1, '.');
        fillRect(g, 1, 4, 18, 9, 'g');
        hline(g, 1, 4, 18, 'O');
        vline(g, 1, 4, 9, 'O');
        vline(g, 18, 4, 9, 'O');
        hline(g, 1, 13, 18, 'O');
        vline(g, 6, 4, 9, 'O');
        vline(g, 13, 4, 9, 'O');
        stamp(g, 3, 0, ['....OOOO....', '..OOggggOO..', 'OOggggggggOO']);
        stamp(g, 8, 9, ['Tt', 'tT']);
        return sprite(rows(g), { g: 'rgba(151, 210, 227, 0.75)', O: INK, T: '#86b25c', t: '#d14b3d' }, { scale: 2.7, cls: 'px-building' });
    }

    function lookout() {
        const g = grid(14, 22);
        fillRect(g, 4, 8, 6, 13, 'K');
        vline(g, 4, 8, 13, 'O');
        vline(g, 9, 8, 13, 'O');
        hline(g, 4, 21, 6, 'O');
        stamp(g, 1, 0, [
            'OOOOOOOOOOOO',
            'OwwwwwwwwwwO',
            'OwWWwwwwWWwO',
            'OwwwwwwwwwwO',
            'OOOOOOOOOOOO',
        ]);
        for (let x = 2; x < 12; x += 3) set(g, x, 5, 'O');
        return sprite(rows(g), { K: '#8a6142', O: INK, w: '#c39868', W: { fill: '#fdf3d8', cls: 'px-window' } }, { scale: 2.7, cls: 'px-building' });
    }

    function shore() {
        const g = grid(18, 8);
        stamp(g, 0, 0, [
            '....SSSSSSSSSS....',
            '..SSSSSSSSSSSSSS..',
            '.SSSbbbbbbbbbbSSS.',
            'SSSbbBBBBBBBBbbSSS',
            'SSSbbBBBBBBBBbbSSS',
            '.SSSbbbbbbbbbbSSS.',
            '..SSSSSSSSSSSSSS..',
            '....SSSSSSSSSS....',
        ]);
        return sprite(rows(g), { S: '#f2d491', b: '#5aa7c7', B: '#2f7ea6' }, { scale: 2.6, cls: 'px-building' });
    }

    /* ── Villagers ───────────────────────────────────────────────────── */
    //
    // 12×15 pixel people. Head/tunic cells carry the legacy class names so
    // tint + archetype CSS keeps working (and tests keep passing).

    const VILLAGER_HATS = {
        scribe:   ['....hhhh....', '...hhhhhh...'],
        builder:  ['...GGGGGG...', '..GGGGGGGG..'],
        jester:   ['..M..MM..M..', '..MMMMMMMM..'],
        farmer:   ['...yyyyyy...', '.yyyyyyyyyy.'],
        musician: ['...hhhhhh...', '..hhhhhhhh..'],
        wanderer: ['...uuuuuu...', '..uuuuuuuu..'],
        sheriff:  ['...nnnnnn...', '.nnnnnnnnnn.'],
        banished: ['....hhhh....', '...hhhhhh...'],
    };

    function villager(archetype = 'wanderer') {
        const hat = VILLAGER_HATS[archetype] || VILLAGER_HATS.wanderer;
        const body = [
            hat[0],
            hat[1],
            '...kkkkkk...',
            '...kekkek...',
            '...kkkkkk...',
            '....kkkk....',
            '..TTTTTTTT..',
            '.aTTTTTTTTa.',
            '.aTTTTTTTTa.',
            '.kTTTTTTTTk.',
            '..TTTTTTTT..',
            '...TT..TT...',
            '...LL..LL...',
            '...LL..LL...',
            '...BB..BB...',
        ];
        const palette = {
            h: '#5a3a2a',
            G: '#ffc93c',
            M: '#d14b3d',
            y: '#e5c565',
            u: '#7d94ad',
            n: '#9d7354',
            k: { fill: '#e6b077', cls: 'world__resident-head' },
            e: INK,
            a: { fill: '#e6b077', cls: 'world__resident-head' },
            T: { fill: '#c9a2e0', cls: 'world__resident-tunic' },
            L: '#4a3a5a',
            B: INK,
        };
        return sprite(body, palette, { scale: 2.1, cls: `px-villager px-villager--${archetype}` });
    }

    // Tiny held-item marker beside the villager; keeps the archetype
    // tool classes that residents.css and tests rely on.
    const VILLAGER_TOOLS = {
        builder:  { art: ['GG', 'GG', '.O', '.O'], colors: { G: '#ffc93c', O: '#7b5635' } },
        scribe:   { art: ['WW', 'WW', 'WW'], colors: { W: '#fdf3d8' } },
        jester:   { art: ['M.', '.M', 'M.'], colors: { M: '#d14b3d' } },
        farmer:   { art: ['.T', 'TT', '.O'], colors: { T: '#86b25c', O: '#7b5635' } },
        musician: { art: ['GG', 'G.', 'GG'], colors: { G: '#ffc93c' } },
        wanderer: { art: ['O.', 'O.', 'OO'], colors: { O: '#7b5635' } },
        sheriff:  { art: ['.G', 'GG', '.G'], colors: { G: '#ffc93c' } },
        banished: { art: ['O.', '.O', 'O.'], colors: { O: '#675e63' } },
    };

    function villagerTool(archetype = 'wanderer') {
        const tool = VILLAGER_TOOLS[archetype] || VILLAGER_TOOLS.wanderer;
        return `<g class="world__resident-tool world__resident-tool--${archetype}">${sprite(tool.art, tool.colors, { scale: 2, dx: 15, dy: -8 })}</g>`;
    }

    /* ── Ground decor ────────────────────────────────────────────────── */

    function tree(fruited = false) {
        const art = [
            '..TTTTT..',
            '.TTTTTTT.',
            fruited ? 'TTUTTTUTT' : 'TTTttTTTT',
            '.TTTTTTT.',
            fruited ? '..TUTTT..' : '..TtTTT..',
            '....K....',
            '....K....',
            '....K....',
        ];
        return sprite(art, { T: '#4d8a3c', t: '#66a34c', U: '#d14b3d', K: '#7b5635' }, { scale: 1.6, cls: 'px-decor' });
    }

    function bush() {
        return sprite(['.BBBB.', 'BBbBBB', '.BBBB.'], { B: '#55873a', b: '#6da24a' }, { scale: 1.5, cls: 'px-decor' });
    }

    function tulip(bloom = '#e0708f') {
        return sprite(['A.A', 'A.A', 'S.S', 'S.S'], { A: bloom, S: '#4d7a34' }, { scale: 1.5, cls: 'px-decor' });
    }

    function daisy() {
        return sprite(['.W.', 'WGW', '.W.'], { W: '#fff8e8', G: '#ffc93c' }, { scale: 1.4, cls: 'px-decor' });
    }

    function grassTuft() {
        return sprite(['S.S.S', 'S.S.S'], { S: '#4d7a34' }, { scale: 1.4, cls: 'px-decor' });
    }

    function pebble() {
        return sprite(['pp.P', 'ppPP'], { p: '#8b8578', P: '#a29a8a' }, { scale: 1.4, cls: 'px-decor' });
    }

    /* ── Sky ─────────────────────────────────────────────────────────── */

    function cloud(scaleFactor = 1, storm = false) {
        const art = [
            '....CCCC......',
            '..CCCCCCCC....',
            '.CCCCCCCCCCC..',
            'CCCCCCCCCCCCCC',
        ];
        return sprite(art, { C: storm ? '#4b5878' : '#fff8e8' }, { scale: 3 * scaleFactor, cls: 'px-cloud' });
    }

    function sun() {
        const art = [
            '..G..G..G..',
            '...ggggg...',
            '.Ggggggggg.',
            '..ggGGGgg..',
            'G.ggGGGgg.G',
            '..ggGGGgg..',
            '.Ggggggggg.',
            '...ggggg...',
            '..G..G..G..',
        ];
        return sprite(art, { G: '#ffc93c', g: '#ffdd6b' }, { scale: 2.4, cls: 'px-celestial' });
    }

    function moon() {
        const art = [
            '..mmmm...',
            '.mmmmmm..',
            'mmmm.....',
            'mmm......',
            'mmm......',
            'mmmm.....',
            '.mmmmmm..',
            '..mmmm...',
        ];
        return sprite(art, { m: '#e8ddf0' }, { scale: 2.2, cls: 'px-celestial' });
    }

    /* ── Market item glyphs ──────────────────────────────────────────── */
    //
    // One crisp pixel picture per item family; `accent` recolors the A char
    // so every item stays visually distinct within its family.

    const ITEM_GLYPHS = {
        lantern: [
            '...OO...',
            '..OGGO..',
            '.OGggGO.',
            '.OGggGO.',
            '..OGGO..',
            '...OO...',
            '...OO...',
        ],
        flower: [
            '.A.A.',
            'AAAAA',
            '.AGA.',
            '..S..',
            '.SSS.',
        ],
        banner: [
            'OOOOOOOOO',
            '.A.A.A.A.',
            '.AAAAAAA.',
            '..A.A.A..',
        ],
        shell: [
            '..AAAA..',
            '.AaAaAa.',
            'AaAaAaAa',
            '.AAAAAA.',
        ],
        fountain: [
            '...bb...',
            '..bbbb..',
            '.OBBBBO.',
            '.OBBBBO.',
            'OOOOOOOO',
        ],
        chime: [
            'OOOOOOO',
            '.A.G.A.',
            '.A.G.A.',
            '.A...A.',
        ],
        steps: [
            '.....AA.',
            '...AAAA.',
            '.AAAAAA.',
            'AAAAAAAA',
        ],
        crate: [
            'OOOOOO',
            'OAAAAO',
            'OAOOAO',
            'OAAAAO',
            'OOOOOO',
        ],
        sign: [
            'OOOOOOO',
            'OAAAAAO',
            'OOOOOOO',
            '..OO...',
            '..OO...',
        ],
        dial: [
            '.GGGG.',
            'GGgOgG',
            'GGgOgG',
            'GGggGG',
            '.GGGG.',
        ],
        hat: [
            '..AAAA..',
            '..AAAA..',
            'AAAAAAAA',
        ],
        cloak: [
            '.AAAAA.',
            'AAaAAAA',
            'AAaAAAA',
            'AAaAAAA',
            '.AAAAA.',
        ],
        specs: [
            'OOO.OOO',
            'OWOOOWO',
            'OOO.OOO',
        ],
        accessory: [
            '..GG..',
            '.GggG.',
            'GggggG',
            '.GggG.',
            '..GG..',
        ],
        bag: [
            '.OOOO.',
            'OAAAAO',
            'OAAGAO',
            'OAAAAO',
            '.OOOO.',
        ],
        sunGlyph: [
            'G..G..G',
            '.GGGGG.',
            'GGgggGG',
            '.GGGGG.',
            'G..G..G',
        ],
        cloudGlyph: [
            '..CCCC..',
            '.CCCCCC.',
            'CCCCCCCC',
        ],
        kite: [
            '...A...',
            '..AAA..',
            '.AAAAA.',
            '..AAA..',
            '...A..O',
            '....O..',
        ],
        bell: [
            '..GG..',
            '.GGGG.',
            'GGGGGG',
            'OOOOOO',
            '..OO..',
        ],
        prism: [
            '...A...',
            '..AAA..',
            '.AAAAA.',
            'AAAAAAA',
        ],
        drum: [
            '.OOOO.',
            'OAAAAO',
            'OAAAAO',
            'OOOOOO',
        ],
        vane: [
            '..O.AA',
            '..OAAA',
            '..O...',
            'OOOOO.',
            '..O...',
        ],
        house: [
            '..RRRR..',
            '.RRRRRR.',
            'RRRRRRRR',
            '.wwwwww.',
            '.wWwwWw.',
            '.wwddww.',
        ],
        lighthouseGlyph: [
            '.GGG.',
            '.MMM.',
            '.WWW.',
            '.MMM.',
            '.WWW.',
            'OOOOO',
        ],
        dome: [
            '..GGG..',
            '.GGGGG.',
            'GGGGGGG',
            'wwwwwww',
            'wwWWWww',
        ],
        shelf: [
            'OOOOOO',
            'OAMNAO',
            'OOOOOO',
            'ONAMNO',
            'OOOOOO',
        ],
        bridgeGlyph: [
            'O....O',
            'OAAAAO',
            'AAAAAA',
            'O.AA.O',
        ],
        dockGlyph: [
            'KKKKKKK',
            '.O..O..',
            '.O..O..',
        ],
        treeGlyph: [
            '.TTT.',
            'TTTTT',
            'TATAT',
            '.TTT.',
            '..K..',
            '..K..',
        ],
        spring: [
            '.bbbb.',
            'bBBBBb',
            'bBBBBb',
            '.bbbb.',
        ],
        tower: [
            '.OOO.',
            '.OAO.',
            '.OOO.',
            '.KKK.',
            '.KKK.',
            'KKKKK',
        ],
        buoy: [
            '..A..',
            '.AAA.',
            '.AAA.',
            'bbbbb',
        ],
        cave: [
            '.ppppp.',
            'ppppppp',
            'pp000pp',
            'p00000p',
        ],
        path: [
            'AA......',
            '..AA....',
            '....AA..',
            '......AA',
        ],
        star: [
            '...G...',
            '..GGG..',
            'GGGGGGG',
            '..GGG..',
            '.G...G.',
        ],
    };

    function itemGlyphKind(key, category) {
        const k = String(key || '').toLowerCase();
        const c = String(category || '').toLowerCase();
        if (/star|moon|comet|aurora/.test(k)) return 'star';
        if (/lantern|light|lamp|jar/.test(k) && c !== 'building') return 'lantern';
        if (/flower|herb|planter|garden(?!_lane)/.test(k)) return 'flower';
        if (/bunting|banner|streamer|sash|ribbon|mask|vest/.test(k)) return 'banner';
        if (/shell|pebble|mosaic|reef/.test(k)) return 'shell';
        if (/fountain|birdbath|mist|dew|pool|mirror|spring/.test(k)) return 'fountain';
        if (/chime|bell|whistle/.test(k)) return 'chime';
        if (/steps|mossy|walkway|loop|lane|path/.test(k)) return c === 'map' ? 'path' : 'steps';
        if (/crate|table|cloth|pouch/.test(k)) return 'crate';
        if (/sign|marker|ferry/.test(k)) return 'sign';
        if (/dial|watch|clock/.test(k)) return 'dial';
        if (/hat|cap/.test(k)) return 'hat';
        if (/cloak|cape|hood|scarf|apron|glove|boot/.test(k)) return 'cloak';
        if (/spec/.test(k)) return 'specs';
        if (/badge|pin|polish|charm/.test(k)) return 'accessory';
        if (/bag/.test(k)) return 'bag';
        if (/sun|beam|noon/.test(k)) return 'sunGlyph';
        if (/cloud|fog|seed/.test(k)) return 'cloudGlyph';
        if (/kite|sock|sail/.test(k)) return 'kite';
        if (/prism|rainbow|glass|filter|lens/.test(k)) return 'prism';
        if (/drum|thunder|storm/.test(k)) return 'drum';
        if (/vane|breeze|wind/.test(k)) return 'vane';
        if (/lighthouse/.test(k)) return 'lighthouseGlyph';
        if (/dome|observatory/.test(k)) return 'dome';
        if (/shelf|archive|stack|library/.test(k)) return 'shelf';
        if (/bridge/.test(k)) return 'bridgeGlyph';
        if (/dock|pier/.test(k)) return 'dockGlyph';
        if (/grove|orchard|tree/.test(k)) return 'treeGlyph';
        if (/cove|beach|tidal|marsh/.test(k)) return 'spring';
        if (/tower|overlook|plateau|hill/.test(k)) return 'tower';
        if (/buoy/.test(k)) return 'buoy';
        if (/cave|quarry|nook/.test(k)) return 'cave';
        if (c === 'outfit') return 'hat';
        if (c === 'weather') return 'sunGlyph';
        if (c === 'building') return 'house';
        if (c === 'map') return 'path';
        return 'lantern';
    }

    function itemGlyph(key, category, accent = '#d14b3d', { scale = 5, dx = 0, dy = 0 } = {}) {
        const kind = itemGlyphKind(key, category);
        const art = ITEM_GLYPHS[kind] || ITEM_GLYPHS.lantern;
        const palette = {
            O: INK,
            A: accent,
            a: '#fff8e8',
            G: '#ffc93c',
            g: '#ffdd6b',
            S: '#4d7a34',
            s: '#66a34c',
            T: '#4d8a3c',
            K: '#7b5635',
            W: '#fdf3d8',
            w: '#e8d5a5',
            R: '#c0472f',
            M: '#d14b3d',
            N: '#2f7ea6',
            C: '#fff8e8',
            b: '#5aa7c7',
            B: '#2f7ea6',
            d: '#3d2e4a',
            p: '#8b8578',
            0: INK,
        };
        return sprite(art, palette, { scale, dx, dy, cls: 'px-item' });
    }

    /* ── Market category icons ───────────────────────────────────────── */

    const CATEGORY_ICONS = {
        decor:    ['..G..', '.GgG.', 'GgggG', '.OKO.', '.OKO.'],
        outfit:   ['.kkk.', '.kek.', 'TTTTT', '.TTT.', '.L.L.'],
        weather:  ['G.G.G', '.ggg.', 'Ggggg', '.ggg.', 'G.G.G'],
        building: ['..R..', '.RRR.', 'RRRRR', '.wWw.', '.wdw.'],
        map:      ['OOOOO', 'OA..O', 'O.A.O', 'O..AO', 'OOOOO'],
        other:    ['..G..', '.GGG.', 'GGGGG', '.GGG.', '.G.G.'],
    };

    function categoryIcon(kind) {
        const art = CATEGORY_ICONS[kind] || CATEGORY_ICONS.other;
        const palette = {
            G: '#ffc93c', g: '#ffdd6b', O: INK, K: '#7b5635',
            k: '#e6b077', e: INK, T: '#2f7ea6', L: '#4a3a5a',
            R: '#c0472f', w: '#e8d5a5', W: '#fdf3d8', d: '#3d2e4a',
            A: '#d14b3d',
        };
        return sprite(art, palette, { scale: 9, dx: 32, dy: 61 });
    }

    /* ── Postcard scene ──────────────────────────────────────────────── */

    function postcardScene() {
        const g = grid(44, 28);
        // Sky + sea bands
        fillRect(g, 0, 0, 44, 17, 'S');
        fillRect(g, 0, 17, 44, 11, 'B');
        hline(g, 0, 17, 44, 'b');
        // Sun + clouds + waves
        stamp(g, 35, 2, ['G.G.G', '.ggg.', 'Ggggg', '.ggg.', 'G.G.G']);
        stamp(g, 6, 3, ['..CCC....', '.CCCCCC..', 'CCCCCCCCC']);
        stamp(g, 24, 6, ['.CCC.', 'CCCCC']);
        stamp(g, 4, 20, ['ww.ww.ww']);
        stamp(g, 30, 23, ['ww.ww']);
        // Island
        stamp(g, 12, 13, [
            '......ssssssss......',
            '...ssssssssssssss...',
            '.ssssTTTTTTTTssss...',
            'ssssTTTTTTTTTTssss..',
            'ssssTTTTTTTTTTsssss.',
            '.ssssTTTTTTTTssss...',
            '...ssssssssssss.....',
        ]);
        // House on the island
        stamp(g, 18, 11, [
            '.RRRR.',
            'RRRRRR',
            'kWkkWk',
            'kkddkk',
        ]);
        // Palm
        stamp(g, 27, 10, [
            'T.T.T',
            '.TTT.',
            '..K..',
            '..K..',
        ]);
        return `<svg viewBox="0 0 44 28" role="presentation" shape-rendering="crispEdges" class="px-postcard">${rectsMarkup(rows(g), {
            S: '#a8dcef', B: '#2f7ea6', b: '#5aa7c7', w: 'rgba(255,248,232,0.7)',
            G: '#ffc93c', g: '#ffdd6b', C: '#fff8e8',
            s: '#f2d491', T: '#74a94c',
            R: '#c0472f', k: '#c68d52', W: '#fdf3d8', d: '#3d2e4a',
            K: '#7b5635',
        })}</svg>`;
    }

    /* ── Public API ──────────────────────────────────────────────────── */

    return {
        INK,
        grid, set, fillRect, hline, vline, stamp, rows,
        rectsMarkup, sprite, baseShadow,
        buildings: {
            townHall, registry, market, chronicle,
            charter, ruleBoard, postcards, study,
            genericShop, lighthouse, grove, dock, bridge,
            greenhouse, lookout, shore,
        },
        villager, villagerTool,
        decor: { tree, bush, tulip, daisy, grassTuft, pebble },
        cloud, sun, moon,
        itemGlyph, itemGlyphKind,
        categoryIcon,
        postcardScene,
    };
})();

window.Px = Px;
