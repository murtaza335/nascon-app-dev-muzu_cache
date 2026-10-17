# Requirements Traceability

Maps every FR/NFR ID (spec §3–§4, refined in [`REQUIREMENTS.md`](REQUIREMENTS.md)) to source files and automated tests (spec §1.3, DEL-04).
**Files below are the planned locations (ARCHITECTURE §4). Status shows what actually exists.** Update a row in the same commit that implements or tests it.

## Convention
- Put the ID in a code comment at the implementing function (`// FR-2.2-02 / BR-ROST-01`), in the commit message (`FR-2.2-02: transfer rule checks`), and in the test name (`test_fr_2_2_02_squad_full`) plus `@pytest.mark.req("FR-2.2-02")`. Node tests name it in the `test()` title.
- `Status`: Todo | In progress | Done (code) | Tested (code + passing tests) | Descoped.
- Coverage check: `grep -rhoE --exclude-dir=node_modules "(FR|NFR|API|APP|MOB|BR)-[A-Z0-9.-]+" backend tests mobile | sort -u`.

Mobile readiness review: [mobile/SCREEN-PLAN.md](mobile/SCREEN-PLAN.md). The
feature/service folders exist as placeholders; the rows below stay Todo until
behavior and tests exist. This review does not mark MOB/NFR requirements complete.

## Matrix
| ID | Requirement | Code (planned) | Tests (planned) | Status |
|---|---|---|---|---|
| FR-1.1-01 | Mystery sport from JSON (API-03) | `backend/src/domain/scoring/sportSchema.js`, `services/sports.js`, `routes/audit/sports.js` | `backend/tests/unit/scoring/sportSchema.test.js`, `tests/api/test_sports_api.py` | Todo |
| FR-1.1-02 | Seeded sports | `backend/src/seed/baseline.js` | `tests/api/test_reset_api.py` | Todo |
| FR-1.1-03 | Event/innings/round models + limits | `domain/scoring/projection.js:build`, `domain/scoring/eventRules.js` | `unit/scoring/projection.test.js`, `unit/scoring/eventRules.test.js`, `tests/api/test_events_api.py::test_fr_1_1_03_*` | Tested |
| FR-1.1-04 | Event sourcing, compensation, score projection (API-06/07) | `services/events.js:appendEvent`, `services/score.js:getScore`, `repos/events.js`, `routes/audit/events.js` | `tests/api/test_events_api.py` | Tested |
| FR-1.1-05 | No hard-coded sport logic | CI grep step (`.github/workflows/ci.yml`) | CI job | Todo |
| FR-1.2-01 | Seasons/divisions/stages (P2) | `services/leagueStructure.js` | `unit/…` | Todo |
| FR-1.2-02 | Register league (API-05) | `services/leagues.js`, `routes/audit/leagues.js` | `tests/api/test_leagues_api.py` | Todo |
| FR-1.3-01 | Round-robin | `domain/fixtures/roundRobin.js` | `unit/fixtures/roundRobin.test.js`, `tests/api/test_fixtures_api.py` | Todo |
| FR-1.3-02 | Swiss | `domain/fixtures/swiss.js`, `domain/fixtures/blossom.js` | `unit/fixtures/swiss.test.js`, `unit/fixtures/blossom.test.js` | Todo |
| FR-1.3-03 | Single elimination | `domain/fixtures/singleElim.js` | `unit/fixtures/singleElim.test.js` | Todo |
| FR-1.3-04 | Double elimination | `domain/fixtures/doubleElim.js` | `unit/fixtures/doubleElim.test.js` | Todo |
| FR-1.3-05 | Rescheduling conflicts (P2) | `domain/fixtures/conflicts.js` | `unit/fixtures/conflicts.test.js` | Todo |
| FR-1.3-06 | Match status machine + broadcast | `domain/scoring/eventRules.js`, `services/matches.js`, `realtime/ws.js` | `tests/api/test_events_api.py`, `tests/api/test_realtime.py` | Todo |
| FR-1.4-01 | Standings (API-08) | `domain/standings/*.js`, `services/standings.js` | `unit/standings/*.test.js`, `tests/api/test_standings_api.py` | Todo |
| FR-2.1-01 | Club profile | `services/clubs.js`, `routes/api/clubs.js` | `tests/api/test_app_clubs.py` | Todo |
| FR-2.1-02 | Tenant branding + isolation | `seed/baseline.js`, `domain/rbac/policy.js` | `tests/api/test_rbac_api.py` | Todo |
| FR-2.2-01 | Roster setup (API-09) | `services/roster.js`, `routes/audit/roster.js` | `tests/api/test_roster_api.py` | Todo |
| FR-2.2-02 | Transfer/loan/release checks (API-10) | `domain/roster/transferRules.js` | `unit/roster/transferRules.test.js`, `tests/api/test_roster_api.py` | Todo |
| FR-2.2-03 | Loan auto-return | `domain/roster/loanReturn.js` | `unit/roster/loanReturn.test.js` | Todo |
| FR-2.2-04 | Audit trail + history (API-11) | `repos/roster.js`, `routes/audit/roster.js` | `tests/api/test_roster_api.py` | Todo |
| FR-2.2-05 | Add player, roles | `routes/api/roster.js` | `tests/api/test_app_roster.py` | Todo |
| FR-2.3-01 | Catalogue, variants, price schedules, discounts | `domain/store/pricing.js`, `routes/api/store.js` | `unit/store/pricing.test.js` | Todo |
| FR-2.3-02 | Checkout + receipt + PDF (API-12) | `services/store.js`, `domain/store/*.js`, `pdf/receiptPdf.js` | `unit/store/*.test.js`, `tests/api/test_checkout_api.py` | Todo |
| FR-2.3-03 | Inventory (API-13) | `routes/audit/inventory.js` | `tests/api/test_checkout_api.py` | Todo |
| FR-2.3-04 | Order states + domain events | `domain/store/orderStateMachine.js`, `queue/outbox.js`, `worker.js` | `unit/store/orderStateMachine.test.js`, `tests/api/test_queue.py` | Todo |
| FR-2.3-05 | Pinned product showcase | `routes/api/matches.js`, `realtime/ws.js` | `tests/api/test_app_matches.py` | Todo |
| FR-5.1-01 | 5-tier RBAC policy-as-code | `domain/rbac/matrix.js`, `domain/rbac/policy.js:authorize`, `http/middleware/authenticate.js`, `routes/audit/rbac.js` | `unit/rbac/policy.test.js`, `tests/api/test_rbac_api.py::test_fr_5_1_01_probe_matrix` (85 cases) | Tested |
| FR-5.1-02 | Tokens + login (API-14, APP-01) | `lib/jwt.js`, `services/auth.js:rbacMatrix` | `unit/rbac/jwt.test.js`, `tests/api/test_rbac_api.py::test_fr_5_1_02_*` | Tested (login APP-01 pending) |
| FR-SYS-01 | Health (API-01) | `routes/health.js:GET /health` | `tests/api/test_platform_api.py::test_fr_sys_01_health_exact_body` | Tested |
| FR-SYS-02 | Reset + baseline (API-02) | `services/reset.js:resetAll`, `seed/baseline.js:seedBaseline` | `tests/api/test_platform_api.py::test_fr_sys_02_*` | Tested |
| FR-SYS-03 | Rate-limited ping (API-16) | `http/middleware/rateLimit.js`, `lib/rateLimiter.js`, `routes/api/ping.js` | `unit/lib/rateLimiter.test.js`, `tests/api/test_security_api.py` | Tested |
| FR-OFF-01 | Offline sync (API-17, APP-40) | `domain/sync/resolve.js`, `services/sync.js` | `unit/sync/resolve.test.js`, `tests/api/test_offline_sync_api.py` | Todo |
| NFR-3 | Concurrency correctness | `services/store.js` | `tests/api/test_checkout_api.py::test_nfr3_burst_20` | Todo |
| NFR-4 | Offline tolerance | `mobile/src/services/storage/*`, `mobile/src/services/sync/*` (planned) | `tests/api/test_offline_sync_api.py`, desk-check script in `docs/MOBILE.md` | Todo |
| NFR-5 | Security | `lib/jwt.js`, `http/middleware/*`, `domain/rbac/*`, mobile `src/services/auth/session.ts` (planned) | `tests/api/test_security_api.py`, `tests/api/test_rbac_api.py` | Todo |
| NFR-7 | Reproducibility | `docker-compose.yml`, `backend/src/index.js` | CI cold start (`.github/workflows/ci.yml`) | Todo |
| NFR-PERF-01 | Latency bounds | all | `tests/perf/smoke.js`, timing asserts in pytest | Todo |
| NFR-SIG | Signatures | `lib/canonical.js`, `lib/signature.js:sign` | `unit/scoring/signature.test.js` (App. A vector 1) | Tested |
| MOB-01…12 | Mobile screens/offline | `mobile/src/**` | desk-check script, optional `tests/e2e-mobile` | Todo |
| DEL-01…08 | Deliverables | repo root files | Appendix C checklist (REQUIREMENTS §11) | Todo |
