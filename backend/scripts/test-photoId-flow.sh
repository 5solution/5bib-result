#!/usr/bin/env bash
# Test the photoId upload flow end-to-end:
#   1. POST /upload-bg with a photo → get photoId
#   2. GET preview with the photoId for each of the 6 templates
#   3. Print timing + file sizes
#
# Backend logs will show [render] / [generate] lines for each step.
# Compare timing of run 1 (cold) vs run 2 (S3 cache hit) vs photoId reuse.
#
# Usage:
#   chmod +x backend/scripts/test-photoId-flow.sh
#   ./backend/scripts/test-photoId-flow.sh
#
# Override defaults via env: RACE_ID, BIB, PHOTO, URL_BASE

set -euo pipefail

URL_BASE="${URL_BASE:-http://localhost:8081}"
RACE_ID="${RACE_ID:-69e85a50e10fdf7b8411fc52}"
BIB="${BIB:-52276}"
PHOTO="${PHOTO:-stock-photo-random-pictures-cute-and-funny-2286554497.jpg}"

if [[ ! -f "$PHOTO" ]]; then
  echo "Photo file not found: $PHOTO"
  echo "Set PHOTO=/path/to/file.jpg or run from a directory containing the file."
  exit 1
fi

PHOTO_SIZE_KB=$(($(wc -c < "$PHOTO") / 1024))
echo "Photo: $PHOTO (${PHOTO_SIZE_KB} KB)"
echo "Race:  $RACE_ID  Bib: $BIB"
echo

# ─── Step 1: Upload background ─────────────────────────────────
echo "=== STEP 1: Upload background photo ==="
UPLOAD_RESPONSE=$(curl -s -X POST "${URL_BASE}/api/race-results/result-image/upload-bg" \
  -F "file=@${PHOTO}" \
  -w "\n__HTTP=%{http_code}__TIME=%{time_total}__")

HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | grep -oE '__HTTP=[0-9]+' | cut -d= -f2)
TIME=$(echo "$UPLOAD_RESPONSE" | grep -oE '__TIME=[^_]+' | cut -d= -f2)
JSON=$(echo "$UPLOAD_RESPONSE" | sed 's/__HTTP=.*$//')

echo "  HTTP=$HTTP_CODE  time=${TIME}s"
echo "  Response: $JSON"

if [[ "$HTTP_CODE" != "201" && "$HTTP_CODE" != "200" ]]; then
  echo "Upload failed."
  exit 1
fi

# Parse photoId out of JSON (no jq dependency)
PHOTO_ID=$(echo "$JSON" | grep -oE '"photoId"[[:space:]]*:[[:space:]]*"[^"]+"' | sed 's/.*"\([^"]\+\)"$/\1/')
if [[ -z "$PHOTO_ID" ]]; then
  echo "Could not parse photoId from response."
  exit 1
fi
echo "  photoId=$PHOTO_ID"
echo

# ─── Step 2: Render previews for all 6 templates ─────────────
TEMPLATES=("classic" "celebration" "endurance" "story" "sticker" "podium")
SIZE_FOR_STORY="9:16"
SIZE_DEFAULT="4:5"

mkdir -p /tmp/result-image-test

for round in 1 2; do
  echo "=== STEP 2: Render previews — round ${round} (round 2 should hit caches) ==="
  for tpl in "${TEMPLATES[@]}"; do
    SIZE="$SIZE_DEFAULT"
    [[ "$tpl" == "story" ]] && SIZE="$SIZE_FOR_STORY"

    OUT="/tmp/result-image-test/${tpl}-r${round}.png"
    URL="${URL_BASE}/api/race-results/result-image/${RACE_ID}/${BIB}?preview=1&template=${tpl}&size=${SIZE}&gradient=blue&showBadges=true&photoId=${PHOTO_ID}"

    curl -s "$URL" -o "$OUT" \
      -w "  [${tpl}] http=%{http_code} time=%{time_total}s size=%{size_download}B\n"
  done
  echo
done

echo "Done. Outputs in /tmp/result-image-test/. Backend logs show [render]/[generate] timing breakdowns."
