#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

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

echo "Stopping Detox..."

if [ -f data/monitor.pid ]; then
    if monitor_pid_is_running; then
        kill "$(cat data/monitor.pid)" 2>/dev/null && echo "  ✓ Monitor stopped" || echo "  Monitor was not running"
    else
        echo "  Monitor PID file was stale; leaving unrelated process alone"
    fi
    rm -f data/monitor.pid
fi

SERVER_PIDS="$(lsof -tiTCP:5050 -sTCP:LISTEN 2>/dev/null || true)"
SERVER_STOPPED=0

if [ -n "$SERVER_PIDS" ]; then
    for pid in $SERVER_PIDS; do
        cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
        case "$cmd" in
            *"agent.server"*)
                kill "$pid" 2>/dev/null && SERVER_STOPPED=1
                ;;
            *)
                echo "  Port 5050 is used by PID $pid, but it does not look like Detox; leaving it running"
                ;;
        esac
    done
fi

if [ "$SERVER_STOPPED" = "1" ]; then
    echo "  ✓ Server stopped"
else
    echo "  Server was not running"
fi

echo "Done."
