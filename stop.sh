#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "Stopping Detox..."

if [ -f data/monitor.pid ]; then
    kill "$(cat data/monitor.pid)" 2>/dev/null && echo "  ✓ Monitor stopped" || echo "  Monitor was not running"
    rm -f data/monitor.pid
fi

# Kill Flask server if running on port 5050
lsof -ti:5050 | xargs kill 2>/dev/null && echo "  ✓ Server stopped" || echo "  Server was not running"

echo "Done."
