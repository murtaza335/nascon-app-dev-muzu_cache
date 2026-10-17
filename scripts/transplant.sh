#!/usr/bin/env bash
# Mode A only: copy this skeleton into the freshly cloned (empty) competition repo.
# Usage: scripts/transplant.sh /path/to/competition-repo
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:?usage: transplant.sh /path/to/competition-repo}"
DEST="$(cd "$DEST" && pwd)"

[[ -d "$DEST/.git" ]] || { echo "Refusing: $DEST has no .git (clone the competition repo first)." >&2; exit 1; }
[[ "$DEST" != "$SRC" ]] || { echo "Refusing: destination is this skeleton." >&2; exit 1; }
others="$(find "$DEST" -mindepth 1 -maxdepth 1 ! -name .git | head -5)"
if [[ -n "$others" ]]; then
  echo "Refusing: $DEST already contains files besides .git:" >&2
  echo "$others" >&2
  exit 1
fi

tar -C "$SRC" --exclude=.git --exclude=node_modules --exclude=.venv \
    --exclude='./reports/*' --exclude=.env --exclude=.directory -cf - . | tar -C "$DEST" -xf -
touch "$DEST/reports/.gitkeep"

cat <<MSG

Copied skeleton into $DEST (nothing committed).

  !!! ONLY AFTER 10:45 AM !!!

  cd "$DEST"
  git config --global init.defaultBranch main
  git add -A
  git commit -m "chore: project skeleton"
  scripts/push.sh "chore: project skeleton"

Day-of checklist:
  1. 10:00-10:44 check-in; confirm the repo has 0 commits (no README, .gitignore, license).
  2. After 10:45: transplant (done), commit and push.
  3. Fill docs/SPEC-CHECKLIST.md; apply spec overrides (compose ports, errors.js, validate.js, cache.js).
  4. Replace backend/src/routes/example.js; fill TRACEABILITY.md and ADR.md as you decide.
  5. Push at least hourly (2 points per miss). Final Day 1 push before 15:05; final Day 2 push before 14:05.
  6. No pushes between 15:05 Day 1 and 10:15 Day 2.
MSG
