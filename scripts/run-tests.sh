#!/usr/bin/env bash
# Usage: scripts/run-tests.sh [--docker] [--destructive] [ui]
#   --docker       run pytest inside python:3.12-slim instead of the host .venv
#   --destructive  also run tests that stop/start compose services (RUN_DESTRUCTIVE=1)
#   ui             start the Selenium grid (docker-compose.test.yml, profile ui) and run tests/e2e-web
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

USE_DOCKER=0; DESTRUCTIVE=0; UI=0
for arg in "$@"; do
  case "$arg" in
    --docker) USE_DOCKER=1 ;;
    --destructive) DESTRUCTIVE=1 ;;
    ui) UI=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

export BASE_URL="${BASE_URL:-http://localhost:${BACKEND_PORT:-3000}}"
export SELENIUM_URL="${SELENIUM_URL:-http://localhost:4444}"
export BROWSER_BASE_URL="${BROWSER_BASE_URL:-http://backend:3000}"
export RUN_DESTRUCTIVE=$DESTRUCTIVE

COMPOSE=(docker compose)
(( UI )) && COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.test.yml --profile ui)

mkdir -p reports
trap 'docker compose logs --no-color > reports/compose.log 2>&1 || true; echo "Compose logs: reports/compose.log"' EXIT

echo "==> Starting stack"
"${COMPOSE[@]}" up --build -d --wait
scripts/wait-for-health.sh "$BASE_URL/health" 90

if (( UI )); then
  echo "==> Waiting for the Selenium grid to have a node"
  for _ in $(seq 1 30); do
    curl -fsS "$SELENIUM_URL/status" 2>/dev/null | grep -q '"ready": *true' && break
    sleep 2
  done
fi

echo "==> Backend unit tests (node --test)"
if command -v npm >/dev/null 2>&1; then
  (cd backend && BASE_URL="$BASE_URL" npm test)
else
  docker run --rm --network host -e BASE_URL="$BASE_URL" -v "$ROOT/backend:/app:z" -w /app node:20-alpine npm test
fi

SUITES=(api)
(( UI )) && SUITES+=(e2e-web)
MARK=()
(( DESTRUCTIVE )) || MARK=(-m "not destructive")
PYTEST_ARGS="${SUITES[*]}"
(( DESTRUCTIVE )) || PYTEST_ARGS+=" -m 'not destructive'"

echo "==> pytest ${SUITES[*]}"
if (( USE_DOCKER )); then
  (( DESTRUCTIVE )) && echo "NOTE: destructive tests need the docker CLI and are skipped inside the container; run without --docker for them."
  docker run --rm --network host \
    -e BASE_URL -e SELENIUM_URL -e BROWSER_BASE_URL -e RUN_DESTRUCTIVE \
    -v "$ROOT:/w:z" -v nascon-pip-cache:/root/.cache/pip -w /w/tests \
    python:3.12-slim sh -c "pip install -q --root-user-action=ignore -r requirements.txt && pytest -p no:cacheprovider $PYTEST_ARGS; rc=\$?; chown -R $(id -u):$(id -g) /w/reports; exit \$rc"
else
  if [[ ! -x .venv/bin/pytest ]]; then
    echo "==> Creating .venv"
    python3 -m venv .venv
    .venv/bin/pip install -q -r tests/requirements.txt
  fi
  (cd tests && "$ROOT/.venv/bin/pytest" "${SUITES[@]}" "${MARK[@]}")
fi

echo "==> All tests passed. Reports: reports/report.html, reports/allure-results/"
