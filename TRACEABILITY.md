# Requirements Traceability

Maps every FR/NFR ID (spec §3–§4, refined in [`REQUIREMENTS.md`](REQUIREMENTS.md)) to source files and automated tests (spec §1.3, DEL-04).
**Files below are the planned locations (ARCHITECTURE §4). Status shows what actually exists.** Update a row in the same commit that implements or tests it.

## Convention
- Put the ID in a code comment at the implementing function (`// FR-2.2-02 / BR-ROST-01`), in the commit message (`FR-2.2-02: transfer rule checks`), and in the test name (`test_fr_2_2_02_squad_full`) plus `@pytest.mark.req("FR-2.2-02")`. Node tests name it in the `test()` title.
- `Status`: Todo | In progress | Done (code) | Tested (code + passing tests) | Descoped.
- Coverage check: `grep -rhoE --exclude-dir=node_modules "(FR|NFR|API|APP|MOB|BR)-[A-Z0-9.-]+" backend tests mobile | sort -u`.

Mobile readiness review: [mobile/SCREEN-PLAN.md](mobile/SCREEN-PLAN.md). The
21 feature screen designs and navigation exist as a UI-only preview; the rows
below remain incomplete until required service behavior and acceptance tests exist. This review does not mark MOB/NFR requirements complete.

Frontend prototyping support (MOB-01–12):
`mobile/tests/fixtures/mockData.ts:createMockData` supplies synthetic screen data;
`mobile/tests/mockData.test.cjs` checks fixture integrity only. See
`mobile/MOCK-DATA.md` for screen mapping and limitations. These are not API,
persistence, server RBAC or device acceptance tests; requirement statuses remain incomplete.

## Matrix
| ID | Requirement | Code (planned) | Tests (planned) | Status |
|---|---|---|---|---|
| FR-1.1-01 | Mystery sport from JSON (API-03) | `backend/src/domain/scoring/sportSchema.js`, `services/sports.js`, `routes/audit/sports.js` | `backend/tests/unit/scoring/sportSchema.test.js`, `tests/api/test_sports_api.py` | Todo |
| FR-1.1-02 | Seeded sports | `backend/src/seed/baseline.js` | `tests/api/test_reset_api.py` | Todo |
| FR-1.1-03 | Event/innings/round models + limits | `domain/scoring/projection.js:build`, `domain/scoring/eventRules.js` | `unit/scoring/projection.test.js`, `unit/scoring/eventRules.test.js`, `tests/api/test_events_api.py::test_fr_1_1_03_*` | Tested |
| FR-1.1-04 | Event sourcing, compensation, score projection (API-06/07) | `services/events.js:appendEvent`, `services/score.js:getScore`, `repos/events.js`, `routes/audit/events.js` | `tests/api/test_events_api.py` | Tested |
| FR-1.1-05 | No hard-coded sport logic | CI grep step (`.github/workflows/ci.yml`) | CI job | Todo |
| FR-1.2-01 | Seasons/divisions/stages (P2) | `services/leagueStructure.js` | `unit/…` | Todo |
| FR-1.2-02 | Register league (API-05) | `domain/leagues/leagueSchema.js:validateLeague`, `services/leagues.js:registerLeague`, `routes/audit/leagues.js` | `tests/api/test_leagues_api.py` | Tested |
| FR-1.3-01 | Round-robin | `domain/fixtures/roundRobin.js:generate` | `unit/fixtures/roundRobin.test.js`, `tests/api/test_fixtures_api.py` | Tested |
| FR-1.3-02 | Swiss | `domain/fixtures/swiss.js:generate`, `domain/fixtures/pairing.js:bestPairing` (exact search; replaces blossom, see CHANGELOG) | `unit/fixtures/swiss.test.js`, `tests/api/test_fixtures_api.py` | Tested |
| FR-1.3-03 | Single elimination | `domain/fixtures/singleElim.js:generate`, `domain/fixtures/bracket.js` | `unit/fixtures/elim.test.js`, `tests/api/test_fixtures_api.py` | Tested |
| FR-1.3-04 | Double elimination | `domain/fixtures/doubleElim.js:generate` | `unit/fixtures/elim.test.js` (graph validator B=4..128), `tests/api/test_fixtures_api.py` | Tested |
| FR-1.3-05 | Rescheduling conflicts (P2) | `domain/fixtures/conflicts.js` | `unit/fixtures/conflicts.test.js` | Todo |
| FR-1.3-06 | Match status machine + broadcast | `domain/scoring/eventRules.js`, `services/matches.js`, `realtime/ws.js` | `tests/api/test_events_api.py`, `tests/api/test_realtime.py` | Todo |
| FR-1.4-01 | Standings (API-08) | `domain/standings/{table,tiebreak,qualification,nrr,index}.js`, `lib/pyround.js`, `services/standings.js:getStandings` | `unit/standings/*.test.js`, `tests/api/test_standings_api.py` | Tested |
| FR-2.1-01 | Club profile | `services/appReads.js:clubProfile`, `routes/api/clubs.js` | `tests/api/test_app_api.py::test_app_30_club_profile_and_isolation` | Tested |
| FR-2.1-02 | Tenant branding + isolation | `seed/baseline.js`, `domain/rbac/policy.js` | `tests/api/test_rbac_api.py` | Todo |
| FR-2.2-01 | Roster setup (API-09) | `domain/roster/setupSchema.js`, `services/roster.js:setup`, `routes/audit/roster.js` | `tests/api/test_roster_api.py::test_fr_2_2_01_*` | Tested |
| FR-2.2-02 | Transfer/loan/release checks (API-10) | `domain/roster/transferRules.js:decide`, `services/roster.js:transfer` | `unit/roster/roster.test.js`, `tests/api/test_roster_api.py::test_fr_2_2_02_*` | Tested |
| FR-2.2-03 | Loan auto-return | `domain/roster/loanReturn.js:dueReturns`, `services/roster.js:materializeReturns` | `unit/roster/roster.test.js`, `tests/api/test_roster_api.py::test_fr_2_2_03_*` | Tested |
| FR-2.2-04 | Audit trail + history (API-11) | `repos/roster.js`, `services/roster.js:history`, `domain/roster/registrationState.js:squadAsOf` | `tests/api/test_roster_api.py::test_fr_2_2_04_*` | Tested |
| FR-2.2-05 | Add player, roles | `services/appWrites.js:addPlayer`, `routes/api/clubs.js` | `tests/api/test_app_api.py::test_app_31_add_player_and_profile_refresh` | Tested |
| FR-2.3-01 | Catalogue, variants, price schedules, discounts | `domain/store/pricing.js:effectivePrice`, `services/appReads.js:listProducts/getProduct`, `routes/api/store.js` | `unit/store/store.test.js`, `tests/api/test_app_api.py::test_app_50_51_catalogue` | Tested |
| FR-2.3-02 | Checkout + receipt + PDF (API-12) | `services/store.js:checkout`, `domain/store/*.js`, `pdf/receiptPdf.js:renderReceipt` | `unit/store/store.test.js`, `tests/api/test_checkout_api.py` | Tested |
| FR-2.3-03 | Inventory (API-13) | `routes/audit/store.js:GET /inventory/:variant_id`, `services/store.js:getInventory` | `tests/api/test_checkout_api.py::test_fr_2_3_03_inventory` | Tested |
| FR-2.3-04 | Order states + domain events | `domain/store/orderStateMachine.js`, `services/orders.js:transition`, `repos/outbox.js` (relay/worker pending, T9) | `unit/store/store.test.js`, `tests/api/test_app_api.py::test_app_55_order_transitions_and_restock` | Done (transitions + outbox rows); relay pending |
| FR-2.3-05 | Pinned product showcase | `services/appWrites.js:pinProduct`, `routes/api/matches.js` (realtime broadcast pending, T9) | `tests/api/test_app_api.py::test_app_14_pin_and_unpin` | Done (REST); realtime pending |
| FR-5.1-01 | 5-tier RBAC policy-as-code | `domain/rbac/matrix.js`, `domain/rbac/policy.js:authorize`, `http/middleware/authenticate.js`, `routes/audit/rbac.js` | `unit/rbac/policy.test.js`, `tests/api/test_rbac_api.py::test_fr_5_1_01_probe_matrix` (85 cases), `tests/api/test_app_api.py` (role boundaries on every `/api/v1` route via `http/guard.js`) | Tested |
| FR-5.1-02 | Tokens + login (API-14, APP-01) | `lib/jwt.js`, `services/auth.js:rbacMatrix/login/me` | `unit/rbac/jwt.test.js`, `tests/api/test_rbac_api.py::test_fr_5_1_02_*`, `tests/api/test_app_api.py::test_app_01_*` | Tested |
| FR-SYS-01 | Health (API-01) | `routes/health.js:GET /health` | `tests/api/test_platform_api.py::test_fr_sys_01_health_exact_body` | Tested |
| FR-SYS-02 | Reset + baseline (API-02) | `services/reset.js:resetAll`, `seed/baseline.js:seedBaseline` | `tests/api/test_platform_api.py::test_fr_sys_02_*` | Tested |
| FR-SYS-03 | Rate-limited ping (API-16) | `http/middleware/rateLimit.js`, `lib/rateLimiter.js`, `routes/api/ping.js` | `unit/lib/rateLimiter.test.js`, `tests/api/test_security_api.py` | Tested |
| FR-OFF-01 | Offline sync (API-17, APP-40) | `domain/sync/resolve.js`, `services/sync.js:process`, `routes/audit/offlineSync.js`, `routes/api/offlineSync.js` | `unit/sync/resolve.test.js`, `tests/api/test_offline_sync_api.py`, `tests/api/test_app_api.py::test_app_40_*` | Tested |
| NFR-3 | Concurrency correctness | `services/store.js:checkoutInTx` | `tests/api/test_checkout_api.py::test_nfr3_*` (burst 20 x20, same-id parallel, multi-item) | Tested |
| NFR-4 | Offline tolerance | `mobile/src/services/storage/*`, `mobile/src/services/sync/*` (planned) | `tests/api/test_offline_sync_api.py`, desk-check script in `docs/MOBILE.md` | Todo |
| NFR-5 | Security | `lib/jwt.js`, `http/middleware/*`, `domain/rbac/*`, mobile `src/services/auth/session.ts` (planned) | `tests/api/test_security_api.py`, `tests/api/test_rbac_api.py` | Todo |
| NFR-7 | Reproducibility | `docker-compose.yml`, `backend/src/index.js` | CI cold start (`.github/workflows/ci.yml`) | Todo |
| NFR-PERF-01 | Latency bounds | all | `tests/perf/smoke.js`, timing asserts in pytest | Todo |
| NFR-SIG | Signatures | `lib/canonical.js`, `lib/signature.js` | `unit/scoring/signature.test.js` (App. A vector 1) | Todo |
| MOB-01…12 | Mobile screens/offline | `mobile/src/features/**`, `navigation/AppNavigator.tsx`, `app/previewData.ts:getPreviewData` | `mobile/tests/screens.test.cjs` (12 display/navigation checks), `mockData.test.cjs` (6 integrity checks); desk checks pending | In progress (UI only) |
| NFR-SIG | Signatures | `lib/canonical.js`, `lib/signature.js:sign` | `unit/scoring/signature.test.js` (App. A vector 1) | Tested |
| MOB-01…12 | Mobile screens/offline | `mobile/src/**` | desk-check script, optional `tests/e2e-mobile` | Todo |
| DEL-01…08 | Deliverables | repo root files | Appendix C checklist (REQUIREMENTS §11) | Todo |


## Mobile design evidence (UI only, 2026-10-17)

| Scope | Real source/functions | Verification and limits |
|---|---|---|
| MOB-01/10 | `auth/LoginScreen.tsx:LoginScreen`, `settings/SettingsScreen.tsx:SettingsScreen`, `navigation/AppNavigator.tsx:AppNavigator`, `screenRegistry.ts:tabsForRole` | Role navigation checks pass; no authentication or durable URL setting. |
| MOB-02/03/04/05/11 | `fixtures/FixturesScreen.tsx:FixturesScreen`, `matches/MatchDetailScreen.tsx:MatchDetailScreen`, `standings/StandingsScreen.tsx:StandingsScreen`, `clubs/ClubProfileScreen.tsx:ClubProfileScreen` | Mock projection/tenant checks pass; no SQLite/realtime acceptance. |
| MOB-06 | `store/{Store,ProductDetail,Cart,Checkout,Orders,OrderDetail,Receipt}Screen.tsx` (matching named exports) | Mock prices/cart checks pass; checkout/PDF writes remain disconnected. |
| MOB-07/08/12 | `roster/{Roster,AddPlayer,RosterAction}Screen.tsx`, `scoring/{ScoringEntry,Compensation}Screen.tsx`, `sync/SyncStatusScreen.tsx` (matching exports) | Visibility and alternate outcome checks pass; no persistent queue/replay acceptance. |
| NFR-ACC-01 | `theme/tokens.ts:type`, `components/ui.tsx:Button/Field/Screen/Sheet`, `components/Icon.tsx:Icon` | System fonts, scaling, labels, min48dp encoded in source; native layout/TalkBack/rotation checks blocked by emulator RAM. |

Paths in this table are relative to `mobile/src/`. TypeScript and Android Hermes
export passed. No domain code changed; COVERAGE.json is not regenerated. UI tests
do not establish server authorization, APP endpoint behavior or judged journeys.
