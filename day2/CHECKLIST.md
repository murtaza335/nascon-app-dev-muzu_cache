# Day 2 Pre-Submission Checklist (Appendix C + our gates)

Run before every push; the full list before 14:00:00 PKT.

## Appendix C (spec, verbatim intent)
- [ ] `DAY1_SALT=<s1> DAY2_SALT=<s2> docker compose up -d --build` starts cleanly; `GET /health` 200 within 120 s.
- [ ] `git merge-base --is-ancestor $DAY1_BASE_SHA HEAD` passes (no history rewrite, no force-push).
- [ ] `POST /audit/v1/reset` seeds `match-m1`, `player-beta-2`, `guest_anon_tok_7721`, default QR mappings.
- [ ] Every `/audit/v1/*` endpoint returns the exact keys, status codes and DAY2 HMAC signatures (§5).
- [ ] `GET http://localhost:4444/status` → `ready: true`, ≥ 3 nodes (`shm_size: "1gb"`).
- [ ] `/web/matches/match-m1/live` has all 9 `data-testid` attributes.
- [ ] `GET http://localhost:4723/status` → `ready: true`; `adb shell am start -W -a android.intent.action.VIEW -d "nascon://entity/match-m1"` opens the native screen.
- [ ] `k6 run tests/k6_load.js` 15 s, 500 + 50 VUs, 0 % 5xx (and thresholds green).
- [ ] `tests/reports/*`, `COVERAGE_DAY2.json`, root `TRACEABILITY.md` committed and pushed before 14:05:00.

## Our extra gates
- [ ] Phase I: `cd backend && node --test "tests/unit/**/*.test.js"` + `pytest tests/api -m "not destructive"` all green.
- [ ] `scripts/static-guards.sh` green (no salt literal, no sport ids outside seed/tests, parameterised SQL).
- [ ] `DAY2_SALT` is read only via `config.js`; `grep -rn "$DAY2_SALT" .` finds nothing tracked.
- [ ] Guest bearer on `POST /api/v1/chat`, `/audit/v1/checkout`, `/audit/v1/events` → 403 `GUEST_WRITE_FORBIDDEN`.
- [ ] `/metrics` header is exactly `text/plain; version=0.0.4`.
- [ ] `/q/m1-live` 302 with relative `Location`.
- [ ] EC-1…EC-4 vectors green.
- [ ] APK rebuilt with the `nascon` intent-filter → `mobile/release/app-release.apk` (human builds/installs).
- [ ] Push landed inside the current window (check GitHub commit time).
