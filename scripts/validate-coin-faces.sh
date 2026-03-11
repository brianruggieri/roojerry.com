#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────
# Validate coin-faces: ensure at least 2 headshot images
# exist so the coin flip never shows the same photo twice.
#
# Usage:
#   ./scripts/validate-coin-faces.sh          # exits 1 on failure
#   git hook (pre-push / pre-commit)          # link or call this script
#   CI step                                   # runs before hugo build
# ───────────────────────────────────────────────────────────

set -euo pipefail

COIN_DIR="static/img/coin-faces"
MIN_REQUIRED=2

# Count only source images (png/jpg/jpeg) — not webp companions.
count=$(find "$COIN_DIR" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) | wc -l)
count=$((count + 0))  # trim whitespace from wc

if (( count < MIN_REQUIRED )); then
  echo "❌  coin-faces validation failed"
  echo "    Found $count image(s) in $COIN_DIR (need at least $MIN_REQUIRED)."
  echo "    Add more headshot .png/.jpg files so the coin never repeats."
  exit 1
fi

echo "✅  coin-faces OK — $count image(s) found (≥ $MIN_REQUIRED required)"
