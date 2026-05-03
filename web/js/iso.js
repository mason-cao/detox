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
};

window.Iso = Iso;
