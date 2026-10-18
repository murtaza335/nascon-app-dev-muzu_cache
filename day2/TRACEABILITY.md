# Day 2 Traceability (Phase II)

Status: `planned` → `impl` → `tested`. Copied into the root `TRACEABILITY.md` (section "Phase II") before the final push.
Test names are the planned names; replace with the real `file::function` when a slice lands.

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
