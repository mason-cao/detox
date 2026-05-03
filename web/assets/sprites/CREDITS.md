# Sprite credits

Resident sprites in `web/assets/sprites/residents/` are derived from the
Liberated Pixel Cup (LPC) base assets.

**Source:** Universal LPC Spritesheet Character Generator
https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator

**Original LPC base body asset:** `spritesheets/body/bodies/male/light.png`

**Original author:** Stephen "Redshrike" Challener
https://opengameart.org/users/redshrike

**License:** CC-BY-SA 3.0 / GPL 3.0
https://creativecommons.org/licenses/by-sa/3.0/
https://www.gnu.org/licenses/gpl-3.0.html

**Modifications:** Cropped the east-walk row (frames 1–4 of the 9-frame walk
cycle), downscaled from 4×64×64 to a 128×32 atlas, saved one copy per
archetype filename. Per-archetype distinction is rendered via CSS
`hue-rotate` and an SVG accessory glyph layered alongside the sprite at
mount time; the underlying pixel data is identical across archetypes.

| Archetype | Tint hue | Accessory glyph |
|---|---|---|
| Scribe | base | quill (✒) |
| Builder | +30° | hammer (🔨) |
| Jester | +60° | bells (🔔) |
| Banished | desaturated | rowboat (—) |
| Farmer | +120° | straw hat (🌾) |
| Musician | +180° | lute (♪) |
| Wanderer | +220° | cloak (no glyph) |
| Sheriff | +280° | star (★) |

Per CC-BY-SA 3.0 share-alike: any redistribution of these sprite files (or
derivatives) must carry the same license. The Detox project's broader code
remains under its own license; only this asset folder is governed by
CC-BY-SA 3.0 / GPL 3.0.
