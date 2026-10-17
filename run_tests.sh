#!/usr/bin/env bash
# Unit tests with line coverage → COVERAGE.json, then the API suite if a stack answers on BASE_URL.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:8080}"
mkdir -p "$ROOT/reports"

(cd "$ROOT/backend" && node --test --experimental-test-coverage --test-reporter=spec --test-reporter-destination=stdout \
  --test-reporter=lcov --test-reporter-destination="$ROOT/reports/lcov.info" "tests/unit/**/*.test.js")
node "$ROOT/scripts/coverage-areas.js" "$ROOT/reports/lcov.info"

if curl -fsS --max-time 3 "$BASE_URL/health" >/dev/null 2>&1; then
  (cd "$ROOT/tests" && BASE_URL="$BASE_URL" "$ROOT/.venv/bin/pytest" api -m "not destructive" -q)
else
  echo "API suite skipped: no stack at $BASE_URL" >&2
fi
