import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "screentime.db")
PID_FILE = os.path.join(DATA_DIR, "monitor.pid")
CARDS_DIR = os.path.join(DATA_DIR, "cards")
WEB_DIR = os.path.join(BASE_DIR, "web")

POLL_INTERVAL = 2  # seconds between active app checks
SERVER_PORT = 5050
SESSION_GAP_THRESHOLD = 5  # seconds gap to consider a new session
DEFAULT_IDLE_TIMEOUT_MINUTES = 5
MAX_IDLE_TIMEOUT_MINUTES = 120

DEFAULT_SETTINGS = {
    "idle_timeout_minutes": str(DEFAULT_IDLE_TIMEOUT_MINUTES),
    "whitelist_mode": "0",
}

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
