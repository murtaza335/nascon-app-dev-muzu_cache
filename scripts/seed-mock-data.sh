#!/usr/bin/env bash
# Adds a small, realistic mock data set (league "Alpha Premier Division" with players, results, a live match, shop items and
# orders) to the running stack. Safe to re-run. `curl -X POST localhost:8080/audit/v1/reset` removes it again.
# Usage: ./scripts/seed-mock-data.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! curl -fsS --max-time 3 http://localhost:8080/health >/dev/null 2>&1; then
  echo "The stack is not up. Run:  docker compose up -d --build" >&2
  exit 1
fi
# Make sure the baseline exists (the script needs league-alpha-2). Reset is harmless on a fresh stack but wipes other data,
# so only do it when the league is missing.
if ! docker compose exec -T postgres psql -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}" -tAc "select 1 from leagues where league_id='league-alpha-2'" | grep -q 1; then
  curl -fsS -X POST http://localhost:8080/audit/v1/reset >/dev/null
fi
# Bind-mount the current source so this works without rebuilding the image; the container gets the compose env (salt, DB, Redis).
docker compose run --rm --no-deps -T -v "$PWD/backend/src:/app/src:ro" backend node src/seed/mockData.js
