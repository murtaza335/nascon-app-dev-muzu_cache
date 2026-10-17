# Documentation and decision change log

Every change to REQUIREMENTS, ARCHITECTURE, ADR, AGENTS or the plan gets one line: date/time (PKT), files, what changed and why.
Organizers' written clarifications are also recorded here.

| When (PKT) | Files | Change | Reason |
|---|---|---|---|
| 2026-10-17 11:46 | `mobile/package.json`, `mobile/package-lock.json`, `mobile/app.json`, `mobile/README.md`, `mobile/SCREEN-PLAN.md`, `ARCHITECTURE.md`, `ADR.md`, `docs/MOBILE.md` | User-selected Expo SDK 54 migration: Expo 54.0.37, RN 0.81.5, React 19.1.0, status-bar 3.0.9, TypeScript 5.9.3, React types 19.1.17; regenerated Android selects Gradle 8.14.3 and reapplies local SDK/JDK/timeout settings; TypeScript and Expo compatibility checks pass | Reuse the existing Windows Gradle/JDK stack; spec does not mandate an Expo SDK; full APK build remains unverified |
| 2026-10-17 11:41 | `mobile/SCREEN-PLAN.md`, `docs/IMPLEMENTATION-PLAN.md` | Expanded initial inventory to 21 primary screens; added Orders/Order Detail/Account, shared selection and confirmation flows, role navigation, MOB coverage matrix and separate P2 management backlog | Complete screen planning before design; preserve requirements, contract gaps and existing priorities |
| 2026-10-17 11:35 | `ARCHITECTURE.md`, `ADR.md`, `TRACEABILITY.md`, `README.md`, `docs/MOBILE.md`, `docs/TEAM.md`, `docs/CACHING.md`, `docs/SPEC-CHECKLIST.md`, `docs/IMPLEMENTATION-PLAN.md`, `mobile/AGENTS.md`, `mobile/README.md`, `mobile/SCREEN-PLAN.md` | Reviewed all 14 existing project Markdown files; retained feature/service folders, recorded existing Expo/RN lockfile versions, replaced conflicting mobile setup and corrected legacy team/checklist/cache guidance, documented screen inventory and integration gaps; feature statuses remain Todo | Prepare mobile screen design without rebuilding the scaffold, adding dependencies or changing contracts/defaults |
| 2026-10-17 11:15 | `docs/spec/nascon26-part1-spec.pdf`, `docs/spec/nascon26-part1-spec.txt` | Added the binding Part I spec (PDF + extracted text) to the repo | Agents must cite and verify exact wording |
| 2026-10-17 11:20 | `REQUIREMENTS.md` (new) | Canonical product behavior: FR/NFR IDs, BR-* exact rules, API-/APP-/RT- contracts, domain model, mobile UI, OQ-05…22 defaults | Planning; spec is the source |
| 2026-10-17 11:20 | `ARCHITECTURE.md` (new) | Proposed structure: services, modules, data, caching, config, runtime, verification, requirement mapping; "current vs proposed" deltas | Planning |
| 2026-10-17 11:20 | `ADR.md` (rewritten) | Replaced the 8 generic starter ADRs with ADR-001…019 (all Proposed) | Spec-driven decisions; starter ADRs conflicted (port 3000, error shape, Node 20) |
| 2026-10-17 11:20 | `AGENTS.md` (new) | Working rules, DoD, decision boundaries, doc-update matrix, reporting format | Planning |
| 2026-10-17 11:20 | `TRACEABILITY.md` (rewritten) | Replaced the placeholder REQ-xx rows with spec FR/NFR IDs and planned files/tests (all Todo) | DEL-04 requires FR/NFR mapping |
| 2026-10-17 11:20 | `docs/IMPLEMENTATION-PLAN.md` (new) | Slices S0–S10, mobile track, timeline vs push windows | Planning |
| 2026-10-17 11:20 | `docs/CACHING.md`, `docs/MOBILE.md`, `docs/SPEC-CHECKLIST.md`, `docs/TEAM.md` | Added a "superseded where conflicting" banner (content unchanged) | They predate the spec (port 3000, `{error_code}` body, AsyncStorage) |

## Known conflicts recorded (spec wins; code still to be changed in S0)
- Port: starter 3000 → spec 8080.
- Error body: starter `{error_code,message,details[]}` → spec `{error:{code,message,details:{}}}`; `INVALID_JSON` → `VALIDATION_ERROR`.
- `/health` body: starter `{"status":"ok","db":…,"cache":…}` → spec `{"status":"ok"}`.
- Timestamps: starter `.000Z` → spec `YYYY-MM-DDTHH:MM:SSZ`.
- Mobile storage: starter AsyncStorage suggestion → spec SQLite/Room/Hive + Keystore.
- `.gitignore` ignores `*.apk` → spec requires `mobile/release/app-release.apk` committed.
- Test runner: starter `scripts/run-tests.sh` → spec root `run_tests.sh` + `COVERAGE.json`.

- 2026-10-17: T0 platform retarget implemented (port 8080, spec error envelope, `001_init.sql`, baseline seed, `/health`, `/audit/v1/reset`). `Dockerfile` takes `ARG NODE_IMAGE` (default `node:22-alpine`) so a machine without Docker Hub access can build from a local image. Test helper `assert_error` in `tests/api/conftest.py` now checks the `{error:{code,message,details}}` envelope. Lossless-number capture (`req.lossless`) is deferred to T2.1: `jsonBody` keeps `req.rawBody` instead.
