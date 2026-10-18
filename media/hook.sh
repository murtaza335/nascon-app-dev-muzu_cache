#!/bin/sh
# Called by MediaMTX hooks: $1 = ready | not_ready | segment_complete. Failures are ignored (best effort).
BODY="{\"event\":\"$1\",\"path\":\"$MTX_PATH\",\"segment_path\":\"$MTX_SEGMENT_PATH\",\"duration_s\":${MTX_SEGMENT_DURATION%.*}}"
[ -z "${MTX_SEGMENT_DURATION%.*}" ] && BODY="{\"event\":\"$1\",\"path\":\"$MTX_PATH\"}"
wget -q -O /dev/null --timeout=2 --tries=1 --header "Content-Type: application/json" --header "X-Media-Hook-Token: ${MEDIA_HOOK_TOKEN:-media-hook-dev}" \
  --post-data "$BODY" http://backend:8080/internal/media/events || true
