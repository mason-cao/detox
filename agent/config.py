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

MARKET_CATALOG = [
    {
        "key": "lantern_path",
        "name": "Lantern Path",
        "description": "Soft amber lights along the main road.",
        "currency": "sunlight",
        "price": 30,
        "category": "decor",
    },
    {
        "key": "mayors_hat",
        "name": "Mayor's Hat",
        "description": "A modest tricorn for the resident-in-chief.",
        "currency": "sunlight",
        "price": 60,
        "category": "outfit",
    },
    {
        "key": "sunbeam_charm",
        "name": "Sunbeam Charm",
        "description": "Adds a warm bias to the weather overlay.",
        "currency": "sunlight",
        "price": 90,
        "category": "weather",
    },
    {
        "key": "lighthouse_skin",
        "name": "Lighthouse Skin",
        "description": "Re-skins the harbor lighthouse.",
        "currency": "starshard",
        "price": 2,
        "category": "building",
    },
    {
        "key": "cove_expansion",
        "name": "Dawn Cove Annex",
        "description": "Extends the map with a small annex.",
        "currency": "starshard",
        "price": 5,
        "category": "map",
    },
]

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
