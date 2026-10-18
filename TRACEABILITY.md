# Requirements Traceability

Maps every FR/NFR ID (spec §3–§4, refined in [`REQUIREMENTS.md`](REQUIREMENTS.md)) to source files and automated tests (spec §1.3, DEL-04).
**Files below are the planned locations (ARCHITECTURE §4). Status shows what actually exists.** Update a row in the same commit that implements or tests it.

## Convention
- Put the ID in a code comment at the implementing function (`// FR-2.2-02 / BR-ROST-01`), in the commit message (`FR-2.2-02: transfer rule checks`), and in the test name (`test_fr_2_2_02_squad_full`) plus `@pytest.mark.req("FR-2.2-02")`. Node tests name it in the `test()` title.
- `Status`: Todo | In progress | Done (code) | Tested (code + passing tests) | Descoped.
- Coverage check: `grep -rhoE --exclude-dir=node_modules "(FR|NFR|API|APP|MOB|BR)-[A-Z0-9.-]+" backend tests mobile | sort -u`.

Mobile uses authenticated APIs; native acceptance remains pending (docs/MOBILE.md).

## Matrix
| ID | Requirement | Code (planned) | Tests (planned) | Status |
|---|---|---|---|---|
| FR-1.1-01 | Mystery sport from JSON (API-03) | `backend/src/domain/scoring/sportSchema.js`, `services/sports.js`, `routes/audit/sports.js` | `backend/tests/unit/scoring/sportSchema.test.js`, `tests/api/test_sports_api.py` | Todo |
| FR-1.1-02 | Seeded sports | `seed/baseline.js:seedBaseline` (through `validateSport`) | `tests/api/test_sports_api.py::test_fr_1_1_02_seeded_sports_exist`, `unit/scoring/sportSchema.test.js` | Tested |
| FR-1.1-03 | Event/innings/round models + limits | `domain/scoring/projection.js:build`, `domain/scoring/eventRules.js` | `unit/scoring/projection.test.js`, `unit/scoring/eventRules.test.js`, `tests/api/test_events_api.py::test_fr_1_1_03_*` | Tested |
| FR-1.1-04 | Event sourcing, compensation, score projection (API-06/07) | `services/events.js:appendEvent`, `services/score.js:getScore`, `repos/events.js`, `routes/audit/events.js` | `tests/api/test_events_api.py` | Tested |
| FR-1.1-05 | No hard-coded sport logic | `scripts/static-guards.sh` (CI step in `.github/workflows/ci.yml`) | static guard (fails on a planted violation, verified) | Tested |
| FR-1.2-01 | Seasons/divisions/stages (P2) | not implemented (APP-20..22) | none | Descoped (P2, not graded in Phase I) |
| FR-1.2-02 | Register league (API-05) | `domain/leagues/leagueSchema.js:validateLeague`, `services/leagues.js:registerLeague`, `routes/audit/leagues.js` | `tests/api/test_leagues_api.py` | Tested |
| FR-1.3-01 | Round-robin | `domain/fixtures/roundRobin.js:generate` | `unit/fixtures/roundRobin.test.js`, `tests/api/test_fixtures_api.py` | Tested |
| FR-1.3-02 | Swiss | `domain/fixtures/swiss.js:generate`, `domain/fixtures/pairing.js:bestPairing` (exact search; replaces blossom, see CHANGELOG) | `unit/fixtures/swiss.test.js`, `tests/api/test_fixtures_api.py` | Tested |
| FR-1.3-03 | Single elimination | `domain/fixtures/singleElim.js:generate`, `domain/fixtures/bracket.js` | `unit/fixtures/elim.test.js`, `tests/api/test_fixtures_api.py` | Tested |
| FR-1.3-04 | Double elimination | `domain/fixtures/doubleElim.js:generate` | `unit/fixtures/elim.test.js` (graph validator B=4..128), `tests/api/test_fixtures_api.py` | Tested |
| FR-1.3-05 | Rescheduling conflicts (P2) | not implemented (APP-23) | none | Descoped (P2, not graded in Phase I) |
| FR-1.3-06 | Match status machine + broadcast | `domain/scoring/eventRules.js:checkState`, `services/hooks.js:eventAppended`, `realtime/ws.js` | `tests/api/test_events_api.py::test_fr_1_1_04_state_machine_errors`, `tests/api/test_realtime.py` | Tested (graded subset upcoming→in_progress→completed); APP-12 postpone/cancel/abandon descoped (P2) |
| FR-1.4-01 | Standings (API-08) | `domain/standings/{table,tiebreak,qualification,nrr,index}.js`, `lib/pyround.js`, `services/standings.js:getStandings` | `unit/standings/*.test.js`, `tests/api/test_standings_api.py` | Tested |
| FR-2.1-01 | Club profile | `services/appReads.js:clubProfile`, `routes/api/clubs.js` | `tests/api/test_app_api.py::test_app_30_club_profile_and_isolation` | Tested |
| FR-2.1-02 | Tenant branding + isolation | `seed/baseline.js` (tenant colors), `services/auth.js:login/me` (branding), `domain/rbac/policy.js` | `tests/api/test_app_api.py::test_app_01_login_each_demo_account`, `tests/api/test_rbac_api.py` | Tested |
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
| NFR-5 | Security | `lib/jwt.js`, `http/middleware/*`, `domain/rbac/*`, `scripts/sql-guard.js`, mobile `src/services/auth/session.ts` (planned) | `tests/api/test_security_api.py`, `tests/api/test_rbac_api.py`, 4.7k-request fuzz run (0 × 5xx, see report) | Tested (backend); mobile storage pending |
| NFR-7 | Reproducibility | `docker-compose.yml`, `backend/Dockerfile`, `backend/src/index.js` | Human run 2026-10-17 on Fedora: `docker compose up -d --build` → all 5 services healthy, `/health` ok in ~11 s; `down -v` + `up` → healthy, reset ok; CI cold start (`.github/workflows/ci.yml`) | Tested (image layers were cached; a fully cold image build is still to time) |
| NFR-PERF-01 | Latency bounds | all services | timing asserts in `tests/api/test_checkout_api.py` (burst < 10 s), `tests/api/test_platform_api.py` (reset < 10 s); manual load run: 681 req/s, p95 140 ms | Tested |
| NFR-SIG | Signatures | `lib/canonical.js`, `lib/signature.js:sign` | `unit/scoring/signature.test.js` (App. A vector 1), `tests/api/test_events_api.py::test_nfr_sig_*`, `tests/api/test_checkout_api.py` | Tested |
| NFR-SIG | Signatures | `lib/canonical.js`, `lib/signature.js:sign` | `unit/scoring/signature.test.js` (App. A vector 1), `tests/api/test_events_api.py::test_nfr_sig_*`, `tests/api/test_checkout_api.py` | Tested |
| DEL-01…08 | Deliverables | `docker-compose.yml`, `.env.example`, `README.md`, `TRACEABILITY.md`, `run_tests.sh`, `COVERAGE.json` | Appendix C checklist (REQUIREMENTS §11) | In progress: backend items verified on the human's machine; APK (DEL-06), push windows (DEL-07) and the demo-data rehearsal remain |



## Mobile API integration (2026-10-17)
| IDs | Implementation | Evidence / status |
|---|---|---|
| APP-03 | `backend/src/services/appReads.js:context`, `repos/app.js:context`, `routes/api/auth.js` | `tests/api/test_app_context.py:test_context_scope/test_context_auth_and_errors`; P6 unit tests pass; API run pending |
| MOB-01/10, NFR-5 | `mobile/src/app/AppContext.tsx:login/logout/changeServer`, `services/auth/session.ts:sessionStorage`, `features/home/AccountScreen.tsx:AccountScreen` | `mobile/tests/api.test.cjs`: login, 401, scoped session, URL cases pass; native pending |
| MOB-02/03/04/05/11, RT-01 | `services/api/models.ts:loadData/loadMatch/matchView`, `app/AppContext.tsx:refresh/watchMatch`, `services/storage/storage.ts:storage` | Pagination/projection/discovery tests pass; native cache/realtime pending |
| MOB-06 | `app/AppContext.tsx:run/exportReceipt`, `plugins/withReceipt.cjs`, `features/store/*Screen.tsx` | Checkout/retry IDs/server PDFs wired; native PDF acceptance pending |
| MOB-07/08/09/12, NFR-4 | `services/api/commands.ts:queuePayload`, `app/AppContext.tsx:run/syncInternal` | Score/compensation/release payload tests pass; force-close/reconnect pending |
| NFR-ACC-01 | `theme/tokens.ts`, `components/ui.tsx:Button/Badge/Message/Screen` | Calmer themes/runtime colors; scaling/48dp targets retained; native screenshots pending |

TypeScript, 15 mobile tests and Hermes export pass. No backend domain code changed;
COVERAGE.json regeneration is not required for this slice.

## Replacement mobile source (2026-10-18)

| IDs | Active implementation | Verification |
|---|---|---|
| MOB-01-10, NFR-ACC-01 | `mobile/src/features/*/*Screen.tsx`, `components/ui.tsx:Screen/Field/Button/Sheet`, `components/MatchScore.tsx:MatchScore`, `theme/tokens.ts` | TypeScript passes; 18 mobile service/contrast tests pass. Native journey acceptance remains pending. |
| APP-51/53 | `services/api/models.ts:loadProduct/loadOrder`, `app/AppContext.tsx:fetchProduct/fetchOrder` | `APP-51/53: detail reads encode IDs, preserve server totals and normalize missing variants` passes with transport doubles; live backend pending. |
| MOB-11/12, APP-40 | `services/api/commands.ts:queueBaseVersion`, `features/roster/RosterActionScreen.tsx:RosterActionScreen`, `app/AppContext.tsx:run/syncInternal` | `MOB-12: queued versions distinguish unknown history from a real empty history` and scoped SQLite/Keychain tests pass; force-close/reconnect journey pending. |
| MOB-10 | `config/env.ts`, `app/AppContext.tsx:load/changeServer` | `MOB-10: backend default, saved development addresses and public override stay configurable` passes. |

The unchanged original source is `mobile/src1`; 61 tracked original files matched
HEAD after normalizing Git line endings. No backend domain changes; COVERAGE.json
regeneration is not applicable.

## Task-oriented mobile redesign (2026-10-18, ADR-024)

| IDs | Source functions | Evidence |
|---|---|---|
| MOB-01 | `features/home/HomeScreen.tsx:HomeScreen`, `home/selectors.ts:dashboardMatches`, `home/components/DashboardSections.tsx:WorkSection`, `navigation/screenRegistry.ts:tabsForRole` | Mobile tests `MOB-01: role tabs stay within five destinations`, `MOB-01: home prioritizes owned live matches without inventing a match` pass. |
| MOB-02 | `features/fixtures/selectors.ts:filterFixtures/groupFixtures`, `fixtures/components/MatchCard.tsx:MatchCard` | `MOB-02: fixture discovery combines team, venue, status and team scope filters` passes. |
| MOB-03/04/05/06 | `matches/MatchDetailScreen.tsx`, `standings/components/StandingRow.tsx`, `clubs/ClubProfileScreen.tsx`, `store/components/ProductCard.tsx`, `store/ProductDetailScreen.tsx` | Phone-first progressive sections and shared component integration; source typecheck and 20 mobile tests pass; native evidence in qa report. |
| MOB-07/08/09/10, NFR-ACC-01 | `components/forms/FormProgress.tsx`, `features/roster/*Screen.tsx`, `scoring/ScoringEntryScreen.tsx`, `sync/SyncStatusScreen.tsx`, `settings/SettingsScreen.tsx`, `components/{layout,feedback,forms,actions,display}` | Guided steps, review, compact recovery and theme/scaling retained; live writes and accessibility journeys remain pending. |

No backend domain edits; COVERAGE.json regeneration is not applicable. Original
src1 backup still matches all 61 tracked source files from HEAD.

## Sportron refinement (2026-10-18)
| IDs | Source | Evidence |
|---|---|---|
| MOB-01-10, FR-2.1-02, NFR-ACC-01 | `mobile/app.json`, `app/App.tsx`, `components/layout/containers.tsx:Section/Screen`, `theme/tokens.ts`, `components/actions/controls.tsx:Button/IconButton`, feature screens | TypeScript and unused-code checks pass; 20 mobile tests pass, including 4 additional dark-surface contrast pairs. Android Hermes900 modules pass. Offline debug build succeeds: 244 tasks, 36 executed; APK label verified Sportron and installed over existing development app. Native visuals tracked separately. |
No backend/domain changes; backend tests and COVERAGE.json regeneration are not
applicable to this branding/copy/layout change. Original src1 remains unchanged.

## Phase II
(Source of truth: `day2/TRACEABILITY.md`; copied here for the spec §3 root requirement.)

| ID | Source | Tests | Status |
|---|---|---|---|
| D2-SYS-01 | `docker-compose.yml`, `media/Dockerfile`, `media/mediamtx.yml` | `.github/workflows/autograde.yml` (cold start), `tests/selenium/test_grid_status.py` | impl (compose validated with `config -q`; cold build blocked offline) |
| D2-SYS-02 | `routes/health.js`, `services/media.js:isHealthy` | `tests/api/test_platform_api.py::test_fr_sys_01_health_exact_body` (media check off locally via `MEDIA_CHECK_REQUIRED=false`) | tested (partial) |
| D2-SYS-03 | `services/reset.js`, `seed/day2.js`, `seed/baseline.js` | `test_qr_api.py`, `test_guest_cart_api.py` (seeded match-m1, QR codes, guest token, cart) | tested |
| D2-SYS-04 | `lib/signature.js:sign2`, `config.js` | every API vector recomputes the signature in Python (`tests/api/day2_helpers.py:day2_sig`) | tested |
| D2-SYS-05 | — | Phase I unit + `tests/api` suite (465 passed with Day 2) | tested |
| FR-3.1 | `services/athletes.js`, `routes/api/day2Public.js`, `routes/api/day2Member.js` | `test_product_day2_api.py::test_follow_graph_is_idempotent_and_drift_free`, `::test_athlete_profile_career_from_event_logs` | tested |
| FR-3.2 | `domain/streaming/streamKey.js`, `services/streaming.js`, `routes/audit/streamKey.js`, `services/mediaHooks.js`, `routes/internalMedia.js`, `queue/mediaReconciler.js` | `unit/day2/streamKey.test.js`, `test_stream_key_api.py`, `test_product_day2_api.py::test_media_auth_hook` | tested (live media path unverified offline) |
| FR-3.3 | `domain/costream/session.js`, `services/costream.js`, `routes/audit/costream.js`, `realtime/day2Sockets.js` | `unit/day2/costream.test.js`, `test_costream_api.py`, `test_realtime_nfr1.py::test_host_socket_drop_triggers_handoff`, `test_product_day2_api.py::test_costream_product_flow` | tested |
| FR-4.1 | `domain/qr/{route,encoder,render}.js`, `services/qr.js`, `routes/audit/qr.js`, `routes/qrShort.js` | `unit/day2/qr.test.js`, `test_qr_api.py` (encoder output also verified against the `qrcode` reference and a jsQR decode) | tested |
| FR-4.2 | `services/guest.js`, `routes/api/day2Public.js` | `test_guest_cart_api.py::test_guest_session_and_staged_cart`; web DOM: frontend pending | tested (API) |
| FR-4.3 | `domain/guest/guard.js`, `http/middleware/guestWriteGuard.js` | `unit/day2/guest.test.js`, `test_guest_cart_api.py::test_direct_writes_are_blocked_before_anything_else` | tested |
| FR-4.4 | `domain/guest/cartMerge.js`, `services/cart.js`, `services/guest.js`, `routes/audit/guest.js` | `unit/day2/guest.test.js`, `test_guest_cart_api.py` | tested |
| FR-5.2 | `domain/notify/retry.js`, `services/dlq.js`, `services/notifications.js` | `unit/day2/notify.test.js`, `test_moderation_api.py::test_dlq_simulation_and_persistence` | tested |
| FR-5.3 | `domain/moderation/*`, `services/moderation.js`, `services/chat.js`, `routes/audit/moderation.js` | `unit/day2/moderation.test.js`, `test_moderation_api.py`, `test_product_day2_api.py::test_chat_*` | tested |
| NFR-1 | `realtime/ws.js`, `realtime/day2Sockets.js`, `services/hooks.js:publishLive`, `services/sseFeed.js` | `test_realtime_nfr1.py` (25 clients, p95 < 500 ms; SSE variant) | tested |
| NFR-2 | `services/day2Cache.js`, `services/qr.js` | `tests/k6_load.js` → `tests/reports/k6-summary.json` (p95 22 ms, 0 failures locally) | tested |
| NFR-6 | `domain/observability/metrics.js`, `services/metrics.js`, `routes/metrics.js` | `unit/day2/notify.test.js`, `test_moderation_api.py::test_metrics_*` | tested |
| NFR-8 | `backend/src/web/**` | frontend pending | planned |
| NFR-9 | `domain/privacy/erase.js`, `services/privacy.js`, `qr_scan_buckets` schema | `test_moderation_api.py::test_erasure_*`, `test_qr_api.py::test_no_pii_in_telemetry_responses` | tested |
| QA-01…07 | `docker-compose.yml`, `tests/selenium`, `tests/appium`, `tests/k6_load.js`, `.github/workflows/autograde.yml`, `scripts/coverage-day2.mjs`, `COVERAGE_DAY2.json` | CI run (selenium/appium need the frontend/device) | impl |
| WEB-01…09 | `backend/src/web/live.html` | `tests/selenium/test_guest_grid.py` | planned (frontend) |
| MOB-D2-01…06 | mobile | `tests/appium/*` | planned (frontend) |
| EC-1…4 | see REQUIREMENTS §6 | `test_costream_api.py`, `test_qr_api.py`, `test_moderation_api.py::test_concurrent_kick_race`, `test_guest_cart_api.py` | tested |
