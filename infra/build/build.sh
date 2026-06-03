#!/bin/bash
set -euo pipefail

VERSION="${1:?version required, e.g. ./build.sh 1.0.0}"
DEVELOPER_ID="${DEVELOPER_ID:-Developer ID Application: Mason Cao (TEAMID)}"
KEYCHAIN_PROFILE="${KEYCHAIN_PROFILE:-detox-notary}"

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

require_codesign_identity() {
  if ! security find-identity -v -p codesigning | grep -F "$DEVELOPER_ID" >/dev/null; then
    cat >&2 <<EOF
error: codesign identity not found: $DEVELOPER_ID

Install the Apple Developer ID Application certificate in this keychain, or run:
  DEVELOPER_ID="Developer ID Application: Name (TEAMID)" ./build.sh $VERSION
EOF
    exit 2
  fi
}

prune_bundle_dev_artifacts() {
  rm -rf "$APP/Contents/Resources/lib/python3.11/agent/tests"
}

release_build_number() {
  local raw="${VERSION//./}"
  local trimmed="${raw#"${raw%%[!0]*}"}"
  if [ -z "$trimmed" ]; then
    trimmed=0
  fi
  printf "%s" "$trimmed"
}

render_info_plist() {
  local build_number="${BUILD_NUMBER:-$(release_build_number)}"
  local sparkle_key="__SPARKLE_PUB_KEY__"
  if [ -f sparkle.pub ]; then
    sparkle_key="$(cat sparkle.pub)"
  else
    echo "warning: sparkle.pub not found; leaving SUPublicEDKey placeholder" >&2
  fi
  sed \
    -e "s|__VERSION__|$VERSION|g" \
    -e "s|__BUILD__|$build_number|g" \
    -e "s|__SPARKLE_PUB_KEY__|$sparkle_key|g" \
    Info.plist.tmpl > build/Info.plist
}

echo "[1/6] py2app build"
rm -rf build dist
mkdir -p build
render_info_plist
DETOX_INCLUDE_SPARKLE=1 DETOX_INFO_PLIST="build/Info.plist" python3 setup.py py2app

APP="dist/Detox.app"
DMG="dist/Detox-${VERSION}.dmg"

prune_bundle_dev_artifacts

echo "[2/6] codesign (hardened runtime)"
require_codesign_identity
codesign --deep --force --options runtime \
  --entitlements entitlements.plist \
  --sign "$DEVELOPER_ID" "$APP"

echo "[3/6] notarize"
KEYCHAIN_PROFILE="$KEYCHAIN_PROFILE" ./notarize.sh "$APP"

echo "[5/6] DMG"
hdiutil create -volname "Detox" -srcfolder "$APP" \
  -ov -format UDZO "$DMG"
codesign --sign "$DEVELOPER_ID" "$DMG"

echo "[6/6] verify"
spctl --assess --type execute -vv "$APP"
shasum -a 256 "$DMG"
