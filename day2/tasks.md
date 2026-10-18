# Day 2 backend task list (token-cheap working index)

Source of truth stays `REQUIREMENTS.md` / `API-CONTRACT.md`; this file only orders the work. Status: `[ ]` todo · `[x]` done+verified · `[~]` done, not fully verified.
Gate per slice: unit tests (`cd backend && node --test "tests/unit/**/*.test.js"`) → restart dev API → `pytest tests/api/test_<area>_api.py`.

## P0 graded (W2)
- [x] T0 platform: `DAY2_SALT` config + boot check, `sign2`, new error codes, `002_day2.sql`, reset TABLES, `seed/day2.js` (match-m1, QR, guest token, cart, room), baseline `p2-1`, lifecycle events (Q-01) — D2-SYS-01…05
- [x] T1 guest write guard (global middleware + pure predicate) — FR-4.3
- [x] T2 `POST /audit/v1/stream/key` — FR-3.2-01
- [x] T3 `POST /audit/v1/costream/session` — FR-3.3-01
- [x] T4 QR: `GET /audit/v1/qr/:id`, exports svg/png/pdf (vendored encoder), `GET /q/:code`, telemetry — FR-4.1
- [x] T5 `POST /audit/v1/guest/cart-merge` (+ `/api/v1/guest/*`, register, cart) — FR-4.4
- [x] T6 `POST /audit/v1/moderation/test` + DLQ, `GET /metrics`, `DELETE /audit/v1/privacy/user/:id` — FR-5.2/5.3, NFR-6/9
- [x] T7 realtime: `/ws/matches/:id`, `/ws/costream/:id`, SSE, `score.updated` after commit — NFR-1
- [~] T8 `/health` media check + compose (`DAY2_SALT`, media, selenium grid) — D2-SYS-01/02
## P1 / support
- [x] T9 `/api/v1` product APIs: public reads, chat, athletes/follow, streams, costreams, notifications
- [~] T10 media hooks (`/internal/media/*`), revocation kick, worker reconciler/VOD
- [~] T11 QA harness: pytest API vectors per endpoint, k6 script, autograde.yml, coverage-day2 script, TRACEABILITY

Notes: T8/T10 compose + media pipeline are written but a cold `docker compose up --build` could not be run offline (images for media/selenium). T11: selenium/appium suites written against FRONTEND-CONTRACT; they need the Guest Web Player (`/web/*`) and a device.
Local-only switch: `MEDIA_CHECK_REQUIRED=false` skips the media probe in `/health` when no media container runs.
