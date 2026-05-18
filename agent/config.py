import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "screentime.db")
PID_FILE = os.path.join(DATA_DIR, "monitor.pid")
LOG_PATH = os.path.join(DATA_DIR, "monitor.log")
CARDS_DIR = os.path.join(DATA_DIR, "cards")
WEB_DIR = os.path.join(BASE_DIR, "web")

APP_VERSION = "1.0.0"
BUNDLE_IDENTIFIER = "com.detox.agent"
LAUNCH_AGENT_PATH = os.path.expanduser(
    "~/Library/LaunchAgents/com.detox.agent.plist"
)

POLL_INTERVAL = 2  # seconds between active app checks
SERVER_PORT = 5050
STALL_THRESHOLD_SECONDS = 30
SESSION_GAP_THRESHOLD = 5  # seconds gap to consider a new session
DEFAULT_IDLE_TIMEOUT_MINUTES = 5
MAX_IDLE_TIMEOUT_MINUTES = 120

CLOUD_API_BASE = os.environ.get("DETOX_CLOUD_API_BASE", "https://api.detox.app")
CLOUD_PULL_INTERVAL_SECONDS = 30
CLOUD_PUSH_INTERVAL_SECONDS = 300
CLOUD_HTTP_TIMEOUT_SECONDS = 5
CLOUD_INGEST_BATCH_ROWS = 200

DEFAULT_SETTINGS = {
    "idle_timeout_minutes": str(DEFAULT_IDLE_TIMEOUT_MINUTES),
    "whitelist_mode": "0",
    "ghost_mode": "0",
}

DAILY_CAP_SUNLIGHT = 120

def _market_catalog_section(category, rows):
    return [
        {
            "key": key,
            "name": name,
            "description": description,
            "currency": currency,
            "price": price,
            "category": category,
        }
        for key, name, description, currency, price in rows
    ]


MARKET_CATALOG = (
    _market_catalog_section("decor", [
        ("lantern_path", "Lantern Path", "Soft amber lights along the main road.", "sunlight", 30),
        ("harbor_lanterns", "Harbor Lanterns", "A line of dock lights for the south shore.", "sunlight", 45),
        ("market_bunting", "Market Bunting", "Festival flags for the bazaar awning.", "sunlight", 55),
        ("tide_pool_garden", "Tide Pool Garden", "Tiny shell gardens around the sandy edge.", "sunlight", 80),
        ("flower_boxes", "Flower Boxes", "Planters under windows across the village.", "sunlight", 35),
        ("pebble_mosaics", "Pebble Mosaics", "Small stone patterns between grass tiles.", "sunlight", 40),
        ("fountain_tile", "Fountain Tile", "A little blue tile fountain near Town Hall.", "sunlight", 65),
        ("picnic_cloth", "Picnic Cloth", "A checkered blanket for quiet breaks.", "sunlight", 38),
        ("wind_chimes", "Wind Chimes", "Soft chimes for roofs and porches.", "sunlight", 52),
        ("shell_border", "Shell Border", "Shells placed around the island path.", "sunlight", 48),
        ("herb_planters", "Herb Planters", "Sage and mint beds beside the Study.", "sunlight", 58),
        ("village_banners", "Village Banners", "Small house banners for civic days.", "sunlight", 62),
        ("firefly_jars", "Firefly Jars", "Warm evening jars near the paths.", "sunlight", 75),
        ("mossy_steps", "Mossy Steps", "Soft green stones for hillside crossings.", "sunlight", 68),
        ("tea_table", "Tea Table", "A tiny table with cups and biscuits.", "sunlight", 72),
        ("orchard_crates", "Orchard Crates", "Stacked apple crates by the market.", "sunlight", 44),
        ("birdbath", "Birdbath", "A stone birdbath for the central meadow.", "sunlight", 85),
        ("moon_mirror", "Moon Mirror", "A silver pool that glows at night.", "starshard", 1),
        ("painted_signposts", "Painted Signposts", "Color signs for the main paths.", "sunlight", 50),
        ("sun_dial", "Sun Dial", "A brass dial for the Charter lawn.", "sunlight", 95),
    ])
    + _market_catalog_section("outfit", [
        ("mayors_hat", "Mayor's Hat", "A modest tricorn for the resident-in-chief.", "sunlight", 60),
        ("resident_sashes", "Resident Sashes", "Colorful ribbons for your island residents.", "sunlight", 70),
        ("straw_hats", "Straw Hats", "Simple sun hats for field villagers.", "sunlight", 35),
        ("explorer_cloaks", "Explorer Cloaks", "Short cloaks for wandering villagers.", "sunlight", 80),
        ("work_aprons", "Work Aprons", "Canvas aprons for builder residents.", "sunlight", 42),
        ("scholar_specs", "Scholar Specs", "Round glasses for registry scribes.", "sunlight", 55),
        ("rain_capes", "Rain Capes", "Waxed capes for cloudy days.", "sunlight", 64),
        ("festival_masks", "Festival Masks", "Painted masks for market holidays.", "sunlight", 78),
        ("wool_scarves", "Wool Scarves", "Soft scarves in village colors.", "sunlight", 46),
        ("sailor_caps", "Sailor Caps", "Caps for dock and ferry villagers.", "sunlight", 50),
        ("gardening_gloves", "Gardening Gloves", "Gloves for meadow caretakers.", "sunlight", 36),
        ("messenger_bags", "Messenger Bags", "Crossbody satchels for delivery runs.", "sunlight", 58),
        ("music_vests", "Music Vests", "Bright vests for musician residents.", "sunlight", 66),
        ("night_hoods", "Night Hoods", "Quiet hoods for after-dusk villagers.", "sunlight", 76),
        ("brass_badges", "Brass Badges", "Tiny badges for rule keepers.", "sunlight", 88),
        ("ribbon_belts", "Ribbon Belts", "Waist ribbons in category colors.", "sunlight", 40),
        ("boot_polish", "Boot Polish", "Shiny boots for formal island days.", "sunlight", 32),
        ("travel_pouches", "Travel Pouches", "Little belt pouches for routes.", "sunlight", 48),
        ("pocket_watches", "Pocket Watches", "Gold watches for punctual villagers.", "starshard", 1),
        ("star_pins", "Star Pins", "Tiny star pins for streak days.", "starshard", 2),
    ])
    + _market_catalog_section("weather", [
        ("sunbeam_charm", "Sunbeam Charm", "Adds a warm bias to the weather overlay.", "sunlight", 90),
        ("cloud_kite", "Cloud Kite", "A kite that pulls soft clouds east.", "sunlight", 65),
        ("rain_bell", "Rain Bell", "Gentle bells for rainy weather scenes.", "sunlight", 82),
        ("breeze_streamers", "Breeze Streamers", "Small streamers that show wind motion.", "sunlight", 54),
        ("rainbow_prism", "Rainbow Prism", "A glass charm for post-storm color.", "starshard", 2),
        ("fog_lantern", "Fog Lantern", "A lantern glow for misty mornings.", "sunlight", 74),
        ("storm_drums", "Storm Drums", "Deeper thunder accents for storms.", "sunlight", 96),
        ("dew_collectors", "Dew Collectors", "Morning dew bowls for grass tiles.", "sunlight", 58),
        ("aurora_glass", "Aurora Glass", "Night shimmer above the horizon.", "starshard", 3),
        ("tide_whistle", "Tide Whistle", "Adds extra motion to the shoreline.", "sunlight", 84),
        ("noon_chimes", "Noon Chimes", "A bright noon pulse around the sun.", "sunlight", 72),
        ("dusk_filter", "Dusk Filter", "Warmer late-day color on the sky.", "sunlight", 88),
        ("cloud_seeds", "Cloud Seeds", "Puffy cloud clusters for calm days.", "sunlight", 62),
        ("wind_sock", "Wind Sock", "A tiny sock that tracks sea breeze.", "sunlight", 44),
        ("thunder_jars", "Thunder Jars", "Bottled storm flashes for rule breaks.", "starshard", 2),
        ("mist_fountain", "Mist Fountain", "A low mist around the inner shore.", "sunlight", 92),
        ("comet_lens", "Comet Lens", "Rare streaks across the night sky.", "starshard", 4),
        ("moonbeam_charm", "Moonbeam Charm", "A cooler glow for late-night checks.", "starshard", 1),
        ("weather_vane", "Weather Vane", "A brass vane for the main roofline.", "sunlight", 57),
        ("sun_sail", "Sun Sail", "A golden sail that catches clear days.", "starshard", 3),
    ])
    + _market_catalog_section("building", [
        ("lighthouse_skin", "Lighthouse Skin", "Re-skins the harbor lighthouse.", "starshard", 2),
        ("observatory_roof", "Observatory Roof", "A brass dome upgrade for the Chronicle.", "starshard", 3),
        ("market_roof_tiles", "Market Roof Tiles", "Fresh red tiles for the bazaar roof.", "sunlight", 120),
        ("ruleboard_roof_cap", "Rule Board Roof Cap", "A finished timber cap for the rule hut.", "sunlight", 110),
        ("registry_archives", "Registry Archives", "Side shelves for old resident ledgers.", "sunlight", 105),
        ("townhall_bell", "Town Hall Bell", "A little bell above the clock face.", "starshard", 2),
        ("study_lamplight", "Study Lamplight", "A warmer lamp in the Mayor's Study.", "sunlight", 95),
        ("postcard_awning", "Postcard Awning", "A blue awning for the mail desk.", "sunlight", 90),
        ("charter_pillars", "Charter Pillars", "Stone pillars for the Charter entry.", "sunlight", 115),
        ("chronicle_stacks", "Chronicle Stacks", "Extra chimney stacks and book crates.", "sunlight", 130),
        ("bakery_facade", "Bakery Facade", "A pastry storefront for future villagers.", "sunlight", 125),
        ("bathhouse_tiles", "Bathhouse Tiles", "Blue roof tiles for a small bathhouse.", "sunlight", 118),
        ("greenhouse_frame", "Greenhouse Frame", "A glass frame for garden experiments.", "starshard", 3),
        ("workshop_chimney", "Workshop Chimney", "A squat chimney for builder work.", "sunlight", 108),
        ("inn_windowboxes", "Inn Windowboxes", "Flower boxes for a tiny village inn.", "sunlight", 94),
        ("schoolhouse_clock", "Schoolhouse Clock", "A clock face for a future schoolhouse.", "sunlight", 102),
        ("dockmaster_booth", "Dockmaster Booth", "A small booth for ferry arrivals.", "sunlight", 112),
        ("library_balcony", "Library Balcony", "A balcony railing for archive views.", "starshard", 4),
        ("tea_shop_shutters", "Tea Shop Shutters", "Painted shutters for a tea shop.", "sunlight", 98),
        ("apothecary_shelves", "Apothecary Shelves", "Bottle shelves for a future apothecary.", "sunlight", 106),
    ])
    + _market_catalog_section("map", [
        ("cove_expansion", "Dawn Cove Annex", "Extends the map with a small annex.", "starshard", 5),
        ("north_isle_bridge", "North Isle Bridge", "A small arched bridge for future map annexes.", "starshard", 4),
        ("south_dock", "South Dock", "A short dock below the market shore.", "starshard", 2),
        ("west_grove_path", "West Grove Path", "A path through the left-side trees.", "sunlight", 125),
        ("east_overlook", "East Overlook", "A lookout point above the water.", "starshard", 3),
        ("orchard_corner", "Orchard Corner", "Adds a fruit grove at the meadow edge.", "sunlight", 135),
        ("hidden_spring", "Hidden Spring", "A quiet spring behind the Charter.", "starshard", 4),
        ("shell_beach", "Shell Beach", "A shell-strewn strip along the sand.", "sunlight", 118),
        ("watchtower_hill", "Watchtower Hill", "Raises a small lookout hill.", "starshard", 5),
        ("ferry_marker", "Ferry Marker", "A buoy marking the ferry approach.", "sunlight", 90),
        ("tidal_steps", "Tidal Steps", "Stone steps down into the tide.", "sunlight", 96),
        ("cave_gate", "Cave Gate", "A sealed cave mouth for later quests.", "starshard", 5),
        ("marsh_walkway", "Marsh Walkway", "A wood walkway over wet grass.", "sunlight", 128),
        ("lighthouse_point", "Lighthouse Point", "A point marker for the lighthouse.", "starshard", 3),
        ("meadow_loop", "Meadow Loop", "A loop trail for villager routes.", "sunlight", 116),
        ("quarry_nook", "Quarry Nook", "A tiny stone quarry near the edge.", "sunlight", 140),
        ("garden_lane", "Garden Lane", "A lane lined with hedges and flowers.", "sunlight", 122),
        ("stargaze_plateau", "Stargaze Plateau", "A raised place for night sky rewards.", "starshard", 4),
        ("fishing_pier", "Fishing Pier", "A small pier for the lower-left water.", "sunlight", 132),
        ("reef_marker", "Reef Marker", "A marker buoy beyond the sandy shallows.", "sunlight", 86),
    ])
)

CHANGELOG_ENTRIES = [
    {
        "date": "2026-04-28",
        "title": "Market and rewards ledger",
        "body": "The Market now supports earned Sunlight, Starshards, inventory, refunds, and Hall of Honor awards.",
    },
    {
        "date": "2026-04-18",
        "title": "Rule Board and Mayor's Study",
        "body": "Blocker controls and settings moved into the Detox Isle visual system.",
    },
    {
        "date": "2026-04-17",
        "title": "Detox Isle foundation",
        "body": "The local dashboard gained the HUD, bottom ribbon, pixel tokens, and isometric Isle home.",
    },
]

DEFAULT_CATEGORIES = {
    "Safari": "Productivity",
    "Google Chrome": "Productivity",
    "Firefox": "Productivity",
    "Mail": "Communication",
    "Messages": "Communication",
    "Slack": "Communication",
    "Discord": "Communication",
    "Signal": "Communication",
    "Telegram": "Communication",
    "WhatsApp": "Communication",
    "Microsoft Teams": "Communication",
    "Zoom": "Communication",
    "FaceTime": "Communication",
    "Instagram": "Social",
    "Twitter": "Social",
    "Facebook": "Social",
    "TikTok": "Social",
    "Reddit": "Social",
    "Snapchat": "Social",
    "YouTube": "Entertainment",
    "Netflix": "Entertainment",
    "Spotify": "Entertainment",
    "Music": "Entertainment",
    "TV": "Entertainment",
    "Podcasts": "Entertainment",
    "Twitch": "Entertainment",
    "Photos": "Entertainment",
    "Terminal": "Productivity",
    "iTerm2": "Productivity",
    "Code": "Productivity",
    "Visual Studio Code": "Productivity",
    "Xcode": "Productivity",
    "Sublime Text": "Productivity",
    "Notes": "Productivity",
    "Reminders": "Productivity",
    "Calendar": "Productivity",
    "Pages": "Productivity",
    "Numbers": "Productivity",
    "Keynote": "Productivity",
    "Microsoft Word": "Productivity",
    "Microsoft Excel": "Productivity",
    "Microsoft PowerPoint": "Productivity",
    "Notion": "Productivity",
    "Obsidian": "Productivity",
    "Finder": "Utilities",
    "System Preferences": "Utilities",
    "System Settings": "Utilities",
    "Activity Monitor": "Utilities",
    "App Store": "Utilities",
    "Preview": "Utilities",
    "Calculator": "Utilities",
    "TextEdit": "Utilities",
}

CATEGORY_COLORS = {
    "Productivity": "#6366f1",
    "Communication": "#8b5cf6",
    "Social": "#ec4899",
    "Entertainment": "#f59e0b",
    "Utilities": "#6b7280",
    "Uncategorized": "#94a3b8",
}

FOCUS_MODE_RECOVERY_APPS = {
    "Activity Monitor",
    "Finder",
    "System Preferences",
    "System Settings",
    "Terminal",
    "iTerm2",
}

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CARDS_DIR, exist_ok=True)
