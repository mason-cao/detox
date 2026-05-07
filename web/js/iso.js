/* Iso projection helpers. Pure functions. No DOM. */

const Iso = {
    TILE_W: 64,
    TILE_H: 32,
    WORLD_TX: 12,
    WORLD_TY: 8,

    // World pixel size — derived from tile counts. The SVG viewBox uses these.
    worldW() {
        return (this.WORLD_TX + this.WORLD_TY) * (this.TILE_W / 2);
    },
    worldH() {
        return (this.WORLD_TX + this.WORLD_TY) * (this.TILE_H / 2);
    },

    // Tile (tx, ty) → screen (x, y) within the SVG viewBox. Origin is at the
    // top-center of the world; (0, 0) tile sits at screen (worldW/2, 0).
    tileToScreen(tx, ty) {
        const x = (tx - ty) * (this.TILE_W / 2) + this.worldW() / 2;
        const y = (tx + ty) * (this.TILE_H / 2);
        return { x, y };
    },

    // Inverse — handy for click-to-tile, but unused in 1e (kept for 1f path math).
    screenToTile(x, y) {
        const dx = x - this.worldW() / 2;
        const tx = (dx / (this.TILE_W / 2) + y / (this.TILE_H / 2)) / 2;
        const ty = (y / (this.TILE_H / 2) - dx / (this.TILE_W / 2)) / 2;
        return { tx, ty };
    },

    // Diamond polygon points for a single iso tile centered at (cx, cy).
    // Used for ground tiles. Returns a string for SVG `points=""`.
    tileDiamond(cx, cy) {
        const hw = this.TILE_W / 2;
        const hh = this.TILE_H / 2;
        return `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
    },

    // Bottom-right shadow wedge of a tile — the southeast edge band that
    // fakes elevation. A thin diamond strip running from south corner to
    // east corner, offset upward by `inset` from the bottom edge.
    tileShadowWedge(cx, cy, inset = 4) {
        const hw = this.TILE_W / 2;
        const hh = this.TILE_H / 2;
        const k = inset / hh;
        const sx = cx;
        const sy = cy + hh;
        const ex = cx + hw;
        const ey = cy;
        // Inset points pulled toward the tile center.
        const isx = cx;
        const isy = cy + hh - inset;
        const iex = cx + hw - (inset / hh) * hw;
        const iey = cy;
        void k; // kept above for clarity if we ever lerp differently
        return `${sx},${sy} ${ex},${ey} ${iex},${iey} ${isx},${isy}`;
    },

    // Deterministic 0..1 pseudo-random for a (tx, ty) tile. Cheap LCG.
    // Stable across renders so decoration placement doesn't jitter.
    tileHash(tx, ty, salt = 0) {
        let h = (tx * 73856093) ^ (ty * 19349663) ^ (salt * 83492791);
        h = (h ^ (h >>> 13)) * 1274126177;
        h = (h ^ (h >>> 16)) >>> 0;
        return h / 0xffffffff;
    },
};

window.Iso = Iso;
