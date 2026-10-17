# TASKS: backend build list (Phase I)

Derived from `docs/IMPLEMENTATION-PLAN.md` (slices), `REQUIREMENTS.md` (contracts), `ARCHITECTURE.md` (structure).
Precedence if sources disagree: spec PDF > REQUIREMENTS > ARCHITECTURE/ADR > AGENTS > legacy docs (AGENTS §2).
Backend only. Mobile is tracked separately in the plan.

## Working rules (token-saving)
1. **Read only what the task cites.** Open the listed REQUIREMENTS sections by line range, not whole files. Do not re-read files you just edited.
2. **Ambiguity ladder:** the cited REQUIREMENTS/ARCHITECTURE section → §12.2 open-question default → `docs/spec/nascon26-part1-spec.txt` (grep for the § number) → ask the human. Never guess.
3. **Quiet output:** run tests with `2>&1 | tail -25`. Look at full logs only on failure.
4. **Rebuild only the api:** `docker compose up -d --build api`. Do not tear the stack down (`down -v` is a manual reset only).
5. **Salt:** `DAY1_SALT` lives only in the human's shell (`export DAY1_SALT=...`). Never write it to a file, a commit, a log or `.env.example`.
6. One task = one local commit, message starts with the requirement ID. No push (human only).

## Gate G (run at the end of every task; a blocked check is reported as blocked, never skipped silently)
| Step | Command | When |
|---|---|---|
| G1 unit | `cd backend && node --test tests/unit/<area> 2>&1 \| tail -25` | domain/lib changed |
| G2 build+health | `docker compose up -d --build api && ./scripts/wait-for-health.sh http://localhost:8080/health 120` | any route, SQL, migration, config change |
| G3 contract | `cd tests && ../.venv/bin/pytest api -m "req" -k <area> -q 2>&1 \| tail -25` | any route changed (success + each error code) |
| G4 docs | TRACEABILITY row → `Tested`; CHANGELOG line if a default or conflict was touched | always |
| G5 commit | `git commit` local, with the ID | always |

Pre-push gate (human, before each window): `./run_tests.sh` green, cold `docker compose up -d --build` → `/health` 200.

---

## Phase 0: Platform retarget (S0). BLOCKS EVERYTHING. Window 11:45–12:45
| ID | Task | Reqs | Done when |
|---|---|---|---|
| T0.1 | Port 8080 everywhere (compose, Dockerfile, config, healthcheck, `tests/conftest.py` BASE_URL, scripts); Node 22 base image; pin tags; no `container_name`, no `:latest` | NFR-7, ARCH §10 | `docker compose config` clean; api answers on 8080 |
| T0.2 | `config.js`: `DAY1_SALT` required (exit 1 if empty, never trimmed or logged); add env vars from ARCH §9; compose `DAY1_SALT: ${DAY1_SALT}`; `.env.example` placeholder only | §3 AGENTS, ARCH §9 | Boot without salt fails with a clear line; with salt boots |
| T0.3 | `errors.js`: spec envelope `{error:{code,message,details}}` + Appendix B constants + implementation-only codes + `ROUTE_NOT_FOUND`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE` | REQ §7 | Unit test on formatter; unknown route returns the envelope |
| T0.4 | `validate.js` → declarative schema; collects all failing fields into `details.fields` (dotted paths); strict JSON ints (no `2.0`, no bool); id regex; date/timestamp checks; ignore unknown fields | REQ §7 | Unit tests for each type |
| T0.5 | Middleware: `requestId`, `bodyLimit` (1 MB → 413 before auth), `jsonBody` (any content type, lossless numbers into `req.lossless`, malformed → 400 `fields:["body"]`, probe exception), `notFound`, `errorHandler` | REQ §7, ARCH §7.1 | pytest: 413, malformed JSON, 404 route |
| T0.6 | `migrations/001_init.sql`: all Phase I tables, CHECKs, append-only triggers (`match_events`, `roster_audit`, session flag for reset), partial indexes, UNIQUE constraints per ARCH §6.1–6.2. `migrate.js` reads the files under an advisory lock | ARCH §6 | Cold boot migrates; UPDATE on `match_events` is rejected |
| T0.7 | `seed/baseline.js` (4 sports via the API-03 path, 2 tenants, product+variants, `WELCOME10`, leagues, clubs, players, 5 demo users with precomputed scrypt hashes) + `services/reset` (single tx, TRUNCATE RESTART IDENTITY, bulk insert, `app_state`) + boot "ensure baseline" | API-02, DEL-08, REQ §8.1 | See T0.8 |
| T0.8 | Routes: `GET /health` → exactly `{"status":"ok"}` only when DB up and baseline seeded (503 otherwise, no MinIO dependency); `POST /audit/v1/reset` with `seed`, `stock` (unknown variant → 404) | API-01/02 | Health 200 on cold start; reset twice returns identical body and identical table digest; reset < 10 s |
| T0.9 | Remove starter leftovers: `routes/example.js`, `items` table, old tests; `.gitignore` APK exception; root `run_tests.sh` skeleton | AGENTS | Old tests gone; `run_tests.sh` runs unit tests |

**Phase 0 exit:** health/reset/413/malformed-JSON/404-route pytest vectors pass on a cold compose up.

## Phase 1: Auth and RBAC (S4). Window 11:45–12:45 (small, unblocks `/api/v1`)
| ID | Task | Reqs | Done when |
|---|---|---|---|
| T1.1 | `lib/jwt.js` (HS256 pinned, reject `alg:none`, `exp` required, 12 h, claims per BR-AUTH-02; secret derived from the salt) | BR-AUTH-02 | Unit: valid, tampered, none, expired |
| T1.2 | `domain/rbac/matrix.js` + `policy.js` (scope predicates: tenant, league ownership, club, self) | REQ §2.1–2.2 | Unit: 65 cells + allow/deny per rule |
| T1.3 | `authenticate` middleware; `POST /audit/v1/rbac-matrix` (5 tokens + context ids); probes P1–P7 (401 → 404 → 403 → 200, no body validation) | API-14/15, BR-AUTH-01, OQ-11 | pytest: 65 cells + 3 security probes |
| T1.4 | `rateLimit` (in-memory sliding log, 100 / 10 s per socket IP, only allowed requests count, `Retry-After`); `GET /api/v1/ping` | API-16, BR-RL-01 | 150-burst gives 429 with `Retry-After`; audit routes never limited |

## Phase 2: Scoring core (S1). Window 12:45–13:45. Highest-point area
| ID | Task | Reqs | Done when |
|---|---|---|---|
| T2.1 | `lib/canonical.js` + `lib/signature.js` (Python-exact canonical JSON, lossless numbers, HMAC) | BR-SIG-01…04, NFR-SIG | Unit: App. A vector 1 `972a8b55…c501`, unicode, nested, floats |
| T2.2 | `domain/scoring/sportSchema.js` (API-03 rules, defaults, drop unknown keys) + `repos/sports` + `POST /audit/v1/sports` | API-03, FR-1.1-01/02 | pytest: kabaddi 201, duplicate 409 incl. `football`, SQL-injection id 400 with the right `fields` |
| T2.3 | `domain/scoring/projection.js` (event / innings / round, overs string, fair_play, winner, outcome) | BR-SCORE-08 | Unit per model |
| T2.4 | `domain/scoring/eventRules.js` (state machine, limits, tie rule, compensation validity) | BR-SCORE-01…07 | Unit: every rule + the kabaddi `all_out` +2 example |
| T2.5 | `services/events` (advisory lock → replay lookup → row lock → rules → sign → insert event, bump version, outbox, idempotency) + `POST /audit/v1/events` | API-06, BR-SCORE-09/10, ARCH §14.1 | pytest: 201, 200 replay, `DUPLICATE_EVENT_ID`, each 404/409 code, check order |
| T2.6 | `GET /audit/v1/score/{match_id}` (derived on every read, compensated flags) | API-07 | pytest: field names exact, compensation shown, `MATCH_NOT_FOUND` |
| T2.7 | Static guard: CI grep for sport/event literals outside `seed/` | FR-1.1-05 | Grep passes |

## Phase 3: Fixtures (S2, pure compute). Parallelizable with Phase 2. Window 12:45–13:45
| ID | Task | Reqs | Done when |
|---|---|---|---|
| T3.1 | `roundRobin.js` (circle method, byes, legs, withdrawals both policies, summary) + `POST /audit/v1/fixtures` route shell | FR-1.3-01 | Property tests n = 2..40, legs 1/2 |
| T3.2 | `singleElim.js` (seed order, byes, results propagation, third place, n ≤ 128) | FR-1.3-03 | n = 6 example exact |
| T3.3 | `doubleElim.js` (WB/LB/GF1/GF2, routing, bracket reset, graph validator) | FR-1.3-04, BR-FIX-04/06/07 | Counts exact for B = 4…128; graph test |
| T3.4 | `blossom.js` + `swiss.js` (round 1 exact, optimal matching, bye rules, buchholz, `NO_VALID_PAIRING`) | FR-1.3-02 | Brute-force cross-check n ≤ 10 |
| T3.5 | Route validation: BR-FIX-01…03 limits; pytest vectors for all four formats | API-04 | Every 400 path covered |

## Phase 4: Leagues and standings (S3). Window 12:45–13:45
| ID | Task | Reqs | Done when |
|---|---|---|---|
| T4.1 | `services/leagues` + `POST /audit/v1/leagues` (defaults, `lots_seed` from last reset, matches at version 0) | API-05, FR-1.2-02, OQ-07/21 | pytest: 201, `SPORT_NOT_FOUND`, `LEAGUE_EXISTS`, `MATCH_EXISTS`, validation |
| T4.2 | `lib/pyround.js` + `domain/standings` (table, h2h, recursive tie-break with restart-on-split, NRR, lots, qualification) | BR-STAND-01…08, App. A vector 2 | Unit: 3-way tie, lots vector (`0613…`, `c8f2…`, `e3e3…`), clinched/eliminated, NRR half-even |
| T4.3 | `services/standings` + `GET /audit/v1/standings/{league_id}` | API-08 | pytest: edge cases 4 and 5, recompute after compensation, `LEAGUE_NOT_FOUND` |

## Phase 5: Store (S5). Window 12:45–13:45
| ID | Task | Reqs | Done when |
|---|---|---|---|
| T5.1 | `domain/store`: pricing (price schedules, `WELCOME10`, floor), checkout rules, mock gateway (tokens, `auth_<n>`/`cap_<n>`), order state machine, receipt payload | BR-STORE-01…05 | Unit per module |
| T5.2 | `services/store` two-phase reservation (conditional UPDATE in variant_id order; tx2 commit or release); sweeper-ready reservation rows | NFR-3, ARCH §6.3 | Concurrency test |
| T5.3 | `pdf/receiptPdf.js` (pdfkit; `PKR 4500.00` format) | AC-2.3-b | Decoded PDF starts `%PDF` and contains `order_id` + total |
| T5.4 | `POST /audit/v1/checkout`, `GET /audit/v1/inventory/{variant_id}` | API-12/13 | pytest: 201, replay 200, `DUPLICATE_ORDER_ID`, 404, `INVALID_DISCOUNT_CODE`, `OUT_OF_STOCK`, both 402s, stock released afterwards |
| T5.5 | **Burst test:** 20 parallel checkouts on the last unit, repeated 20× | NFR-3 | 1×201, 19×409, stock 0, reserved 0, all < 10 s |

## Phase 6: Roster (S6). Window 13:45–14:45
| ID | Task | Reqs | Done when |
|---|---|---|---|
| T6.1 | `domain/roster`: as-of registration state, lazy loan return, the 8 ordered checks, effects (transfer/loan/release/deferral) | BR-ROST-01…06 | Unit: positive + negative per row, double-violation precedence |
| T6.2 | `services/roster` + `POST /audit/v1/roster/setup` (re-setup replaces league state, OQ-09/10) | API-09, FR-2.2-01 | pytest: 201 counts, 400 unknown squad, `SPORT_NOT_FOUND` |
| T6.3 | `POST /audit/v1/roster/transfer` (league row lock, replay by `request_id`, audit entry `au-NNNN`) | API-10 | pytest: every BR-ROST-01 code, replay 200, OQ-06 code, edge case 6 |
| T6.4 | `GET /audit/v1/roster/history/{player_id}?as_of=` | API-11, AC-2.2-c | Loan return appears exactly once, even on repeated calls |

## Phase 7: Offline sync (S7). Window 13:45–14:45
| ID | Task | Reqs | Done when |
|---|---|---|---|
| T7.1 | `domain/sync/resolve.js` (the 7-row precedence table) + `services/sync` reusing events and roster services; sort by `queued_at`, results in request order | BR-SYNC-01/02 | Unit per row |
| T7.2 | `POST /audit/v1/offline-sync` | API-17 | Re-send gives all `duplicate`; stale `base_version` gives `rebased_append`; HTTP 200 even if every action is rejected |

## Phase 8: Production API for mobile (S9). Minimal set first. Window 13:45–14:45
| ID | Task | Reqs | Done when |
|---|---|---|---|
| T8.1 | `POST /api/v1/auth/login` (scrypt, same error for bad email and bad password), `GET /api/v1/me` | APP-01/02 | pytest: 5 demo accounts, `INVALID_CREDENTIALS` |
| T8.2 | Reads with `cache.cached()`: leagues, fixtures, match detail, standings (tenant-scoped, paginated envelope) | APP-10/11/13/16 | Cross-tenant 403; cache invalidated after a write |
| T8.3 | Writes via shared services: events, roster transfers, checkout, offline-sync | APP-15/32/52/40 | Same results as the audit routes; server-set `requested_by`/`customer_id` |
| T8.4 | Club profile, store catalogue, orders + receipt PDF, pin product | APP-30/50/51/53/54/14 | Tenant-beta token on a tenant-alpha club gives 403 |
| T8.5 | P2 only if time: match status, add player, schedule, seasons, order transitions | APP-12/20-23/31/34/55 | — |

## Phase 9: Queue, worker, realtime (S8). Window 13:45–14:45, freeze 14:40
| ID | Task | Reqs | Done when |
|---|---|---|---|
| T9.1 | Compose: add `minio` + `worker` (api does NOT depend on minio); `worker.js` outbox relay (`SKIP LOCKED`) → Redis Stream; consumer logs + archives receipt PDFs; reservation sweeper | FR-2.3-04, ADR-011/012 | Paid order produces a stream entry and a MinIO object; `/health` unaffected when MinIO is down |
| T9.2 | `realtime/ws.js` (`/api/v1/ws?token=`, subscribe/unsubscribe, tenant check, 25 s ping, 4401 on bad token) + publish hooks after commit | RT-01 | WS test receives `match.event_appended` and `match.status_changed` |

## Phase 10: Quality gate (continuous; final 14:30–14:55)
| ID | Task | Done when |
|---|---|---|
| T10.1 | `scripts/coverage-areas.js` + `run_tests.sh` → `COVERAGE.json` (6 areas ≥ 85%) | Numbers reproduced within 2 points |
| T10.2 | TRACEABILITY rows → real file:function and test names | No `Todo` for P0 IDs |
| T10.3 | README (run steps, 5 demo accounts, `SEED_DEMO_DATA` note), `.env.example` | Follows the clean-checkout steps in ARCH §10.5 |
| T10.4 | Appendix C rehearsal: cold start from a pruned state, health < 120 s, reset twice identical, secret/latest/container_name greps clean | Checklist all green |

## Suggested order and parallelism
`T0.*` → `T1.*` → (`T2.*` ‖ `T3.*`) → (`T4.*` ‖ `T5.*`) → `T6.*` → `T7.*` → `T8.*` → `T9.*`; `T10.*` throughout.
Points at risk are highest in scoring, standings, fixtures, store, roster and rbac (6 each); finish the P0 `/audit/v1` contract before any `/api/v1` extra.

## Open items needing a human decision before 13:00 PKT
Only if they change the default: OQ-05, 06, 09, 11, 15, 17, 18 (REQUIREMENTS §12.2). Everything else uses its written default.
