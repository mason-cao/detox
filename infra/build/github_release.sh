#!/bin/bash
set -euo pipefail

VERSION="${1:?version required, e.g. ./github_release.sh 0.1.0}"

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

prune_bundle_dev_artifacts() {
  rm -rf "$APP/Contents/Resources/lib/python3.11/agent/tests"
}

adhoc_sign_bundle() {
  codesign --force --deep --sign - "$APP"
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

echo "[1/6] py2app GitHub release build"
rm -rf build dist
mkdir -p build
render_info_plist
DETOX_INCLUDE_SPARKLE=0 DETOX_INFO_PLIST="build/Info.plist" python3 setup.py py2app

APP="dist/Detox.app"
DMG="dist/Detox-${VERSION}.dmg"
ZIP="dist/Detox-${VERSION}.app.zip"

prune_bundle_dev_artifacts

echo "[2/6] ad-hoc sign"
adhoc_sign_bundle

echo "[3/6] verify bundle seal"
codesign --verify --deep --strict --verbose=2 "$APP"

echo "[4/6] DMG"
hdiutil create -volname "Detox" -srcfolder "$APP" \
  -ov -format UDZO "$DMG"

echo "[5/6] zip"
ditto -c -k --keepParent "$APP" "$ZIP"

echo "[6/6] checksums"
shasum -a 256 "$DMG" "$ZIP"
