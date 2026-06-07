# Phase 1f - Living World Final Implementation Notes

> **Final-state note:** The original Phase 1f direction used external resident
> image atlases. That approach was superseded on 2026-05-17 by
> `docs/specs/2026-05-02-phase-1efg-immersive-redesign-design.md`.
> The shipped implementation uses programmatic inline SVG villagers, eased
> `requestAnimationFrame` movement, and no external resident image dependency.

## Goal

Make the Isle feel alive without introducing a bitmap asset pipeline:

- Render app-linked villagers inside `#worldResidents`.
- Give each villager a category-matched role silhouette, color tint, tool, and
  readable app label.
- Move villagers along short authored tile paths with eased motion.
- Highlight the resident tied to the current frontmost app.
- Keep all motion disabled or softened under `prefers-reduced-motion`.

## Shipped Architecture

- `web/js/residents.js` owns app-to-archetype mapping, resident SVG rendering,
  walking paths, ticker lifecycle, and frontmost-app highlighting.
- `web/css/residents.css` owns villager shape styling, directional transforms,
  glow effects, and reduced-motion behavior.
- `web/js/isle.js` mounts residents after the island and buildings render.
- `web/js/market.js` renders market item and section art as generated inline
  SVGs, so the market stays visually coherent with the Dawn Cove island.
- `agent/server.py` exposes `GET /api/dashboard/now` with a short in-memory
  cache for frontmost-app polling.
- `agent/database.py` exposes `latest_usage_row()` for the dashboard-now route.

## Visual Rules

- Villagers must be inline SVG anatomy, not image tags.
- Each role needs a recognizable body detail:
  - `scribe`: cap, glasses, quill-like tool.
  - `builder`: helmet, hammer-like tool.
  - `jester`: bright headwear and playful tunic.
  - `farmer`: brimmed hat and simple field-tool shape.
  - `musician`: instrument-like prop.
  - `sheriff`: badge/lantern language.
  - `banished`: muted palette and lowered presence.
  - `wanderer`: neutral cloak.
- Movement should interpolate tile positions smoothly. Avoid low-frame walk
  stepping that reads as a mismatched imported game asset.
- Market category icons and item previews must use the same hand-drawn SVG
  vocabulary as residents and buildings.
- The island, houses, market, overlays, and focus-mode chrome should use Dawn
  Cove tokens (`--dc-*`) and pixel-border treatment instead of generic app
  dashboard styling.

## Runtime Behavior

- Mounting is idempotent. Re-rendering the dashboard should replace residents
  cleanly and rebuild `_state`.
- The ticker starts on dashboard entry and stops when leaving the Isle.
- Frontmost polling should not hammer SQLite. The backend cache target is two
  seconds, and the frontend poll target is about three seconds.
- Clicking a resident opens the apps tab.
- Resident names must use escaped app names in both text and attributes.
- No external resident or market bitmap paths should be required for a clean
  local launch.

## Verification

Required checks for this feature area:

```bash
python3 -m pytest agent/tests api/tests -q
node web/tests/app-symbols.test.cjs
node web/tests/island-state.test.cjs
node web/tests/market-preview.test.cjs
node web/tests/residents-render.test.cjs
node web/tests/view-polish.test.cjs
python3 -m compileall -q agent api
find web/js -name '*.js' -exec node --check {} \;
```

Manual smoke targets:

- Dashboard renders without console errors.
- All primary tabs render their expected shell.
- Desktop dashboard has buildings, residents, and no horizontal overflow.
- Mobile dashboard shows the compact HUD, visible island, residents, and no
  horizontal overflow.
- Residents are SVG-only and contain no image-backed villager nodes.
- Market shelf art is generated SVG-only and contains no image-backed glyphs.

## Regression Guards

- `web/tests/residents-render.test.cjs` asserts resident rendering uses inline
  SVG body parts and no image-backed villager nodes.
- `web/tests/market-preview.test.cjs` asserts market previews use generated SVG
  scenes.
- `agent/tests/test_shell_scripts.py` includes static guards for retired asset
  paths and focus-mode theme drift.

## Deferred Work

- More distinct per-building villager interactions.
- Daily schedules.
- Per-tab signature animations.
- Audio.
- A synthetic always-visible sheriff resident if product direction needs it.
