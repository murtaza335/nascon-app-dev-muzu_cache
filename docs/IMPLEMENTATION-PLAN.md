# Implementation plan: Phase I (2026-10-17)

Owners: **BA** = Backend-A (platform, scoring, standings, sync, production API), **BB** = Backend-B (fixtures, rbac, store, roster),
**MOB** = Mobile, **QA** = tests/docs/coverage. Agents or humans can fill any role. The order is by points at risk and by dependency.
Contracts: REQUIREMENTS §7–8. Structure: ARCHITECTURE §4. Each slice ends with tests, a TRACEABILITY update and a local commit.

## Timeline (PKT) vs push windows
| Window | Must be pushed by the end of the window |
|---|---|
| 10:45–11:45 | Planning docs (this commit) |
| 11:45–12:45 | S0 platform retarget + S1 partial + S4 RBAC |
| 12:45–13:45 | S1, S2 (RR + single elim), S3, S5; mobile skeleton |
| 13:45–14:45 | S2 (double + swiss), S6, S7, S8, S9; first APK |
| ≤ 15:05:00 | Final: COVERAGE.json, TRACEABILITY, README, APK. **Freeze features at 14:40.** |

Raise written questions on the REQUIREMENTS §12.2 items that matter **before 13:00** (human).

## Slices

### S0 Platform retarget (BA, 11:30–12:00), blocks everything
- Node 22 base image. Port 8080 everywhere (compose, Dockerfile, config, healthcheck, CI, tests `BASE_URL`, scripts).
- `errors.js` → spec envelope + Appendix B catalogue constants. `validate.js` → `details.fields`, strict ints, dates/timestamps/id regex.
- Middleware: bodyLimit (413), jsonBody (lossless, any content type, probe exception), notFound `ROUTE_NOT_FOUND`.
- Config: `DAY1_SALT` required (fail fast), new env vars (ARCHITECTURE §9); `.env.example` updated; compose `DAY1_SALT: ${DAY1_SALT}`.
- `001_init.sql` (all Phase I tables, triggers, indexes); `migrate.js` reads the files.
- `seed/baseline.js` + `services/reset` + API-02 + boot "ensure baseline" + `/health` → exactly `{"status":"ok"}` when ready.
- Delete `routes/example.js`, the `items` table and its tests. `.gitignore` APK exception. Root `run_tests.sh` skeleton.
- **Done when:** a cold compose up gives health 200; reset twice gives an identical response; the pytest health/reset/413/malformed-JSON vectors pass.

### S1 Scoring (BA, 12:00–13:00): FR-1.1, NFR-SIG, API-03/06/07
`lib/canonical` + `lib/signature` (App. A vector 1 first) → `domain/scoring/sportSchema` → `projection` (3 models) → `eventRules` (state machine, limits, compensation) → `services/events` (row lock, idempotency) → routes. Tests: every BR-SCORE rule, the kabaddi example, innings/round limits, compensation cases, replay/duplicate.

### S2 Fixtures (BB, 12:00–14:00): FR-1.3-01…04, API-04
Order: round-robin (+ withdrawals) → single elim (exact) → double elim (graph) → Swiss (round 1 exact, blossom, bye fallback, 409). Property tests per ARCHITECTURE §12.

### S3 Leagues + standings (BA, 13:00–13:45): FR-1.2-02, FR-1.4-01, API-05/08
`services/leagues` → `domain/standings` (table, h2h, resolve with restart-on-split, NRR + pyround, lots vector 2, qualification). Edge cases 4 and 5.

### S4 RBAC + security (BB, 11:45–12:30): FR-5.1, API-14/15/16, BR-RL-01
`lib/jwt`, users seed (scrypt hashes precomputed), `domain/rbac/matrix+policy`, `authenticate`, probes P1–P7, `/rbac-matrix`, rate limiter, `/api/v1/ping`. The 65-cell matrix test + forged/none/expired tokens + 150-burst test.

### S5 Store (BB, 12:30–13:30): FR-2.3-01…04, NFR-3, API-12/13
`domain/store` (pricing, discount, rules, mock gateway, order state machine, receipt payload) → `services/store` (two-phase reservation) → `pdf/receiptPdf` → routes. 20-thread burst test ×20, PDF text test, 402 paths.

### S6 Roster (BB, 13:30–14:15): FR-2.2-01…04, API-09/10/11
`domain/roster` (as-of state, the 8 ordered checks, effects, loan return) → `services/roster` → routes. Precedence tests and edge case 6.

### S7 Offline sync (BA, 13:45–14:15): FR-OFF-01, API-17
`domain/sync/resolve` + `services/sync` reusing the event and roster services. Re-send → all duplicate.

### S8 Queue/worker/realtime (BA, 14:15–14:35): FR-2.3-04, RT-01, DEL-01
Outbox writes (already in S1/S5 transactions), `worker.js` relay → Stream, consumer (log + MinIO archive), sweeper. Compose: minio + worker. `ws` hub + publish hooks.

### S9 Production API for mobile (BA, starting 12:45 in parallel with S3, minimal set first)
APP-01/02 login/me → APP-10/11/13/16 reads (cached) → APP-15 events → APP-32 transfers → APP-50/52/54 store → APP-40 sync → APP-30 club → APP-14 pin. P2 routes (APP-12/20-23/55) only if time allows.

### S10 Quality gate (QA, continuous; final 14:30–14:55)
pytest vectors per slice; `run_tests.sh` + `scripts/coverage-areas.js` → COVERAGE.json; TRACEABILITY rows; README (run instructions, demo accounts, desk-check steps incl. `SEED_DEMO_DATA=true`); Appendix C checklist; cold-start rehearsal with `docker compose down -v`.

### Mobile track (MOB)

Current mobile integration: real APIs, Keychain/SQLite, discovery, persistent queue,
checkout/PDF and navigation are implemented. Mock engine/data, Screen Studio and
unsupported simulations are removed. Native acceptance pending (docs/MOBILE.md).
The schedule below is historical planning.

| Time | Deliverable |
|---|---|
| 11:30–12:15 | RN app in `mobile/` (no nested git), navigation shell, theme tokens, Settings (base URL), API client + error map, mock responses from REQUIREMENTS examples |
| 12:15–13:00 | Keychain session + Login (APP-01), role-aware tabs, SQLite schema (kv, cache_entries, outbox, sync_results) |
| 13:00–13:45 | Fixtures, Match detail (WS + poll), Standings, Club profile with `useCachedQuery`; offline banner (NetInfo) |
| 13:45–14:15 | Store → cart → checkout → receipt; Roster mgmt; Scoring entry; outbox enqueue when offline |
| 14:15–14:35 | Sync engine + Sync status screen; desk-check rehearsal §8.4; **assembleRelease → `mobile/release/app-release.apk`** |
| 14:35–14:50 | HCI pass (48 dp, labels, 360×640, rotation, empty states); final APK commit |

## Definition of "Phase I ready" (≈ 14:50)
Appendix C all green; TRACEABILITY covers FR-1.1…FR-5.1 and NFR-3/4/5/7; COVERAGE.json is generated; the APK is committed; the final push happens before 15:05:00.

### Mobile redesign follow-up (2026-10-18)
User-authorized replacement UI is implemented in fresh `mobile/src`, with original
source preserved at `mobile/src1`. All 21 core screens and two existing management
screens use reusable forest/mineral components and real APIs. TypeScript and 18
mobile tests pass. APK/judging-device release and full backend/offline desk-check
acceptance remain separate, pending checks. No commit or push was performed.

### Second mobile redesign (2026-10-18)
The user rejected the first redesign's similar composition. ADR-024 implements a
Home workspace, five stable tabs, feature-specific components and guided task flows.
TypeScript and 20 tests pass. Native screenshots and final bundle are recorded in
mobile/qa-redesign/VERIFICATION.md; complete live backend/desk-check acceptance
remains separate. The src1 archive is unchanged; no commit or push performed.

### Sportron refinement (2026-10-18)
Brand, concise copy, grouped sections and light/dark surface contrast are implemented
under ADR-025. TypeScript, unused-code checks, 20 tests, Hermes export and offline
native debug build pass. Existing development installation updated with Sportron
label; no release/judging-device APK delivery claimed. Native evidence and limitations
are in mobile/qa-redesign/SPORTRON.md. No commit/push.
