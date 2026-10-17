#!/usr/bin/env bash
# Hourly checkpoint push with competition time guard.
# Usage: scripts/push.sh [--no-pull] ["commit message"]
# Env:   COMP_DAY1 / COMP_DAY2 (YYYY-MM-DD, Asia/Karachi), ALLOW_OUTSIDE_WINDOW=1 to override the guard,
#        PUSH_NOW="YYYY-MM-DD HH:MM" to simulate the clock when testing the guard.
set -euo pipefail

RED=$'\e[1;31m'; GREEN=$'\e[1;32m'; YELLOW=$'\e[1;33m'; RESET=$'\e[0m'
die() { echo "${RED}$*${RESET}" >&2; exit 1; }

NO_PULL=0
if [[ "${1:-}" == "--no-pull" ]]; then NO_PULL=1; shift; fi
MSG="${1:-chore: hourly checkpoint $(TZ=Asia/Karachi date +%H:%M)}"

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || die "Not inside a git repository."

# --- 1. Time guard (Asia/Karachi) -------------------------------------------
COMP_DAY1="${COMP_DAY1:-2026-10-17}"
COMP_DAY2="${COMP_DAY2:-2026-10-18}"
export TZ=Asia/Karachi
ts() { date -d "$1" +%s; }
now=$(if [[ -n "${PUSH_NOW:-}" ]]; then ts "$PUSH_NOW"; else date +%s; fi)
d1_open=$(ts "$COMP_DAY1 10:45"); d1_close=$(ts "$COMP_DAY1 15:05")
d2_open=$(ts "$COMP_DAY2 10:15"); d2_close=$(ts "$COMP_DAY2 14:05")

reason=""
if (( now < d1_open )); then reason="before Day 1 opens ($COMP_DAY1 10:45 PKT)"
elif (( now >= d1_close && now < d2_open )); then reason="inside the overnight lock ($COMP_DAY1 15:05 to $COMP_DAY2 10:15 PKT)"
elif (( now >= d2_close )); then reason="after Day 2 closes ($COMP_DAY2 14:05 PKT)"
fi
if [[ -n "$reason" ]]; then
  if [[ "${ALLOW_OUTSIDE_WINDOW:-0}" == "1" ]]; then
    echo "${YELLOW}WARNING: pushing $reason (ALLOW_OUTSIDE_WINDOW=1).${RESET}"
  else
    echo "${RED}==================================================================${RESET}" >&2
    echo "${RED} REFUSING TO PUSH: it is $(date '+%Y-%m-%d %H:%M %Z'), $reason.${RESET}" >&2
    echo "${RED} Pushing outside the window can be penalised.${RESET}" >&2
    echo "${RED} Override only if you are sure: ALLOW_OUTSIDE_WINDOW=1 $0 ...${RESET}" >&2
    echo "${RED}==================================================================${RESET}" >&2
    exit 1
  fi
fi

# --- 2. Commit ---------------------------------------------------------------
# symbolic-ref also works on a fresh clone with zero commits (rev-parse HEAD does not).
BRANCH="$(git symbolic-ref --short -q HEAD)" || die "Detached HEAD: check out a branch first."
git add -A
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -q -m "$MSG"
  echo "Committed: $MSG"
fi
git rev-parse --verify -q HEAD >/dev/null || die "No commits yet: nothing to push."

# --- 3. Rebase onto remote ---------------------------------------------------
if (( NO_PULL == 0 )); then
  rc=0; git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1 || rc=$?
  if (( rc == 0 )); then
    if ! git pull --rebase --autostash origin "$BRANCH"; then
      git rebase --abort >/dev/null 2>&1 || true
      echo "${RED}MERGE CONFLICT DETECTED. Resolve manually before the deadline.${RESET}" >&2
      echo "Your commit is safe locally; the rebase was aborted and the repo is clean. Next:" >&2
      echo "  git pull --rebase origin $BRANCH" >&2
      echo "  # fix the conflicted files, then:" >&2
      echo "  git add <files>" >&2
      echo "  git rebase --continue" >&2
      echo "  scripts/push.sh --no-pull" >&2
      exit 1
    fi
  elif (( rc == 2 )); then
    echo "Remote branch origin/$BRANCH does not exist yet: first push, skipping pull."
  else
    echo "${YELLOW}Could not query origin (exit $rc); trying to push anyway.${RESET}"
  fi
fi

# --- 4. Push -----------------------------------------------------------------
if ! git push -u origin HEAD; then
  die "PUSH REJECTED. Run scripts/push.sh again (it rebases first); never force-push."
fi

# --- 5. Summary --------------------------------------------------------------
echo "${GREEN}Pushed $(git rev-parse --short HEAD) to origin/$BRANCH at $(date '+%H:%M %Z').${RESET}"
echo "${GREEN}Next push due before $(date -d '+55 minutes' +%H:%M).${RESET}"
