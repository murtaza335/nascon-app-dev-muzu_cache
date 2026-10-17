# Architecture Decision Records

Each ADR records one significant decision: the context that forced it, what we chose, and what it costs. Format:

- **Status:** Proposed | Accepted | Superseded by ADR-xxx
- **Date:** YYYY-MM-DD
- **Context:** the problem and constraints
- **Decision:** what we chose
- **Consequences:** (+) benefits, (-) costs and risks
- **Requirements linked:** REQ IDs from TRACEABILITY.md

> Keep each ADR to 5-8 lines. You must defend these verbally in the viva, so edit them to match what you actually built.
> The decisions below are **suggested defaults the team must confirm or change**; set Status to Accepted once confirmed.

---

## ADR-001: Backend framework

- **Status:** Proposed
- **Date:** 2026-10-17
- **Context:** An 8-hour build graded by HTTP test vectors; the team needs a fast, familiar stack that runs anywhere in Docker.
- **Decision:** Express 5 on Node 20 (`node:20-alpine`). Express 5 forwards rejected async handlers to the error middleware, so no try/catch boilerplate is needed.
- **Consequences:** (+) minimal boilerplate, three runtime dependencies (`express`, `pg`, `redis`), boots in about 1 s. (-) No built-in validation or typing; we hand-wrote a validator (ADR-004).
- **Requirements linked:** REQ-00

## ADR-002: Database and schema approach

- **Status:** Proposed
- **Date:** 2026-10-17
- **Context:** The grader starts from a cold database every run and may restart containers.
- **Decision:** PostgreSQL 16 with idempotent startup migrations (`CREATE TABLE IF NOT EXISTS`, under an advisory lock, in one transaction) and deterministic, idempotent seeds (`ON CONFLICT DO NOTHING`). Raw SQL through a `pg` pool (max 10).
- **Consequences:** (+) No manual migration step; `down -v && up` always works; constraints (UNIQUE, CHECK, FK) give integrity, and their violations map to 409/400. (-) No down-migrations; schema changes after release need a new statement, not an edit.
- **Requirements linked:** REQ-00, REQ-INF-01

## ADR-003: Caching strategy

- **Status:** Proposed
- **Date:** 2026-10-17
- **Context:** Read-heavy endpoints must stay fast under load, but a read right after a write must never be stale, and Redis must not become a single point of failure.
- **Decision:** Redis cache-aside on GET routes with a 60 s TTL (±10% jitter). Invalidation is by version key: each write does `INCR` on the resource's version key, after the DB write and before the response. Each Redis call has a 200 ms timeout, and the cache is bypassed (`X-Cache: BYPASS`) when Redis fails. Redis runs with `volatile-lru` and no persistence. Concurrent misses for one key share a single loader call (single-flight).
- **Consequences:** (+) Writes invalidate in O(1) with no SCAN; read-your-writes holds; a Redis outage only costs latency. (-) Old-version keys linger until their TTL expires; an extra Redis round trip on each miss.
- **Requirements linked:** REQ-INF-03

## ADR-004: API design (errors and validation)

- **Status:** Proposed
- **Date:** 2026-10-17
- **Context:** Hidden test vectors check exact status codes and error bodies on many failure paths; consistency matters more than cleverness.
- **Decision:** Strict input validation runs before any DB or cache call and reports all problems at once. Every error body is `{error_code, message, details?}`, built by a single error handler. Stack traces are never returned. A malformed id is 400 and a missing one 404; duplicates and FK conflicts are 409; malformed JSON is 400 `INVALID_JSON`.
- **Consequences:** (+) Predictable contract for graders and the mobile client; a spec-mandated shape change is one function (`formatError`). (-) Hand-written validator to maintain; unknown fields are silently stripped unless `strict`.
- **Requirements linked:** REQ-INF-01, REQ-INF-02

## ADR-005: Mobile stack and repo layout

- **Status:** Proposed
- **Date:** 2026-10-17
- **Context:** Mobile is graded by repo content and the viva; laptops have limited RAM; the campus network blocks most package hosts.
- **Decision:** React Native (Android) in `mobile/` inside the single root repository (no nested git), run on a physical phone over USB. One API client with a single base-URL constant; the UI's error handling is driven by `error_code` and displays `message`.
- **Consequences:** (+) Everything is graded from one repo; no emulator RAM cost; backend errors map directly to UI states. (-) Requires a Gradle cache warmed at home; iOS is not covered.
- **Requirements linked:** (fill on the day)

## ADR-006: Authentication and authorization

- **Status:** Proposed
- **Date:** 2026-10-17
- **Context:** (decide from the spec: is auth required, which roles exist, what token format)
- **Decision:** (e.g. bearer token checked by middleware; 401 `UNAUTHORIZED` when missing or invalid, 403 `FORBIDDEN` when the role is insufficient; passwords hashed with `crypto.scrypt`)
- **Consequences:** (+) / (-)
- **Requirements linked:**

## ADR-007: Testing strategy

- **Status:** Proposed
- **Date:** 2026-10-17
- **Context:** The grader runs hidden HTTP vectors; we need fast local proof of the same behaviour.
- **Decision:** Backend unit tests (`node:test`); pytest API tests with parametrized vectors generated per field (missing, null, wrong type, empty, too long, out of range) and tagged with REQ IDs; a k6 smoke test (p95 < 300 ms); optional Selenium and Appium smoke tests. CI mirrors the grader's cold start.
- **Consequences:** (+) Every requirement is traceable to a test; regressions are caught before the hourly push. (-) Local vectors are guesses at the hidden ones; the spec remains the authority.
- **Requirements linked:** REQ-00, REQ-INF-01, REQ-INF-02, REQ-INF-03

## ADR-008: Docker/compose and health strategy

- **Status:** Proposed
- **Date:** 2026-10-17
- **Context:** The grader runs `docker compose up --build -d` from the repo root with no `.env` and polls a health endpoint.
- **Decision:** A single root compose file with pinned images, `${VAR:-default}` for every value, and healthchecks on every service. The backend uses `depends_on: condition: service_healthy`. `/health` reports DB status (a failing DB gives 503) and cache status (a Redis outage still gives 200). Restart policy is `unless-stopped`.
- **Consequences:** (+) Cold boot in about 20 s with zero config; healthchecks are truthful; reproducible across machines. (-) Pinned tags need manual bumps; optional services must be uncommented and wired by hand.
- **Requirements linked:** REQ-00
