#!/usr/bin/env bash
# scripts/export-teightysix-views.sh: view grid -> showpiece assets.
#
#   scripts/export-teightysix-views.sh [SRC]
#
# SRC holds r{row}c{col}.png at 1600x1000 plus views.json, as written by the
# teightysix capture suite, which owns the card (club, colours, photo), the
# production-build hook and the determinism. From a teightysix checkout:
#
#   npm run capture:showpiece -- --out ~/git/roojerry/.claude/teightysix-captures/showpiece
#
# (see that repo's tools/capture-showpiece.mjs). Nothing is read back from
# static/, so a re-run on the same originals produces the same bytes.
#
# Only the part of the frame that moves ships per view. The bench's editor
# panel and header are DOM and sit still while the camera orbits, so the crop
# is the bounding box of everything that differs between the grid's extreme
# views, found from the pixels rather than hard-coded: when the bench layout
# changes, the crop follows. The poster (the full centre view) supplies the
# rest of the picture underneath.
set -euo pipefail

SRC=${1:-.claude/teightysix-captures/showpiece}
OUT=static/img/projects/teightysix
W=1280   # the poster's width; showpieceTile.html reserves 1280x800
FW=1120  # each view's width per full frame. The tile is ~740 css px wide, and
         # 65 views at 1280 q76 were ~5 MB; this is ~3 MB with no visible loss
         # while the picture is moving
PAD=12   # source px around the moving region, so a blur edge never clips
Q=66

[ -f "$SRC/views.json" ] || { echo "missing $SRC/views.json" >&2; exit 1; }

rows=$(ls "$SRC"/r*c0.png | wc -l | tr -d ' ')
cols=$(ls "$SRC"/r0c*.png | wc -l | tr -d ' ')
[ "$(ls "$SRC"/r*c*.png | wc -l | tr -d ' ')" -eq $((rows * cols)) ] || { echo "incomplete ${cols}x${rows} grid in $SRC" >&2; exit 1; }
read -r sw sh < <(magick identify -format "%w %h\n" "$SRC/r0c0.png")
lr=$((rows - 1)); lc=$((cols - 1)); mr=$((rows / 2)); mc=$((cols / 2))

# Union of the changed-pixel boxes between the centre and each corner.
x0=$sw; y0=$sh; x1=0; y1=0
for f in "r0c0" "r0c$lc" "r${lr}c0" "r${lr}c$lc"; do
	box=$(magick "$SRC/r${mr}c$mc.png" "$SRC/$f.png" -compose difference -composite \
		-colorspace gray -threshold 3% -format "%@" info:)
	read -r bw bh bx by < <(echo "$box" | sed -E 's/([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+)/\1 \2 \3 \4/')
	[ "$bx" -lt "$x0" ] && x0=$bx
	[ "$by" -lt "$y0" ] && y0=$by
	[ $((bx + bw)) -gt "$x1" ] && x1=$((bx + bw))
	[ $((by + bh)) -gt "$y1" ] && y1=$((by + bh))
done
x0=$((x0 > PAD ? x0 - PAD : 0)); y0=$((y0 > PAD ? y0 - PAD : 0))
x1=$((x1 + PAD < sw ? x1 + PAD : sw)); y1=$((y1 + PAD < sh ? y1 + PAD : sh))
# Snap to multiples of 5 source px, which are whole pixels at 1280/1600.
x0=$((x0 / 5 * 5)); y0=$((y0 / 5 * 5)); x1=$(((x1 + 4) / 5 * 5)); y1=$(((y1 + 4) / 5 * 5))
[ "$x1" -gt "$sw" ] && x1=$sw; [ "$y1" -gt "$sh" ] && y1=$sh
cw=$((x1 - x0)); ch=$((y1 - y0))
# The crop in poster pixels.
px=$((x0 * W / sw)); py=$((y0 * W / sw)); pw=$((cw * W / sw)); ph=$((ch * W / sw))

rm -rf "$OUT/views"
mkdir -p "$OUT/views"
for f in "$SRC"/r*c*.png; do
	n=$(basename "${f%.png}")
	magick "$f" -crop "${cw}x${ch}+${x0}+${y0}" +repage -resize "$((cw * FW / sw))x$((ch * FW / sw))!" png:- \
		| cwebp -quiet -q "$Q" -o "$OUT/views/$n.webp" -- -
done
cwebp -quiet -q 82 -resize "$W" 0 "$SRC/r${mr}c$mc.png" -o "$OUT/poster.webp"

# The site's manifest: the capture's own record plus the grid and the crop,
# which showpieceTile.html reads at build time.
python3 - "$SRC/views.json" "$OUT/views/views.json" "$cols" "$rows" "$px" "$py" "$pw" "$ph" <<'EOF'
import json, sys
src, dst, cols, rows, x, y, w, h = sys.argv[1:]
m = json.load(open(src))
m["site"] = {"cols": int(cols), "rows": int(rows), "crop": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}, "poster": {"w": 1280, "h": 800}}
json.dump(m, open(dst, "w"), indent="\t")
open(dst, "a").write("\n")
EOF

echo "exported ${cols}x${rows} views, crop ${pw}x${ph}+${px}+${py} of the poster ($(du -ch "$OUT"/views/*.webp | tail -1 | cut -f1)) into $OUT"
