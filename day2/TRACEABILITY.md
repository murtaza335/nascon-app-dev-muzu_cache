# Day 2 Traceability (Phase II)

Status: `planned` → `impl` → `tested`. Copied into the root `TRACEABILITY.md` (section "Phase II") before the final push.
Test names are the planned names; replace with the real `file::function` when a slice lands.

| ID | Source (planned) | Tests (planned) | Status |
|---|---|---|---|
| D2-SYS-01 | docker-compose.yml, media/Dockerfile | autograde.yml `compose-up`, tests/selenium/test_grid_status.py | planned |
| D2-SYS-02 | routes/health.js | tests/api/test_platform_api.py::test_health_* | planned |
| D2-SYS-03 | services/reset.js, seed/day2.js | tests/api/test_day2_reset_api.py | planned |
| D2-SYS-04 | lib/signature.js, config.js | tests/unit/lib/signature2.test.js (Appendix A vectors), every API vector recomputes sig | planned |
| D2-SYS-05 | — | full P1 unit + `tests/api` suite, autograde ancestry step | planned |
| FR-3.1 | domain/—, services/athletes.js, routes/api/athletes.js, repos/follows.js | tests/api/test_athletes_api.py::test_follow_burst_no_drift | planned |
| FR-3.2 | domain/streaming/streamKey.js, services/streaming.js, routes/audit/streamKey.js, routes/internalMedia.js, services/media.js | tests/unit/streaming/*.test.js, tests/api/test_stream_key_api.py, tests/api/test_media_hooks_api.py | planned |
| FR-3.3 | domain/costream/session.js, services/costream.js, routes/audit/costream.js, routes/api/costreams.js | tests/unit/costream/*.test.js, tests/api/test_costream_api.py | planned |
| FR-4.1 | domain/qr/*, services/qr.js, routes/audit/qr.js, routes/qrShort.js | tests/unit/qr/*.test.js, tests/api/test_qr_api.py | planned |
| FR-4.2 | routes/api/guest.js, backend/src/web/** | tests/selenium/test_guest_grid.py::test_qr_resolution_zero_friction | planned |
| FR-4.3 | domain/guest/guard.js, http/middleware/guestWriteGuard.js | tests/unit/guest/guard.test.js, tests/api/test_guest_api.py::test_direct_write_403_* | planned |
| FR-4.4 | domain/guest/cartMerge.js, services/cart.js, routes/audit/guest.js | tests/unit/guest/cartMerge.test.js, tests/api/test_cart_merge_api.py | planned |
| FR-5.2 | domain/notify/retry.js, services/notify.js, services/dlq.js | tests/unit/notify/*.test.js, tests/api/test_moderation_api.py::test_dlq_* | planned |
| FR-5.3 | domain/moderation/*, services/moderation.js, routes/audit/moderation.js, routes/api/chat.js | tests/unit/moderation/*.test.js, tests/api/test_moderation_api.py | planned |
| NFR-1 | realtime/ws.js, services/hooks.js, routes/api/sse.js | tests/api/test_realtime_nfr1.py | planned |
| NFR-2 | ARCHITECTURE §7 caches | tests/k6_load.js → tests/reports/k6-summary.json | planned |
| NFR-6 | domain/observability/metrics.js, routes/metrics.js | tests/api/test_metrics_api.py | planned |
| NFR-8 | backend/src/web/** | tests/selenium/test_a11y.py | planned |
| NFR-9 | domain/privacy/erase.js, services/privacy.js, qr telemetry | tests/api/test_privacy_api.py, test_qr_api.py::test_no_pii_columns | planned |
| QA-01…07 | docker-compose.yml, tests/selenium, tests/appium, tests/k6_load.js, autograde.yml, scripts/coverage-day2.mjs | CI run | planned |
| WEB-01…09 | backend/src/web/live.html | tests/selenium/test_guest_grid.py | planned |
| MOB-D2-01…06 | mobile/android/app/src/main/AndroidManifest.xml, mobile/src/navigation/linking.ts, mobile/src/features/live/* | tests/appium/test_mobile_deeplink.py, test_cross_surface.py | planned |
| EC-1…4 | see REQUIREMENTS §6 | see REQUIREMENTS §6 | planned |
