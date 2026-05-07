#!/usr/bin/env sh
# Run the agent pairing CLI against the deployed Railway api.
#
# Source of truth for the URL is the script — edit it here when the
# Railway domain changes. Sets DETOX_CLOUD_API_BASE for one shot so
# this doesn't permanently leak into the user's shell rc.

set -eu

CLOUD_BASE="${DETOX_CLOUD_API_BASE:-https://api-production-ab65.up.railway.app}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"
DETOX_CLOUD_API_BASE="$CLOUD_BASE" python3 -m agent.cli.pair
