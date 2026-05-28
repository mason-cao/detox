#!/bin/bash
set -euo pipefail

VERSION="${1:?version required, e.g. ./preview.sh 0.1.0}"

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "[1/4] py2app preview build"
rm -rf build dist
mkdir -p build
if [ -f sparkle.pub ]; then
  sed "s|__SPARKLE_PUB_KEY__|$(cat sparkle.pub)|g" \
    Info.plist.tmpl > build/Info.plist
else
  echo "warning: sparkle.pub not found; leaving SUPublicEDKey placeholder" >&2
  cp Info.plist.tmpl build/Info.plist
fi
DETOX_INFO_PLIST="build/Info.plist" python3 setup.py py2app

APP="dist/Detox.app"
DMG="dist/Detox-preview-${VERSION}.dmg"
ZIP="dist/Detox-preview-${VERSION}.app.zip"

echo "[2/4] DMG"
hdiutil create -volname "Detox Preview" -srcfolder "$APP" \
  -ov -format UDZO "$DMG"

echo "[3/4] zip"
ditto -c -k --keepParent "$APP" "$ZIP"

echo "[4/4] checksums"
shasum -a 256 "$DMG" "$ZIP"
