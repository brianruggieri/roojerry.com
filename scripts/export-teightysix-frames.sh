#!/usr/bin/env bash
# scripts/export-teightysix-frames.sh: capture frames -> site assets.
#
# Two sources, both read-only:
#   LIVE    .claude/teightysix-captures/   written by scripts/capture-teightysix-press.mjs
#   ARCHIVE the teightysix repo's kept capture set
#
# Everything is written under static/img/projects/teightysix/ and nothing is
# ever read back from there, so running this twice produces the same bytes
# instead of re-encoding its own output.
#
# Shipping standard for a frame: no real person may be recognisable at the size
# the site serves, unless the photograph is freely licensed and carries its
# credit on the card. Frames from before the bench's 2026-09-10 switch to
# invented players show the original real-MLB seed set and do not ship.
set -euo pipefail

LIVE=.claude/teightysix-captures
ARCHIVE=~/git/baseball-cards/teightysix/.claude/captures/kept
OUT=static/img/projects/teightysix
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[ -d "$LIVE" ] || { echo "missing $LIVE; run scripts/capture-teightysix-press.mjs first" >&2; exit 1; }
mkdir -p "$OUT/shots" "$OUT/story"

# webp SRC DST WIDTH [QUALITY]; png SRC DST WIDTH (long edge, fallback only).
# WIDTH is a ceiling: a source narrower than it is encoded at its own size,
# because upscaling only buys bytes.
webp() {
	local w
	w=$(magick identify -format "%w" "$1")
	[ "$w" -gt "$3" ] && w="$3"
	cwebp -quiet -q "${4:-82}" -resize "$w" 0 "$1" -o "$2"
}
png()  { sips -Z "$3" "$1" --out "$2" >/dev/null; }

# ── The live bench: one MIAMI card from empty stock to its print in the pile ──
for n in press-empty press-loaded; do
	webp "$LIVE/$n.png" "$OUT/$n.webp" 1600
	png  "$LIVE/$n.png" "$OUT/$n.png"  420
done
# The detail page's hero is the same loaded bench as the compare pair's "after".
webp "$LIVE/press-loaded.png" "$OUT/hero.webp" 1600
png  "$LIVE/press-loaded.png" "$OUT/hero.png"  420
# The wall tile's poster. 1600x1000 down to 1280x800; showpieceTile.html
# declares those exact numbers.
webp "$LIVE/press-loaded.png" "$OUT/poster.webp" 1280
webp "$LIVE/back-turned-over.png" "$OUT/shots/back-turned-over.webp" 1600
webp "$LIVE/pile-top-down.png"    "$OUT/shots/pile-top-down.webp"    1600

# ── Archive frames ──
webp "$ARCHIVE/pick-a-spot-on-the-field.png"    "$OUT/shots/position-board.webp"     732
webp "$ARCHIVE/the-frame-takes-team-colors.jpg" "$OUT/shots/team-colours.webp"      1200
webp "$ARCHIVE/wear3d-cut-corner-ladder.png"    "$OUT/shots/cut-corner-ladder.webp" 1000
webp "$ARCHIVE/sweep-delta-legendary-512.png"   "$OUT/shots/sweep-footprint.webp"   1600
# The 4400x1464 frame is the whole bench; crop to the lifted card, the pile
# behind it and the Commons credit printed along the card's bottom margin.
magick "$ARCHIVE/picked-out-of-the-pile.png" -crop 1600x1232+1978+106 +repage "$TMP/picked-card.png"
webp "$TMP/picked-card.png" "$OUT/shots/picked-card.webp" 1600
# A dense 10x6 photo board; q76 keeps every jersey and credit legible at 1600.
webp "$ARCHIVE/sixty-photographs-nobody-had-to-license.png" "$OUT/shots/sixty-licensed.webp" 1600 76

# PNG fallbacks are rarely served (near-universal webp support); keep them well
# under their webp siblings' resolution so the 4 MB total budget holds.
for pair in "an-alphabet-rebuilt-from-nothing:alphabet" "four-models-drew-baseball-man:mascot-bake-off" \
            "three-hands-on-the-bat:three-hands" "infinite-pile-10k:pile-runaway" \
            "ten-thousand-cards-redeemed:pile-fixed" "nobody-wears-the-right-uniform:wrong-uniforms"; do
	s="${pair%%:*}"; t="${pair##*:}"
	png  "$ARCHIVE/$s.png" "$OUT/story/$t.png" 420
	webp "$ARCHIVE/$s.png" "$OUT/story/$t.webp" 1600 78
done

du -sk "$OUT"
