/* Residents — sprite-atlas walk + frontmost-glow binding.
   Foundation: archetype assignment from app category. */

const Residents = {
    // Eight archetypes, each backed by a 128×32 PNG atlas under
    // web/assets/sprites/residents/. Order is the enumeration order
    // used when no app maps to a given archetype.
    archetypes: ['scribe', 'builder', 'jester', 'banished', 'farmer', 'musician', 'wanderer', 'sheriff'],

    // Map an app's category (from agent/config.py) to an archetype.
    // Categories that don't appear here fall through to 'wanderer'.
    archetypeFor(category) {
        const map = {
            productivity: 'scribe',
            'dev tools': 'builder',
            development: 'builder',
            entertainment: 'jester',
            social: 'jester',
            utilities: 'farmer',
            media: 'musician',
            music: 'musician',
            enforcement: 'sheriff',
        };
        return map[(category || '').toLowerCase()] || 'wanderer';
    },

    // Hash an app name to a stable 0-359 hue rotation for per-app uniqueness.
    // Two apps in the same archetype get distinguishable shirt tints.
    tintFor(appName) {
        let h = 0;
        for (let i = 0; i < appName.length; i++) {
            h = ((h << 5) - h + appName.charCodeAt(i)) | 0;
        }
        return Math.abs(h) % 360;
    },

    // Build the resident objects from /api/dashboard's `apps` array.
    // Residents are stable per app_name across renders so frontmost-binding
    // can target a known DOM node.
    build(apps) {
        if (!apps || !apps.length) return [];
        return apps.slice(0, 8).map(app => ({
            appName: app.app_name,
            archetype: this.archetypeFor(app.category),
            tint: this.tintFor(app.app_name),
            tile: { tx: 0, ty: 0 },     // assigned by walk-path init in Task 5
            progress: 0,                 // 0-1 within the current path leg
            frame: 0,                    // 0-3 walk-cycle frame
            isFrontmost: false,
        }));
    },
};

window.Residents = Residents;
