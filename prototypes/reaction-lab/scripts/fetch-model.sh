#!/usr/bin/env bash
# Fetch the MediaPipe Face Landmarker model used by Reaction Lab.
# The .task binary is NOT committed to this repo (keeps git history slim);
# run this once before serving the app:
#
#   bash scripts/fetch-model.sh          # skips if models/face_landmarker.task exists
#   bash scripts/fetch-model.sh --force  # re-download
set -euo pipefail

MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
DIR="$(cd "$(dirname "$0")/.." && pwd)/models"
OUT="$DIR/face_landmarker.task"

mkdir -p "$DIR"

if [ -f "$OUT" ] && [ "${1:-}" != "--force" ]; then
  echo "Model already present: $OUT (use --force to re-download)"
  exit 0
fi

echo "Downloading MediaPipe Face Landmarker (float16, v1)..."
curl -fL --retry 3 -o "$OUT.tmp" "$MODEL_URL"

# Sanity check: the download must exist, be non-trivial, and start with a
# flatbuffer/TFLite-style header (0x10 0x00 0x00 0x00 "TFL3").
SIZE=$(wc -c < "$OUT.tmp" | tr -d ' ')
if [ "$SIZE" -lt 1000000 ]; then
  echo "Download looks wrong (${SIZE} bytes); aborting." >&2
  rm -f "$OUT.tmp"
  exit 1
fi
if ! head -c 8 "$OUT.tmp" | grep -q $'TFL3'; then
  echo "File header does not look like a TFLite bundle; aborting." >&2
  rm -f "$OUT.tmp"
  exit 1
fi

mv "$OUT.tmp" "$OUT"
echo "Done: $OUT ($SIZE bytes)"
echo "Model: MediaPipe Face Landmarker float16 v1 — Apache-2.0 (see models/README.md)"
