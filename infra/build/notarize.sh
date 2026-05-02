#!/bin/bash
set -euo pipefail

APP="${1:-dist/Detox.app}"
KEYCHAIN_PROFILE="${KEYCHAIN_PROFILE:-detox-notary}"

if [ ! -d "$APP" ]; then
  echo "error: app bundle not found: $APP" >&2
  exit 2
fi

ZIP="${APP}.zip"

echo "[3/6] create notarization archive"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"

echo "[3/6] submit to notarytool"
xcrun notarytool submit "$ZIP" \
  --keychain-profile "$KEYCHAIN_PROFILE" --wait

echo "[4/6] staple"
xcrun stapler staple "$APP"
