#!/usr/bin/env bash
# Unit tests (+ API vectors if the stack answers on BASE_URL). Coverage → COVERAGE.json is added in T10.1.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:8080}"

(cd "$ROOT/backend" && node --test "tests/unit/**/*.test.js")

if curl -fsS --max-time 3 "$BASE_URL/health" >/dev/null 2>&1; then
  (cd "$ROOT/tests" && BASE_URL="$BASE_URL" "$ROOT/.venv/bin/pytest" api -m "not destructive" -q)
else
  echo "API suite skipped: no stack at $BASE_URL" >&2
fi
