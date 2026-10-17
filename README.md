# NaSCon '26 App Dev: Backend + Mobile Starter

## What this is

A generic, domain-free starter for the 8-hour NaSCon '26 app-dev competition:

- **Backend:** Node 20 + Express 5, PostgreSQL 16, Redis 7 (cache-aside), all in one root `docker-compose.yml` that the autograder runs as-is.
- **Conventions baked in:** one consistent error body, strict input validation, malformed id is 400 and missing id is 404, conflicts are 409, ISO-8601 UTC timestamps, `snake_case` JSON.
- **Test harness:** `node:test` unit tests, pytest API test vectors tagged with requirement IDs, an optional Selenium smoke test, a k6 smoke test and a CI workflow that mirrors the grader.
- **Mobile:** React Native (Android, physical phone). `mobile/` is a placeholder; create the app on the day ([docs/MOBILE.md](docs/MOBILE.md)).

The only domain code is `backend/src/routes/example.js` (an `items` CRUD), which shows every convention. **Replace it on the day.**

## Quick start

```bash
cp .env.example .env          # optional; compose defaults are enough
docker compose up --build -d --wait
curl localhost:3000/health    # {"status":"ok","db":true,"cache":true}
```

## Services and ports

| Service  | Image                | Host port               | Inside compose         | Notes |
|----------|----------------------|-------------------------|------------------------|-------|
| backend  | built from `backend/`| `${BACKEND_PORT:-3000}` | `http://backend:3000`  | healthcheck `/health` |
| postgres | `postgres:16-alpine` | not published           | `postgres:5432`        | volume `pgdata` |
| redis    | `redis:7-alpine`     | not published           | `redis:6379`           | cache only: 128 MB, `volatile-lru`, no persistence |

Optional services (minio, rabbitmq, nats, ntfy, mediamtx, livekit, prometheus, grafana) are commented out in `docker-compose.yml`. Test-only services (Selenium grid on 4444, k6) are in `docker-compose.test.yml`, under profiles `ui`, `ui-firefox` and `perf`.

## API conventions

**Error body** (every 4xx/5xx, defined only in `backend/src/errors.js`):

```json
{ "error_code": "VALIDATION_ERROR", "message": "Request validation failed",
  "details": [{ "field": "name", "issue": "is required" }] }
```

`details` appears only on validation errors. Responses never contain stack traces, SQL or file paths; the full error is logged server-side.

| Situation | Status | `error_code` |
|---|---|---|
| Missing/wrong-type/out-of-range field, body not an object | 400 | `VALIDATION_ERROR` |
| Malformed JSON | 400 | `INVALID_JSON` |
| Malformed id (`abc`, `0`, `1.5`, > 2147483647) | 400 | `VALIDATION_ERROR` |
| Well-formed id that does not exist | 404 | `NOT_FOUND` |
| Unknown route | 404 | `NOT_FOUND` |
| Unique or foreign-key violation | 409 | `CONFLICT` |
| Body over 1 MB | 413 | `PAYLOAD_TOO_LARGE` |
| Auth missing or invalid / not allowed | 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN` |
| Anything unexpected | 500 | `INTERNAL_ERROR` |

**Validation** (`backend/src/validate.js`): runs before any DB or cache call and reports all problems at once. Strings are trimmed, and whitespace-only counts as empty. Unknown fields are stripped (or rejected with `strict: true`). Numeric strings are coerced only in query and path params, never in JSON bodies.

**Success codes:** POST returns 201 with the created object; GET and PATCH return 200; DELETE returns 204 with no body. Lists return `{ data, total, limit, offset }` (`limit` 1-100, default 20; `offset` >= 0).

**Caching:** cached GETs send `X-Cache: HIT | MISS | BYPASS`. Writes invalidate before responding, so a read right after a write is always fresh. See [docs/CACHING.md](docs/CACHING.md).

Every response carries `X-Request-Id`, which also appears in the log line for that request.

## Running tests

Run pytest from inside `tests/`, because the report paths in `pytest.ini` are relative to it.

```bash
scripts/run-tests.sh                  # compose up + node tests + pytest tests/api (host .venv)
scripts/run-tests.sh --docker         # pytest inside python:3.12-slim (no host Python needed)
scripts/run-tests.sh --destructive    # also stops/starts Redis to prove graceful bypass
scripts/run-tests.sh ui               # + Selenium grid and tests/e2e-web
docker compose -f docker-compose.yml -f docker-compose.test.yml --profile perf run --rm k6

cd backend && npm test                # unit tests + health smoke (needs the stack up)
cd tests && ../.venv/bin/pytest api -m "not destructive"
```

Reports are written to `reports/` (`report.html`, `allure-results/`, `compose.log`). CI (`.github/workflows/ci.yml`) runs the same cold start and API tests on every push.

## Repo layout

```
docker-compose.yml        grader entry point (backend, postgres, redis)
docker-compose.test.yml   selenium / k6 (profiles ui, ui-firefox, perf)
backend/src/              index.js (boot) app.js config.js db.js migrate.js cache.js errors.js validate.js routes/
backend/tests/            node:test unit + smoke tests
tests/                    pytest: api/, e2e-web/, e2e-mobile/, perf/ (k6)
mobile/                   React Native app (created on the day, tracked by the root repo)
docs/                     MOBILE, TEAM, CACHING, SPEC-CHECKLIST
scripts/                  push, wait-for-health, run-tests, preflight, pull-images, transplant
ADR.md, TRACEABILITY.md   graded documents (keep these exact names)
```

## Hourly push

```bash
scripts/push.sh "REQ-03: add booking endpoint"    # commit, rebase onto origin, push
scripts/push.sh                                    # "chore: hourly checkpoint HH:MM"
```

The script refuses to push outside the competition windows (Asia/Karachi): before Day 1 10:45, between Day 1 15:05 and Day 2 10:15, and after Day 2 14:05. Override with `ALLOW_OUTSIDE_WINDOW=1`. The dates come from `COMP_DAY1` / `COMP_DAY2`, and `PUSH_NOW="YYYY-MM-DD HH:MM"` simulates the clock. On a rebase conflict it aborts the rebase, leaves the repo clean and prints the commands to finish by hand. It never force-pushes.

## Environment variables

| Variable | Default | Used by |
|---|---|---|
| `BACKEND_PORT` | `3000` | compose (host port) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `app` | compose |
| `CACHE_ENABLED` | `true` | backend (`false` makes every cached GET `BYPASS`) |
| `CACHE_TTL_SECONDS` | `60` | backend (±10% jitter applied) |
| `CACHE_TIMEOUT_MS` | `200` | backend (per Redis call) |
| `LOG_LEVEL` | `info` | backend |
| `BASE_URL` | `http://localhost:3000` | host tests |
| `SELENIUM_URL` / `APPIUM_URL` | `http://localhost:4444` / `:4723` | e2e tests |
| `BROWSER_BASE_URL` | `http://backend:3000` | Selenium (browser runs inside compose) |
| `RUN_DESTRUCTIVE` | `0` | pytest (Redis stop/start test) |
| `APP_PATH` | none | Appium (`mobile/android/app/build/outputs/apk/debug/app-debug.apk`) |

## Day-of checklist

1. 10:00-10:44 check-in; confirm the repo has **0 commits** (no README, .gitignore or license).
2. After 10:45: copy the skeleton in (`scripts/transplant.sh /path/to/repo`) or run the generator prompt inside the clone; commit and push.
3. Fill `docs/SPEC-CHECKLIST.md`; apply spec overrides (compose ports, `errors.js`, `validate.js`, `cache.js`).
4. Replace `backend/src/routes/example.js`; fill `TRACEABILITY.md` and `ADR.md` as you decide.
5. Push at least hourly (2 points per miss). Final Day 1 push before **15:05**; final Day 2 push before **14:05**.
6. **No pushes between 15:05 Day 1 and 10:15 Day 2.**

## Troubleshooting

- **Port 3000 in use:** `ss -ltnp | grep 3000`; stop the other process or run `BACKEND_PORT=3001 docker compose up -d` (the grader still uses the default).
- **SELinux (Fedora) "permission denied" on bind mounts:** add `:z` to the mount (`./tests/perf:/scripts:ro,z`). Every mount in this repo already has it.
- **Docker memory / OOM:** the core stack needs about 300 MB. Stop the Selenium grid when not in use: `docker compose -f docker-compose.yml -f docker-compose.test.yml --profile ui stop selenium-hub chrome`.
- **CRLF line endings** (`/usr/bin/env: 'bash\r'`): `.gitattributes` forces LF; fix existing files with `sed -i 's/\r$//' scripts/*.sh`.
- **`_JAVA_OPTIONS=-Xmx6G`:** every JVM (the Gradle daemon and each worker) gets a 6 GB heap, which can exhaust RAM on its own. Run `unset _JAVA_OPTIONS` and set `org.gradle.jvmargs=-Xmx2g` in `~/.gradle/gradle.properties`.
- **`adb devices` shows `unauthorized`:** accept the RSA prompt on the phone (revoke USB debugging authorisations and replug if it never shows). **`no permissions`:** switch the USB mode to File Transfer, or add a udev rule for the vendor id and run `sudo udevadm control --reload-rules`.
- **Metro `ENOSPC` / file watcher errors:** `echo fs.inotify.max_user_watches=524288 | sudo tee /etc/sysctl.d/99-inotify.conf && sudo sysctl --system`.
- **Phone cannot reach the backend:** the Fedora Workstation firewalld zone normally opens 1025-65535. Check from the phone's browser: `http://<laptop-ip>:3000/health`. If it fails: `sudo firewall-cmd --add-port=3000/tcp --add-port=8081/tcp --add-port=4723/tcp` (add `--permanent` to keep it). Over USB, `adb reverse tcp:3000 tcp:3000` avoids the network entirely.
- **Stale state:** `docker compose down -v && docker compose up --build -d --wait` gives a cold database, as the grader sees it.
