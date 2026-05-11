#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

STARTED_MONITOR=0
MONITOR_PID=""

monitor_pid_is_running() {
    [ -f data/monitor.pid ] || return 1
    pid="$(cat data/monitor.pid 2>/dev/null || true)"
    case "$pid" in
        ""|*[!0-9]*) return 1 ;;
    esac
    kill -0 "$pid" 2>/dev/null || return 1
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    case "$cmd" in
        *"agent.monitor"*) return 0 ;;
        *) return 1 ;;
    esac
}

cleanup() {
    status=$?
    trap - EXIT INT TERM
    echo ""
    echo "Shutting down..."
    if [ "$STARTED_MONITOR" = "1" ] && monitor_pid_is_running; then
        kill "$(cat data/monitor.pid)" 2>/dev/null || true
        rm -f data/monitor.pid
        echo "  ✓ Monitor stopped"
    elif [ "$STARTED_MONITOR" = "1" ] && [ -f data/monitor.pid ]; then
        rm -f data/monitor.pid
        echo "  Monitor was not running"
    elif [ -f data/monitor.pid ]; then
        echo "  Monitor was already running; leaving it running"
    fi
    echo "  ✓ Detox stopped. See you next time!"
    exit "$status"
}

trap cleanup EXIT INT TERM

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║       🧘 Detox v1.0             ║"
echo "  ║    Screen Time Tracker           ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# 1. Install dependencies
echo "[1/4] Installing dependencies..."
pip3 install -q flask pillow 2>/dev/null || pip3 install flask pillow
echo "  ✓ Dependencies installed"

# 2. Create data directories
mkdir -p data/cards

# 3. Initialize database
echo "[2/4] Initializing database..."
python3 -c "from agent.database import init_db; init_db()"
echo "  ✓ Database ready"

# 4. Start monitor daemon
echo "[3/4] Starting monitor..."
if [ -f data/monitor.pid ] && ! monitor_pid_is_running; then
    echo "  Removing stale monitor PID file"
    rm -f data/monitor.pid
fi

if monitor_pid_is_running; then
    echo "  ✓ Monitor already running (PID $(cat data/monitor.pid))"
else
    python3 -m agent.monitor > data/monitor.log 2>&1 &
    MONITOR_PID=$!
    STARTED_MONITOR=1
    echo "$MONITOR_PID" > data/monitor.pid
    echo "  ✓ Monitor started (PID $MONITOR_PID)"
fi

# 5. Start web server
echo "[4/4] Starting dashboard server..."
echo ""
echo "  ┌─────────────────────────────────────┐"
echo "  │  Dashboard: http://localhost:5050    │"
echo "  │  Press Ctrl+C to stop               │"
echo "  └─────────────────────────────────────┘"
echo ""
echo "  NOTE: If this is your first run, grant Accessibility"
echo "  permission to Terminal in System Settings >"
echo "  Privacy & Security > Accessibility"
echo ""

# Open browser after a brief delay
(sleep 2 && open http://localhost:5050) &

# Run Flask server (foreground — Ctrl+C stops everything)
python3 -m agent.server
