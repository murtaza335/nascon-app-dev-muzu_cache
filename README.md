# NaSCon '26 Part I: Multi-Sport League & Club Operations Platform

> Mobile handoff (2026-10-17): `mobile/` now contains an Expo/React Native
> UI preview with all 21 screen designs. Use [mobile/README.md](mobile/README.md)
> for setup/exploration and [mobile/SCREEN-PLAN.md](mobile/SCREEN-PLAN.md) for scope.
> The backend starter examples below describe legacy behavior, not the target
> contracts. [REQUIREMENTS.md](REQUIREMENTS.md) and
> [ARCHITECTURE.md](ARCHITECTURE.md) govern port 8080, the error envelope and
> the planned stack. Backend readiness has not been verified by the mobile review.

## What this is

A generic, domain-free starter for the 8-hour NaSCon '26 app-dev competition:

- **Backend:** Node 20 + Express 5, PostgreSQL 16, Redis 7 (cache-aside), all in one root `docker-compose.yml` that the autograder runs as-is.
- **Conventions baked in:** one consistent error body, strict input validation, malformed id is 400 and missing id is 404, conflicts are 409, ISO-8601 UTC timestamps, `snake_case` JSON.
- **Test harness:** `node:test` unit tests, pytest API test vectors tagged with requirement IDs, an optional Selenium smoke test, a k6 smoke test and a CI workflow that mirrors the grader.
- **Mobile:** All 21 React Native Android screen designs and role-aware navigation exist as a UI-only mock-data preview; backend, persistence and native acceptance remain pending ([mobile setup](mobile/README.md), [desk-check checklist](docs/MOBILE.md)).

The only domain code is `backend/src/routes/example.js` (an `items` CRUD), which shows every convention. **Replace it on the day.**

## Quick start

```bash
export DAY1_SALT=<the salt you were given>      # required; never written to a file we commit
docker compose up -d --build
./scripts/wait-for-health.sh http://localhost:8080/health 120     # → {"status":"ok"}
curl -s -X POST localhost:8080/audit/v1/reset                      # baseline: tenants, sports, leagues, clubs, users, stock
```

For the desk check (judge phone), add demo fixtures, rosters and products first: `SEED_DEMO_DATA=true docker compose up -d --build`
(then `POST /audit/v1/reset` once). **Leave it off for the grader.** The compose project is `nascon`.

| Service | Image | Host port | Notes |
|---|---|---|---|
| backend | built from `backend/` | **8080** | API + WebSocket; healthcheck `GET /health` (does not depend on MinIO) |
| worker | same image | none | outbox relay → Redis Stream, consumer, receipt archive to MinIO, reservation sweeper |
| postgres | `postgres:16-alpine` | none | source of truth, volume `pgdata` |
| redis | `redis:7-alpine` | none | cache-aside for `/api/v1` reads + the `domain-events` stream |
| objectstore | same image as the backend (`backend/src/objectstore.js`) | none | tiny S3-compatible server on `objectstore:4566`, bucket `receipts`, volume `objects`; MinIO no longer publishes images and the alternatives are ~1 GB, so nothing extra is downloaded. Copies only: the receipt of record is in PostgreSQL |

## Demo accounts (password `Nascon@26`, recreated by every startup and `/reset`)

| Role | Email | Scope |
|---|---|---|
| Super Admin | `admin@nascon.test` | all tenants |
| League Organizer | `organizer@nascon.test` | owns `league-alpha-1` (tenant-alpha) |
| Club Manager | `manager@nascon.test` | `club-alpha-1` (tenant-alpha) |
| Player | `player@nascon.test` | `player-alpha-1` (tenant-alpha) |
| Viewer | `viewer@nascon.test` | read-only, tenant-alpha |

Baseline ids: tenants `tenant-alpha`, `tenant-beta`; leagues `league-alpha-1`, `league-alpha-2`, `league-beta-1`; clubs
`club-alpha-1`, `club-alpha-2`, `club-beta-1`; product `prod-jersey-001` with variants `var-jersey-001-M` (stock 1) and
`var-jersey-001-L` (stock 5), price 450000 paisa; discount code `WELCOME10`.

## API overview

Errors always look like `{"error":{"code","message","details"}}` (codes: REQUIREMENTS §7). Timestamps are
`YYYY-MM-DDTHH:MM:SSZ`; money is integer paisa. Full contracts: REQUIREMENTS §8.

| Area | Endpoints |
|---|---|
| System | `GET /health`, `POST /audit/v1/reset` |
| Sports and scoring | `POST /audit/v1/sports`, `POST /audit/v1/events`, `GET /audit/v1/score/{match_id}` |
| Leagues | `POST /audit/v1/leagues`, `GET /audit/v1/standings/{league_id}` |
| Fixtures | `POST /audit/v1/fixtures` (round robin, Swiss, single and double elimination) |
| Roster | `POST /audit/v1/roster/setup`, `POST /audit/v1/roster/transfer`, `GET /audit/v1/roster/history/{player_id}` |
| Store | `POST /audit/v1/checkout`, `GET /audit/v1/inventory/{variant_id}` |
| RBAC | `POST /audit/v1/rbac-matrix`, probes `/audit/v1/rbac/...`, `GET /api/v1/ping` |
| Offline | `POST /audit/v1/offline-sync` |
| Mobile (`/api/v1`, Bearer JWT) | auth `POST /auth/login`, `GET /me`; reads `GET /leagues`, `/leagues/{id}/fixtures`, `/leagues/{id}/standings`, `/matches/{id}`, `/clubs/{id}`, `/store/products`; writes `POST /matches/{id}/events`, `PUT /matches/{id}/pin`, `POST /clubs/{id}/players`, `POST /roster/transfers`, `PATCH /players/{id}`, `POST /store/checkout`, `POST /offline-sync`; orders `GET /store/orders[/{id}[/receipt.pdf]]`, `POST /store/orders/{id}/transition` |
| Realtime | `GET /api/v1/ws?token=<jwt>` (topics `match:<id>`, `league:<id>`, `store:<tenant_id>`) |

Not implemented (P2, no Phase I script grades them): match status changes `APP-12`, seasons/divisions/stages `APP-20..22`,
manual rescheduling `APP-23`.

## Running tests

```bash
./run_tests.sh                    # unit tests + line coverage → COVERAGE.json, then the API suite if the stack is up
cd backend && node --test "tests/unit/**/*.test.js"                       # unit only (pure, no stack)
cd tests && ../.venv/bin/pytest api -m "not destructive"                  # API vectors (BASE_URL defaults to :8080)
```

The API suite needs `DAY1_SALT` exported to the same value as the server for the signature checks (default `dev-salt`), and
`SEED_DEMO_DATA=true` on the server for the mobile-API and realtime tests (they skip themselves otherwise). Create the venv once:
`python3 -m venv .venv && .venv/bin/pip install -r tests/requirements.txt`. Reports go to `reports/`.

## Repo layout

```
docker-compose.yml        grader entry point (backend, worker, postgres, redis, objectstore)
backend/src/              index.js (API boot) worker.js config.js db.js cache.js errors.js migrate.js
  http/ lib/ domain/      middleware; pure helpers; pure rules (fixtures scoring standings roster store rbac sync leagues)
  repos/ services/ routes/  SQL only; transactions and orchestration; thin HTTP mapping (audit/ and api/)
  migrations/ seed/ queue/ realtime/ pdf/
backend/tests/unit/       node:test, pure domain
tests/api/                pytest contract vectors tagged @pytest.mark.req("<ID>")
mobile/                   React Native app
docs/                     IMPLEMENTATION-PLAN, CHANGELOG, spec/ (binding PDF), legacy starter guides
TRACEABILITY.md COVERAGE.json run_tests.sh TASKS.md
```

## Environment variables (all optional except `DAY1_SALT`; `.env.example` lists them)

| Variable | Default | Used by |
|---|---|---|
| `DAY1_SALT` | none, required | api (signatures, token secret); never logged or committed |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `app` | compose |
| `CACHE_ENABLED` / `CACHE_TTL_SECONDS` / `CACHE_TIMEOUT_MS` | `true` / `60` / `200` | api |
| `SEED_DEMO_DATA` | `false` | api (demo fixtures for the desk check; off for the grader) |
| `MOCK_GATEWAY_LATENCY_MS` | `0` | api (rehearse the checkout burst) |
| `JWT_SECRET`, `JWT_TTL_SECONDS` | derived from the salt, `43200` | api |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `100` / `10000` | api (spec values; changing them breaks grading) |
| `S3_ENDPOINT`, `S3_BUCKET_RECEIPTS`, `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (S3 credentials; any value works with LocalStack) | `http://objectstore:4566`, `receipts`, `minioadmin` | worker |
| `PG_POOL_MAX`, `LOG_LEVEL` | `20`, `info` | api |
| `BASE_URL` | `http://localhost:8080` | host tests |

## Hourly push

```bash
scripts/push.sh "FR-1.1-04: scoring engine"      # commit, rebase onto origin, push
scripts/push.sh                                  # "chore: hourly checkpoint HH:MM"
```

The script refuses to push outside the competition windows (Asia/Karachi). Pushing is a human action: agents commit locally only.
On a rebase conflict it aborts, leaves the repo clean and prints the commands to finish by hand. It never force-pushes.

## Troubleshooting

- **Port 8080 in use:** `ss -ltnp | grep 8080`; stop the other process. The grader needs host port 8080, so the port is fixed in `docker-compose.yml`.
- **SELinux (Fedora) "permission denied" on bind mounts:** add `:z` to the mount (`./tests/perf:/scripts:ro,z`). Every mount in this repo already has it.
- **Docker memory / OOM:** the core stack needs about 300 MB. Stop the Selenium grid when not in use: `docker compose -f docker-compose.yml -f docker-compose.test.yml --profile ui stop selenium-hub chrome`.
- **CRLF line endings** (`/usr/bin/env: 'bash\r'`): `.gitattributes` forces LF; fix existing files with `sed -i 's/\r$//' scripts/*.sh`.
- **`_JAVA_OPTIONS=-Xmx6G`:** every JVM (the Gradle daemon and each worker) gets a 6 GB heap, which can exhaust RAM on its own. Run `unset _JAVA_OPTIONS` and set `org.gradle.jvmargs=-Xmx2g` in `~/.gradle/gradle.properties`.
- **`adb devices` shows `unauthorized`:** accept the RSA prompt on the phone (revoke USB debugging authorisations and replug if it never shows). **`no permissions`:** switch the USB mode to File Transfer, or add a udev rule for the vendor id and run `sudo udevadm control --reload-rules`.
- **Metro `ENOSPC` / file watcher errors:** `echo fs.inotify.max_user_watches=524288 | sudo tee /etc/sysctl.d/99-inotify.conf && sudo sysctl --system`.
- **Phone cannot reach the backend:** the Fedora Workstation firewalld zone normally opens 1025-65535. Check from the phone's browser: `http://<laptop-ip>:8080/health`. If it fails: `sudo firewall-cmd --add-port=8080/tcp --add-port=8081/tcp --add-port=4723/tcp` (add `--permanent` to keep it). Over USB, `adb reverse tcp:8080 tcp:8080` avoids the network entirely.
- **Stale state:** `POST /audit/v1/reset` restores the baseline without touching volumes. `docker compose down -v` (manual only, never scripted) gives a fully cold database, as the grader sees it.
- **No DAY1_SALT:** the API refuses to start (`[boot] DAY1_SALT is missing or empty`) and compose warns that the variable is unset. Export it first; it is never stored in a file we commit.
