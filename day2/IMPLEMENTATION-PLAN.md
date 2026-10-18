# Day 2 Implementation Plan (end-to-end)

Order follows marks: P0 graded contracts → infra probes (grid, metrics, k6) → guest web DOM → media realism → mobile → P2.
Each slice = domain + unit tests → service/repo → route → API vector → TRACEABILITY row → local commit (gate G below).
**Agents commit locally; humans push in each window.**

## Timeline (PKT, Sunday 2026-10-18)
| Window | Time | Target state pushed |
|---|---|---|
| W1 | ≤ 11:30 | day2/ plan docs (this commit) |
| W2 | 11:30–12:45 | S0–S6: salt + migration + reset seed + guard + stream key + costream + QR (+ exports) + cart merge + moderation/DLQ + metrics + privacy — **all 11 graded endpoints** |
| W3 | 12:45–13:45 | S7–S10: guest web player (9 test ids, WS), compose with media + selenium grid, selenium/k6/autograde, COVERAGE_DAY2, mobile deep links |
| W4 | 13:45–14:00 (grace 14:05:00) | S11–S12 polish: media hooks/revocation/VOD, reports committed, root TRACEABILITY, checklist run. **No risky change after 13:45.** |

## Slices
| # | Slice | Requirement IDs | Files (main) | Owner | Est |
|---|---|---|---|---|---|
| S0 | Platform: `DAY2_SALT` in config + boot check, `sign2()` helper, error codes (`GUEST_WRITE_FORBIDDEN`, `UNSUPPORTED_LAYOUT`, `STREAM_NOT_FOUND`, `QR_NOT_FOUND`, `COSTREAM_SESSION_FULL`, `KEY_REVOKED`, `GUEST_TOKEN_ALREADY_MERGED`), `002_day2.sql`, reset TABLES + `seed/day2.js` (match-m1 events, player-beta-2, QR, guest token, cart, room), lifecycle events (Q-01), compose env `DAY2_SALT` | D2-SYS-01…05, BR-QR-05 | config.js, errors.js, lib/signature.js, migrations/002, seed/day2.js, services/reset.js, domain/scoring/* | Backend-A | 20 m |
| S1 | Guest write guard + guest auth branch | FR-4.3, BR-GUEST-01 | domain/guest/guard.js, http/middleware/guestWriteGuard.js, authenticate.js, app.js | Backend-B | 10 m |
| S2 | Stream key API | FR-3.2-01, API-D2-03, BR-SK | domain/streaming, services/streaming.js, repos/streamKeys.js, routes/audit/streamKey.js | Backend-A | 15 m |
| S3 | Co-stream session API | FR-3.3-01, API-D2-04, BR-CS, EC-1 | domain/costream, services/costream.js, routes/audit/costream.js | Backend-A | 15 m |
| S4 | QR resolve + `/q` + exports (encoder port, SVG/PNG/PDF) + telemetry + caches | FR-4.1, API-D2-05…07, NFR-9 (scan), EC-2 | domain/qr/*, services/qr.js, routes/audit/qr.js, routes/qrShort.js | Backend-B | 30 m |
| S5 | Cart merge (audit + `/api/v1/guest/*` + register) | FR-4.4, API-D2-08, 50…56, EC-4 | domain/guest/cartMerge.js, services/cart.js, routes/audit/guest.js, routes/api/guest.js | Backend-B | 25 m |
| S6 | Moderation engine + DLQ + `/metrics` + privacy erase | FR-5.2, FR-5.3, NFR-6, NFR-9, API-D2-09…11, EC-3 | domain/moderation/*, domain/notify, domain/observability, services/{moderation,dlq,metrics,privacy}.js, routes | Backend-A | 30 m |
| S7 | Realtime: `/ws/matches/:id`, `/ws/costream/:id`, SSE, after-commit publish of `score.updated`; NFR-1 probe | NFR-1, RT-D2-01…03 | realtime/ws.js, services/hooks.js, routes/api/sse.js | Backend-A | 20 m |
| S8 | Guest Web Player (live/preview/vod/notice/players/clubs/costream), public reads, chat API, a11y | FR-4.2, WEB-01…09, NFR-8, API-D2-45/46/57…61 | backend/src/web/**, routes/web.js, routes/api/{public,chat}.js | Web (Mobile dev) | 40 m |
| S9 | Compose: media wrapper image + selenium hub/3 nodes + healthchecks + env; `/health` media check | D2-SYS-01/02, QA-01 | docker-compose.yml, media/*, routes/health.js | Backend-A | 20 m |
| S10 | QA harness: selenium suite, k6 script, appium suite + script, autograde.yml, coverage-day2 script, reports | QA-02…07 | tests/selenium, tests/appium, tests/k6_load.js, .github/workflows/autograde.yml, scripts/coverage-day2.mjs | QA | 30 m |
| S11 | Mobile: intent-filter + linking config + guest mode + MatchLive/CoStreamView screens (+ QR scanner/broadcast if libs approved) | MOB-D2-01…06, QA-03 | mobile/android/…/AndroidManifest.xml, mobile/plugins, mobile/src/navigation, features/{live,costream,scanner} | Mobile | 60 m (parallel) |
| S12 | Media realism: auth hook, events hook, revoke kick ≤ 2 s, reconciler, VOD upload, bitrate metric, compositor script; product APIs for streams/costreams/athletes/follow | FR-3.1, FR-3.2-02…05, FR-3.3-02…04, FR-5.2-01/02 | routes/internalMedia.js, services/media.js, worker.js, media/compose.sh, routes/api/{streams,costreams,athletes}.js | Backend-A/B | rest |

**Parallelism:** Backend-A (S0→S2→S3→S6→S7→S9), Backend-B (S1→S4→S5→S12 product APIs), Web (S8 from 12:00 against the
contract, real data once S4/S7 land), Mobile (S11 from now), QA (S10 from now; flip to real runs as slices land).
One worktree per agent if run in parallel (AGENTS §11); shared files (`errors.js`, `app.js`, `config.js`, compose, `002_day2.sql`)
are edited **only** by Backend-A — others send the line they need.

**Cut line (if behind at 13:15):** drop S12 compositor/VOD upload and mobile scanner/broadcast; keep everything P0 + Selenium + k6.

## Gate G (per slice)
1. `cd backend && node --test "tests/unit/**/*.test.js"` green.
2. Restart API (dev container per memory notes), `/health` 200.
3. `pytest tests/api/test_<area>_api.py` green + full `tests/api -m "not destructive"` before each push (Phase I regression).
4. TRACEABILITY row updated; `git commit` (local).

## Pre-push (each window, human)
`./run_tests.sh` → green, `COVERAGE_DAY2.json` regenerated, `git log --oneline -3`, push, check GitHub server time is inside the window.
