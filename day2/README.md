# Day 2 (Part II) working set

Everything for NaSCon '26 Part II lives in this folder. The Phase I documents at the repo root stay as they are:
Day 2 builds **on top of** them and must not break them (the grader re-runs Phase I tests and `/audit/v1/reset`).

**Spec:** [`spec/nascon26-part2-spec.pdf`](spec/nascon26-part2-spec.pdf) (text copy: [`spec/nascon26-part2-spec.txt`](spec/nascon26-part2-spec.txt)).
§ numbers in these files refer to the Part II spec unless they say "P1 §".

## Read order
| # | File | Owns |
|---|---|---|
| 1 | [`REQUIREMENTS.md`](REQUIREMENTS.md) | Requirement IDs, acceptance criteria, business rules, our defaults for unclear points, open questions |
| 2 | [`API-CONTRACT.md`](API-CONTRACT.md) | **Backend contract**: every Day 2 endpoint (graded `/audit/v1/*`, `/q`, `/metrics`, `/api/v1/*`, WS/SSE, internal media hooks), exact shapes, status and error codes |
| 3 | [`FRONTEND-CONTRACT.md`](FRONTEND-CONTRACT.md) | **Frontend contract**: Guest Web Player routes + mandatory `data-testid` DOM, progressive auth flow, mobile deep links, screens, realtime frames the clients consume |
| 4 | [`ARCHITECTURE.md`](ARCHITECTURE.md) | Modules, schema (migration `002_day2.sql`), compose topology, media pipeline, config/env, performance design |
| 5 | [`ADR.md`](ADR.md) | Decisions D2-ADR-01…, with the ones that need human approval marked |
| 6 | [`QA-HARNESS.md`](QA-HARNESS.md) | Selenium Grid 4, Appium 2, k6, GitHub Actions `autograde.yml`, reports, `COVERAGE_DAY2.json` |
| 7 | [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) | Time-boxed slices, owners, push windows, cut lines |
| 8 | [`TRACEABILITY.md`](TRACEABILITY.md) | Requirement → file:function → test (copied into the root `TRACEABILITY.md` before the final push; the spec requires it at the root) |
| 9 | [`CHECKLIST.md`](CHECKLIST.md) | Appendix C pre-submission checklist + per-slice gates |

## Hard facts for today (Sunday 2026-10-18, PKT)
- **Code freeze 14:00:00, final push ≤ 14:05:00.** Anything pushed later is ignored.
- **Push windows (one commit pushed in each, or a penalty):** W1 10:15–11:30 · W2 11:30–12:45 · W3 12:45–13:45 · W4 13:45–14:00 (grace to 14:05:00).
  Pushing is human-only (AGENTS §3).
- **Weight:** 80 % backend + QA infrastructure, 20 % frontend (mobile + guest web). Plan accordingly.
- **Never rewrite history**: the grader checks `git merge-base --is-ancestor $DAY1_BASE_SHA HEAD`.
- **Two salts from the environment only**: `DAY1_SALT` (Phase I) and `DAY2_SALT` (16 chars, venue slip). Never committed, logged, trimmed.
- Grader command: `DAY1_SALT=<s1> DAY2_SALT=<s2> docker compose up -d --build`; every container healthy and `/health` 200 within 120 s.

## Precedence (unchanged from AGENTS §2, extended)
Part II spec PDF > organizers' written answers > human direction in session > `day2/REQUIREMENTS.md` + `day2/API-CONTRACT.md`
> `day2/ARCHITECTURE.md` / `day2/ADR.md` > root Phase I docs > code. Where Part II changes a Phase I behaviour
(e.g. `/health` now checks the media server, reset seeds more data), the Day 2 file wins and the conflict is listed
in [`REQUIREMENTS.md` §9](REQUIREMENTS.md#9-conflicts-found-and-how-we-resolved-them).
