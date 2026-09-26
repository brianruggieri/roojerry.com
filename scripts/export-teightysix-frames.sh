#!/usr/bin/env bash
# scripts/export-teightysix-frames.sh: kept capture frames -> site assets
set -euo pipefail
SRC=~/git/baseball-cards/teightysix/.claude/captures/kept
OUT=static/img/projects/teightysix
mkdir -p "$OUT/shots" "$OUT/story"
webp() { cwebp -quiet -q "${4:-82}" -resize "$3" 0 "$1" -o "$2"; }
png()  { sips -Z "$3" "$1" --out "$2" >/dev/null; }

webp "$SRC/forty-years-and-the-dates-agree.png" "$OUT/poster.webp" 1280
webp "$SRC/pick-a-spot-on-the-field.png" "$OUT/shots/position-board.webp" 732
webp "$SRC/the-frame-takes-team-colors.jpg" "$OUT/shots/team-colours.webp" 1200
webp "$SRC/the-career-you-chose.png" "$OUT/shots/career-you-chose.webp" 1594
webp "$SRC/gold-in-the-pile.png" "$OUT/shots/gold-in-the-pile.webp" 1600
webp "$SRC/forty-years-and-the-dates-agree.png" "$OUT/shots/pile-background.webp" 1440
webp "$SRC/realistic-2000.png" "$OUT/shots/real-odds.webp" 1600
webp "$SRC/wear3d-cut-corner-ladder.png" "$OUT/shots/cut-corner-ladder.webp" 1000
webp "$SRC/sweep-delta-legendary-512.png" "$OUT/shots/sweep-footprint.webp" 1600

# PNG fallbacks are rarely served (near-universal webp support); keep them well
# under their webp siblings' resolution so the 4 MB total budget holds.
for pair in "an-alphabet-rebuilt-from-nothing:alphabet" "four-models-drew-baseball-man:mascot-bake-off" \
            "three-hands-on-the-bat:three-hands" "infinite-pile-10k:pile-runaway" \
            "ten-thousand-cards-redeemed:pile-fixed" "nobody-wears-the-right-uniform:wrong-uniforms"; do
	s="${pair%%:*}"; t="${pair##*:}"
	png  "$SRC/$s.png" "$OUT/story/$t.png" 420
	webp "$SRC/$s.png" "$OUT/story/$t.webp" 1600 78
done

# compare pair + hero (captured by scripts/capture-teightysix-press.mjs at 1600x1000 native)
for n in press-empty press-loaded; do
	webp "$OUT/$n.png" "$OUT/$n.webp" 1600
	png  "$OUT/$n.png" "$OUT/$n.png" 420
done
cp "$OUT/press-loaded.png" "$OUT/hero.png"; cp "$OUT/press-loaded.webp" "$OUT/hero.webp"
du -sh "$OUT"
