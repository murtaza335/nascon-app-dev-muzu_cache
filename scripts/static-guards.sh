#!/usr/bin/env bash
# Static guards (ARCHITECTURE §12, AGENTS §3). Exits non-zero on the first violated rule.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
fail=0
check() { # name, command-that-prints-offenders
  local out; out="$(eval "$2" 2>/dev/null || true)"
  if [ -n "$out" ]; then echo "FAIL  $1"; echo "$out" | head -10 | sed 's/^/        /'; fail=1; else echo "ok    $1"; fi
}

# FR-1.1-05: sport ids and event names only in backend/src/seed/** (and tests)
check "no sport/event literals outside backend/src/seed" \
  "grep -rniE \"'(football|basketball|cricket|esports|goal|wicket|six|four|round_win|kabaddi)'\" backend/src --include=*.js | grep -v '^backend/src/seed/'"
# `wicket` is also a property NAME of the spec'd innings event schema (runs, legal_ball, wicket): allowed there only.
check "no sport/event words as identifiers outside seed" \
  "grep -rniwE '(football|basketball|cricket|esports|kabaddi|wicket)' backend/src --include=*.js | grep -v '^backend/src/seed/' | grep -vE '^\\S+:[0-9]+:\\s*(//|\\*)' | grep -vE 'wicket: t\\.bool|def\\.wicket'"
check "domain/** is pure (no db/config/process.env/Date.now/fs)" \
  "grep -rnE \"require\\('(\\.\\./)+(db|config|cache|repos|services|http)|process\\.env|Date\\.now\\(|require\\('(node:)?fs'\" backend/src/domain"
check "no :latest image tags and no container_name in compose" "grep -nE ':latest|container_name' docker-compose.yml"
check ".env is not tracked" "git ls-files | grep -E '(^|/)\\.env$'"
check "no nested .git in mobile/" "find mobile -maxdepth 2 -name .git"
check "parameterized SQL only (no unsafe interpolation in SQL text)" "node scripts/sql-guard.js | grep ^FAIL"
check "the DAY1_SALT value is never logged" "grep -rnE 'console\\.[a-z]+\\(.*day1Salt' backend/src"
check "DAY1_SALT only read in config.js" "grep -rn 'process.env.DAY1_SALT\\|env.DAY1_SALT' backend/src | grep -v 'backend/src/config.js'"
if [ -n "${DAY1_SALT:-}" ] && [ "${#DAY1_SALT}" -ge 8 ] && [ "$DAY1_SALT" != "dev-salt" ]; then
  check "real salt value appears in no tracked file" "git grep -nF -- \"\$DAY1_SALT\" -- . ':!node_modules'"
fi
check "no Firebase/Supabase/Amplify references in code or manifests" "grep -rniE 'firebase|supabase|amplify' backend/src backend/package.json docker-compose.yml"
exit $fail
