#!/bin/bash
set -euo pipefail

VERSION="${1:?version required, e.g. ./preview.sh 0.1.0}"

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

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

echo "[1/4] py2app preview build"
rm -rf build dist
mkdir -p build
render_info_plist
DETOX_INFO_PLIST="build/Info.plist" python3 setup.py py2app

APP="dist/Detox.app"
DMG="dist/Detox-preview-${VERSION}.dmg"
ZIP="dist/Detox-preview-${VERSION}.app.zip"

prune_bundle_dev_artifacts

echo "[2/4] DMG"
hdiutil create -volname "Detox Preview" -srcfolder "$APP" \
  -ov -format UDZO "$DMG"

echo "[3/4] zip"
ditto -c -k --keepParent "$APP" "$ZIP"

echo "[4/4] checksums"
shasum -a 256 "$DMG" "$ZIP"
