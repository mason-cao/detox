"""Flask web server serving the dashboard API and frontend static files."""

import os
import re
import io
import csv
from functools import wraps
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, send_from_directory

from backend.config import FRONTEND_DIR, SERVER_PORT, CARDS_DIR, PID_FILE
from backend import database as db

app = Flask(__name__, static_folder=None)

DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def api_route(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            date = request.args.get('date')
            if date and not DATE_RE.match(date):
                return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return wrapper


# ── Static file serving ─────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/css/<path:filename>")
def serve_css(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "css"), filename)


@app.route("/js/<path:filename>")
def serve_js(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "js"), filename)


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "assets"), filename)


# ── Dashboard API ────────────────────────────────────────────────────────

@app.route("/api/dashboard")
@api_route
def api_dashboard():
    date = request.args.get("date", datetime.now().strftime("%Y-%m-%d"))
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
    data = db.get_weekly_data(week_start)
    return jsonify(data)


# ── Statistics API ───────────────────────────────────────────────────────

@app.route("/api/stats/daily")
@api_route
def api_stats_daily():
    date = request.args.get("date", datetime.now().strftime("%Y-%m-%d"))
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
    stats = db.get_weekly_stats(week_start)
    return jsonify(stats)


# ── Apps API ─────────────────────────────────────────────────────────────

@app.route("/api/apps")
@api_route
def api_apps():
    apps = db.get_all_apps()
    return jsonify(apps)


@app.route("/api/apps/<app_name>")
@api_route
def api_app_detail(app_name):
    date = request.args.get("date", datetime.now().strftime("%Y-%m-%d"))
    period = request.args.get("period", "week")
    days = 7 if period == "week" else 30

    hourly = db.get_app_usage(app_name, date)
    daily_totals = db.get_app_daily_totals(app_name, days)
    today_total = db.get_app_total_today(app_name)

    return jsonify({
        "app_name": app_name,
        "today_total": today_total,
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
    data = request.json
    goal_id = db.create_goal(
        goal_type=data["type"],
        target_minutes=data.get("target_minutes"),
        app_name=data.get("app_name"),
        bedtime_hour=data.get("bedtime_hour"),
        bedtime_minute=data.get("bedtime_minute"),
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
    data = request.json
    db.add_block(
        app_name=data["app_name"],
        block_type=data.get("block_type", "blocked"),
        daily_limit_minutes=data.get("daily_limit_minutes"),
    )
    return jsonify({"ok": True}), 201


@app.route("/api/blocks/<app_name>", methods=["DELETE"])
@api_route
def api_blocks_delete(app_name):
    db.remove_block(app_name)
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
    data = request.json
    db.set_category(data["app_name"], data["category"])
    return jsonify({"ok": True})


# ── Cards API ────────────────────────────────────────────────────────────

@app.route("/api/cards/generate", methods=["POST"])
@api_route
def api_cards_generate():
    from backend.cards import generate_card

    data = request.json or {}
    date = data.get("date", datetime.now().strftime("%Y-%m-%d"))
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
    settings = db.get_settings()
    return jsonify(settings)


@app.route("/api/settings", methods=["POST"])
@api_route
def api_settings_set():
    data = request.json
    for key, value in data.items():
        db.set_setting(key, value)
    return jsonify({"ok": True})


# ── Status API ───────────────────────────────────────────────────────────

@app.route("/api/status")
@api_route
def api_status():
    monitor_running = False
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE) as f:
                pid = int(f.read().strip())
            os.kill(pid, 0)  # Check if process exists
            monitor_running = True
        except (ProcessLookupError, ValueError, PermissionError):
            pass
    return jsonify({"monitor_running": monitor_running})


# ── Export API ───────────────────────────────────────────────────────

@app.route('/api/export/csv')
@api_route
def export_csv():
    start = request.args.get('start', (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'))
    end = request.args.get('end', datetime.now().strftime('%Y-%m-%d'))
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
    start = request.args.get('start', (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'))
    end = request.args.get('end', datetime.now().strftime('%Y-%m-%d'))
    rows = db.get_export_data(start, end)
    return jsonify({"start": start, "end": end, "data": rows})


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    db.init_db()
    print(f"[Server] Dashboard running at http://localhost:{SERVER_PORT}")
    app.run(host="127.0.0.1", port=SERVER_PORT, debug=False)


if __name__ == "__main__":
    main()
