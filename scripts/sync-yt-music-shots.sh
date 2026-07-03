#!/usr/bin/env bash
# Sync yt-music screenshot grid assets from the harness regression snapshots.
# Usage: npm run sync-shots   (or ./scripts/sync-yt-music-shots.sh)
set -euo pipefail

SRC="${YT_MUSIC_OSX:-$HOME/git/yt-music-osx}/harness/snapshots/contrast.spec.js-snapshots"
DST="$(cd "$(dirname "$0")/.." && pwd)/static/img/projects/yt-music/shots"

# harness snapshot name -> site asset name (add rows to grow the grid)
MAP=(
  "home-light-light-darwin:home-light"
  "home-dark-dark-darwin:home-dark"
  "explore-light-light-darwin:explore-light"
  "search-light-light-darwin:search-light"
  "library-dark-dark-darwin:library-dark"
  "explore-moods-light-light-darwin:moods-light"
  "modal-track-context-menu-light-light-darwin:context-menu-light"
  "modal-account-menu-dark-dark-darwin:account-menu-dark"
)

for m in "${MAP[@]}"; do
  src="$SRC/${m%%:*}.png"
  tmp="$src"
  [ -f "$src" ] || { echo "MISSING: $src" >&2; exit 1; }
  # home-light: erase the carousel-clipped chip at the right edge before export
  # (feathered backdrop clone; see PR #25). Idempotent — no-op if chips end clean.
  if [ "${m##*:}" = "home-light" ]; then
    tmp=$(mktemp -t home-light-patched).png
    magick "$src" \( +clone -crop 60x60+1178+100 +repage \
      \( -size 60x60 xc:black -fill white -draw "rectangle 6,6 53,53" -blur 0x4 \) \
      -alpha off -compose CopyOpacity -composite \) \
      -geometry +1122+100 -compose over -composite "$tmp"
  fi
  cwebp -quiet -q 82 "$tmp" -o "$DST/${m##*:}.webp"
  echo "synced ${m##*:}.webp"
done
echo "done — review with git diff, then commit."
