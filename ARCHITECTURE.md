# ARCHITECTURE — NaSCon '26 Part I Platform

> This file owns the **implementation structure**. Product behavior and contracts live in
> [`REQUIREMENTS.md`](REQUIREMENTS.md) (it never redefines API shapes). The detailed rationale for each
> decision lives in [`ADR.md`](ADR.md). Working practices are in [`AGENTS.md`](AGENTS.md).
>
> **Status legend:** **Current** = present in the repo today (backend starter at `2f133f8`; mobile scaffold reviewed 2026-10-17).
> **Proposed** = approved plan, not yet implemented. Nothing in this file implies that a proposed part exists.

---

## 0. Implementation status (2026-10-17)

The backend described below is implemented (all `/audit/v1` contracts API-01..17, the `/api/v1` production routes except the
P2 items, the worker and the realtime hub). Where the code differs from the sections below, **the code is current** and
the difference is listed here and in `docs/CHANGELOG.md`:

| Topic | Planned | Implemented |
|---|---|---|
| Compose service name | `api` | `backend` (plus `worker`, `postgres`, `redis`, `objectstore`) |
| Object store | MinIO (`minio/minio`) | `localstack/localstack:3.8.1` S3 service as `objectstore` (MinIO no longer publishes images: Docker Hub and Quay refuse the pull); the `minio` npm client still talks to it; no volume (copies only) |
| Checkout (§6.3) | two-phase reservation, sweeper | one transaction per checkout (order-id lock, variants `FOR UPDATE` in id order, rollback = release); `reserved` stays 0; `reservations` table and `queue/sweeper.js` are a safety net only |
| Receipt PDF | `pdfkit` | hand-written uncompressed PDF (`pdf/receiptPdf.js`), no dependency |
| Swiss matching | weighted blossom | exact branch-and-bound `domain/fixtures/pairing.js` (verified against brute force for n <= 10) |
| Validator | `http/validate.js` | `lib/validate.js` (pure, used by domain code too); `http/validate.js` re-exports it |
| JWT | `jsonwebtoken` | `lib/jwt.js` on `node:crypto` (HS256 pinned) |
| Idempotency/order responses | jsonb | `text` so replays keep the original key order |
| Lossless numbers | reviver `context.source` | `lib/canonical.js` re-parses `req.rawBody` for the signed sub-object (works on any Node) |
| Cache keys | resource version | resource version + global epoch (bumped by `/reset`); invalidation in `services/hooks.js` |
| Realtime | `realtime/ws.js` | same, plus topic `store:<tenant_id>` for `inventory.changed`; frames published from `services/hooks.js` |
| New modules | | `http/guard.js` (authorization helper, pagination), `services/{appReads,appWrites,orders,hooks}.js`, `seed/demo.js`, `queue/{outbox,consumers,sweeper}.js`, `worker.js` |
| New env vars | | `SEED_DEMO_DATA`, `MOCK_GATEWAY_LATENCY_MS`, `S3_ENDPOINT`, `S3_BUCKET_RECEIPTS`, `MINIO_ROOT_USER/PASSWORD`, `WORKER_HEARTBEAT_FILE` (see §9) |
| Schema | | `roster_audit.loan_end_date`; `roster_audit.audit_seq` is allocated as max+1 under a global advisory lock so `au-NNNN` is gap-free |

Verified commands: `./run_tests.sh` (unit + coverage + API suite), `cd backend && node --test "tests/unit/**/*.test.js"`,
`cd tests && ../.venv/bin/pytest api`. Not yet verified on this machine: a cold `docker compose up -d --build` (the sandbox
cannot reach Docker Hub or the npm registry from inside containers) and the real MinIO image (archive path verified against an
S3-compatible stub).

---

## 1. Goals and constraints

| Goal / constraint | Source | Consequence |
|---|---|---|
| Hidden vectors compare status, code, every field and signature exactly | §5, §9.2, NFR-SIG | A single error formatter, a single canonical-JSON/HMAC module, contract tests per field |
| One command, clean Linux, ≤ 10 min build, health ≤ 120 s, no manual steps, `DAY1_SALT` only from env | NFR-7, §5.2 | Compose-only stack; startup migrations and seed; fail fast without the salt |
| No hard-coded sport logic (−8) | FR-1.1-05 | Sport behavior is data (`sports.config` JSON) interpreted by a model-generic engine; sport names appear only in seed data |
| Zero overselling under 20 concurrent buyers | NFR-3 | A conditional `UPDATE … WHERE stock >= q` in PostgreSQL; two-phase reservation |
| Append-only event log; projections rebuilt on read | FR-1.1-04, FR-1.4 | `match_events` is insert-only; no stored score counters |
| Every request < 5 s, reset < 10 s; grader may send 200 req/s | NFR-PERF-01 | Indexed single-query loads, in-memory computation, a bounded pool, no network hops on the hot path except PostgreSQL |
| 5-role RBAC, absolute tenant isolation, negative tests | FR-5.1 | One policy-as-code module that every protected route calls |
| ≥ 85% line coverage per backend area (bonus) | §9.2, §9.3 | Domain logic lives in pure modules per area; `COVERAGE.json` is generated, never hand-typed |
| Self-hosted OSS only; approved stack (§7) | §1.1, §7 | PostgreSQL 16, Redis 7 (cache + Streams), MinIO, custom JWT, pdfkit |
| Offline-tolerant Android app | NFR-4, §8 | React Native + SQLite cache + persistent outbox + sync engine |

---

## 2. System context

```mermaid
flowchart LR
  subgraph Clients
    G[Python autograder]
    M[Android app (React Native)]
  end
  subgraph Compose["docker compose (project: nascon)"]
    API[api: Node 22 / Express 5\nREST + WebSocket\nhost :8080]
    W[worker: same image\noutbox relay, consumers,\nreservation sweeper]
    PG[(postgres:16\nsource of truth)]
    R[(redis:7\ncache + Streams)]
    S3[(minio\nreceipt archive)]
  end
  G -- HTTP /audit/v1, /api/v1/ping, /health --> API
  M -- HTTP /api/v1 + WS --> API
  API -- SQL (pool) --> PG
  API -- cache-aside, best effort --> R
  W -- poll outbox --> PG
  W -- XADD / XREADGROUP --> R
  W -- PUT receipts --> S3
```

**Main flow (plain language):** a request enters the `api` container on port 8080. The middleware assigns a request id, enforces the 1 MB limit, parses JSON losslessly, applies the rate limit (only on `/api/v1`) and authenticates (only where required). The route validates the body, then the service opens a PostgreSQL transaction, applies the domain rules (pure functions) and persists the result. In the same transaction it writes outbox domain events. It commits, then broadcasts realtime messages and invalidates cache versions. The `worker` relays outbox rows to a Redis Stream and consumes them (logging, archiving receipt PDFs to MinIO, releasing expired reservations).

**Trust boundaries:** (1) network → API: every input is untrusted, validated and size-limited, and every SQL parameter is bound. (2) API → PostgreSQL/Redis/MinIO: these sit on the compose network only; only port 8080 is published. (3) The mobile device: tokens are kept in the Android Keystore; the SQLite cache holds non-secret data only.

---

## 3. Stack

| Component | Technology / version | Purpose | Decision | Status |
|---|---|---|---|---|
| Backend runtime | Node.js **22 LTS** (`node:22-alpine`; exact patch pinned by digest/tag at implementation time) | API + worker | ADR-001 | Proposed (current: `node:20-alpine`) |
| Web framework | Express 5 (`express@^5.3.0` in the current lockfile) | Routing, middleware | ADR-001 | Current |
| DB driver | `pg` (`^8.23.1` current) | PostgreSQL access, raw SQL | ADR-002 | Current |
| Redis client | `redis` (`^6.3.0` current) | Cache-aside, Streams | ADR-004, ADR-011 | Current |
| Database | PostgreSQL 16 (`postgres:16-alpine`) | Source of truth | ADR-002 | Current |
| Cache / queue | Redis 7 (`redis:7-alpine`) | Cache + Streams queue | ADR-004, ADR-011 | Current (cache only) |
| Object store | MinIO (tag to verify at implementation; current compose comment: `RELEASE.2024-09-22T00-33-43Z`) | Receipt PDF archive | ADR-012 | Proposed |
| WebSocket | `ws` (version TBD at install) | Realtime layer | ADR-013 | Proposed |
| JWT | `jsonwebtoken` (version TBD) with `algorithms:['HS256']` pinned | Auth tokens | ADR-009 | Proposed |
| PDF | `pdfkit` (version TBD) | Receipt PDF | ADR-012 | Proposed |
| S3 client | `minio` npm (version TBD) | MinIO uploads (worker only) | ADR-012 | Proposed |
| Unit tests + coverage | `node:test` + built-in `--experimental-test-coverage` (lcov reporter) | Unit tests, COVERAGE.json | ADR-015 | Proposed (node:test current) |
| API tests | pytest + requests (current `tests/requirements.txt`) | Contract/integration vectors | ADR-019 | Current harness |
| Load probe | grafana/k6 (current `docker-compose.test.yml`) | Perf smoke | ADR-019 | Current |
| Mobile | Expo 54.0.37, React Native 0.81.5, React 19.1.0 (lockfile) | Android app; generated native project | ADR-017 | 21-screen UI preview; native build unverified |
| Mobile storage | SQLite via `@op-engineering/op-sqlite` (fallback `react-native-sqlite-storage`) | Offline cache + outbox | ADR-017 | Proposed |
| Mobile secure storage | `react-native-keychain` (Android Keystore) | JWT | ADR-017 | Proposed |
| Mobile connectivity | `@react-native-community/netinfo` | Online/offline | ADR-017 | Proposed |
| Mobile navigation | native 7.5.1, native-stack 7.21.0, bottom-tabs 7.21.0; screens 4.16.0, safe-area 5.6.2 | Navigation | ADR-017 | Installed; native build unverified |

Never guess versions: record exact versions from `package-lock.json` / Gradle once installed.

---

## 4. Repository tree and module responsibilities

### 4.1 Target tree (proposed; `*` = exists today)
```
docker-compose.yml*            grader entry (api, worker, postgres, redis, minio)
docker-compose.test.yml*       selenium/k6 profiles (test-only)
.env.example*                  every env var, no real salt
README.md*  TRACEABILITY.md*  ADR.md*  REQUIREMENTS.md  ARCHITECTURE.md  AGENTS.md
COVERAGE.json                  generated by run_tests.sh
run_tests.sh                   root test runner (spec-mandated name)
docs/spec/                     spec PDF + text (read-only)
docs/CHANGELOG.md              doc/decision change log
docs/IMPLEMENTATION-PLAN.md    slices, owners, order
docs/MOBILE.md* docs/CACHING.md* docs/TEAM.md* docs/SPEC-CHECKLIST.md*   legacy starter guides (see AGENTS §2)
backend/
  Dockerfile* package.json* package-lock.json*
  src/
    index.js*                  API boot (migrate → ensure baseline → listen → ready)
    worker.js                  worker boot (relay, consumers, sweeper)
    config.js*                 ONLY reader of process.env
    db.js*                     pool, withTx(), withAdvisoryLock()
    cache.js*                  Redis cache-aside (version keys) + global epoch
    errors.js*                 AppError, catalogue, formatError (spec envelope)
    migrate.js*                runs migrations/*.sql in order under an advisory lock
    migrations/001_init.sql …  schema
    http/
      app.js                   middleware order + router mounting
      middleware/{requestId,bodyLimit,jsonBody,rateLimit,authenticate,notFound}.js
      validate.js              schema validator → details.fields
    lib/
      canonical.js             canonical JSON (Python-compatible, lossless numbers)
      signature.js             HMAC recipe (§5.3)
      jwt.js                   sign/verify (HS256 pinned)
      pyround.js               Python round(x, 3)
      time.js                  UTC timestamp/date formatting, date math
      ids.js                   id regex, sequences (au-NNNN)
    domain/                    PURE: no I/O, no Date.now() (time injected), no process.env
      fixtures/{roundRobin,swiss,blossom,singleElim,doubleElim,index}.js
      scoring/{sportSchema,projection,eventRules,index}.js
      standings/{table,tiebreak,h2h,qualification,nrr,index}.js
      roster/{transferRules,registrationState,loanReturn,index}.js
      store/{pricing,checkoutRules,orderStateMachine,receiptPayload,mockGateway,index}.js
      rbac/{policy,matrix,index}.js
      sync/{resolve,index}.js
    repos/                     SQL only, one file per aggregate (sports, matches, events, leagues, roster, store, users, idempotency, outbox, sync)
    services/                  orchestration + transactions (one per area + reset, auth, realtime publish)
    routes/
      health.js*
      audit/{reset,sports,fixtures,leagues,events,score,standings,roster,checkout,inventory,rbac,offlineSync}.js
      api/{auth,leagues,matches,clubs,roster,players,store,offlineSync,ping}.js
    realtime/ws.js             WebSocket server, topic registry, tenant check
    pdf/receiptPdf.js          pdfkit rendering
    queue/{outbox,relay,consumers,sweeper}.js
    seed/{baseline,demo,passwords}.js   ← the ONLY place sport/event names may appear
  tests/
    unit/<area>/*.test.js      node:test, pure domain
    vectors/                   spec example JSON (App. A vectors, §5 examples)
tests/                         pytest API/contract suites (api/, e2e-*, perf/)
scripts/coverage-areas.js      lcov → COVERAGE.json per area
mobile/                        Expo/React Native app (see §11)
mobile/release/app-release.apk built artifact (committed; .gitignore exception)
```

### 4.2 Dependency direction (enforced by review and a CI grep)
`routes → services → (domain, repos, lib)`; `repos → db`; `domain → lib` (pure helpers only); `realtime`/`queue` are called by services after commit.
- `domain/**` must not import `db`, `repos`, `services`, `config`, `cache`, `http` or any npm package. Time and ids are parameters.
- Routes contain no SQL and no business rules: they parse, validate the shape, call one service and serialize.
- `/audit/v1` and `/api/v1` routes call the **same service functions**. The only differences are auth, RBAC and server-set fields (`requested_by`, `customer_id`).
- Shared code goes in `lib/` only if it is used by at least 2 areas and has no I/O.

### 4.3 Coverage areas (COVERAGE.json keys → measured paths)
| Key | Paths measured |
|---|---|
| `fixtures` | `backend/src/domain/fixtures/**` |
| `scoring` | `backend/src/domain/scoring/**`, `backend/src/lib/canonical.js`, `backend/src/lib/signature.js` |
| `standings` | `backend/src/domain/standings/**`, `backend/src/lib/pyround.js` |
| `store` | `backend/src/domain/store/**` |
| `roster` | `backend/src/domain/roster/**` |
| `rbac` | `backend/src/domain/rbac/**`, `backend/src/lib/jwt.js` |
The mapping is declared in `scripts/coverage-areas.js` and documented in README. Changing it requires an ARCHITECTURE update.

---

## 5. Hard-coded sport logic guard
Sport ids and event names may appear only in `backend/src/seed/**` and tests. The engine dispatches on `scoring_model` (`event` | `innings` | `round`), which is an enum of the spec, not a sport. A CI step greps `backend/src` (excluding `seed/`) for the seeded sport/event literals and fails on a match (FR-1.1-05).

---

## 6. Data architecture (PostgreSQL 16; canonical definitions in REQUIREMENTS §5)

### 6.1 Tables (proposed; `001_init.sql`)
| Table | Key / constraints | Notes |
|---|---|---|
| `tenants` | PK `tenant_id` | name, logo_url, colors jsonb |
| `users` | PK `user_id`; UNIQUE `lower(email)` | role CHECK in 5 roles; tenant_id FK nullable; `league_ids text[]`, `club_id`, `player_id` |
| `sports` | PK `sport_id` | name, scoring_model, `config jsonb NOT NULL`, `is_seed bool` |
| `leagues` | PK `league_id` | tenant_id (nullable), sport_id (nullable), name, `teams text[]`, `points jsonb`, `tie_break_order text[]`, `qualification_spots int`, `lots_seed int`, `transfer_window_open/close date`, `max_squad_size int`, `required_positions jsonb`, `organizer_user_id` |
| `matches` | PK `match_id`; FK sport, league | home_team_id, away_team_id, **`version int NOT NULL DEFAULT 0`** (event count, updated in the append tx), `status_cache text` (denormalized for lists, rebuilt with version), scheduled_at, venue_id, pinned_product_id |
| `match_events` | PK `event_id`; UNIQUE (`match_id`,`sequence`) | type, `payload jsonb`, `payload_canonical text` (signed bytes), signature, request_hash, created_at. **No UPDATE/DELETE grants used by the app** (a trigger rejects UPDATE/DELETE except during reset via a session flag) |
| `clubs` | PK `club_id`; FK tenant | name, home_venue jsonb, socials jsonb, staff jsonb |
| `players` | PK `player_id` | name, position, club_id (home club, RBAC) |
| `squads` | PK (`league_id`,`squad_id`) | club_id, tenant_id, name |
| `registrations` | PK (`league_id`,`player_id`) | squad_id, parent_squad_id, registration_type, start_date, loan_end_date, role, state, blocking_match_id |
| `roster_matches_in_progress` | PK (`league_id`,`match_id`) | home_squad_id, away_squad_id, ordinal |
| `roster_audit` | PK `audit_seq bigserial`; UNIQUE `audit_id`; UNIQUE (`loan_audit_id`) WHERE action='loan_return' | action, player_id, league_id, from/to, effective_date, state, who, `when`, why. Append-only trigger as for events |
| `products`, `variants` | PK ids; `variants.stock int CHECK (stock >= 0)`, `reserved int CHECK (reserved >= 0)` | price_minor current |
| `price_schedules` | PK (`variant_id`,`effective_from`) | scheduled price changes |
| `discount_codes` | PK `code` | percent |
| `reservations` | PK `reservation_id`; `order_id` | items jsonb, expires_at, state (held/committed/released) |
| `orders` | PK `order_id` | customer_id, status, totals, payment jsonb, receipt jsonb, pdf bytea, request_hash, `response jsonb` |
| `payment_attempts` | PK bigserial | order_id, token, outcome, created_at |
| `idempotency` | PK (`scope`,`client_id`) | request_hash, status_code, response jsonb (events, roster requests) |
| `offline_sync_actions` | PK (`device_id`,`action_id`) | result jsonb |
| `outbox` | PK `id bigserial`; partial index on `published_at IS NULL` | topic, type, aggregate_id, payload jsonb |
| `counters` | PK `name` | per-reset counters (`auth`, `cap`) when sequences are not convenient |
| `app_state` | PK `key` | `last_reset_seed`, `baseline_version` |
| P2: `seasons`, `divisions`, `stages`, `venues`, `venue_availability`, `match_schedule` | — | FR-1.2-01, FR-1.3-05 |

### 6.2 Indexes justified by access patterns
- `match_events (match_id, sequence)`: score projection and append (the unique index doubles as access path).
- `matches (league_id)`: standings loads all league matches, then `match_events` with `match_id = ANY($1)` ordered by `(match_id, sequence)`.
- `roster_audit (player_id, audit_seq)`: history and sync version count.
- `registrations (league_id, squad_id)`: squad counts.
- `outbox (id) WHERE published_at IS NULL`: relay polling.
- `reservations (expires_at) WHERE state='held'`: sweeper.

### 6.3 Transactions and consistency
- **Event append:** `BEGIN; SELECT … FROM matches WHERE match_id=$1 FOR UPDATE;` load events, project in memory, run `eventRules`, `INSERT match_events (sequence = version+1)`, `UPDATE matches SET version = version+1, status_cache=…`, `INSERT outbox`, `INSERT idempotency`; `COMMIT`. The row lock serializes appends per match; there are no global locks.
- **Same client id racing:** `pg_advisory_xact_lock(hashtextextended(scope||':'||id, 0))` at the top of the transaction for events, transfers, checkouts and sync devices.
- **Checkout:** tx1: idempotency lock, then `UPDATE variants SET stock=stock-$q, reserved=reserved+$q WHERE variant_id=$v AND stock>=$q` for each item **in variant_id order** (deadlock-free); if any update affects 0 rows → ROLLBACK → 409. INSERT reservation (expires_at = now + `RESERVATION_TTL_SECONDS`). COMMIT. Then the mock gateway (in process). tx2 (success): `reserved -= q`, reservation committed, INSERT order (status paid) + outbox (pending→paid) + stored response. COMMIT. tx2 (failure): `stock += q, reserved -= q`, reservation released, payment_attempts + outbox. COMMIT. The sweeper releases `held` reservations past expires_at (crash recovery).
- **Roster transfer:** a single tx with `SELECT … FOR UPDATE` on the league row (serializes roster changes per league), materializes due loan returns, runs `transferRules` (pure) on a snapshot, writes registration + audit + idempotency + outbox.
- **Reset:** a single tx with `SET LOCAL app.allow_mutation='on'`, `TRUNCATE … RESTART IDENTITY CASCADE` on all domain tables, bulk-insert the baseline (multi-row INSERTs), update `app_state`. After commit: bump the cache epoch and clear L1 caches. Serialized by an advisory lock.

### 6.4 Migrations
Ordered SQL files in `backend/src/migrations/`, executed at boot by `migrate.js` under `pg_advisory_lock` and recorded in `schema_migrations(version)`. Forward-only: never edit an applied migration, add a new file instead. During Phase I (no persisted prod data) editing `001_init.sql` is allowed **until the first push that the grader would run**; after that, add files.

### 6.5 Backup / recovery
The grader always starts from a clean state; `/reset` is the recovery path for test state. The team-laptop demo volume (`pgdata`) is disposable. There is no backup requirement in Phase I. `docker compose down -v` is a documented **manual** clean-slate step, never part of normal startup.

---

## 7. Contract implementation

### 7.1 Middleware order (`http/app.js`, proposed)
1. `requestId`: sets `X-Request-Id`; logs method, path, status and ms on finish.
2. `bodyLimit`: if `Content-Length` > 1,048,576 → 413 `PAYLOAD_TOO_LARGE` immediately; streaming bodies are also capped at 1 MB.
3. `jsonBody`: reads the raw body for **any** content type. Empty → `undefined`. Parses with a reviver that keeps the source lexemes of non-integer and unsafe-integer numbers in a side table (`req.lossless`) used only for canonicalization. A parse error → 400 `VALIDATION_ERROR` `fields:["body"]`, **except** on `/audit/v1/rbac/*` probes, where parse errors are ignored (authorization comes first; probes never read the body).
4. `rateLimit`: on `/api/v1/*` only (BR-RL-01). An in-memory sliding log per IP (ADR-010).
5. Routers: `/health`, `/audit/v1/rbac/*` (with `authenticate`), `/audit/v1/*`, `/api/v1/auth/*` (public), `/api/v1/*` (with `authenticate`), WS upgrade at `/api/v1/ws`.
6. `notFound`: 404 `ROUTE_NOT_FOUND`.
7. `errorHandler`: `AppError` → `{error:{code,message,details}}`. Unknown errors → 500 `INTERNAL_ERROR`, logged with the request id.

### 7.2 Validation
`http/validate.js` is a declarative schema per route (types: string-id, string, int (JSON integer only, `Number.isInteger` and not boolean), number, bool, enum, date, timestamp, object, array, map). It collects **all** failures into `details.fields` (dotted paths). Unknown fields are ignored and dropped. Business validation that needs the DB (existence, state) lives in services/domain, keeping the 400 → 404 → 409 order (REQUIREMENTS §7, BR-SCORE-10, BR-ROST-01, BR-STORE-01).

### 7.3 Errors
`errors.js` holds the Appendix B catalogue as constants (`E.OUT_OF_STOCK = {status:409, code:'OUT_OF_STOCK'}`), so domain code returns `{ok:false, error:E.X, details}` and never constructs status numbers ad hoc. Domain functions return result objects; services throw `AppError`. PostgreSQL errors are mapped (unique violation on known constraints → the specific catalogue code, e.g. `sports_pkey` → `SPORT_EXISTS`); anything else → 500. Responses never contain stack traces or SQL.

### 7.4 Authorization
`authenticate` verifies the JWT (`lib/jwt.js`: HS256 only, `exp` required, `alg:none` rejected by the algorithm pin and an explicit header check) → `req.principal`. Routes call `authorize(principal, action, resource)` from `domain/rbac/policy.js`, where the resource is loaded by the service (`{type:'club', id, tenant_id}`, `{type:'player', id, tenant_id, club_id}` …). The order is 401 → 404 (resource missing) → 403 → validation → rules. The policy matrix is data (`matrix.js`), and the 65 graded cells are unit-tested.

### 7.5 Serialization
Responses are built by explicit mapper functions per contract (field order as in the spec examples, all fields present, `null` not omitted). Timestamps go through `lib/time.js` (`YYYY-MM-DDTHH:MM:SSZ`). Money is integers. Swiss `score`/`buchholz` are numbers. NRR goes through `pyround`.

### 7.6 Integration boundaries
- **Mock gateway** (`domain/store/mockGateway.js`): a pure decision by token plus an id counter from the DB. Optional artificial latency (`MOCK_GATEWAY_LATENCY_MS`, default 0) to rehearse the burst. No network.
- **Redis:** every call has a 200 ms timeout. Failures degrade to BYPASS (cache) or leave outbox rows unpublished (queue) and are never on the request's critical path.
- **MinIO:** worker only. Failures are retried with backoff; they never affect API responses.

---

## 8. Caching and performance design (ADR-004)

| Layer | What | Key / invalidation | Why safe |
|---|---|---|---|
| L1 in-process (API) | Sport configs, JSON-schema compiled validators, the seed password hashes, tenant branding | Map keyed by id; cleared on `/reset` (epoch); sports are immutable after creation | Immutable data; a single API instance |
| Redis cache-aside (current `cache.js`) | **`/api/v1` GET reads only:** league list, fixtures list, club profile, product catalogue, mobile standings and match detail | Version keys: `ver:league:{id}`, `ver:match:{id}`, `ver:club:{id}`, `ver:catalogue:{tenant}`, plus `ver:epoch` (global). Writes `INCR` the affected versions after commit and before responding; `/reset` bumps the epoch. TTL 60 s ± 10%, single-flight on miss | Read-your-writes holds; a Redis outage → BYPASS |
| **Never cached** | All `/audit/v1/*` responses (score and standings are recomputed from the log on every call, as the spec mandates), inventory, checkout, auth/login, offline-sync, probes | — | Grader exactness; spec §5.10 "recomputed from scratch on every call" |
| Mobile SQLite | Fixtures, standings, club profiles, products, matches | Overwritten on every successful fetch; served when offline | NFR-4 |

**Hot-path budget (proposed targets, not agreed):** a single SQL round trip for reads (`matches` + `match_events` via `ANY($1)`), O(events) in-memory projection, O(n² log n) standings for n ≤ 40, O(n³) blossom for Swiss n ≤ 64, PDF render about 20–50 ms. The PG pool (`PG_POOL_MAX`, default 20) keeps no pool connection held across the gateway call. `keepAliveTimeout` 65 s.

---

## 9. Configuration

| Variable | Consumer | Required | Safe dev default | Secret | Notes |
|---|---|---|---|---|---|
| `DAY1_SALT` | api, worker | **Yes** | none (`.env.example` holds a placeholder `change-me-dev-salt`) | **Yes** | Compose: `DAY1_SALT: ${DAY1_SALT}` verbatim. Boot fails with a clear log line if it is empty or missing. Never trimmed, never logged. |
| `PORT` | api | No | `8080` | No | Container port; compose publishes `8080:8080` (fixed, the grader needs 8080). |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | postgres, api, worker | No | `app` / `app` / `app` | Dev-only creds | The DB is not published to the host; never reuse these outside local/grader runs. |
| `DATABASE_URL` | api, worker | No | composed in compose | Contains creds | — |
| `PG_POOL_MAX` | api | No | `20` | No | — |
| `REDIS_URL` | api, worker | No | `redis://redis:6379` | No | — |
| `CACHE_ENABLED` / `CACHE_TTL_SECONDS` / `CACHE_TIMEOUT_MS` | api | No | `true` / `60` / `200` | No | Current. |
| `JWT_SECRET` | api | No | derived: `HMAC_SHA256(DAY1_SALT, "nascon-jwt-v1")` | **Yes** | Set explicitly outside the grader; the derivation keeps the grader zero-config. |
| `JWT_TTL_SECONDS` | api | No | `43200` (12 h; spec ≥ 1 h) | No | — |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | api | No | `100` / `10000` | No | Spec values; changing them breaks grading. |
| `RESERVATION_TTL_SECONDS` | api, worker | No | `60` | No | Sweeper threshold. |
| `MOCK_GATEWAY_LATENCY_MS` | api | No | `0` | No | Rehearsal only. |
| `SEED_DEMO_DATA` | api | No | `false` | No | `true` on the team laptop for the desk check (adds `demo-`-prefixed fixtures/matches/products). **Off for the grader.** |
| `S3_ENDPOINT` / `S3_BUCKET_RECEIPTS` | worker | No | `http://objectstore:4566` / `receipts` | No | The bucket is created by the worker at boot. |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | minio, worker | No | `minioadmin` / `minioadmin` | Dev-only creds | Not published to the host (no host port). |
| `LOG_LEVEL` | api, worker | No | `info` | No | — |
| `BASE_URL` | host tests | No | `http://localhost:8080` | No | Current default (3000) must change. |

`backend/src/config.js` stays the only reader of `process.env` (current rule).

---

## 10. Runtime and deployment

### 10.1 Compose topology (proposed `docker-compose.yml`)
| Service | Image | Host port | Depends on (condition) | Healthcheck |
|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | none | — | `pg_isready` |
| `redis` | `redis:7-alpine` (no persistence, `volatile-lru`, 128 MB) | none | — | `redis-cli ping` |
| `objectstore` | `localstack/localstack:3.8.1` (replaces MinIO) | none | — | `curl` of `/_localstack/health` for the s3 service |
| `api` | build `./backend` | **8080:8080** | postgres healthy, redis healthy | `wget -qO- http://127.0.0.1:8080/health` |
| `worker` | build `./backend`, `command: ["node","src/worker.js"]` | none | postgres healthy, redis healthy, objectstore started, api healthy | process-alive (optional heartbeat file) |

`api` deliberately does **not** depend on the object store, so `/health` cannot be delayed by object storage. Restart policy: `unless-stopped`. There is no `container_name` and no `:latest` tag (the current CI checks both).

### 10.2 Startup sequence (api)
1. Load config and validate `DAY1_SALT` (exit 1 if missing).
2. `waitForDb` (current, 30 × 1 s).
3. Run migrations (advisory lock).
4. Ensure the baseline: if `app_state.baseline_version` is missing → run the same `seedBaseline()` used by `/reset` (idempotent; it does not wipe an existing demo DB).
5. Precompute the demo password hashes (scrypt) into L1.
6. Connect Redis (non-blocking, current behavior).
7. `listen(8080)`; set `ready=true` → `/health` 200.

Worker: wait for the DB, create the MinIO bucket if absent (retry), start the outbox relay (poll every 250 ms, `FOR UPDATE SKIP LOCKED`, batch 100), the consumer group `XREADGROUP` on stream `domain-events`, and the reservation sweeper (every 10 s).

### 10.3 Graceful shutdown
The current `index.js` behavior is kept: on SIGTERM stop accepting, close idle keep-alives, drain (force exit after 5 s), end the pool and disconnect Redis. The worker stops its loops and acknowledges in-flight messages.

### 10.4 Addresses
| From | To API |
|---|---|
| Host / grader | `http://localhost:8080` |
| Inside compose | `http://api:8080` |
| Android emulator | `http://10.0.2.2:8080` |
| Physical phone | `http://<laptop LAN IP>:8080` (or `adb reverse tcp:8080 tcp:8080` → `http://localhost:8080`) |

### 10.5 Clean-checkout baseline (proposed commands; verify when implemented)
Prerequisites: Docker Engine 24+ with Compose v2. Optional: Node 22 (unit tests on the host), Python 3.11+ (pytest), JDK 17 + Android SDK (mobile).
```bash
cp .env.example .env                      # set DAY1_SALT to a dev value (human step)
DAY1_SALT=dev-salt docker compose up -d --build
./scripts/wait-for-health.sh http://localhost:8080/health 120   # expect {"status":"ok"}
curl -s -X POST localhost:8080/audit/v1/reset | jq .status      # "reset_complete"
./run_tests.sh                            # unit tests + COVERAGE.json (+ API tests if the stack is up)
```
Automated: migrations, seed, bucket creation, health. Human: choosing the dev salt, Android SDK setup, installing the APK.

---

## 11. Client architecture (mobile; ADR-017)

**Current:** Expo/React Native TypeScript app with all 21 screen designs, shared
tokens/components, typed role-aware navigation and a read-only mock-data adapter.
This is a UI-only in-memory preview. Authentication, HTTP transport, native
persistence, connectivity detection, sync and realtime remain unimplemented.
`mobile/SCREEN-PLAN.md` records the screen inventory and integration targets.
Initial frontend fixtures live in `mobile/tests/fixtures/mockData.ts`, with
`createMockData()` for isolated preview state and integrity checks in
`mobile/tests/mockData.test.cjs` (`npm run test:mock-data` from `mobile/`).
This test-data location keeps sport/event literals within the permitted boundary.
Contract-shaped reads, requests and alternative outcomes are separate from
UI-only/provisional data. `mobile/MOCK-DATA.md` maps all 21 screens and records
contract gaps. `src/app/previewData.ts:getPreviewData` adapts these read-only fixtures
to typed screen data, scoped by role/tenant with separately selected sync scenarios.
`mobile/DESIGN-BRIEF.md` records the approved direction. Implemented tokens live
in `src/theme/tokens.ts`; reusable UI is in `src/components/ui.tsx`. Root DESIGN.md
and `.impeccable/design.json` describe the code system; native visual review is pending.
`PRODUCT.md` records user-confirmed product context for Impeccable; it does not
replace REQUIREMENTS or define visual tokens. `.impeccable/config.json` stores
the user-selected code-first workflow for future landing/showcase work; native
app screens use code-first independently. Local hook consent stays in the
existing `.impeccable/config.local.json`.
Keep the existing feature layout; the earlier flat `screens/`, `api/`, `db/` and
`sync/` proposal is replaced by the following equivalent responsibility boundaries.

```text
mobile/
  index.ts       Expo registerRootComponent -> App.tsx -> src/app/App.tsx
  app.json       Expo config; Android project generated by prebuild
  scripts/       existing Windows SDK/JDK and USB helpers
  src/
    app/         app root, in-memory preview provider and mock-data adapter
    navigation/  typed role-aware tabs/detail stacks, screen registry and studio
    features/    screen UI and feature-local hooks/components/types
      auth/ home/ fixtures/ matches/ standings/ clubs/
      store/ roster/ scoring/ sync/ settings/
    config/      env.ts (current startup URL); future runtime settings
    components/  shared UI and loading/empty/error/offline previews
    theme/       implemented tokens and tenant identity marker
    hooks/       planned shared useCachedQuery and other cross-feature hooks
    types/       typed screen data and role models; not wire contract definitions
    services/
      api/       errorMessages.ts implemented; HTTP client/endpoints planned
      auth/      planned Keychain session; login UI stays in features/auth
      storage/   planned SQLite migrations, cache/outbox/result repositories
      sync/      planned NetInfo, device ID, sync engine; UI in features/sync
      realtime/  planned socket lifecycle and subscriptions
  release/       required app-release.apk destination; APK not present
```

**Dependency direction:** app/navigation compose features; features use shared
hooks, UI and services. Services do not import screens. Screens use repositories
and session/socket abstractions rather than handling SQLite, tokens or connections.
Create feature subfolders only as code requires them.

The following behavior remains proposed, with REQUIREMENTS sections 8–10 owning
all contracts and acceptance criteria:

- **Data flow:** `useCachedQuery(key, fetcher)` serves SQLite data immediately,
  marks its age, refreshes online and writes successful responses back. Cache keys
  include server/user/tenant scope. Required cached screens: fixtures, standings,
  club profiles. SQLite tables remain `kv`, `cache_entries`, `outbox`, `sync_results`.
- **Mutations:** only supported scoring and roster transfer/loan/release actions
  enter the persistent API-17 queue, with stable action/request IDs, UTC timestamps
  without milliseconds and the last known match/player version. Checkout and
  add-player have no specified offline queue action type.
- **Sync:** trigger on reconnect, foreground, manual Sync, and every 30 s online
  with pending work; APP-40 batches contain at most 100 actions. Store outcomes,
  remove applied/duplicate pending items and retain rejected results visibly with
  reasons until dismissed. A force-close must preserve pending work.
- **Session:** tokens only in Keychain. A 401 clears the session while preserving
  outbox work; logout clears cached tenant data and asks before discarding pending
  actions. Never replay retained work under a different user/tenant/server.
- **Realtime:** Match detail subscribes to `match:<id>`, refreshes on reconnect,
  and falls back to a 10 s poll while WS is unavailable.
- **Platform:** Android only. Use the existing Expo prebuild/native-build workflow;
  generated Android files are ignored, so repeatable native configuration belongs
  in tracked configuration/scripts. Release cleartext HTTP, signing and APK copy
  still need implementation and verification. Final artifact:
  `mobile/release/app-release.apk`.

---

### 11.1 Screen-only implementation slice (2026-10-17)

User authorized the 21-screen UI and approved the design brief. Added within
existing folders: `theme/tokens.ts`, `components/{ui,Icon}.tsx`,
`navigation/{routes,AppNavigator,screenRegistry,ScreenStudio}`, `app/{PreviewContext,previewData}`,
`types/preview.ts`, `services/api/errorMessages.ts`, and the 21 feature files
listed in mobile/SCREEN-PLAN.md. No new service, port, environment variable or
backend module is introduced.

Installed ADR-017 navigation stack (lockfile): @react-navigation/native **7.5.1**,
native-stack **7.21.0**, bottom-tabs **7.21.0**, react-native-screens **4.16.0**,
react-native-safe-area-context **5.6.2**. Navigation and safe-area modules require
a new native build; an older APK does not contain this screen implementation.

PreviewProvider accepts typed ScreenData or adapts the separately owned test
fixtures. Cart, server URL, role, tenant and state choices are memory-only.
Screen Studio is explicitly a development/design control, not authentication.
All mutations and PDF actions report that integration is unavailable. No success
is fabricated from a button press. Tenant color is a non-text identity marker;
app text keeps contrast-safe tokens. Non-admin data remains within its tenant,
with club/league ownership checks on management views. These are presentation
rules, not server authorization.

Checks: TypeScript passed; 12 display-adapter/navigation checks and 6 mock-data
integrity checks passed; Android Hermes export passed. Native layout, font scaling,
rotation, keyboard and TalkBack checks remain open. Offline Gradle build failed
for uncached screens dependencies; online retry stalled fetching them and was
stopped. The final Hermes export passed. Emulator startup failed for
insufficient host committed RAM. No persistence/offline desk-check or release
APK acceptance is claimed. See mobile/README.md for exploration and verification.

### 11.2 Interactive mock application (authorized 2026-10-17)

The user authorized complete local mock journeys, persistent mock sessions,
reload/recovery, themes and the remaining management surfaces. This supersedes
the disconnected-action restriction of ADR-020 for mock mode only. No real API
contract, open-question default, backend service, port or environment changes.

Add `services/mock/{engine,seed}.ts` for pure local commands and projection,
`services/storage/mockStorage.ts` for a versioned SQLite snapshot and settings,
`services/auth/mockSession.ts` for Keychain-only mock session metadata, and
`services/mock/receipt.ts` for deterministic local PDF generation. Existing Expo
file-system (already in the lockfile) handles local receipt export; no new PDF
runtime dependency. Install ADR-017-approved op-sqlite, Keychain and NetInfo.

Each mock server address has an independent world. Session, carts and queue scope
include server/user/tenant; only secure session metadata lives in Keychain, never
passwords. SQLite commits precede accepted mutation/queued feedback. Logout asks
about pending work; expiry preserves it for re-login. Mock management contracts
remain local prototypes, not invented production endpoints. Persist theme and
server settings. Use reduced-motion-safe native feedback, pull-to-refresh,
retryable failures, explicit demo credentials and visible mock-mode labeling.

## 12. Verification architecture

| Level | Scope | Tool / command (verified unless marked proposed) |
|---|---|---|
| Unit | `domain/**`, `lib/**` (pure), with spec examples and App. A vectors as fixtures | `cd backend && node --test tests/unit` |
| Coverage | per area → `COVERAGE.json` | `./run_tests.sh` → `node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=../reports/lcov.info tests/unit` + `node ../scripts/coverage-areas.js` |
| Property | round-robin invariants n = 2..40; Swiss optimality vs brute force n ≤ 10; double-elim graph rules for B = 4..128 | node:test loops |
| Contract / API | every §5 example, every Appendix B code, the RBAC 65-cell matrix, security probes, rate limit, 413, idempotency | `cd tests && pytest api -m "not destructive"` (current harness, retargeted to 8080) |
| Concurrency | 20-thread barrier checkout burst ×20 repetitions; parallel event appends on one match | pytest (`threading.Barrier`) |
| Reproducibility | cold `docker compose up -d --build` + health < 120 s + reset twice gives identical results (a table hash) | CI job (current `.github/workflows/ci.yml`, retargeted) + `scripts/preflight.sh` |
| Static guards | no sport literals outside seed; no `:latest`; no `.env` tracked; no SQL string interpolation | CI grep steps |
| Mobile | manual desk-check script (§8.4), judge-task dry run (§8.6), optional Appium smoke (current `tests/e2e-mobile`) | `docs/MOBILE.md` checklist |
| Perf | k6 smoke on `/audit/v1/score` and `/standings` | current `docker-compose.test.yml` perf profile |

---

## 13. Requirement-to-design mapping

| Req | Component | Mechanism | Verification | Remaining risk |
|---|---|---|---|---|
| FR-1.1-01/02/05 | `domain/scoring/sportSchema`, `seed/baseline`, `repos/sports` | JSON schema validation; config-driven engine; seed via the same path | unit + API-03 vectors + CI grep | Unspecified validation nuances (e.g. `name` whitespace) |
| FR-1.1-03/04 | `domain/scoring/projection`, `eventRules`, `services/events` | Append-only table + per-match row lock + rebuild on read | unit per model + API-06/07 vectors | OQ-05, OQ-07 interpretations |
| NFR-SIG | `lib/canonical`, `lib/signature` | Python-compatible canonicalization with lossless numbers | App. A vector 1 + unicode/float tests | Float lexemes the grader generates differently |
| FR-1.2-02 | `services/leagues` | Validation + bulk insert of matches | API-05 vectors | OQ-21 |
| FR-1.3-01…04 | `domain/fixtures/*` | Circle method; blossom matching; recursive seeding; bracket graph builder | property tests + exact examples | Graph-check details for double elim (OQ-18) |
| FR-1.4-01 | `domain/standings/*` | Recursive resolve with restart-on-split; pyround; SHA-256 lots | unit (3-way tie, lots vector 2, qualification) | OQ-15/16/17 |
| FR-2.2-* | `domain/roster/*`, `services/roster` | Ordered rule pipeline on an as-of snapshot; lazy loan return with a unique constraint | unit per rule + precedence + API-10/11 | OQ-06/09/10 |
| FR-2.3-02/03, NFR-3 | `services/store`, `domain/store/*`, `pdf/receiptPdf` | Conditional UPDATE reservation; two-phase commit; sweeper | 20-thread burst ×20; PDF text extraction test | Pool exhaustion under a larger burst (bounded by pool 20) |
| FR-2.3-04 | `queue/outbox`, `queue/relay`, `worker` | Transactional outbox → Redis Stream | integration test reads the stream | Redis restart loses unacknowledged stream entries (the outbox is the source of truth) |
| FR-5.1 | `domain/rbac/*`, `lib/jwt`, `authenticate` | Policy-as-code matrix + scope predicates | 65-cell test + forged/none/expired token tests | OQ-11 |
| FR-SYS-02 | `services/reset` | TRUNCATE + bulk insert in one tx | reset twice → identical table digests | Time budget if seed grows (demo data off) |
| FR-SYS-03 | `http/middleware/rateLimit` | In-memory sliding log | pytest 150-burst + 11 s recovery | A multi-instance API would need Redis (not planned) |
| FR-OFF-01 | `domain/sync/resolve`, `services/sync` | Sequential per-action processing reusing the event/roster services | API-17 vectors + desk check | Version semantics for roster (all-league count) |
| RT-01 | `realtime/ws` | In-process topic hub, broadcast after commit | WS integration test | Lost messages during reconnect (the mobile app polls as a fallback) |
| NFR-7 | compose, `index.js` boot | Health gating, startup seed | CI cold start | Image pull time on the grader network |
| NFR-4 | mobile `services/storage`, `services/sync` | SQLite cache + outbox | desk-check script | RN native module build offline (Gradle cache) |

---

## 14. Representative flows

### 14.1 Success: `POST /audit/v1/events` (score)
1. Middleware: request id, size OK, lossless parse (`req.body`, `req.lossless`). No rate limit (audit).
2. Route: schema validation (event_id/match_id ids, type enum, payload object) → on failure 400 `VALIDATION_ERROR` `fields`.
3. Service `appendEvent`: `withTx` → advisory lock on `event:<event_id>` → idempotency lookup (identical → return the stored 200) → `SELECT match FOR UPDATE` (missing → 404) → load the sport config (L1) → load events → `projection.build()` → `eventRules.check(type, payload, projection, config)` (400/409 result) → canonicalize the payload (lossless) → sign → INSERT event, UPDATE version, INSERT outbox, INSERT idempotency → COMMIT.
4. After commit: `realtime.publish('match:m1', …)`, `cache.invalidate('match:m1','league:lg-1')`.
5. Response 201 mapper → `{event_id, match_id, type, sequence, match_version, signature}`.

### 14.2 Failure: 20 concurrent checkouts, last unit
Each request: validation OK → idempotency lock on its own `order_id` → tx1 conditional `UPDATE variants … WHERE stock >= 1`. PostgreSQL row locking serializes the 20 updates: the first decrements stock to 0; the other 19 re-evaluate `stock >= 1` after the lock is released, affect 0 rows → ROLLBACK → 409 `OUT_OF_STOCK` `{variant_id}` via `errorHandler`. The winner calls the gateway → tx2 commits `reserved 1→0` and the order is paid → PDF → 201. Inventory → `{stock:0, reserved:0}`. The mobile app maps `OUT_OF_STOCK` to "Sorry, that size just sold out." Where errors are translated: the domain returns `E.OUT_OF_STOCK` → the service throws `AppError` → `errorHandler` formats it → the client maps the code to a message.

### 14.3 Timeouts and retries
- PG: `connectionTimeoutMillis` 3 s; `statement_timeout` 4 s on the pool (keeps every request < 5 s). The reset session raises it to 9 s.
- Redis: 200 ms per call, no retry on the request path.
- Worker → MinIO/Redis: exponential backoff (0.5 s → 10 s cap), unlimited retries, idempotent by key (`receipts/<order_id>.pdf`, outbox id).
- Mobile → API: 10 s timeout; sync retries with backoff (2 s → 60 s cap) while online.

---

## 15. Logging and diagnostics
One line per request: `METHOD path status ms request_id` (current). Errors are logged with the stack server-side only. Boot logs: config summary (no secrets), migration count, baseline status. The worker logs relay lag and consumer failures. `docker compose logs api worker` is the diagnostic entry point; `scripts/run-tests.sh` already dumps `reports/compose.log`.

---

## 16. Known limitations and risks
| Risk | Impact | Mitigation / what resolves it |
|---|---|---|
| Spec ambiguities (OQ-05…22) | Hidden vectors may disagree | Written questions before 13:00 PKT; defaults isolated in single functions for quick flips |
| Python-exact float canonicalization | Signature mismatch on decimal payloads | Lossless lexemes (Node 22 reviver `context.source`); unit tests |
| Single API instance (in-memory rate limit, WS hub) | Not horizontally scalable | Acceptable for Phase I; move to Redis if Part II demands scale |
| MinIO image pull adds build time | Could approach the 10 min budget on a slow network | Pin a tag; measure a cold pull; MinIO is not on the health path |
| Mobile APP integration gaps (tenant/club/squad discovery and scoring config reads) | Screens cannot infer selectable resources from documented contracts alone | Coordinate contracts with backend owner before functional implementation; see mobile/SCREEN-PLAN.md |
| RN native modules + blocked Gradle hosts | APK build failure on campus | Use only modules warmed in the Gradle cache; build the APK early (by 13:30) |
| Coverage below 85% | Loses 10% of each area | Pure domain modules; coverage gate in `run_tests.sh` |

## 17. Extension points (future, not Phase I)
Additional scoring models (add to the `scoring_model` enum + projection strategy map), additional fixture formats (`domain/fixtures/index.js` registry), Redis-backed rate limit/WS fan-out for multiple API replicas, a real payment provider adapter behind the `mockGateway` interface.

## 18. Decision summary (details in ADR.md)
| # | Choice | Rationale | Alternatives | Consequence | Status |
|---|---|---|---|---|---|
| ADR-001 | Node 22 + Express 5 | Team stack; lossless JSON reviver | Node 20 (no `context.source`), Fastify | Base image change | Proposed |
| ADR-002 | PostgreSQL raw SQL, forward-only migrations | Constraints + row locks for NFR-3 | ORM | Hand-written SQL | Proposed (extends current) |
| ADR-003 | Spec error envelope, validation pipeline | Literal comparison by grader | Current `{error_code}` shape | Rewrite errors.js | Proposed |
| ADR-004 | Cache only `/api/v1` reads + immutable L1; never audit | Spec mandates recompute; correctness first | Projection snapshots | Audit reads hit PG every time | Proposed |
| ADR-005 | Event store table + per-match row lock | Ordered sequences, append-only | Global sequence, event bus | Per-match serialization | Proposed |
| ADR-006 | Idempotency table keyed by scope+id, success-only | §5.2 replay semantics | Redis idempotency | Extra write per request | Proposed |
| ADR-007 | Python-compatible canonical JSON with lossless numbers | Signature exactness | `JSON.stringify` sort | Custom code + tests | Proposed |
| ADR-008 | Conditional UPDATE + two-phase reservation + sweeper | Zero oversell, observable `reserved` | SERIALIZABLE, Redis locks | Two transactions | Proposed |
| ADR-009 | Custom HS256 JWT + policy-as-code | Spec allows; simplest | Keycloak (heavy) | Own policy tests | Proposed |
| ADR-010 | In-memory sliding-log rate limit | Single instance, exact window | Redis ZSET | Not multi-instance | Proposed |
| ADR-011 | Transactional outbox → Redis Streams → worker | Reliable events, no extra broker | RabbitMQ, BullMQ | Worker service | Proposed |
| ADR-012 | pdfkit in API; MinIO archive in worker | Fast PDF, object store required by compose | Puppeteer/WeasyPrint | Archive is async | Proposed |
| ADR-013 | WebSocket (`ws`) in API | RN has built-in WS client | SSE | Single-instance hub | Proposed |
| ADR-014 | Own weighted blossom for Swiss | Exact optimum required | Greedy/backtracking | ~300 LOC algorithm | Proposed |
| ADR-015 | Pure domain + built-in coverage → COVERAGE.json | Honest ≥ 85% per area | c8, Istanbul | Discipline on purity | Proposed |
| ADR-016 | Reset = TRUNCATE + bulk seed; demo data flag | Identical state, < 10 s | Drop/recreate DB | Flag must be set for the desk check | Proposed |
| ADR-017 | Existing Expo/RN scaffold; planned SQLite + Keychain + outbox | Matches §8; preserve local scaffold | Bare RN/Flutter/Kotlin | Native build compatibility unverified | Proposed capabilities; current scaffold recorded |
| ADR-018 | Compose: api/worker/postgres/redis/minio, port 8080 | §1.3 table | Fewer services | MinIO pull time | Proposed |
| ADR-019 | Testing pyramid as in §12 | Vectors are literal | — | Test upkeep | Proposed |

### Current vs proposed deltas to apply first (from the repo as it is today)
1. Port `3000` → `8080` (compose, Dockerfile `EXPOSE`, config default, healthcheck, tests' `BASE_URL`, CI, docs).
2. Error body `{error_code,message,details[]}` → `{error:{code,message,details:{}}}`; malformed JSON code `INVALID_JSON` → `VALIDATION_ERROR`; validation `details` array → `details.fields`; `NOT_FOUND`/`CONFLICT`/`UNAUTHORIZED` → catalogue codes.
3. `/health` body `{"status":"ok","db":true,"cache":true}` → exactly `{"status":"ok"}`; seed-awareness.
4. Remove `routes/example.js` and the `items` table; remove `GET /` (or keep it, since it is harmless and not in the spec).
5. Add `DAY1_SALT: ${DAY1_SALT}` to the api and worker environment.
6. `.gitignore` `*.apk` → add `!mobile/release/app-release.apk`.
7. Root `run_tests.sh` + `COVERAGE.json` (spec names); keep `scripts/run-tests.sh` as the API test runner or merge.
8. Timestamps without milliseconds.
