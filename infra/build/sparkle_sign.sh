#!/bin/bash
set -euo pipefail

DMG="${1:?path to .dmg required}"
PRIV_KEY="${SPARKLE_PRIV_KEY:?Set SPARKLE_PRIV_KEY to private key path}"
DIR="$(cd "$(dirname "$0")" && pwd)"

SIGN_TOOL=""
for candidate in \
  "$DIR/bin/sign_update" \
  "$DIR/Sparkle.framework/Resources/sign_update" \
  "$DIR/Sparkle.framework/Versions/Current/Resources/sign_update"; do
  if [ -x "$candidate" ]; then
    SIGN_TOOL="$candidate"
    break
  fi
done

if [ -z "$SIGN_TOOL" ]; then
  echo "error: Sparkle sign_update tool not found" >&2
  exit 2
fi

"$SIGN_TOOL" --ed-key-file "$PRIV_KEY" "$DMG"
