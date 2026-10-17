# Architecture Decision Records

These are the key architectural decisions for the NaSCon '26 Part I platform, kept separate so the team can review
(and defend in the viva) each one. Each record covers context, decision, alternatives, consequences and the linked
requirement IDs from [`REQUIREMENTS.md`](REQUIREMENTS.md). The structural summary is in
[`ARCHITECTURE.md` §18](ARCHITECTURE.md#18-decision-summary-details-in-adrmd).

- **Status:** Proposed (plan approved, not implemented) | Accepted (implemented and verified) | Superseded by ADR-xxx
- Change an ADR's status in the same commit that implements or abandons it, and log the change in `docs/CHANGELOG.md`.
- The starter ADRs that existed before 2026-10-17 11:15 PKT (generic Express/PG/Redis defaults) are superseded by this set; see `git log -p ADR.md`.

---

## ADR-001: Backend runtime: Node.js 22 LTS + Express 5
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** The team's starter is Node 20 + Express 5. Signatures must byte-match Python canonical JSON (NFR-SIG). Reproducing a float such as `1.0` exactly requires access to the JSON number's source text, which the `JSON.parse` reviver `context` argument provides from V8 11.4 onward. Node 20 ships V8 11.3; Node 22 ships V8 12.4.
- **Decision:** Move the base image from `node:20-alpine` to `node:22-alpine` (pin an exact tag at implementation time). Keep Express 5 (async errors propagate to the error handler).
- **Alternatives:** stay on Node 20 and hand-write a JSON tokenizer (more code, more bugs); Fastify (unfamiliar to the team, no benefit for grading).
- **Consequences:** (+) lossless numbers with zero dependencies; LTS. (−) The lockfile must be regenerated with Node 22 (`npm ci` in the image); developers need Node ≥ 22 on the host for unit tests, or must run them in Docker.
- **Requirements:** NFR-SIG, NFR-7, all API-*.

## ADR-002: PostgreSQL 16 as the single source of truth, raw SQL, forward-only migrations
- **Status:** Proposed (extends the current starter) · **Date:** 2026-10-17
- **Context:** Zero overselling (NFR-3), per-match ordered event sequences, unique ids with literal 409 codes, and a clean DB on every grader run.
- **Decision:** Raw SQL through `pg` (pool max 20, `statement_timeout` 4 s). Ordered `.sql` migrations under an advisory lock at boot, recorded in `schema_migrations`. Constraints carry invariants: `CHECK (stock >= 0)`, `UNIQUE (match_id, sequence)`, PKs on client ids. Triggers reject UPDATE/DELETE on `match_events` and `roster_audit` unless the session flag `app.allow_mutation` is set (only `/reset` sets it).
- **Alternatives:** ORM (Prisma/TypeORM: slow builds, less control over locking); SQLite (no concurrent row locks); event store in Redis (no transactions with the rest).
- **Consequences:** (+) correctness enforced by the database even if app code is wrong; (+) one transaction spans event + outbox + idempotency. (−) Hand-written SQL; mapping constraint names to error codes must be maintained.
- **Requirements:** FR-1.1-04, FR-2.2-04, FR-2.3-02, NFR-3, NFR-7.

## ADR-003: Error contract and validation pipeline exactly per spec §5.2
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** The grader compares status, `error.code` and field names literally. The starter emits `{error_code,message,details[]}` and `INVALID_JSON`, which do not match the spec.
- **Decision:** One formatter: `{"error":{"code","message","details":{}}}`. `details` is always an object; `VALIDATION_ERROR` carries `details.fields` (all offending dotted paths). Appendix B codes are constants in `errors.js`. A declarative validator runs first (400), then existence (404), then rules (409/402); the first failing step wins. Malformed JSON → 400 `VALIDATION_ERROR` `fields:["body"]`. Unknown fields are ignored. A body over 1 MB → 413 before parsing.
- **Alternatives:** keep the starter shape and translate per route (error-prone); JSON-schema library (ajv): possible, but the existing hand validator is small and already tested.
- **Consequences:** (+) every route behaves identically; (+) one place to change if organizers clarify. (−) The starter tests in `tests/api/test_errors_api.py` and `test_validation_api.py` must be rewritten.
- **Requirements:** §7 protocol rules, all API-*, NFR-5.

## ADR-004: Caching: only production reads and immutable data; never the graded projections
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** The user wants fast endpoints with proper caching. The spec, however, requires that standings be "recomputed from scratch from the event logs on every call", that the score be "rebuilt from the event log on read", and that inventory be exact under concurrency. A stale cache entry costs a whole vector, while a cache hit saves milliseconds against a 5 s budget.
- **Decision:**
  1. **L1 in-process** caches for immutable or reset-scoped data: sport configs (sports cannot be updated), compiled validators, demo password hashes, tenant branding. They are cleared by `/reset` (an epoch counter).
  2. **Redis cache-aside** (the existing `cache.js`, version-key invalidation, 60 s ± 10% TTL, single-flight, 200 ms timeout, BYPASS on failure) **only for `/api/v1` GET reads** used by the mobile app: league list, fixtures list, club profile, product catalogue, standings and match detail. Writes `INCR` the affected version keys **after commit, before responding**; `/reset` bumps a global epoch key that is part of every cache key.
  3. **Never cached:** every `/audit/v1/*` response, inventory, checkout, login, offline-sync and probes.
  4. Speed for uncached routes comes from design: one indexed query per read, in-memory projection, no network hops other than PostgreSQL, a bounded pool, no connection held across the gateway call.
- **Alternatives:** projection snapshots keyed by `match.version` (correct, but they contradict the literal "on every call" wording and add invalidation risk); HTTP ETags (deferred).
- **Consequences:** (+) zero risk of stale graded responses; (+) mobile reads are fast and read-your-writes holds. (−) Audit reads always hit PostgreSQL (expected < 50 ms at the spec's data sizes).
- **Requirements:** NFR-PERF-01/02, FR-1.4-01, FR-1.1-04, NFR-3.

## ADR-005: Event store: `match_events` table, per-match row lock, rebuild on read
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** The event log is append-only and signed. `sequence` is 1-based per match; `match_version` = the event count; compensations append and never mutate; limits and the state machine depend on the current projection.
- **Decision:** Append inside one transaction: `SELECT … FROM matches WHERE match_id=$1 FOR UPDATE` → load events → pure `projection.build(events, sportConfig)` → pure `eventRules.check()` → INSERT the event with `sequence = version + 1`, `UPDATE matches SET version = version + 1`. `matches.version` is a denormalized counter maintained in the same transaction. It is not a score, so the "no mutable counters as source of truth" rule holds; every score is derived from events. Compensation targets are found by scanning the loaded events (no flag column). `compensated`/`compensated_by` are derived.
- **Alternatives:** a global sequence (contention, wrong semantics); optimistic insert with retry on unique violation (more retries under the grader's parallel load).
- **Consequences:** (+) appends to different matches never block each other; (+) projection code is reused for reads, rules and sync. (−) Reading the whole log per append is O(events), fine for the spec's sizes.
- **Requirements:** FR-1.1-03, FR-1.1-04, FR-OFF-01.

## ADR-006: Idempotency: a success-only result store keyed by (scope, client id)
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** §5.2: replaying an identical request with `event_id`/`order_id`/`request_id`/`action_id` returns the stored result with 200 and changes nothing; the same id with a different body → `DUPLICATE_*`. Concurrent duplicates are possible.
- **Decision:** `idempotency(scope, client_id, request_hash, status_code, response)`, with `request_hash = sha256(canonical(body))`. Only successful (2xx) results are stored, in the same transaction as the side effects. Same-id requests are serialized with `pg_advisory_xact_lock` on `scope:id`. A replay returns the stored body with status 200. Orders store their full response (including `pdf_base64`) on the order row. Offline sync records every processed action (applied or rejected) in `offline_sync_actions`, because the spec requires re-sends to be `duplicate`.
- **Alternatives:** Redis SETNX (not transactional with the write); storing failures (would turn retried failures into replays, which the spec does not ask for).
- **Consequences:** (+) exact replay bodies (byte-identical signatures and PDFs). (−) Response JSON is duplicated in storage (small).
- **Requirements:** FR-1.1-04, FR-2.2-04, FR-2.3-02, FR-OFF-01.

## ADR-007: Canonical JSON and HMAC signatures, Python-compatible and lossless
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** The grader recomputes `HMAC_SHA256(DAY1_SALT, id + "|" + json.dumps(payload, sort_keys=True, separators=(",",":"), ensure_ascii=False))`. Pitfalls: JS sorts keys by UTF-16 code units (Python sorts by code points); `JSON.parse` turns `1.0` into `1` and loses precision beyond 2^53; the salt must not be trimmed.
- **Decision:** `lib/canonical.js` walks a **lossless tree**. The raw body is re-parsed with a reviver that captures `context.source` for every number, so integers emit their digits and non-integers emit the received lexeme verbatim. Keys are sorted with a code-point comparator. Strings are escaped exactly like Python (`\"`, `\\`, `\n`, `\r`, `\t`, `\b`, `\f`, other C0 controls as `\u00xx` lowercase); non-ASCII is left raw. The canonical string of each event payload is stored in `match_events.payload_canonical`, so replays and sync reuse the exact bytes. Receipts are built from integers and strings only. `lib/signature.js`: `createHmac('sha256', Buffer.from(salt,'utf8')).update(id + '|' + canonical, 'utf8').digest('hex')`.
- **Alternatives:** `JSON.stringify` with sorted keys (fails floats and astral-plane key order); a `json-canonicalize` package (RFC 8785, which differs from Python's output).
- **Consequences:** (+) matches App. A vector 1 and Python on unicode, nesting and floats. (−) Custom code needs thorough tests (vector 1, emoji keys, `1.0`, `1e-05`, big ints, control characters).
- **Requirements:** NFR-SIG, FR-1.1-04, FR-2.3-02, FR-OFF-01.

## ADR-008: Concurrency-safe inventory: conditional UPDATE + two-phase reservation + sweeper
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** 20 simultaneous buyers of the last unit → exactly 1 success, 19 `OUT_OF_STOCK`, stock 0, reserved 0. `reserved` must be visible while checkouts are in flight. A payment failure must release stock.
- **Decision:** tx1 reserves with `UPDATE variants SET stock = stock - $q, reserved = reserved + $q WHERE variant_id = $v AND stock >= $q` for each item in sorted variant order; if any affects 0 rows → rollback → 409 with that `variant_id`; then INSERT a reservation with `expires_at`. Then the in-process mock gateway runs. tx2 on success: `reserved -= q`, create the order (`paid`), receipt, outbox. tx2 on failure: `stock += q, reserved -= q`, then 402. A worker sweeper releases `held` reservations past `expires_at` (crash safety). `CHECK (stock >= 0 AND reserved >= 0)` is the last line of defense.
- **Alternatives:** SERIALIZABLE isolation (aborts → retries → latency); `SELECT … FOR UPDATE` then UPDATE (same effect, more round trips); a Redis DECR counter (two sources of truth).
- **Consequences:** (+) the database guarantees no oversell even under a bug; losers fail fast without waiting for the gateway. (−) Two transactions per checkout; an orphaned reservation lasts up to `RESERVATION_TTL_SECONDS` after a crash.
- **Requirements:** NFR-3, FR-2.3-02, FR-2.3-03.

## ADR-009: Authentication and authorization: custom HS256 JWT + policy-as-code
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** Five roles, scoped ownership, absolute tenant isolation, and the exact probe matrix of §5.13. Tokens are valid ≥ 1 h; `alg:none`, a tampered signature or an expired token → 401. Keycloak and Ory are allowed but heavy, and the grader treats tokens as opaque.
- **Decision:** `jsonwebtoken` with `algorithms:['HS256']` pinned plus an explicit header check. Claims: `sub, role, tenant_id, league_ids, club_id, player_id, iat, exp (12 h), jti`. Secret: `JWT_SECRET`, or derived as `HMAC(DAY1_SALT,"nascon-jwt-v1")` so the grader needs no extra env. `domain/rbac/matrix.js` declares action → rule; `policy.authorize(principal, action, resource)` evaluates super_admin → tenant match → scope predicate (own league / own club / own club's player / self / read-only viewer). Every protected route calls it; resources are loaded first (missing → 404), then 403. Passwords use scrypt (`node:crypto`), with the five demo hashes precomputed at boot so `/reset` stays fast.
- **Alternatives:** Keycloak (extra container, slow boot, realm import); a DB policy table (spec allows it; harder to unit-test for coverage).
- **Consequences:** (+) pure, 100%-testable policy; fast verification. (−) Token revocation is not supported (the 12 h expiry bounds exposure).
- **Requirements:** FR-5.1-01, FR-5.1-02, NFR-5.

## ADR-010: Rate limiting: in-memory sliding log per client IP on `/api/v1/*`
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** 100 requests per rolling 10 s per client IP. In the grader probe, 150 requests in 5 s → ≥ 40 return 429 with `Retry-After`, and a request 11 s later → 200. `/audit/v1/*` and `/health` are exempt (the grader may send 200 req/s there).
- **Decision:** A `Map<ip, number[]>` of accepted-request timestamps, pruned on access. Over the limit → 429 `RATE_LIMITED` with `Retry-After = ceil((oldest + 10000 − now)/1000)`. Rejected requests do not consume quota (so recovery happens 10 s after the last accepted request). The key is `req.socket.remoteAddress` (no trust in `X-Forwarded-For`). Periodic cleanup of idle IPs.
- **Alternatives:** Redis sorted set (needed only with multiple API replicas); fixed window (does not satisfy "rolling").
- **Consequences:** (+) exact, O(1) amortized, no I/O. (−) Per-process state; it is lost on restart (acceptable).
- **Requirements:** FR-SYS-03, NFR-5.

## ADR-011: Internal job queue: transactional outbox → Redis Streams → worker
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** Each order transition must emit a structured domain event to an internal queue. Compose must include a queue and workers (§1.3). Approved options: RabbitMQ, Redis Streams, NATS, BullMQ, Celery. A queue outage must not fail checkouts.
- **Decision:** Services INSERT into `outbox` in the same transaction as the state change. The `worker` container (same image, `node src/worker.js`) relays unpublished rows (`FOR UPDATE SKIP LOCKED`, batch 100, every 250 ms) to the Redis Stream `domain-events` (`XADD … MAXLEN ~ 100000`) and marks them published. A consumer group `workers` processes events: it logs, archives receipt PDFs to MinIO, and runs the reservation sweeper. Event shape: `{id, type, aggregate_id, occurred_at, payload}` (e.g. `order.status_changed`, `order.payment_failed`, `match.status_changed`, `roster.changed`).
- **Alternatives:** RabbitMQ (an extra broker container and boot time); direct XADD from the API (loses events if Redis blips after commit).
- **Consequences:** (+) at-least-once delivery, no extra broker, reuses Redis. (−) Consumers must be idempotent (keyed by outbox id); the stream lives in a non-persistent Redis, with the outbox as the durable record.
- **Requirements:** FR-2.3-04, DEL-01.

## ADR-012: PDF via pdfkit in the API; MinIO object store for the receipt archive
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** `pdf_base64` must be returned inline, start with `%PDF`, and its extracted text must contain `order_id` and `PKR 4500.00`. Approved generators (WeasyPrint, wkhtmltopdf, Puppeteer) are heavy; the spec also allows "PDF libraries". Compose must include an object store.
- **Decision:** `pdfkit` with a built-in Helvetica font renders the receipt synchronously after tx2 (it is generated once and stored for replay). The worker uploads `receipts/<order_id>.pdf` to the MinIO bucket `receipts` on the `order.status_changed → paid` event. MinIO is not on the health or checkout path.
- **Alternatives:** Puppeteer (≈ 300 MB image, slow, would endanger the 10 min build); no MinIO (would violate the compose requirement wording).
- **Consequences:** (+) about 30 ms PDFs, small image, text extractable by pypdf. (−) Helvetica WinAnsi cannot render non-Latin `customer_id` glyphs (cosmetic; the graded fields are ASCII).
- **Requirements:** FR-2.3-02, DEL-01.

## ADR-013: Realtime: WebSocket (`ws`) hosted in the API process
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** Status changes, live scores and product pins must reach connected clients in realtime. React Native has a built-in WebSocket client; SSE would need a polyfill library.
- **Decision:** `ws` attached to the HTTP server at `/api/v1/ws?token=`, with JWT verification on upgrade, topic subscriptions (`match:<id>`, `league:<id>`) checked against tenant scope, publishing after commit from services, and a 25 s ping. Single instance, in-memory hub.
- **Alternatives:** SSE (needs a client library); Redis pub/sub fan-out (only needed with multiple API replicas).
- **Consequences:** (+) zero client dependency, low latency. (−) Messages are lost while a client is disconnected; the mobile app re-fetches on reconnect and polls as a fallback.
- **Requirements:** FR-1.3-06, FR-2.3-05, MOB-03, RT-01.

## ADR-014: Swiss pairing via our own maximum-weight (blossom) matching
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** Rounds ≥ 2 must minimize Σ|score difference| over all rematch-free pairings, with a bye candidate fallback; greedy pairing "will fail". n ≤ 64. Third-party fixture libraries are prohibited.
- **Decision:** Implement Edmonds' weighted blossom (an O(n³) max-weight, max-cardinality matching, a port of the well-known public-domain algorithm description) in `domain/fixtures/blossom.js`. Edge weight = `K − 2·|Δscore|` (integers; K large), with rematch edges omitted. For each bye candidate in the spec order, remove it and solve; if the matching is perfect, accept it; otherwise try the next candidate; if none works → 409 `NO_VALID_PAIRING` with `details.round`. Pairs are ordered by the higher-ranked team (current standings order) for `SW-R{r}-M{i}` numbering; home = the higher-ranked team (not graded).
- **Alternatives:** backtracking with pruning (exponential worst case at n = 64 within a 5 s limit); a general matching npm package (arguably not a fixture library, but avoided to remove any doubt).
- **Consequences:** (+) provably optimal and fast. (−) Complex code, mitigated by brute-force cross-check tests for n ≤ 10.
- **Requirements:** FR-1.3-02.

## ADR-015: Pure domain modules per graded area; COVERAGE.json is generated
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** The coverage bonus is 10% of each backend area if declared line coverage is ≥ 85% and within 2 points of `./run_tests.sh`'s real figure. DB-bound code is hard to unit-test.
- **Decision:** All rules live in `backend/src/domain/<area>/` as pure functions (time, ids and config are injected). Services are thin orchestration. `run_tests.sh` runs `node --test` with the built-in coverage and lcov reporter; `scripts/coverage-areas.js` aggregates line coverage per area path set (ARCHITECTURE §4.3) and writes `COVERAGE.json` with one decimal. The committed file is always the output of the last run, never hand-edited.
- **Alternatives:** c8/Istanbul (extra dependencies, same data); measuring services with a live DB (slow and flaky for judges).
- **Consequences:** (+) honest, reproducible coverage; fast unit tests. (−) Discipline is needed to keep logic out of services and routes.
- **Requirements:** DEL-05, §9.3.

## ADR-016: Reset and seeding: one transaction, TRUNCATE + bulk baseline; demo data behind a flag
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** `/reset` must leave identical state every time, recreate exact seed ids and the five demo users, and finish in < 10 s. Startup must also seed. The desk check needs realistic fixtures, but extra data could collide with grader ids (e.g. `m1`).
- **Decision:** `seedBaseline(client, {seed, stock})` is shared by boot (only when the baseline is missing) and `/reset` (always, after `TRUNCATE … RESTART IDENTITY CASCADE` of every domain table, in one transaction under an advisory lock). It bulk-inserts the baseline, records `last_reset_seed`, and resets counters (`au-` numbering, `auth_n`). After commit it bumps the cache epoch and clears L1. `SEED_DEMO_DATA=true` (team laptop only) additionally seeds `demo-`-prefixed fixtures, matches, events and products under the seeded leagues and clubs; the grader default is `false`.
- **Alternatives:** DROP/CREATE schema (slower, re-runs migrations); deleting row by row (slow, order-sensitive).
- **Consequences:** (+) deterministic and fast (expected < 1 s). (−) The team must remember `SEED_DEMO_DATA=true` before judging (it is in the README desk-check checklist).
- **Requirements:** FR-SYS-02, DEL-08, NFR-7.

## ADR-017: Mobile: React Native (Android), SQLite cache + outbox, Keychain, NetInfo
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** One platform suffices; the team's Gradle cache is warmed for React Native; §8.4 requires SQLite/Room/Hive persistence, a persistent offline queue in the §5.14 format, an always-visible connectivity indicator, and Keystore token storage. The campus network may block Google Maven.
- **Decision:** React Native bare Android app in `mobile/` (no nested git; same RN version as the warmed cache, recorded here once created). Persistence: SQLite (`@op-engineering/op-sqlite`, fallback `react-native-sqlite-storage`) with tables `kv`, `cache_entries`, `outbox`, `sync_results`. Token: `react-native-keychain`. Connectivity: `@react-native-community/netinfo`. Navigation: React Navigation. One API client with a configurable base URL (Settings; default `http://10.0.2.2:8080`). Release APK signed with the debug keystore → `mobile/release/app-release.apk`; `usesCleartextTraffic=true`.
- **Alternatives:** AsyncStorage (not SQLite, so it fails the §8.4 wording); Flutter/Hive (no warmed cache); Kotlin/Room (slower UI iteration for this team).
- **Consequences:** (+) meets §8 exactly; offline-first by construction. (−) Native modules must build offline; validate the APK build by 13:30 PKT.
- **Requirements:** MOB-01…12, NFR-4, NFR-5, DEL-06.

## ADR-018: Compose topology: api, worker, postgres, redis, minio; API on host port 8080
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** §1.3: compose must bring up the API on host port 8080, database, cache, queue, object store and workers, and forward `DAY1_SALT: ${DAY1_SALT}`. §5.2: ≤ 10 min build, health ≤ 120 s, no manual steps, no internet needed at runtime.
- **Decision:** Five services (ARCHITECTURE §10.1). Only `api` publishes a port (`8080:8080`). The API depends on postgres and redis being healthy, and **not** on minio. The worker depends on all of them. Every value has a `${VAR:-default}` except `DAY1_SALT`. Pinned image tags, no `container_name`, healthchecks on all services, and `restart: unless-stopped`.
- **Alternatives:** a separate queue broker container (unnecessary with Streams); folding the worker into the API (violates "workers" and couples latency).
- **Consequences:** (+) matches the spec wording; health is independent of optional services. (−) Two more containers to build and pull.
- **Requirements:** DEL-01, NFR-7.

## ADR-019: Testing strategy
- **Status:** Proposed · **Date:** 2026-10-17
- **Context:** Hidden vectors (≥ 40 per area) compare everything literally; partial credit only comes from more vectors passing.
- **Decision:** (1) `node:test` unit tests for every domain rule, the spec examples and App. A vectors (they drive coverage). (2) pytest API vectors for every endpoint example, every Appendix B code, the 65-cell RBAC matrix, security probes, rate limit, 413, idempotency and edge cases 1–6 of §6, tagged `@pytest.mark.req("<ID>")`. (3) Concurrency tests (20-thread barrier, repeated). (4) CI mirrors the grader cold start on port 8080. (5) A manual desk-check script for mobile.
- **Consequences:** (+) every requirement is traceable to a test; (−) our vectors are only our reading of the spec, so any open question (REQUIREMENTS §12.2) remains a risk.
- **Requirements:** all; DEL-04, DEL-05.
