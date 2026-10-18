# AGENTS.md: working guide for coding agents and developers

**Project:** NaSCon '26 Part I is a multi-tenant sports league and club operations platform. It has a Node 22 / Express 5 backend
(PostgreSQL 16, Redis 7, MinIO, worker) graded by hidden Python vectors on `http://localhost:8080`, and a React Native
Android app judged at the desk.
**Delivery priority:** (1) graded `/audit/v1/*` contracts behave exactly per spec; (2) the stack is reproducible from one
command; (3) offline-capable mobile app + APK; (4) P2 features. **Hard lock 15:00 PKT; last push ≤ 15:05:00 PKT.**

## 1. Read before every task (in this order)
> **Day 2 (Part II, 2026-10-18):** start with [`day2/README.md`](day2/README.md). Day 2 requirements, the backend and frontend contracts, architecture, plan and push windows live in `day2/` and win over the Phase I files for Part II behaviour (see `day2/REQUIREMENTS.md` §9).

1. `AGENTS.md` (this file): how we work.
2. [`REQUIREMENTS.md`](REQUIREMENTS.md): **owns product behavior and API contracts** (requirement IDs, BR-* rules, API-/APP-/RT- contracts).
3. [`ARCHITECTURE.md`](ARCHITECTURE.md): **owns implementation structure** (modules, data, config, runtime, caching).
4. [`ADR.md`](ADR.md): rationale for each decision. [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md): slice order and owners.
5. When wording matters, check the binding spec: [`docs/spec/nascon26-part1-spec.pdf`](docs/spec/nascon26-part1-spec.pdf) (§ numbers are cited everywhere).

Legacy starter guides (`docs/CACHING.md`, `docs/MOBILE.md`, `docs/TEAM.md`, `docs/SPEC-CHECKLIST.md`, and README sections about
port 3000 and the `{error_code}` body) predate the spec. **Where they conflict with the files above, the files above win.**

## 2. Scope and conflict handling
- Precedence: spec PDF (and organizers' written clarifications) > explicit human direction in the session > REQUIREMENTS > ARCHITECTURE/ADR > AGENTS > legacy docs > code.
- If you find a conflict, do not silently pick one side. State it in your report and fix the lower-priority document in the same change. Add a line to [`docs/CHANGELOG.md`](docs/CHANGELOG.md).
- Do not change open-question defaults (REQUIREMENTS §12.2) without a human decision or a written organizer answer.

## 3. Hard rules
- **Runtime:** the API listens on container port 8080, published as `8080:8080`. Node 22 in Docker is the source of truth.
- **Infrastructure:** `docker compose up -d --build` must work with no `.env` except `DAY1_SALT`. No manual steps, no `container_name`, no `:latest`, healthchecks on every service. `/health` must not depend on MinIO.
- **Secrets:** `DAY1_SALT` is read only from the environment at startup. It is never hard-coded, committed, logged, trimmed or put in `.env.example` (placeholder only). No real secrets in any file.
- **Data:** `match_events` and `roster_audit` are append-only. Score and standings are derived from events on every audit read. Money is integer paisa. Timestamps are `YYYY-MM-DDTHH:MM:SSZ`. Parameterized SQL only.
- **Domain:** no sport ids or event names (`football`, `goal`, `wicket`, …) outside `backend/src/seed/**` and tests (−8 penalty). No third-party fixture-generation libraries. `backend/src/domain/**` is pure: no I/O, no `Date.now()`, no `process.env`.
- **Contracts:** response field names, status codes and error codes are copied from REQUIREMENTS §7–8 exactly. Never invent a code where an Appendix B code applies.
- **Third-party services:** no Firebase, Supabase, Amplify or any managed BaaS (−10). Payments go only through our mock gateway.
- **Git:** work on `master` unless a human says otherwise. Never force-push, rewrite pushed history, or commit `.env`, `node_modules` or a nested `.git` in `mobile/`. Committing and pushing are **human-authorized** actions: an agent never runs `git commit` (not even locally) or `git push` unless a human explicitly asks for that specific commit/push; agents leave changes in the working tree and list them in the report. Remind the team of push windows: 10:45–11:45, 11:45–12:45, 12:45–13:45, 13:45–14:45, final ≤ 15:05:00.
- **Deployment:** there is no deployment beyond the grader cloning the repo. `docker compose down -v` is a manual reset only; never script it into startup.

## 4. Working loop
1. Name the requirement IDs you are addressing (e.g. `FR-2.2-02`, `API-10`, `BR-ROST-01`).
2. Inspect the relevant code and the owning docs; check §12.2 open questions for your area.
3. State the intended change in 2–4 lines (files, behavior, tests).
4. Implement one small coherent slice (domain function + test, then service, then route).
5. Verify (§6), then update docs per §9, then report (§11).

## 5. Definition of Done
- Acceptance criteria for the touched IDs are demonstrably met, including the failure, boundary and precedence cases in REQUIREMENTS.
- Unit tests for the domain logic, and a pytest API vector for each touched endpoint path (success + every error code it can emit) tagged `@pytest.mark.req("<ID>")`.
- Contracts are unchanged, or REQUIREMENTS was updated first in the same change. Spec-defined shapes may never change.
- `TRACEABILITY.md` rows for the IDs list real file:function and test names, and `COVERAGE.json` is regenerated if domain code changed.
- Remaining limitations are written in the report (and in ARCHITECTURE §16 if lasting).

## 6. Verification commands
These are proposed until the first slice lands; replace "proposed" with "verified" in ARCHITECTURE §12 when they run.
```bash
cd backend && node --test "tests/unit/**/*.test.js"                    # unit (pure, no stack needed)
./run_tests.sh                                            # unit + coverage → COVERAGE.json (+ API suite if stack up)
DAY1_SALT=dev-salt docker compose up -d --build && ./scripts/wait-for-health.sh http://localhost:8080/health 120
cd tests && ../.venv/bin/pytest api -m "not destructive"  # contract vectors
```
Minimum per change: the unit tests for the touched area. Backend route changes also need the stack up and the API tests for that area.

## 7. Decision boundaries
- **You may decide (reversible, local):** internal names, helper extraction, SQL query shape, index additions, log wording, test structure, UI layout details inside the HCI rules.
- **You must document (ARCHITECTURE/ADR + CHANGELOG):** new modules/directories, new env vars, schema changes, cache keys/TTLs, queue topics, any default for an ambiguous spec point, mobile library choice/version.
- **Human approval required:** new services/containers, new runtime dependencies beyond those listed in ARCHITECTURE §3, changes to the compose topology or ports, changing an open-question default, changing priorities/scope, anything touching `DAY1_SALT` handling, git push/history operations, deleting data volumes.

## 8. Stack conventions
- **Layers:** `routes → services → domain | repos | lib`. Routes: parse → validate shape → call one service → map response. Services: transactions, locks, ordering of checks, after-commit hooks (realtime, cache invalidation). Domain: pure rules returning `{ok, value} | {ok:false, error:E.CODE, details}`. Repos: SQL only.
- **Shared services:** `/audit/v1` and `/api/v1` routes call the **same** service functions. Never fork logic per surface.
- **Validation:** the declarative schema in `http/validate.js`. Collect all failing fields, ignore unknown fields, and keep JSON integers strict. Order: 400 → 404 → 409/402 (exceptions are written in REQUIREMENTS BR-*).
- **Errors:** throw `AppError` built from the `errors.js` catalogue constants. Never `res.status(n).json(...)` ad hoc. No stack traces, SQL or paths in responses.
- **Authorization:** `authenticate` middleware, then `policy.authorize(principal, action, resource)` after loading the resource. Every new protected action needs a matrix entry plus allow and deny unit tests.
- **Idempotency:** client-id writes take `pg_advisory_xact_lock(scope:id)`, then do the replay lookup, and store only successes in the same transaction.
- **Caching:** only `/api/v1` GETs via `cache.cached()`, with `cache.invalidate()` after commit and before responding. Never cache `/audit/v1/*`, inventory or auth (ADR-004).
- **Naming:** snake_case JSON; camelCase JS; files `camelCase.js`; SQL snake_case; ids as given by clients (never normalized).
- **Migrations:** forward-only `backend/src/migrations/NNN_name.sql`. Never edit one that has been pushed after the first graded-ready push; add a new file.
- **Lifecycle:** boot = config check → DB wait → migrate → ensure baseline → listen → ready. Keep graceful shutdown working.
- **Mobile UI states:** every screen implements loading / empty / error (plain language via `errorMessages.ts`) / success / offline. Tap targets ≥ 48 dp, labels on icons, never color alone. Tokens live only in the Keychain.

## 9. Dependency policy
- Use what is in `package.json`/the lockfile and Node built-ins first (`node:crypto`, `node:test`).
- Approved planned additions (ARCHITECTURE §3): `ws`, `jsonwebtoken`, `pdfkit`, `minio` (backend); the RN libraries in ADR-017 (mobile). Anything else needs human approval and an ARCHITECTURE §3 row.
- npm only. Commit `package-lock.json`. Install with `npm ci` in Docker. Pin exact image tags.
- Before adding a library, check: license OSS, works offline at runtime, builds within the 10 min budget, not a fixture-generation or BaaS library.

## 10. Documentation-update matrix
| Change type | Update first | Also update |
|---|---|---|
| Behavior, contract, error code, default, validation rule | `REQUIREMENTS.md` | `TRACEABILITY.md`, tests, CHANGELOG |
| New module/dir, schema, index, env var, service, port, cache key, queue topic | `ARCHITECTURE.md` | `.env.example` (env), `ADR.md` (if a decision), CHANGELOG |
| Significant technical choice or reversal | `ADR.md` | ARCHITECTURE §18, CHANGELOG |
| Workflow, rules, commands | `AGENTS.md` | CHANGELOG |
| Requirement implemented/tested | `TRACEABILITY.md` | `COVERAGE.json` (regenerated) |
| Run instructions, demo accounts, troubleshooting | `README.md` | — |
| Mobile build/run/desk-check steps | `docs/MOBILE.md` | README pointer |
| Slice done/re-planned | `docs/IMPLEMENTATION-PLAN.md` | — |

**Quick action table**
| You are about to… | Do this in the same coherent change |
|---|---|
| Change what an endpoint accepts or returns | Edit REQUIREMENTS first → code → API vector → TRACEABILITY |
| Add a table/column/env var/container | Edit ARCHITECTURE (+ `.env.example`) → migration/code → verify cold start |
| Change how the team works | Edit AGENTS → tell the humans in your report |

## 11. Collaboration
- **Assigned areas** (docs/IMPLEMENTATION-PLAN.md): Backend-A (platform, scoring, standings, sync), Backend-B (fixtures, roster, store, rbac), Mobile (everything under `mobile/`), QA/Docs (tests/, TRACEABILITY, COVERAGE, README). An owner integrates their area; Backend-A owns `http/app.js`, `errors.js`, `config.js`, compose and migrations ordering.
- **Shared files** (`errors.js`, `http/app.js`, `config.js`, `docker-compose.yml`, `001_init.sql`, `REQUIREMENTS.md`): make small, additive edits; pull/rebase before editing; mention the edit in your report.
- **Concurrent agents** (only when actually running in parallel): one git worktree per agent (`git worktree add ../wt-<area> -b <area>`), with disjoint directories per area. The integration owner merges into `master`. Do not edit another area's directory without coordination. Delegation is never mandatory.
- The mobile team develops against the contracts in REQUIREMENTS §8.2–8.3. Contract questions go to the backend owner, and the answer lands in REQUIREMENTS.

## 12. Delivery and handoff
**Every task report must contain:**
1. Requirement IDs addressed.
2. Files changed.
3. Checks run, with the observed outcome (command and pass/fail counts).
4. Checks **not** run and why (e.g. "stack not running: compose build blocked by network"). A blocked check stays visible as blocked; never write "should work".
5. Remaining issues, risks and open questions.

**Human-only release actions:** registering the repo URL, `git commit` and `git push` (unless a human explicitly asks an agent to run them), building and installing the APK on the judging device, setting `SEED_DEMO_DATA=true` before judging, raising written questions to organizers before 13:00 PKT.
**Agent-authorized:** code, tests, docs, local builds, running compose locally. **Not** commits: `git commit` and `git push` only on explicit human request.

**Pre-push gate (human runs, agent may prepare):** Appendix C checklist in REQUIREMENTS §11, `./run_tests.sh` green, cold `docker compose up -d --build` → `/health` 200, `COVERAGE.json` regenerated, TRACEABILITY current, the APK present at `mobile/release/app-release.apk` once built.
