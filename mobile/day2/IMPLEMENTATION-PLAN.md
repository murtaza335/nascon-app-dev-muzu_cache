# Day 2 Frontend Implementation Plan

## Frontend task ownership and sequence

These slices divide the entire frontend surface. The root `day2/FRONTEND-CONTRACT.md`, `day2/API-CONTRACT.md`, and `day2/QA-HARNESS.md` remain authoritative.

| Task | Scope | Requirement IDs | Main paths | Depends on |
|---|---|---|---|---|
| FE-WEB-01 | Live match HTML template, exact initial DOM, responsive base styles, safe boot payload, frontend integration notes | FR-4.1, FR-4.2, NFR-8, WEB-01…09 | `mobile/day2/web/**` | Partner mounts assets at `/web` and injects API-D2-57 boot payload |
| FE-WEB-02 | Guest session, cart staging, progressive login/register, atomic merge, resume to playback | FR-4.2…4.4 | `mobile/day2/web/assets/**` | API-D2-50…56 — frontend implemented; live backend integration pending |
| FE-WEB-03 | Match/co-stream realtime, chat history/send/moderation display, WHEP/HLS playback, reconnect | FR-3.2…3.3, FR-5.2…5.3, NFR-1 | `mobile/day2/web/assets/**` | RT-D2-01…04 and API-D2-45/46/57/61 — frontend reliability pass implemented; live backend E2E pending |
| FE-WEB-04 | Preview, VOD, notice, athlete and club templates; QR open-in-app behavior | FR-3.1, FR-4.1 | `mobile/day2/web/**` | API-D2-57…61 and partner `/web` route integration — source implemented; mount/E2E pending |
| FE-NATIVE-01 | Android deep-link bootstrap and guest public destinations | FR-4.1…4.2 | `mobile/app.json`, `mobile/plugins/**`, `mobile/src/navigation/**` | scheme, intent-filter config, and public route dispatch implemented; Appium/device check pending |
| FE-NATIVE-02 | Match live, solo stream, co-stream layouts, host controls and chat | FR-3.2…3.3 | `mobile/src/features/day2/**`, `mobile/src/services/**` | API-D2-31…46, RT-D2-01/03 — UI/API source implemented; native media/device E2E pending |
| FE-NATIVE-03 | QR scanner, athlete follow/VOD, notifications and entry routing | FR-3.1, FR-4.1, FR-5.2 | `mobile/src/features/day2/**`, native config | Camera and in-app notification routing implemented; device/realtime verification pending |
| FE-QA-01 | Selenium/Appium flows, accessibility, cross-surface test, Phase I regression, APK and reports | NFR-1, NFR-8, QA-02…07 | `tests/selenium/**`, `tests/appium/**`, `tests/reports/**`, `mobile/release/**` | Added the 500 ms score assertion, live DOM accessibility checks, accessible screen assertions for deep links, and mobile-UI-to-browser chat flow. Execution still requires the backend web mount, Selenium Grid, Appium, and an Android device. APK build remains blocked on Gradle distribution availability. |

Current status: frontend source for FE-WEB-01…04 and FE-NATIVE-01…03 is implemented. Frontend test coverage has been tightened, but API/web mount, live contract behavior, Appium, Selenium Grid, cross-surface timing, accessibility-on-device, and release APK checks remain unverified until the required services and device are available. The mobile package now uses the approved Day 2 media/camera dependencies; see [README](README.md). Frontend source stays in mobile-owned paths. No backend route or service was changed.

## Window and priority

Day 2 active window: 10:15–14:00 PKT. Final push deadline: 14:05 PKT.

Priority order:

1. Guest Web Player selectors and Selenium journey.
2. QR/deep-link routing.
3. Guest cart and progressive auth.
4. Realtime score/chat behavior.
5. Native Android deep links and co-stream screen.
6. Native scanner, notifications, and public profile.
7. Accessibility, regression, APK, and reports.

## Phase 0 — baseline, 10:15–10:30

- Confirm Day 1 ancestry.
- Confirm backend health and seeded `match-m1`.
- Confirm media, QR, realtime, and guest contracts are available.
- Run existing mobile typecheck/tests once.
- Record unavailable backend dependencies.

## Phase 1 — Guest Web shell, 10:30–11:15

- Add web entry point and routing.
- Add live match page.
- Add exact nine selectors.
- Add responsive shell and accessible media container.
- Add loading, error, offline, and empty states.

## Phase 2 — Guest journey, 11:15–12:00

- Add guest session and cart staging.
- Add pinned merchandise interaction.
- Add chat list/input/send behavior.
- Add server 403 handling and progressive auth modal.
- Preserve cart and stream context.

## Phase 3 — Realtime and Selenium, 12:00–12:45

- Add score subscription.
- Add chat subscription and deduplication.
- Add reconnect and authoritative refresh.
- Add Selenium tests 1–3.
- Verify 500 ms score update behavior.

## Phase 4 — Native deep links and co-stream, 12:45–13:25

- Add Android intent filters.
- Add central deep-link bootstrap.
- Add public match/co-stream destinations.
- Add participant grid and host handoff state.
- Add native chat and playback state.

## Phase 5 — Native QR, profile, notifications, 13:25–13:45

- Add QR scanner and permissions.
- Add public athlete/VOD sections.
- Add notification routing.
- Add stream status and overlay states.

## Phase 6 — final QA, 13:45–14:00

- Run Selenium Grid and Appium tests.
- Run cross-surface test.
- Run accessibility checks.
- Run Phase I regression.
- Build release APK.
- Generate reports and update traceability/checklist.

## Non-negotiable fallback

If time is constrained, finish the Guest Web Player selectors, zero-friction load, guest write-block modal, cart staging, realtime score update, and native deep-link routes before lower-priority profile or notification polish.
