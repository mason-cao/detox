# Detox Isle — Immersive Redesign (Phase 1e/1f/1g)

Date: 2026-05-02
Status: Draft — pending plan files
Owner: Mason Cao
Supersedes: portions of `docs/specs/2026-04-17-detox-redesign-design.md` §3.1, §4

2026-05-17 launch amendment: the walking sprite direction is retired.
Residents are now programmatic SVG markers with eased requestAnimationFrame
movement and frontmost glow. No sprite atlas or low-frame-rate walk cycle
should ship in the main Isle. The compact compass remains available on
the Isle while clickable buildings stay the primary navigation surface.
Monitor refreshes must update Isle data in place instead of tearing down
and remounting the world.

## 1. Summary

Phase 1a–1d landed the Detox Isle reskin: tokens, HUD, ribbon nav, parchment cards, a Market and a local rewards ledger. The implementation is functional but the world feels static. The Isle is a CSS grid of emoji-in-boxes labeled "isometric" but rendered top-down. The celestial body steps in 4-second linear hops. The bottom ribbon and the buildings double-encode navigation and neither feels diegetic. The seven sub-tabs are reskinned forms with no signature interaction. The result reads as a screen-time tracker with a pixel-art skin, not as a place.

This phase replaces the Isle's rendering substrate with a real SVG isometric world, makes the world a live mirror of current behavior (the frontmost app's resident glows in real time), retires the bottom ribbon in favor of clickable buildings + a small compass HUD, and gives each non-Isle tab one signature animation tied to its primary action.

The work splits into three plans (1e Foundation, 1f Living world, 1g Tab polish) sized to mirror the 1a/1b/1c/1d cadence. No bundler is introduced; vanilla HTML/CSS/JS holds.

## 2. Goals & non-goals

**Goals:**
- Replace the CSS-grid Isle with a single SVG canvas using true iso projection. Buildings, residents, weather all share one coordinate system.
- Make the world react to the live agent — the frontmost app's resident has a visible glow and "working" state, not just historical totals.
- Retire the bottom ribbon. Navigation happens by clicking buildings on the Isle, plus a small compass HUD that prevents sub-tabs from feeling stranded. Keyboard `1`–`8` is preserved.
- Give each of the seven non-Isle tabs one signature animation tied to its primary action, so the whole app feels built rather than styled.
- Stay vanilla. No bundler, no Node, no framework (per `CLAUDE.md`).
- Honor `prefers-reduced-motion` for every new motion.

**Non-goals:**
- Canvas/PixiJS rewrite.
- Daily NPC schedules (wake / lunch / sleep loops).
- Audio / sound packs.
- Sprite-atlas resident art or walking NPC loops.
- Full "interior room" sub-tabs that camera-pan into Town Hall.
- Backend rewrites in 1e or 1g. 1f adds a single new endpoint.

## 3. What changes, conceptually

The Isle becomes a place, not a grid. Eight buildings sit at fixed coordinates on an isometric tile field. Residents are quiet markers assigned an archetype style based on their app's category. They glide through small open-ground routes instead of running on sprite frames. The frontmost application's marker has a glowing aura and rises above the other markers. At night, the world dims and lanterns above each building glow.

Navigation is the world. Clicking a building deep-links to the section it represents. A small compass card on the Isle lists the eight destinations when needed, while sub-tabs keep their own uncluttered page controls. The bottom ribbon disappears. Keyboard `1`–`8` continues to work as a power-user shortcut.

The seven sub-tabs keep their current data and routes. What changes is one signature interaction per tab: chalk write/erase on the Rule Board, parchment page-turn on the Registry, wax seal stamps on the Charter, coin float on Market, postcard slide on Postcards, and so on. Each is a small CSS keyframe + JS hook; nothing structural moves.

## 4. Architecture

### 4.1 SVG world layering

One `<svg>` element with five top-level `<g>` groups, painted in order:

```
<g id="sky">       gradient rect, stars, celestial body (real-time arc)
<g id="weather">   clouds, rain, sunbeams (above sky, below world)
<g id="ground">    iso diamond tile grid, painted once on render
<g id="buildings"> 8 buildings at fixed iso coords
<g id="residents"> N eased resident markers with frontmost glow
<g id="effects">   currency floats, glow auras, dust particles
```

HUD overlays (date bar, weather badge, signboards) stay as absolutely-positioned HTML on top of the SVG. The `?` help button and compass HUD also stay as HTML.

### 4.2 Module split

`web/js/isle.js` shrinks to orchestration. New modules under `web/js/`:

- `iso.js` — projection helpers. `tileToScreen(tx, ty) → {x, y}`, `screenToTile(x, y) → {tx, ty}`, plus tile-grid constants (tile width / height, world tile bounds).
- `world.js` — SVG scaffold, layer mounting, ground-tile painting, building placement, sky / celestial / day-night logic (refactored from `isle.js`).
- `buildings.js` — programmatic SVG generators, one function per building (`townHall`, `registry`, `market`, `charter`, `ruleBoard`, `chronicle`, `postcards`, `study`).
- `residents.js` — programmatic resident markers, eased route movement, archetype assignment, frontmost-glow binding.
- `effects.js` — reusable visual primitives (wax seal, chalk dust burst, currency float, glow halo).
- `compass.js` — compass HUD: 8 destinations, current-room highlight, click to teleport, collapsible at <760 px.

Existing modules unchanged in 1e: `app.js`, `apps.js`, `blocker.js`, `cards.js`, `dashboard.js`, `goals.js`, `market.js`, `settings.js`, `stats.js`. (`hud.js` loses its bottom-ribbon code; the rest stays.)

### 4.3 Coordinate system

Iso tile size: 64×32 pixels (2:1 aspect, classic). World fits 12×8 tiles. Buildings occupy 1×1 (minor) or 2×2 (major) tile footprints; the four major buildings (Town Hall, Registry, Market, Chronicle) get 2×2 to anchor the camera, the other four (Charter, Rule Board, Postcards, Study) get 1×1. Residents have a `tile` property (`{tx, ty}`) plus a `progress` field for in-tile interpolation.

`iso.js#tileToScreen` returns the centerpoint of a tile in SVG-space pixels. World origin sits at the SVG's horizontal center, with `y=0` at the top of the world group.

### 4.4 Backend touchpoint

Phase 1e and 1g are frontend-only. Phase 1f adds exactly one endpoint:

```
GET /api/dashboard/now  →  { app_name: str|null, since_unix: int|null }
```

Implementation: read the latest row from `usage_log` ordered by timestamp. Cache the result in `agent/server.py` module memory; on incoming requests, refresh the cache lazily when its age exceeds 2 s. Polled every 3 s by `residents.js`. No schema change, no monitor change.

## 5. Sprite system

### 5.1 Residents - programmatic markers

Residents are SVG markers generated in `residents.js`. They do not use
PNG atlases or frame-based walk cycles. Each marker has an eased open-ground
route, category-colored ring, app initials, app name, optional minutes label
on hover/focus, and a frontmost glow when the live agent reports that app.

Eight archetypes; each tracked app maps to one based on its category in `agent/config.py`:

| Archetype | Category source | Visual cue |
|---|---|---|
| Scribe | productivity, dev tools | quill, glasses |
| Builder | dev tools (heavy use) | hard-hat, hammer |
| Jester | entertainment, social | bells, bright color |
| Banished | full-blocked apps | muted grey marker |
| Farmer | utilities | straw hat |
| Musician | media, music | lute |
| Wanderer | uncategorized | plain cloak |
| Sheriff | enforcement (not an app) | star badge, lantern |

Per-app uniqueness comes from initials plus a `--tint` custom property
seeded from a hash of the app name. Same archetype, different marker
tone.

### 5.2 Buildings — programmatic SVG

Eight building functions in `web/js/buildings.js`, returning SVG strings. Each is roughly 60 lines of `<rect>` + `<polygon>` for walls, roof, door, windows. Drawn at fixed pixel sizes (~64×80 for major buildings, ~48×60 for minor). Colors come from Dawn Cove tokens. Doors are separate `<rect>`s so they can swing open on click.

### 5.3 Asset budget and licensing

No resident art assets are required for the Isle. Programmatic SVG keeps
the launch surface smaller and avoids sprite-license churn.

## 6. Motion & live binding

### 6.1 Motion catalogue

| Motion | Trigger | Owner | Reduced-motion fallback |
|---|---|---|---|
| Sky gradient | Real time, every 60 s | `world.js#updateSky` | Static painted snapshot at noon |
| Celestial arc | Real time | `world.js` | Static at current phase, no transition |
| Cloud drift / rain / sunbeam | Continuous CSS keyframes | `weather.css` | All `animation: none`, single decorative cloud |
| Resident marker glide | Continuous RAF route movement | `residents.js` | No route movement |
| Resident marker lift | Hover/focus/frontmost state | CSS transform only | No transform |
| Chimney smoke / water drift / twinkle | Continuous CSS keyframes | `isle.css` | All `animation: none` |
| Frontmost glow | `/api/dashboard/now` poll, 3 s | `residents.js#applyFrontmost` | Static halo, no pulse |
| Currency earn float | `+1 ☀` rises 24 px from the active marker, fades | `effects.js` | HUD counter flashes once, no float |
| Day/night light pass | Real time, every 60 s | `world.js#updateSky` | Snap to current phase |
| Building lantern glow | Ramps with sky darkness | `world.js` | Snap on/off at dusk |

### 6.2 Frontmost glow (marquee feature)

The frontmost-app binding is the single highest-leverage change in this redesign — it makes the Isle a live mirror of behavior, not a daily report card.

Flow:
1. Frontend polls `GET /api/dashboard/now` every 3 s.
2. `residents.js#applyFrontmost(app_name)` finds the matching resident marker.
3. Apply: soft yellow halo (`<circle>` with blur filter, opacity 0.45 → 0.15 pulse, 1.4 s loop) and `data-active="true"` attribute. The active marker rises visually through layer order.
4. When frontmost changes, the previous resident's glow fades over 600 ms; the new one's halo fades in.
5. If frontmost is null (no app focused), all glows fade over 600 ms.

### 6.3 Smooth marker routes

Each visible app gets one stable open-ground route. The list is top-eight
by daily usage from `/api/dashboard`, and the set only remounts when that
top-eight signature changes. Normal monitor refreshes update labels and
weather in place so the Isle does not flash or reset.

### 6.4 Performance

Target: under 3 % idle CPU on a 2020 M1 with the Isle visible. SVG with ~30 animating elements is well within budget. Frontmost poll is one DB row plus a 2 s server-side cache, so well under 1 ms per request. Reduced-motion path drops the SVG animation count to roughly 5.

## 7. Navigation amendment

### 7.1 Bottom ribbon retired

Master spec §4 lists the ribbon as primary nav. This redesign retires it. Navigation surfaces are now:

1. **Clickable buildings on the Isle.** Hover lifts the building 2 px and shows a name label + currency cost (if locked). Click teleports to the section.
2. **Compass HUD.** Pinned top-right under the `?` button. Lists the 8 destinations, highlights current room, click to teleport. Width 84 px on desktop. Collapses to a single icon at viewport <760 px, expanding on tap.
3. **Keyboard `1`–`8`.** Migrated from `hud.js` to `app.js`. Behaviour unchanged.

### 7.2 Returning to the Isle

From any sub-tab, the compass HUD's "Isle" entry teleports back. Sub-tabs also gain a small "back to Isle" door icon in their header — diegetic exit, equivalent to the Esc key.

### 7.3 First-run hint

Spec §4.2's town-crier first-visit tooltip system is reused: on a user's first visit to the redesigned Isle, a one-line bubble explains "click any building to enter; the compass keeps track of where you've been."

## 8. Per-tab signature animations

| Tab | Primary action | Signature animation | Implementation |
|---|---|---|---|
| Registry | Filter / sort | Parchment page-turn between filter views | CSS 3D `rotateY` on the list container, 400 ms |
| Chronicle | Open a date | Quill draws each bar in the chart | Chart.js `animation` config + a quill SVG riding the y-axis |
| Charter | Save a goal | Wax seal stamps onto the scroll | `effects.js#waxSeal`, transform: scale(0) → scale(1) + slight rotate, 300 ms |
| Rule Board | Add / remove a block | Chalk write on add (letter-by-letter + dust particles), chalk-erase swipe on remove | `@keyframes typewriter` + 12-particle SVG burst from `effects.js#chalkDust` |
| Market | Buy an item | Coin clink + item floats to inventory icon | `effects.js#currencyFloat` from item card to top-right HUD over 500 ms |
| Postcards | Generate a card | Postcard slides out + stamp slams down | `transform: translateY` with cubic-bezier overshoot + `effects.js#waxSeal` reused |
| Study | Export / privacy action | Study controls animate as filing-cabinet actions | Existing settings actions stay in the Study without a theme switch |

**Reused primitives.** `effects.js` exposes `waxSeal`, `chalkDust`, `currencyFloat`, `glowHalo`. Each is called from multiple tabs, written once. Wax seal is reused by Charter and Postcards; chalk dust by Rule Board and any future "law passed" event; currency float by Market and the live-earn token from §6.1.

**Reduced motion.** Each animation has a no-motion equivalent: page-turn becomes fade, quill becomes static, wax seal pops in without rotation, chalk text appears whole, coin teleports, and postcard fades. All gated on `prefers-reduced-motion: reduce`.

**Sound is out of scope.** "Thunk" and "clink" descriptors above describe character, not committed audio.

## 9. Phase split

Three plans, three branches, three PRs. Each is independently shippable.

### 9.1 Plan 1e — Foundation (~3 days)

**Goal:** Replace the rendering substrate without changing what the user sees do. The Isle still shows the same residents and weather; it's drawn in SVG and navigation is diegetic.

Suggested commits:
- `refactor(isle): extract iso projection + world renderer into svg modules`
- `feat(nav): compass HUD + clickable buildings; retire bottom ribbon`
- `feat(buildings): programmatic SVG for the 8 nav buildings`
- `docs: amend spec §4 — buildings + compass replace bottom ribbon`

### 9.2 Plan 1f — Living world (~1.5 weeks)

**Goal:** Isle feels alive without sprite-sheet walking residents. Programmatic markers move smoothly while the frontmost app glows in real time.

Suggested commits:
- `feat(residents): smooth SVG markers + 8 archetypes mapped from category`
- `fix(isle): refresh live data without remounting the world`
- `feat(api): GET /api/dashboard/now for live frontmost binding`
- `feat(isle): frontmost resident glows in real time`
- `feat(world): day/night light pass + building lantern glow`
- `feat(a11y): reduced-motion fallbacks for all isle animations`

### 9.3 Plan 1g — Tab polish (~1 week)

**Goal:** Each non-Isle tab gets its signature animation. Whole app feels coherent.

Suggested commits:
- `feat(registry): parchment page-turn between filter views`
- `feat(chronicle): quill draws bar chart on render`
- `feat(charter): wax seal stamp on goal save`
- `feat(rules): chalk write/erase + dust particles`
- `feat(market): coin clink + item-to-HUD float`
- `feat(postcards): postcard slide-out + stamp slam`
- `feat(study): filing-cabinet export interactions`

**Total surface across the three plans:** ~600 new LOC, ~400 modified, no `requirements.txt` change, no schema change, no Python deps added.

## 10. Risks

1. **Programmatic residents look too abstract.** Markers can become too symbolic if they never feel embodied. Mitigation: keep the marker style but give each app a slow eased route, minute label, hover/focus lift, and frontmost glow.
2. **Iso projection on small viewports.** SVG world targets 720×400 minimum. Below that, buildings overlap. Mitigation: a `max-width: 1200px` container and "scroll to pan" mechanic at <760 px width. Verify at 360 px during 1e.
3. **3 s frontmost poll cost.** ~1200 requests/hour to the local Flask server. Mitigation: cache the latest frontmost in `agent/server.py` module memory, refresh from the existing 2 s monitor heartbeat. The poll reads cache, not DB. Confirm during 1f.
4. **Walking sprites distract from data.** Resolved for launch by removing walking sprites entirely. Resident markers move through slow eased routes; frontmost glow and hover/focus lift remain readable.
5. **Bottom ribbon retirement breaks muscle memory.** Mitigation: first-run town-crier bubble explains the new nav; compass HUD is always visible; keyboard `1`–`8` still works.

## 11. Spec amendments

Apply to `docs/specs/2026-04-17-detox-redesign-design.md`:

- **§3.1 — Core game loop.** Add: "The frontmost application's resident marker glows in real time. Background residents are smoothly moving app markers, not sprite-sheet walkers."
- **§4 — Information architecture.** Replace "Bottom ribbon — a persistent pixel-art bulletin board with 8 tiles" with: "Compass HUD — small pinned card top-right listing the 8 destinations, highlights current room, collapses on mobile. Keyboard `1`–`8` retained. Bottom ribbon retired."
- **§4.1 — Persistent HUD.** Add "Compass card" to the list. Drop the ribbon mention.

These amendments commit as part of plan 1e under `docs: amend spec §4 — buildings + compass replace bottom ribbon`.

## 12. Open questions (deferred to plan-writing time)

- Exact CC0 pack — chosen during plan 1f day 1.
- Walk-path waypoints per archetype — authored in plan 1f, not specced to coordinates here.
- Sheriff visibility — leaning idle-visible, walks during enforcement. Confirm during plan 1f.
- Mobile compass UX — single-icon vs collapsible card. Designed during plan 1e.
