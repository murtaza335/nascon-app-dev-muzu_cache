#!/bin/sh
# Co-stream compositor (FR-3.3): started by MediaMTX runOnDemand for costream/<id>. Reads the participant list from the
# backend, builds an FFmpeg xstack graph and republishes the composite. Exits when the list changes (MediaMTX restarts it).
ID="$1"
TOKEN="${MEDIA_HOOK_TOKEN:-media-hook-dev}"
URL="http://backend:8080/internal/costream/$ID/inputs"
fetch() { wget -q -O - --header "X-Media-Hook-Token: $TOKEN" "$URL"; }
command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg not installed: clients render tiles instead"; exit 1; }

SNAP="$(fetch)" || exit 1
INPUTS="$(echo "$SNAP" | awk '$1=="input" && $3!="" {print $3}')"
N="$(echo "$INPUTS" | grep -c .)"
[ "$N" -ge 1 ] || exit 1

ARGS=""; FILTER=""; LABELS=""; I=0
for U in $INPUTS; do
  ARGS="$ARGS -i $U"
  FILTER="$FILTER[$I:v]scale=640:360,setsar=1[v$I];"
  LABELS="$LABELS[v$I]"
  I=$((I+1))
done
if [ "$N" -eq 1 ]; then GRAPH="${FILTER}${LABELS}null[out]"
elif [ "$N" -eq 2 ]; then GRAPH="${FILTER}${LABELS}hstack=inputs=2[out]"
else GRAPH="${FILTER}${LABELS}xstack=inputs=$N:layout=0_0|w0_0|0_h0|w0_h0[out]"; fi

# shellcheck disable=SC2086
ffmpeg -loglevel warning $ARGS -filter_complex "$GRAPH" -map "[out]" -c:v libx264 -preset ultrafast -tune zerolatency -g 30 -f rtsp \
  "rtsp://compositor:$TOKEN@127.0.0.1:8554/costream/$ID" &
FF=$!
trap 'kill $FF 2>/dev/null' EXIT TERM INT
while kill -0 $FF 2>/dev/null; do
  sleep 1
  [ "$(fetch)" = "$SNAP" ] || { kill $FF 2>/dev/null; exit 0; }
done
