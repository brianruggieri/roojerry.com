#!/usr/bin/env bash
# scripts/export-teightysix-views.sh: view grid -> showpiece assets.
#
# Reads the originals scripts/capture-teightysix-views.mjs wrote and never
# reads back from static/, so a re-run produces the same bytes.
#
# The centre view is also the showpiece poster: the tile paints it first and
# the parallax starts from it, so there is no jump when the grid takes over.
set -euo pipefail

SRC=${1:-.claude/teightysix-captures/views}
OUT=static/img/projects/teightysix
W=1280 # poster.webp's served width; showpieceTile.html reserves 1280x800

[ -f "$SRC/views.json" ] || { echo "missing $SRC/views.json; run scripts/capture-teightysix-views.mjs first" >&2; exit 1; }
rm -rf "$OUT/views"
mkdir -p "$OUT/views"

for f in "$SRC"/r*c*.png; do
	cwebp -quiet -q 78 -resize "$W" 0 "$f" -o "$OUT/views/$(basename "${f%.png}").webp"
done
cp "$SRC/views.json" "$OUT/views/views.json"

# The centre of the grid: the middle row, the middle column.
cols=$(ls "$OUT"/views/r0c*.webp | wc -l | tr -d ' ')
rows=$(ls "$OUT"/views/r*c0.webp | wc -l | tr -d ' ')
cp "$OUT/views/r$((rows / 2))c$((cols / 2)).webp" "$OUT/poster.webp"

echo "exported $((rows * cols)) views ($(du -ch "$OUT"/views/*.webp | tail -1 | cut -f1)) and the poster into $OUT"
