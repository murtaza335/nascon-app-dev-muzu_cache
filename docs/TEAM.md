> **Superseded where conflicting (2026-10-17).** This starter guide predates the NaSCon '26 Part I spec. The canonical sources are [`REQUIREMENTS.md`](../REQUIREMENTS.md), [`ARCHITECTURE.md`](../ARCHITECTURE.md), [`ADR.md`](../ADR.md) and [`AGENTS.md`](../AGENTS.md). Key overrides: API port **8080** (not 3000); error body `{"error":{"code","message","details":{}}}`; mobile storage is SQLite + Keystore (not AsyncStorage). See `docs/CHANGELOG.md`.

# Team Setup

## Laptop split

| Laptop | RAM | Role |
|---|---|---|
| A | 32 GB | **Mobile:** React Native, Metro, Gradle, phone over USB |
| B | 16 GB (Fedora) | **Backend:** docker compose stack, API routes, migrations |
| C | 16 GB | **Tests, docs, CI watch:** pytest vectors, TRACEABILITY/ADR, watches GitHub Actions, spec checklist |

Docker's Node 20 (`node:20-alpine`) is the **source of truth** for the backend; host Node versions only matter for tooling. Run `nvm use 20` before `npm install`, so the lockfile matches.

## GitHub

- All three members are collaborators with **write** access, plus the evaluator account **`nascon-eval-26`** (check the spec for the exact access level).
- Set the default branch name before anyone runs `git init`: `git config --global init.defaultBranch main`.
- Campus networks often block port 22. Use SSH over 443 in `~/.ssh/config`:

  ```
  Host github.com
    HostName ssh.github.com
    Port 443
    User git
  ```

  Accept the host key once: `ssh -T git@github.com` (answer `yes`). It should print "Hi <user>! You've successfully authenticated". `scripts/preflight.sh` checks both 22 and 443.

## Pushing

- Push **at least hourly** (2 points per missed hour). Either one designated pusher runs `scripts/push.sh` every hour, or everyone pushes their own work with `scripts/push.sh` (it rebases onto origin first).
- **Never force-push.** On a conflict, `push.sh` aborts the rebase and prints the steps; fix it together.
- Final Day 1 push before **15:05**. **No pushes between 15:05 Day 1 and 10:15 Day 2.** Final Day 2 push before **14:05**.
- Day 2 continues from the locked Day 1 SHA: start Day 2 with `git pull` and confirm `git log -1` matches the Day 1 final SHA.

## Network

- One person owns the **hotspot** for the whole event (and keeps their phone charged).
- Each laptop shares its IP: `hostname -I` (also printed by `scripts/preflight.sh`). Post the backend laptop's IP in the team chat.
- Check from the test phone's browser: `http://<backend-ip>:3000/health` must show `{"status":"ok",...}`. If it does not, open the firewall on the backend laptop (see README Troubleshooting).
- **Do not rely on Tailscale** or other VPNs; campus networks may block them.

## Morning-of routine

1. `scripts/preflight.sh` on every laptop; fix every MISSING.
2. Backend laptop: `docker compose up --build -d --wait` once to confirm images and layers are cached.
3. Mobile laptop: `adb devices` shows `device`; `./gradlew assembleDebug --offline` in the warm-up app still works.
4. Confirm the competition repo is cloned and has 0 commits, and that nobody pushes before 10:45.
