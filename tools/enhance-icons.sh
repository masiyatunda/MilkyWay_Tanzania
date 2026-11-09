#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT
convert milkyway/brand/milkyway-emblem.png -trim +repage -modulate 105,140,100 -sigmoidal-contrast 3x45% -unsharp 0x0.65+0.7+0.01 -resize 720x720 "$temporary/emblem.png"
convert -size 1024x1024 radial-gradient:'#123456-#030a20' "$temporary/background.png"
convert "$temporary/background.png" "$temporary/emblem.png" -gravity center -compose over -composite milkyway/icon-square-source.png
for size in 128 180 192 512; do
  convert milkyway/icon-square-source.png -filter Lanczos -resize "${size}x${size}" -unsharp 0x0.4+0.45+0.01 -depth 8 -strip "milkyway/icon-${size}.png"
done
for size in 192 512; do
  convert milkyway/icon-square-source.png -filter Lanczos -resize "${size}x${size}" -depth 8 -strip "milkyway/icon-maskable-${size}.png"
done
convert milkyway/brand/milkyway-emblem.png -modulate 105,140,100 -resize 96x96 -unsharp 0x0.5+0.7+0.01 milkyway/brand/milkyway-emblem-96.png
for size in 16 32; do
  convert milkyway/icon-square-source.png -filter Lanczos -resize "${size}x${size}" -unsharp 0x0.5+0.6+0.01 "milkyway/brand/favicon-${size}.png"
done
convert milkyway/icon-square-source.png -define icon:auto-resize=64,48,32,16 milkyway/favicon.ico
