#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────
# Validate coin-faces before a build.
#
# Two things can silently break the coin, and neither surfaces as an error
# at runtime — the face just renders blank or repeats:
#   1. Fewer than 2 source images, so the flip always shows the same photo.
#   2. A source image with no .webp companion. coin-flip.js builds an
#      image-set() with a .webp URL for every image it is handed, so a
#      missing companion hands webp-capable browsers a 404.
# layouts/partials/nav.html skips companion-less images, so without this
# check a new face is dropped from the rotation with no visible failure.
#
# Usage:
#   ./scripts/validate-coin-faces.sh    # exits non-zero on failure
#   npm run validate:coin-faces
#   CI step, before hugo --minify
# ───────────────────────────────────────────────────────────

set -euo pipefail

COIN_DIR="static/img/coin-faces"
MIN_REQUIRED=2
# The coin renders at 10rem (160px) desktop, 36px mobile. 400x400 covers 2x DPR
# with headroom; past that is dead weight on the LCP path.
MAX_BYTES=$((300 * 1024))

if [[ ! -d "$COIN_DIR" ]]; then
  echo "❌  coin-faces validation failed"
  echo "    $COIN_DIR does not exist."
  exit 1
fi

failed=0
count=0
warnings=0

while IFS= read -r src; do
  count=$((count + 1))
  base="${src%.*}"

  # Companion lookup is case-insensitive: nav.html discovers images the same way.
  webp=""
  for cand in "$base.webp" "$base.WEBP"; do
    [[ -f "$cand" ]] && webp="$cand" && break
  done

  if [[ -z "$webp" ]]; then
    echo "❌  $(basename "$src") — no .webp companion"
    echo "    nav.html will skip this image, so it never joins the rotation."
    echo "    Generate one:  cwebp -q 80 -m 6 '$src' -o '$base.webp'"
    failed=1
    continue
  fi

  size=$(stat -f %z "$src" 2>/dev/null || stat -c %s "$src")
  if (( size > MAX_BYTES )); then
    echo "⚠️   $(basename "$src") — $((size / 1024)) KB exceeds the $((MAX_BYTES / 1024)) KB budget"
    echo "    The coin renders at 160px; 400x400 is plenty. Downscale:"
    echo "    sips -z 400 400 '$src'"
    warnings=$((warnings + 1))
  fi
done < <(find "$COIN_DIR" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) | sort)

if (( count < MIN_REQUIRED )); then
  echo "❌  coin-faces validation failed"
  echo "    Found $count image(s) in $COIN_DIR (need at least $MIN_REQUIRED)."
  echo "    Add more headshots so the coin never shows the same face twice."
  failed=1
fi

if (( failed )); then
  exit 1
fi

if (( warnings )); then
  echo "✅  coin-faces OK — $count image(s), $warnings oversized (not blocking)"
else
  echo "✅  coin-faces OK — $count image(s), all with .webp companions"
fi
