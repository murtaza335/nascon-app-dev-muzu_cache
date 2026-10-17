#!/usr/bin/env bash
# Usage: wait-for-health.sh URL [TIMEOUT_SECONDS=120]
# Polls URL every 2 s until it returns 2xx; exits 1 on timeout.
set -euo pipefail

URL="${1:?usage: wait-for-health.sh URL [TIMEOUT]}"
TIMEOUT="${2:-120}"
deadline=$(( $(date +%s) + TIMEOUT ))

echo "Waiting for ${URL} (timeout ${TIMEOUT}s)..."
until curl -fsS --max-time 3 "$URL" >/dev/null 2>&1; do
  if (( $(date +%s) >= deadline )); then
    echo "TIMEOUT: ${URL} not healthy after ${TIMEOUT}s" >&2
    exit 1
  fi
  sleep 2
done
echo "Healthy: $(curl -fsS --max-time 3 "$URL")"
