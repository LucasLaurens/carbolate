#!/usr/bin/env bash
# Rebuilds store-assets/ from a real render of the built panel.
# Needs Google Chrome (override its path with CHROME=...) and python3 with Pillow.
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PORT=5274
RENDERS="$(mktemp -d)"

npm run -s build
CSS="$(cd dist && ls assets/*.css)"
for lang in fr en; do
  sed "s#CSSFILE#$CSS#; s#LANG#$lang#g" scripts/store-shot.template.html > "dist/store-shot-$lang.html"
done

python3 -m http.server "$PORT" --directory dist >/dev/null 2>&1 &
SERVER=$!
# The seeded pages must never ship: they leave dist/ whatever happens.
trap '{ kill "$SERVER"; wait "$SERVER"; } 2>/dev/null || true; rm -f dist/store-shot-*.html; rm -rf "$RENDERS"' EXIT
sleep 1

# 500px wide: headless Chrome clamps narrower windows, and the crop offsets in
# compose-store-assets.py are measured at this width and 2x.
for lang in fr en; do
  "$CHROME" --headless=new --force-device-scale-factor=2 --window-size=500,1200 \
    --virtual-time-budget=6000 --hide-scrollbars \
    --screenshot="$RENDERS/panel-$lang.png" "http://localhost:$PORT/store-shot-$lang.html" 2>/dev/null
done

python3 scripts/compose-store-assets.py "$RENDERS"
