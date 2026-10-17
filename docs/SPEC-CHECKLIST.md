> **Superseded where conflicting (2026-10-17).** This starter guide predates the NaSCon '26 Part I spec. The canonical sources are [`REQUIREMENTS.md`](../REQUIREMENTS.md), [`ARCHITECTURE.md`](../ARCHITECTURE.md), [`ADR.md`](../ADR.md) and [`AGENTS.md`](../AGENTS.md). Key overrides: API port **8080** (not 3000); error body `{"error":{"code","message","details":{}}}`; mobile storage is SQLite + Keystore (not AsyncStorage). See `docs/CHANGELOG.md`.

# Spec Checklist (complete in the first 15 minutes)

Read the spec once end to end, then fill this in. Anything the spec defines **overrides** the skeleton defaults.

## API contract

- [ ] Base URL / port the grader uses: `________` (required `http://localhost:8080`)
- [ ] Health path and expected body: `________` (required `GET /health` -> exactly `{"status":"ok"}`)
- [ ] Path prefix (`/audit/v1` graded; `/api/v1` mobile): `________`
- [ ] Endpoint list:

| Method | Path | Request body / query | Success status + body | Error cases | REQ ID |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

- [ ] Request/response JSON shapes: field names (`snake_case` or `camelCase`?), types, nullability
- [ ] Id type: case-sensitive client strings as defined by REQUIREMENTS section 5.
- [ ] Timestamp format (required UTC without fractional seconds `2026-10-17T10:45:00Z`)
- [ ] Status codes: create 201 or 200? delete 204 or 200 with body?
- [ ] **Error format** (exact shape): `________` (required `{error:{code,message,details:{}}}`)
- [ ] Error code names required? `________`
- [ ] Auth: none / API key / bearer JWT / session? Header name? Roles?
- [ ] Production pagination: limit/offset; default limit 50, max 100; `{data,total,limit,offset}`. No audit pagination.
- [ ] Sorting / filtering params
- [ ] Seed data required at startup? (must be deterministic and idempotent)

## Infrastructure

- [ ] Required services beyond postgres/redis (object storage, queue, push, streaming)?
- [ ] Required ports or service names?
- [ ] Grader command exactly (`docker compose up --build -d --wait`?), health timeout
- [ ] Resource limits mentioned?

## Mobile

- [ ] Screens / features required:
- [ ] Offline / caching / push requirements?
- [ ] Deliverables: APK in repo? screenshots? demo video? (if APK, remove `*.apk` from `.gitignore`)

## Documents and scoring

- [ ] Required format for `ADR.md` / `TRACEABILITY.md` (template given?)
- [ ] Other deliverables (README sections, diagrams, test reports)
- [ ] Day 1 scope vs Day 2 scope
- [ ] Scoring weights: backend ___ / mobile ___ / docs ___ / tests ___ / viva ___
- [ ] Tie-breaker definition ("automated test vectors passed" = the grader's vectors or ours?)
- [ ] Push rules (hourly penalty, lock windows)

## Apply spec overrides

- [ ] `docker-compose.yml`: ports, service names, env
- [ ] `backend/src/errors.js`: `formatError()` shape, error code names, status mapping
- [ ] `backend/src/validate.js`: rules, id format, pagination defaults and limits
- [ ] `backend/src/cache.js`: TTLs, key prefix (and decide which routes are cached)
- [ ] `backend/src/routes/example.js`: replace with the real resources
- [ ] `backend/src/migrate.js`: real schema + seed
- [ ] `tests/api/*`: update vectors to the real endpoints
- [ ] `TRACEABILITY.md`: one row per requirement
