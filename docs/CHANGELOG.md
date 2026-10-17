# Documentation and decision change log

Every change to REQUIREMENTS, ARCHITECTURE, ADR, AGENTS or the plan gets one line: date/time (PKT), files, what changed and why.
Organizers' written clarifications are also recorded here.

| When (PKT) | Files | Change | Reason |
|---|---|---|---|
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
