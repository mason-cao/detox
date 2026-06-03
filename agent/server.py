"""Flask web server serving the dashboard API and web static files."""

import os
import re
import io
import csv
import time
import subprocess
from functools import wraps
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, send_from_directory

from agent.config import (
    CARDS_DIR,
    CHANGELOG_ENTRIES,
    DEFAULT_SETTINGS,
    DOCS_DIR,
    WEB_DIR,
    MAX_IDLE_TIMEOUT_MINUTES,
    PID_FILE,
    SERVER_PORT,
)
from agent import database as db

app = Flask(__name__, static_folder=None)

DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_monitor_status_provider = None


class ApiError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def set_monitor_status_provider(provider):
    """Override PID-file status for in-process monitor owners."""
    global _monitor_status_provider
    _monitor_status_provider = provider


def _pid_command(pid):
    try:
        result = subprocess.run(
            ["ps", "-p", str(pid), "-o", "command="],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def _pid_file_monitor_running():
    if not os.path.exists(PID_FILE):
        return False
    try:
        with open(PID_FILE) as f:
            pid = int(f.read().strip())
        os.kill(pid, 0)
    except (ProcessLookupError, ValueError, PermissionError, OSError):
        return False
    return "agent.monitor" in _pid_command(pid)


def validate_date(value, field_name="date"):
    if not isinstance(value, str) or not DATE_RE.match(value):
        raise ApiError(f"Invalid {field_name} format. Use YYYY-MM-DD")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise ApiError(f"Invalid {field_name}. Use a real calendar date")
    return value


def get_date_arg(field_name, default):
    return validate_date(request.args.get(field_name, default), field_name)


def get_json_object(required=True):
    data = request.get_json(silent=True)
    if data is None:
        if required:
            raise ApiError("Expected a JSON object")
        return {}
    if not isinstance(data, dict):
        raise ApiError("Expected a JSON object")
    return data


def require_text(data, field_name):
    value = data.get(field_name)
    if not isinstance(value, str) or not value.strip():
        raise ApiError(f"Missing or invalid field: {field_name}")
    return value.strip()


def optional_positive_int(data, field_name):
    value = data.get(field_name)
    if value is None:
        return None
    try:
        value = int(value)
    except (TypeError, ValueError):
        raise ApiError(f"{field_name} must be a positive integer")
    if value <= 0:
        raise ApiError(f"{field_name} must be a positive integer")
    return value


def normalize_setting(key, value):
    if key == "idle_timeout_minutes":
        try:
            minutes = int(value)
        except (TypeError, ValueError):
            raise ApiError("idle_timeout_minutes must be a number")
        if minutes < 0 or minutes > MAX_IDLE_TIMEOUT_MINUTES:
            raise ApiError(
                f"idle_timeout_minutes must be between 0 and {MAX_IDLE_TIMEOUT_MINUTES}"
            )
        return str(minutes)

    if key == "whitelist_mode":
        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "on", "yes"}:
            return "1"
        if normalized in {"0", "false", "off", "no"}:
            return "0"
        raise ApiError("whitelist_mode must be enabled or disabled")

    if key == "ghost_mode":
        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "on", "yes"}:
            return "1"
        if normalized in {"0", "false", "off", "no"}:
            return "0"
        raise ApiError("ghost_mode must be enabled or disabled")

    return value


def get_frontmost_app_name():
    try:
        result = subprocess.run(
            [
                "osascript",
                "-e",
                'tell application "System Events" to get name of first process whose frontmost is true',
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (subprocess.TimeoutExpired, OSError):
        return None
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return None


def get_installed_app_names():
    app_dirs = [
        "/Applications",
        os.path.expanduser("~/Applications"),
        "/System/Applications",
        "/System/Applications/Utilities",
    ]
    names = set()
    for app_dir in app_dirs:
        if not os.path.isdir(app_dir):
            continue
        try:
            entries = os.listdir(app_dir)
        except OSError:
            continue
        for entry in entries:
            if entry.endswith(".app"):
                names.add(entry[:-4])
    return sorted(names, key=str.casefold)


def api_route(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            for field_name in ("date", "week_start", "start", "end"):
                value = request.args.get(field_name)
                if value is not None:
                    validate_date(value, field_name)
            if request.path.startswith("/api/"):
                db.run_rollup_if_needed()
            return f(*args, **kwargs)
        except ApiError as e:
            return jsonify({"error": e.message}), e.status_code
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return wrapper


# ── Static file serving ─────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(WEB_DIR, "index.html")


@app.route("/sign-in.html")
def sign_in_page():
    return send_from_directory(WEB_DIR, "sign-in.html")


@app.route("/pair.html")
def pair_page():
    return send_from_directory(WEB_DIR, "pair.html")


@app.route("/api/config")
@api_route
def api_config():
    """Bootstrap config for the web client.

    Cloudflare Pages injects these via build-time env. Locally Flask is the
    only origin, so the dashboard reads the same shape from here. Empty
    strings mean "no cloud configured" — the web client falls back to the
    same-origin Flask routes.
    """
    return jsonify({
        "supabase_url": os.environ.get("DETOX_SUPABASE_URL", ""),
        "supabase_anon_key": os.environ.get("DETOX_SUPABASE_ANON_KEY", ""),
        "api_base": os.environ.get("DETOX_API_BASE", ""),
    })


@app.route("/config.js")
def config_js():
    """Same shape as /api/config but as a <script>-friendly JS file.

    Production parity: Cloudflare Pages writes web/config.js at deploy
    time via infra/cloudflare/build.sh. In dev there's no static file —
    Flask renders one from the same env vars so the HTML can include a
    plain ``<script src="/config.js"></script>`` tag in both worlds.
    """
    body = (
        "/* Local dev — values from env. */\n"
        f'window.DETOX_SUPABASE_URL = {_js_string("DETOX_SUPABASE_URL")};\n'
        f'window.DETOX_SUPABASE_ANON_KEY = {_js_string("DETOX_SUPABASE_ANON_KEY")};\n'
        f'window.DETOX_API_BASE = {_js_string("DETOX_API_BASE")};\n'
    )
    return body, 200, {"Content-Type": "application/javascript; charset=utf-8"}


def _js_string(env_key):
    raw = os.environ.get(env_key, "") or ""
    safe = raw.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "")
    return f'"{safe}"'


@app.route("/css/<path:filename>")
def serve_css(filename):
    return send_from_directory(os.path.join(WEB_DIR, "css"), filename)


@app.route("/js/<path:filename>")
def serve_js(filename):
    return send_from_directory(os.path.join(WEB_DIR, "js"), filename)


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory(os.path.join(WEB_DIR, "assets"), filename)


@app.route("/docs/<path:filename>")
def serve_docs(filename):
    """Serve the in-repo policy markdown so the Mayor's Study can link to it.

    Browsers render .md as plaintext, which is good enough for the privacy
    policy and TOS — no build step, no extra dependency. Restricted to
    .md files to keep this from accidentally exposing arbitrary repo paths.
    """
    if not filename.endswith(".md") or "/" in filename or ".." in filename:
        return ("", 404)
    return send_from_directory(
        DOCS_DIR,
        filename,
        mimetype="text/markdown; charset=utf-8",
    )


# ── Dashboard API ────────────────────────────────────────────────────────

@app.route("/api/dashboard")
@api_route
def api_dashboard():
    date = get_date_arg("date", datetime.now().strftime("%Y-%m-%d"))
    apps = db.get_daily_usage(date)
    hourly = db.get_hourly_breakdown(date)
    categories = db.get_category_breakdown(date)
    total = db.get_daily_total(date)
    goals = db.get_goals()

    goal_target = None
    for g in goals:
        if g["type"] == "daily_total":
            goal_target = g["target_minutes"]
            break

    return jsonify({
        "date": date,
        "total_minutes": total,
        "apps": apps,
        "hourly": hourly,
        "categories": categories,
        "goal_target": goal_target,
    })


@app.route("/api/dashboard/weekly")
@api_route
def api_dashboard_weekly():
    week_start = request.args.get("week_start")
    if not week_start:
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        week_start = monday.strftime("%Y-%m-%d")
    else:
        week_start = validate_date(week_start, "week_start")
    data = db.get_weekly_data(week_start)
    return jsonify(data)


_NOW_CACHE = {"value": None, "fetched_at": 0.0}
_NOW_CACHE_TTL_SECONDS = 2.0


@app.route("/api/dashboard/now")
@api_route
def api_dashboard_now():
    now = time.time()
    if now - _NOW_CACHE["fetched_at"] > _NOW_CACHE_TTL_SECONDS:
        row = db.latest_usage_row()
        _NOW_CACHE["value"] = {
            "app_name": row["app_name"] if row else None,
            "since_unix": int(row["timestamp"]) if row else None,
        }
        _NOW_CACHE["fetched_at"] = now
    return jsonify(_NOW_CACHE["value"])


# ── Help API ────────────────────────────────────────────────────────────

@app.route("/api/changelog")
@api_route
def api_changelog():
    return jsonify(CHANGELOG_ENTRIES)


# ── Statistics API ───────────────────────────────────────────────────────

@app.route("/api/stats/daily")
@api_route
def api_stats_daily():
    date = get_date_arg("date", datetime.now().strftime("%Y-%m-%d"))
    stats = db.get_daily_stats(date)
    return jsonify(stats)


@app.route("/api/stats/weekly")
@api_route
def api_stats_weekly():
    week_start = request.args.get("week_start")
    if not week_start:
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        week_start = monday.strftime("%Y-%m-%d")
    else:
        week_start = validate_date(week_start, "week_start")
    stats = db.get_weekly_stats(week_start)
    return jsonify(stats)


# ── Apps API ─────────────────────────────────────────────────────────────

@app.route("/api/apps")
@api_route
def api_apps():
    apps = db.get_all_apps()
    return jsonify(apps)


@app.route("/api/app-suggestions")
@api_route
def api_app_suggestions():
    names = {app["app_name"] for app in db.get_all_apps()}
    names.update(c["app_name"] for c in db.get_categories())
    names.update(
        g["app_name"]
        for g in db.get_goals()
        if g.get("app_name")
    )
    names.update(
        b["app_name"]
        for b in db.get_blocks()
    )
    names.update(get_installed_app_names())
    frontmost = get_frontmost_app_name()
    if frontmost:
        names.add(frontmost)
    return jsonify(sorted(names, key=str.casefold))


@app.route("/api/apps/<app_name>")
@api_route
def api_app_detail(app_name):
    date = get_date_arg("date", datetime.now().strftime("%Y-%m-%d"))
    period = request.args.get("period", "week")
    if period not in {"week", "month"}:
        raise ApiError("Invalid period. Use week or month")
    days = 7 if period == "week" else 30

    hourly = db.get_app_usage(app_name, date)
    daily_totals = db.get_app_daily_totals(app_name, days, end_date=date)
    selected_total = db.get_app_total(app_name, date)

    return jsonify({
        "app_name": app_name,
        "date": date,
        "selected_total": selected_total,
        "hourly": hourly,
        "daily_totals": daily_totals,
    })


# ── Goals API ────────────────────────────────────────────────────────────

@app.route("/api/goals", methods=["GET"])
@api_route
def api_goals_get():
    goals = db.get_goals()
    return jsonify(goals)


@app.route("/api/goals", methods=["POST"])
@api_route
def api_goals_create():
    data = get_json_object()
    goal_type = data.get("type")
    if goal_type not in {"daily_total", "app_limit", "bedtime"}:
        raise ApiError("Invalid goal type")

    target_minutes = optional_positive_int(data, "target_minutes")
    app_name = data.get("app_name")
    bedtime_hour = data.get("bedtime_hour")
    bedtime_minute = data.get("bedtime_minute")

    if goal_type in {"daily_total", "app_limit"} and target_minutes is None:
        raise ApiError("target_minutes is required")
    if goal_type == "app_limit":
        app_name = require_text(data, "app_name")
    if goal_type == "bedtime":
        try:
            bedtime_hour = int(bedtime_hour)
            bedtime_minute = int(bedtime_minute or 0)
        except (TypeError, ValueError):
            raise ApiError("Invalid bedtime")
        if not (0 <= bedtime_hour <= 23 and 0 <= bedtime_minute <= 59):
            raise ApiError("Invalid bedtime")

    goal_id = db.create_goal(
        goal_type=goal_type,
        target_minutes=target_minutes,
        app_name=app_name,
        bedtime_hour=bedtime_hour,
        bedtime_minute=bedtime_minute,
    )
    return jsonify({"id": goal_id}), 201


@app.route("/api/goals/<int:goal_id>", methods=["DELETE"])
@api_route
def api_goals_delete(goal_id):
    db.delete_goal(goal_id)
    return jsonify({"ok": True})


# ── Blocks API ───────────────────────────────────────────────────────────

@app.route("/api/blocks", methods=["GET"])
@api_route
def api_blocks_get():
    blocks = db.get_blocks()
    return jsonify(blocks)


@app.route("/api/blocks", methods=["POST"])
@api_route
def api_blocks_create():
    data = get_json_object()
    app_name = require_text(data, "app_name")
    block_type = data.get("block_type", "blocked")
    if block_type not in {"blocked", "whitelisted"}:
        raise ApiError("Invalid block_type")
    daily_limit_minutes = optional_positive_int(data, "daily_limit_minutes")
    db.add_block(
        app_name=app_name,
        block_type=block_type,
        daily_limit_minutes=daily_limit_minutes,
    )
    return jsonify({"ok": True}), 201


@app.route("/api/blocks/<app_name>", methods=["DELETE"])
@api_route
def api_blocks_delete(app_name):
    db.remove_block(app_name)
    return jsonify({"ok": True})


# ── Category Blocks API ─────────────────────────────────────────────────

@app.route("/api/category-blocks", methods=["GET"])
@api_route
def api_category_blocks_get():
    return jsonify(db.get_category_blocks())


@app.route("/api/category-blocks", methods=["POST"])
@api_route
def api_category_blocks_create():
    data = get_json_object()
    category_name = require_text(data, "category_name")
    db.add_category_block(category_name)
    return jsonify({"ok": True}), 201


@app.route("/api/category-blocks/<category_name>", methods=["DELETE"])
@api_route
def api_category_blocks_delete(category_name):
    db.remove_category_block(category_name)
    return jsonify({"ok": True})


# ── Categories API ───────────────────────────────────────────────────────

@app.route("/api/categories", methods=["GET"])
@api_route
def api_categories_get():
    categories = db.get_categories()
    return jsonify(categories)


@app.route("/api/categories", methods=["POST"])
@api_route
def api_categories_set():
    data = get_json_object()
    app_name = require_text(data, "app_name")
    category = require_text(data, "category")
    db.set_category(app_name, category)
    return jsonify({"ok": True})


# ── Rewards and Market API ──────────────────────────────────────────────

@app.route("/api/rewards/balance")
@api_route
def api_rewards_balance():
    return jsonify(db.get_rewards_balance())


@app.route("/api/rewards/awards")
@api_route
def api_rewards_awards():
    return jsonify(db.get_rewards_awards())


@app.route("/api/market/catalog")
@api_route
def api_market_catalog():
    return jsonify(db.get_market_catalog())


@app.route("/api/market/inventory")
@api_route
def api_market_inventory():
    return jsonify(db.get_market_inventory())


@app.route("/api/market/buy", methods=["POST"])
@api_route
def api_market_buy():
    data = get_json_object()
    item_key = require_text(data, "item_key")
    try:
        balance = db.buy_market_item(item_key)
    except db.RewardError as e:
        raise ApiError(e.code)
    return jsonify({"ok": True, "balance": balance})


@app.route("/api/market/refund", methods=["POST"])
@api_route
def api_market_refund():
    data = get_json_object()
    try:
        spend_id = int(data.get("spend_id"))
    except (TypeError, ValueError):
        raise ApiError("unknown_spend")
    if spend_id <= 0:
        raise ApiError("unknown_spend")

    try:
        result = db.refund_market_item(spend_id)
    except db.RewardError as e:
        raise ApiError(e.code)
    return jsonify({"ok": True, **result})


# ── Cards API ────────────────────────────────────────────────────────────

@app.route("/api/cards/generate", methods=["POST"])
@api_route
def api_cards_generate():
    from agent.cards import generate_card

    data = get_json_object(required=False)
    date = validate_date(data.get("date", datetime.now().strftime("%Y-%m-%d")))
    filename = generate_card(date)
    return jsonify({"filename": filename, "url": f"/api/cards/{filename}"})


@app.route("/api/cards/<filename>")
@api_route
def api_cards_serve(filename):
    return send_from_directory(CARDS_DIR, filename)


# ── Settings API ─────────────────────────────────────────────────────────

@app.route("/api/settings", methods=["GET"])
@api_route
def api_settings_get():
    settings = {**DEFAULT_SETTINGS, **db.get_settings()}
    return jsonify(settings)


@app.route("/api/settings", methods=["POST"])
@api_route
def api_settings_set():
    data = get_json_object()
    for key, value in data.items():
        db.set_setting(key, normalize_setting(key, value))
    return jsonify({"ok": True})


@app.route("/api/focus-mode/enable", methods=["POST"])
@api_route
def api_focus_mode_enable():
    allowed_app = get_frontmost_app_name()
    if allowed_app:
        db.add_block(allowed_app, block_type="whitelisted")
    db.set_setting("whitelist_mode", "1")
    return jsonify({"ok": True, "allowed_app": allowed_app})


@app.route("/api/focus-mode/disable", methods=["POST"])
@api_route
def api_focus_mode_disable():
    db.set_setting("whitelist_mode", "0")
    return jsonify({"ok": True})


# ── Status API ───────────────────────────────────────────────────────────

@app.route("/api/status")
@api_route
def api_status():
    if _monitor_status_provider is not None:
        try:
            monitor_running = bool(_monitor_status_provider())
        except Exception:
            monitor_running = False
    else:
        monitor_running = _pid_file_monitor_running()
    return jsonify({"monitor_running": monitor_running})


# ── Export API ───────────────────────────────────────────────────────

@app.route('/api/export/csv')
@api_route
def export_csv():
    start = get_date_arg('start', (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'))
    end = get_date_arg('end', datetime.now().strftime('%Y-%m-%d'))
    if start > end:
        raise ApiError("start must be before or equal to end")
    rows = db.get_export_data(start, end)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=['date', 'app_name', 'minutes'])
    writer.writeheader()
    writer.writerows(rows)

    return output.getvalue(), 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': f'attachment; filename=detox-export-{start}-to-{end}.csv'
    }


@app.route('/api/export/json')
@api_route
def export_json():
    start = get_date_arg('start', (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'))
    end = get_date_arg('end', datetime.now().strftime('%Y-%m-%d'))
    if start > end:
        raise ApiError("start must be before or equal to end")
    rows = db.get_export_data(start, end)
    return jsonify({"start": start, "end": end, "data": rows})


@app.route('/api/export/full')
@api_route
def export_full():
    """Download every user-owned row in the local DB as a single JSON dump."""
    payload = db.export_all()
    payload["exported_at"] = datetime.now().isoformat(timespec="seconds")
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return jsonify(payload), 200, {
        'Content-Disposition': f'attachment; filename=detox-full-export-{timestamp}.json'
    }


@app.route('/api/data/delete', methods=['POST'])
@api_route
def delete_all_data():
    """Wipe local data after an explicit ``confirmation: "DELETE"`` token.

    The token is a deliberate friction step so a stray POST can't nuke
    months of data. The UI surfaces it as a typed-confirmation modal.
    """
    data = get_json_object()
    if data.get("confirmation") != "DELETE":
        raise ApiError("Type DELETE in confirmation to proceed")
    db.delete_all_data()
    return jsonify({"ok": True})


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    db.init_db()
    print(f"[Server] Dashboard running at http://localhost:{SERVER_PORT}")
    app.run(host="127.0.0.1", port=SERVER_PORT, debug=False)


if __name__ == "__main__":
    main()
