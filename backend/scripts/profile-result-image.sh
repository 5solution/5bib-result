#!/usr/bin/env bash
# Profile the result-image generation endpoint.
#
# Runs the same curl multiple times with three modes:
#   1. COLD  — unique customMessage per call → forces fresh render every time (bypasses S3 cache)
#   2. WARM  — same params each call → 1st call renders, rest hit S3 cache
#   3. NOPHOTO — no customPhoto → isolates how much time the JPEG decode costs
#
# Run the backend separately first, then this script. Backend logs will show:
#   [render] badges=Xms photo=Yms qr=Zms assets=Ams render=Rms encode=Ems total=Tms ...
#
# Usage:
#   chmod +x backend/scripts/profile-result-image.sh
#   ./backend/scripts/profile-result-image.sh
#
# Override defaults via env: RACE_ID, BIB, PHOTO, URL_BASE, RUNS

set -euo pipefail

URL_BASE="${URL_BASE:-http://localhost:8081}"
RACE_ID="${RACE_ID:-69cfcee3e9587a3853b02f3d}"
BIB="${BIB:-2104}"
PHOTO="${PHOTO:-stock-photo-random-pictures-cute-and-funny-2286554497.jpg}"
RUNS="${RUNS:-3}"

URL="${URL_BASE}/api/race-results/result-image/${RACE_ID}/${BIB}"

if [[ ! -f "$PHOTO" ]]; then
  echo "Photo file not found: $PHOTO"
  echo "Set PHOTO=/path/to/file.jpg or run from a directory containing the file."
  exit 1
fi

PHOTO_SIZE_KB=$(($(wc -c < "$PHOTO") / 1024))
echo "Photo: $PHOTO (${PHOTO_SIZE_KB} KB)"
echo "URL:   $URL"
echo "Runs:  $RUNS per mode"
echo

run_curl () {
  local label="$1"
  local extra_msg="$2"
  local with_photo="$3"  # "yes" | "no"

  local photo_args=()
  if [[ "$with_photo" == "yes" ]]; then
    photo_args=(-F "customPhoto=@${PHOTO};type=image/jpeg")
  fi

  curl -s -X POST "$URL" \
    -H 'accept: */*' \
    -F "size=4:5" \
    "${photo_args[@]}" \
    -F "showQrCode=false" \
    -F "showBadges=true" \
    -F "gradient=blue" \
    -F "showSplits=false" \
    -F "textColor=auto" \
    -F "customMessage=${extra_msg}" \
    -F "template=classic" \
    -o /dev/null \
    -w "  [${label}] http=%{http_code} total=%{time_total}s size=%{size_download}B\n"
}

echo "=== MODE 1: COLD (unique customMessage → bypass S3 cache) ==="
for i in $(seq 1 "$RUNS"); do
  run_curl "cold-$i" "cold-$(date +%s%N)" "yes"
done
echo

echo "=== MODE 2: WARM (same params → S3 cache hit after run 1) ==="
for i in $(seq 1 "$RUNS"); do
  run_curl "warm-$i" "warm-fixed-message" "yes"
done
echo

echo "=== MODE 3: NOPHOTO (no customPhoto → isolates JPEG decode cost) ==="
for i in $(seq 1 "$RUNS"); do
  run_curl "nophoto-$i" "nophoto-$(date +%s%N)" "no"
done
echo

echo "Done. Check backend logs for [render] lines to see per-step breakdown."
