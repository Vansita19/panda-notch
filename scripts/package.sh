#!/bin/zsh
set -eu
cd "$(dirname "$0")/.."
APP="${PANDA_APP_PATH:-../Panda.app}"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/Web"
cp -R licenses "$APP/Contents/Resources/"
cp THIRD-PARTY-NOTICES.md "$APP/Contents/Resources/"
cp native/Info.plist "$APP/Contents/Info.plist"
cp dist/index.html dist/app.js dist/app.css "$APP/Contents/Resources/Web/"
cp -R dist/audio "$APP/Contents/Resources/Web/"
cp -R dist/menu "$APP/Contents/Resources/Web/"
if [ -f native/Panda.icns ]; then cp native/Panda.icns "$APP/Contents/Resources/"; fi
swiftc -O -target arm64-apple-macos14.0 -module-cache-path /private/tmp/panda-swift-module-cache -framework AppKit -framework WebKit -framework Carbon -framework ServiceManagement -framework EventKit native/main.swift native/CalendarReader.swift native/TextCapture.swift native/NowPlaying.swift native/CampaignBridge.swift -o "$APP/Contents/MacOS/Panda"
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"
echo "Built Panda.app"
