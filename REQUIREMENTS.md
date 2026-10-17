# REQUIREMENTS — NaSCon '26 Part I: Multi-Sport League & Club Operations Platform

> **Canonical source of intended product behavior.** Binding upstream source: the problem statement
> [`docs/spec/nascon26-part1-spec.pdf`](docs/spec/nascon26-part1-spec.pdf) (text copy:
> [`docs/spec/nascon26-part1-spec.txt`](docs/spec/nascon26-part1-spec.txt)), cited below as **§n.n**.
> If this file and the spec disagree, **the spec wins**: fix this file in the same change and log it
> in [`docs/CHANGELOG.md`](docs/CHANGELOG.md).
> Implementation structure lives in [`ARCHITECTURE.md`](ARCHITECTURE.md), decisions in [`ADR.md`](ADR.md),
> and working practices in [`AGENTS.md`](AGENTS.md).

Document status: **Approved baseline for Phase I (plan stage, nothing implemented yet).** Last updated 2026-10-17.

---

## 1. Product overview

### 1.1 Problem
Build a production-style, multi-tenant sports league and club operations platform. It covers rule-driven
league management, fixture scheduling, club roster operations and a concurrency-safe merchandise store (§1).
All of it must be self-hosted open-source software (§1.1, §7).

### 1.2 Deliverable surfaces (Phase I)
1. **Backend platform:** a REST API, a realtime WebSocket/SSE layer, an event-sourced scoring engine, an
   internal job queue and admin configuration endpoints. Everything comes up with one `docker compose` command.
2. **Mobile application:** Android (target), for players, club managers, league organizers and signed-in viewers.

### 1.3 Users and roles (§3.3 FR-5.1)
| Role id (token/claims) | Display name | Scope |
|---|---|---|
| `super_admin` | Platform Super-Admin | Platform-wide, all tenants |
| `league_organizer` | League Organizer | Only the leagues they own, inside their tenant |
| `club_manager` | Club Manager | Only their club (and its players), inside their tenant |
| `player` | Player | Themselves, inside their tenant |
| `viewer` | General Viewer | Read-only, inside their tenant |

### 1.4 Success criteria and scoring (§9)
| Component | Max | Verified by |
|---|---|---|
| Backend platform: 6 areas × 6 pts (fixtures, scoring, standings, store, roster, rbac) | 36 | Hidden Python vectors on the grader machine (≥ 40 per area) |
| Offline mobile persistence and sync queue | 4 | Python script (`/offline-sync`) + desk check (§8.4) |
| Mobile UI/HCI (5 areas, §8.6) | 10 | Judge panel |

Per backend area worth P points: `S = 0.9·P·n/|V| + 0.1·P·[declared unit-test coverage of that area ≥ 85%]`.
A vector passes only if **every** assertion holds: status, error code, every compared field and signature (§9.2).
Penalties (§9.4): non-reproducible stack −10; hard-coded sport logic −8; managed BaaS −10; missed push window −2 each (max −8).

### 1.5 Phase and scope
- **In scope:** everything in Part I (§1–§9, Appendices A–C), as captured below.
- **Out of scope / excluded:** Part II (Day 2) features, which are unknown until 2026-10-18 10:15 PKT. No iOS app
  (Android only, §8.1). No real payment provider; payments use the mock gateway we build. No proprietary BaaS
  (Firebase, Supabase, Amplify). No third-party fixture-generation libraries.
- **Hard deadlines:** Phase I is locked at **15:00 PKT**; the final push must happen before **15:05:00 PKT**.
  Push windows 10:45–11:45, 11:45–12:45, 12:45–13:45 and 13:45–14:45 each need at least one pushed commit.
  Questions on the contract must be raised **in writing before 13:00 PKT** (§9.5).

### 1.6 Priority legend (requirement priority, not implementation status)
- **P0:** graded by the autograder (§5, §6), or a hard-lock/penalty item. Missing it loses points directly.
- **P1:** graded by the desk check or judges (§8), or a required deliverable (§1.3).
- **P2:** a functional requirement in §3 that no Phase I script grades. Needed for completeness, the viva and likely Part II.

Implementation and verification status is tracked in [`TRACEABILITY.md`](TRACEABILITY.md), not here.

---

## 2. Role / permission matrix

### 2.1 Graded probe matrix (§5.13, exact): A = 200 `{"authorized":true}`, D = 403 `FORBIDDEN`
| Probe (target) | Super Admin | Organizer | Club Mgr | Player | Viewer |
|---|---|---|---|---|---|
| P1 `POST /audit/v1/rbac/tenants` | A | D | D | D | D |
| P2 own_league | A | A | D | D | D |
| P2 other_league (same tenant) | A | D | D | D | D |
| P2 foreign_league | A | D | D | D | D |
| P3/P4 own_club | A | D | A | D | D |
| P3/P4 other_club (same tenant) | A | D | D | D | D |
| P3/P4 foreign_club | A | D | D | D | D |
| P5 own_player | A | D | A (own club's players) | A (self only) | D |
| P5 other_player (other club) | A | D | D | D | D |
| P5 foreign_player | A | D | D | D | D |
| P6 own_club / other_club (tenant-alpha) | A | A | A | A | A |
| P6 foreign_club | A | D | D | D | D |
| P7 `GET /audit/v1/rbac/platform/config` | A | D | D | D | D |

### 2.2 Product permission matrix (production `/api/v1`, derived from §3.3 and the probe semantics)
Actions map onto the probe semantics. "Own" means the resource sits inside the principal's scope. Cross-tenant access is always 403 for non-super-admins.

| Action | Super Admin | Organizer | Club Mgr | Player | Viewer |
|---|---|---|---|---|---|
| Create tenant / platform config (P1, P7) | ✓ | – | – | – | – |
| Read tenant data (leagues, fixtures, matches, standings, clubs, store) (P6) | ✓ all | ✓ own tenant | ✓ own tenant | ✓ own tenant | ✓ own tenant |
| Manage fixtures / scoring / match status in a league (P2) | ✓ | own leagues | – | – | – |
| Manage club roster (add/transfer/loan/release) (P3) | ✓ | – | own club | – | – |
| Manage club products / pins (P4) | ✓ | – (pin: own leagues, see FR-2.3-05) | own club | – | – |
| Update a player profile (P5) | ✓ | – | own club's players | self | – |
| Checkout in store | ✓ | ✓ | ✓ | ✓ | ✓ (signed-in viewer is a customer) |
| Advance order status (pack/ship/deliver/cancel/refund) | ✓ | – | own club's orders | – | – |

**Order of authorization:** authentication (401) comes first, then resource existence (404, only when the id does not exist at all), then authorization (403), then body validation (400), then business rules (409/402). On probe routes the body is never validated (§5.13). See BR-AUTH-01.

---

## 3. Functional requirements index

IDs from the spec are kept verbatim (FR-1.1 … FR-5.1, NFR-3/4/5/7). Sub-IDs (`-NN`) refine them. Contract IDs (`API-xx` for the graded autograder routes, `APP-xx` for production routes, `RT-xx` for realtime) are defined in §8.

| ID | Title | Actor | Priority | Depends on | Acceptance |
|---|---|---|---|---|---|
| FR-1.1-01 | Sports defined purely as JSON data (create "mystery sport") | Grader / Super Admin | P0 | — | AC-1.1-01 |
| FR-1.1-02 | Four seeded sports (football, basketball, cricket, esports) stored as ordinary data | System | P0 | FR-1.1-01 | AC-1.1-02 |
| FR-1.1-03 | Three scoring models: event, innings, round | System | P0 | FR-1.1-01 | AC-1.1-03 |
| FR-1.1-04 | Append-only, signed event log; compensating events; score projection rebuilt from the log | Organizer / Grader | P0 | FR-1.1-01, NFR-SIG | AC-1.1-04 |
| FR-1.1-05 | No hard-coded sport or event names in domain logic | Dev constraint | P0 (−8 penalty) | — | AC-1.1-05 |
| FR-1.2-01 | Leagues, divisions, promotion/relegation, knockouts and hybrid (group stage → seeded knockout), scoped to seasons | Organizer | P2 | FR-1.3 | AC-1.2-01 |
| FR-1.2-02 | Register a league for standings (teams, fixtures, points, tie-break, qualification) | Grader / Organizer | P0 | FR-1.1-01 | AC-1.2-02 |
| FR-1.3-01 | Round-robin generation (single/double, circle method, byes, withdrawals) | Grader / Organizer | P0 | — | AC-1.3-01 |
| FR-1.3-02 | Swiss pairing (score groups, no rematches, byes, Buchholz) | Grader / Organizer | P0 | — | AC-1.3-02 |
| FR-1.3-03 | Single elimination (exact seeding, byes, third place) | Grader / Organizer | P0 | — | AC-1.3-03 |
| FR-1.3-04 | Double elimination (winners/losers brackets, grand final, bracket reset) | Grader / Organizer | P0 | FR-1.3-03 | AC-1.3-04 |
| FR-1.3-05 | Manual rescheduling with structured conflict detection | Organizer | P2 | FR-1.2-01 | AC-1.3-05 |
| FR-1.3-06 | Match status state machine (Upcoming, In-Progress, Completed, Postponed, Abandoned, Cancelled); illegal transitions rejected; realtime broadcast; postponement re-evaluates bracket slots and conflicts | Organizer / System | P0 (graded subset) / P2 (rest) | FR-1.1-04, RT-01 | AC-1.3-06 |
| FR-1.4-01 | Standings: points, tie-breakers in configured order, H2H mini-league, differentials, qualification status, recomputed from scratch | Grader / All | P0 | FR-1.1-04, FR-1.2-02 | AC-1.4-01 |
| FR-2.1-01 | Club profile: home venue coordinates, socials, historical stats across seasons, active roster, staff | All (read) / Club Mgr | P1 | FR-5.1 | AC-2.1-01 |
| FR-2.1-02 | White-label tenants (logo, colors, name) with strict tenant isolation | System | P0 (isolation) / P1 (branding) | FR-5.1 | AC-2.1-02 |
| FR-2.2-01 | Roster scenario setup | Grader | P0 | — | AC-2.2-01 |
| FR-2.2-02 | Transfer / loan / release with ordered rule checks | Club Mgr / Grader | P0 | FR-2.2-01 | AC-2.2-02 |
| FR-2.2-03 | Automatic loan return | System | P0 | FR-2.2-02 | AC-2.2-03 |
| FR-2.2-04 | Immutable roster audit trail (who/when/why) and history query | All (read) | P0 | FR-2.2-02 | AC-2.2-04 |
| FR-2.2-05 | Role assignments (captain, vice_captain, starter, substitute) and add-player | Club Mgr | P1 | FR-2.2-01 | AC-2.2-05 |
| FR-2.3-01 | Product catalogue: apparel/accessories/digital, variants (size, color), scheduled price changes, discount codes | All (read) / Club Mgr | P1 (catalogue) / P0 (seed) | — | AC-2.3-01 |
| FR-2.3-02 | Concurrency-safe checkout with mock gateway, signed receipt, PDF | Customer / Grader | P0 | FR-2.3-01, NFR-3 | AC-2.3-02 |
| FR-2.3-03 | Inventory query (stock, reserved) | Grader / All | P0 | FR-2.3-02 | AC-2.3-03 |
| FR-2.3-04 | Order state machine (Pending, Paid, Packed, Shipped, Delivered, Cancelled, Refunded); each transition emits a domain event to the internal queue | Club Mgr / System | P0 (paid event) / P2 (rest) | FR-2.3-02 | AC-2.3-04 |
| FR-2.3-05 | Product showcase pinned on match pages; pin updates clients in realtime | Organizer | P1 | RT-01 | AC-2.3-05 |
| FR-5.1-01 | Five-tier RBAC with tenant isolation, as policy-as-code, with negative tests for every boundary | System | P0 | — | AC-5.1-01 |
| FR-5.1-02 | Token issuance (`/rbac-matrix`) and email/password login | Grader / All | P0 / P1 | FR-5.1-01 | AC-5.1-02 |
| FR-SYS-01 | Health probe | Grader | P0 | — | AC-SYS-01 |
| FR-SYS-02 | Reset and baseline seed (exact ids) | Grader | P0 | all | AC-SYS-02 |
| FR-SYS-03 | Rate-limited ping | Grader | P0 | NFR-5 | AC-SYS-03 |
| FR-OFF-01 | Offline sync replay with per-action conflict resolution | Mobile / Grader | P0 | FR-1.1-04, FR-2.2-02 | AC-OFF-01 |
| MOB-01…MOB-12 | Mobile screens and behaviors (§9 of this doc) | Users | P1 | APP-* | §9 |
| NFR-3 | Concurrency correctness | — | P0 | FR-2.3-02 | §10 |
| NFR-4 | Offline tolerance | — | P0/P1 | FR-OFF-01, MOB-* | §10 |
| NFR-5 | Security (OWASP Mobile/API Top 10, secure storage, rate limit, validation, RBAC) | — | P0 | FR-5.1 | §10 |
| NFR-7 | Reproducibility (one command on a clean Linux machine) | — | P0 | — | §10 |
| NFR-PERF-01 | Every request < 5 s; reset < 10 s; 20-checkout burst < 10 s | — | P0 | — | §10 |
| NFR-SIG | HMAC signatures, byte-exact (§5.3, App. A) | — | P0 | — | §10 |
| DEL-01…DEL-08 | Submission package and process deliverables | Team | P0/P1 | — | §11 |

---

## 4. Functional requirements with acceptance criteria

### FR-1.1 Multi-sport taxonomy and event-sourced scoring

**FR-1.1-01: Mystery sport from JSON (§5.6), contract API-03.**
Given a valid sport JSON, when it is POSTed, the sport is stored as data and becomes immediately usable by
`/events`, `/leagues`, `/standings` and `/fixtures` without a code change or restart.
- **AC-1.1-01a:** POST the kabaddi example → 201 `{"sport_id":"kabaddi","status":"created","config":{…stored config echoed…}}`; then `/leagues` with `sport_id:"kabaddi"` → 201; `match_init` → 201; a `score` with `event_type:"all_out"` adds 2 points.
- **AC-1.1-01b:** POSTing the same `sport_id` again → 409 `SPORT_EXISTS`. This includes seeded ids such as `football`.
- **AC-1.1-01c:** A `sport_id` of `x'; DROP TABLE sports;--` → 400 `VALIDATION_ERROR` with `details.fields` containing `"sport_id"`. Never a 5xx.
- **AC-1.1-01d:** Every rule in the API-03 field table is enforced. Each violation → 400 `VALIDATION_ERROR` with **all** offending field names in `details.fields`.

**FR-1.1-02: Seeded sports (§5.5 table).** These are created by startup and by every `/reset`, through the same schema and code path as API-03:

| sport_id | name | scoring_model | periods | scoring_events | draw_allowed | overtime | roster |
|---|---|---|---|---|---|---|---|
| `football` | Football | event | `{count:2,duration_minutes:45}` | `goal:{points:1}` | true | `{policy:"none"}` | min 11, max 25, required `{gk:1}` |
| `basketball` | Basketball | event | `{count:4,duration_minutes:12}` | `free_throw:{points:1}`, `two_pointer:{points:2}`, `three_pointer:{points:3}` | false | `{policy:"extra_time",duration_minutes:5}` | min 5, max 15, required `{}` |
| `cricket` | Cricket | innings | `{innings_per_team:1,overs_per_innings:20,balls_per_over:6,wickets_per_innings:10}` | `dot_ball{runs:0,legal_ball:true,wicket:false}`, `single{1,true,false}`, `two{2,true,false}`, `four{4,true,false}`, `six{6,true,false}`, `wide{1,false,false}`, `no_ball{1,false,false}`, `wicket{0,true,true}` | true | `{policy:"super_over"}` | min 11, max 18, required `{wicketkeeper:1}` |
| `esports` | Esports | round | `{best_of:3}` | `round_win:{rounds:1}` | false | `{policy:"none"}` | min 5, max 8, required `{}` |

All seeded sports use the default `tie_break_order` (the full list). The display names (`Football`, …) are our choice; the spec does not fix them.
- **AC-1.1-02:** After `/reset`, POST `/audit/v1/sports` with `sport_id:"cricket"` → 409 `SPORT_EXISTS`. A cricket match accepts `six` (+6 runs, one legal ball) and `wide` (+1 run, no legal ball).

**FR-1.1-03: Scoring models (§5.9).** The projection semantics per model are defined in BR-SCORE-*.
- **AC-1.1-03a (innings limits):** cricket with 20 overs × 6 balls: after a team has 120 legal (non-compensated) balls, or 10 non-compensated wickets, its next `score` event → 409 `INNINGS_COMPLETE`.
- **AC-1.1-03b (round limits):** esports best_of 3: once either team has 2 rounds, any further `score` → 409 `SERIES_ALREADY_DECIDED`.
- **AC-1.1-03c:** Compensated events do not count toward limits. After compensating a wicket, the team can score again.

**FR-1.1-04: Event sourcing (§5.9), contracts API-06 and API-07.**
- **AC-1.1-04a:** Each accepted event returns 201 with `sequence`, `match_version` and `signature`. The signature is HMAC per NFR-SIG over `event_id` and the canonical request `payload`.
- **AC-1.1-04b:** A compensation appends a new signed row. The original row is unchanged: `GET /score` shows both, the target with `compensated:true, compensated_by:<comp event_id>`, and the score excludes the target.
- **AC-1.1-04c:** Replaying an identical event body → 200 with the stored response and no new row. Same `event_id` with a different body → 409 `DUPLICATE_EVENT_ID`.
- **AC-1.1-04d:** The score is rebuilt from the event log on every read. There is no mutable score counter as the source of truth.
- **Edge case 5 (§6):** compensating a result on a completed match after qualification was decided → the next `/standings` call recomputes ranks, status and h2h from scratch, and the original events are unchanged in `/score`.

**FR-1.1-05: No hard-coded sport logic (§9.4).** No branch in domain logic may test a specific sport id or event name (`"football"`, `"goal"`, `"wicket"`, …). All behavior flows from `scoring_model` and the config fields.
- **AC-1.1-05:** `grep -rniE "'(football|basketball|cricket|esports|goal|wicket|six|four|round_win|kabaddi)'" backend/src --include=*.js` finds matches **only** in the seed-data module (see ARCHITECTURE §5). CI enforces this.

### FR-1.2 League and tournament setup

**FR-1.2-01 (P2): League structures.** Admins configure single-stage leagues, multi-division structures with promotion/relegation rules, knockout tournaments and hybrid formats (group stage followed by a seeded knockout bracket), all scoped to seasons.
- **AC-1.2-01:** Via `APP-20…APP-22` an organizer can create a season, divisions with promotion/relegation counts, and stages (`league` | `group` | `knockout`) with a format from FR-1.3. A hybrid stage seeds the knockout bracket from the group standings (FR-1.4 ranks) using the FR-1.3-03 seeding. No Phase I script grades this; it is verified by our own tests.

**FR-1.2-02 (P0): Register a league (§5.8), contract API-05.**
- **AC-1.2-02a:** The §5.8 example → 201 `{"league_id":"lg-1","status":"created","team_count":4,"fixture_count":2}`. Each fixture becomes a match stream with status `upcoming` and version 0 (see OQ-07).
- **AC-1.2-02b:** Unknown sport → 404 `SPORT_NOT_FOUND`. A reused `league_id` → 409 `LEAGUE_EXISTS`. A reused `match_id` → 409 `MATCH_EXISTS`. Duplicate teams, fewer than 2 or more than 40 teams, a fixture team not in `teams`, or `home == away` → 400.
- **AC-1.2-02c:** Defaults: points `{win:3,draw:1,loss:0}`; `tie_break_order` = the sport's; `lots_seed` = the seed of the last `/reset` (42 if none), resolved and stored at registration time.

### FR-1.3 Match and fixture scheduling

All four formats are implemented in our own code. Third-party fixture-generation libraries are prohibited. Contract: API-04 (`POST /audit/v1/fixtures`, stores nothing).

**FR-1.3-01: Round-robin (§5.7-A).**
- Rounds per leg: n−1 (n even) or n (n odd). Matches per round: ⌊n/2⌋. `byes` = `[]` for even n, exactly one team for odd n. Round numbers are global (leg 2 continues after leg 1). `match_id` = `RR-L{leg}-R{round}-M{index}` (index from 1 within the round).
- Every team plays exactly once per round except its bye round. With odd n, every team has exactly one bye per leg.
- Every unordered pair meets exactly `legs` times. With `legs=2`, every ordered pair (home, away) occurs exactly once.
- Home/away balance (circle method): within each leg, for every team, |home games − away games| ≤ 1.
- Withdrawals: `after_round` = the last global round the team still plays; 0 = never plays. `forfeit_remaining` (default): fixtures involving a withdrawn team with `round > after_round` get `status:"forfeit"`, `awarded_to` = the opponent; earlier fixtures stay `scheduled`. `void_all`: every fixture involving a withdrawn team (any round) gets `status:"voided"`, `awarded_to:null`. A fixture where both teams are withdrawn (and past both teams' `after_round` under forfeit_remaining) is voided. Fixtures are never removed; byes are unaffected.
- `summary` = `{total, scheduled, forfeit, voided}` counts.
- **AC-1.3-01a:** For every n in 2..40 and legs ∈ {1,2}, all the properties above hold (property tests).
- **AC-1.3-01b:** A withdrawal with an unknown team, or `after_round` outside `0..round_count` → 400 `VALIDATION_ERROR`.
- **Edge case 1 (§6):** odd n plus a mid-season withdrawal → one bye per round and the withdrawal policy applied exactly as above.

**FR-1.3-02: Swiss (§5.7-B).** One call pairs one round.
- Scoring: win 1, draw 0.5, loss 0, bye 1 (counts as a win). `standings` reflect history only (before the round being paired), sorted by score desc, then buchholz desc, then seed (lower index first). Buchholz = the sum of the current scores of every opponent the team actually played (a bye contributes 0). `score` and `buchholz` are compared exactly.
- **Round 1 (exact):** m = ⌊n/2⌋. If n is odd, the last seed gets the bye. Pair seed i with seed i+m for i = 1..m (home = lower seed). Match ids `SW-R{round}-M{index}`.
- **Rounds ≥ 2 (properties):** (a) every team appears at most once; (b) no pair has met before; (c) with odd n exactly one bye, given to the lowest-scoring team that has not had a bye (ties → lowest seed, i.e. largest index); if no valid pairing exists for the rest, try the next-lowest candidate; (d) the sum over pairs of |score difference| equals the minimum achievable over all rematch-free pairings (greedy pairing fails this; an optimal matching is required). Home/away is not checked.
- If no complete rematch-free pairing exists for any bye candidate → 409 `NO_VALID_PAIRING` with `details.round`.
- **AC-1.3-02:** Brute-force cross-check in unit tests for n ≤ 10 (enumerate all pairings) against the optimal-matching result. Edge case 2 (§6) → 409 with `details.round`.

**FR-1.3-03: Single elimination (§5.7-C), exact.**
- B = the next power of two ≥ n. `order(2) = [1,2]`; `order(2k)` = for each s in `order(k)`: `s, 2k+1−s`. So `order(8) = [1,8,4,5,2,7,3,6]`. Round-1 match i takes entries 2i−1 and 2i; the lower seed number is home. A seed number > n is missing: that match has `bye:true`, `away:null`, and its winner is the present team, propagated immediately.
- `match_id` = `R{round}M{index}`; rounds = log2 B. The winner of R{r}M{i} goes to R{r+1}M{⌈i/2⌉}, slot `home` if i is odd, `away` if even. Final: `winner_to:null`. `home`/`away` are null while unknown.
- `params.results`: `[{match_id, winner}]`, filled into `winner`/`loser` and propagated. An unknown `match_id` or a winner who is not a participant → 400.
- `third_place_match:true` adds match `TP` (`bracket:"third_place"`). The `loser_to` of both semifinals points to TP (first semifinal → `home`, second → `away`).
- **MATCH object (mandatory fields):** `match_id, bracket, round, index, home, away, home_seed, away_seed, bye, winner, loser, winner_to {match_id, slot} | null, loser_to {match_id, slot} | null`.
- **AC-1.3-03:** For n = 6: R1M1 seed 1 vs (8 missing) BYE; R1M2 seed 4 vs seed 5; R1M3 seed 2 vs (7 missing) BYE; R1M4 seed 3 vs seed 6; `R2M1.home = t1` immediately. n is limited to 2..128.

**FR-1.3-04: Double elimination (§5.7-D).**
- B and the WR1 seeding are identical to single elimination. `bracket` ∈ {`winners`, `losers`, `grand_final`}.
- Winners bracket `WR{r}M{i}`: round r has B/2^r matches (r = 1..k, B = 2^k). Losers bracket `LR{r}M{i}`: rounds 1..2(k−1); rounds 2j−1 and 2j each have B/2^(j+1) matches (j = 1..k−1). There are B−2 losers matches in total. Grand final `GF1`; `GF2` exists only when `bracket_reset:true`.
- Routing (graph-checked): every non-terminal match has `winner_to`; every winners-bracket match has `loser_to`; losers-bracket matches have `loser_to:null`; every match slot except WR1 is fed by exactly one source. WR final winner → `GF1.home`; WR final loser → LB final `away`; LB final winner → `GF1.away`. WR1 losers meet each other in LR1; WR r (r ≥ 2) losers drop into LR(2r−2).
- Bracket reset: GF2 has `conditional:true` and the same two teams as GF1. Its `required` is `null` until GF1 has a result, then `true` iff `bracket_reset` is true and the GF1 winner is the losers-bracket champion (`GF1.away`), else `false`. A winners-bracket champion who wins GF1 ends the event.
- WR1 byes are graded as in single elimination. Whether losers-bracket matches fed by a missing team carry `bye:true` is not graded (our behavior: see BR-FIX-06).
- **AC-1.3-04:** Counts and ids are exact for B ∈ {4, 8, 16, 32, 64, 128}. A graph validator test asserts every routing rule. Edge case 3 (§6): GF1 won by GF1.away with `bracket_reset:true` → `GF2.required:true`.

**FR-1.3-05 (P2): Manual rescheduling and conflict detection.** Detect: venue double-booking, team overlap, player overlap across squads (a player registered in two squads), the minimum rest period between matches, and venue availability windows. Conflicts are returned as a structured 409 (`code:"SCHEDULE_CONFLICT"`, `details.conflicts:[{type, entity_ids:[…], match_ids:[…]}]`). The code is our choice and is not in Appendix B.
- **AC-1.3-05:** Rescheduling a match into a slot where its venue is booked → 409 listing the conflicting `match_id` and `venue_id`.

**FR-1.3-06: Match status state machine.** Statuses: Upcoming, In-Progress, Completed, Postponed, Abandoned, Cancelled. The graded subset is `upcoming → in_progress → completed` via events (BR-SCORE-01). Production transitions (APP-12): `upcoming → postponed | cancelled`, `in_progress → abandoned`, `postponed → upcoming` (rescheduled) `| cancelled`. Every other transition → 409 `ILLEGAL_TRANSITION`. Each status change is broadcast in realtime (RT-01). Postponing re-evaluates downstream bracket slots and re-runs conflict detection (P2).
- **AC-1.3-06:** `match_end` on an `upcoming` match → 409 `ILLEGAL_TRANSITION`. A subscribed WebSocket client receives `match.status_changed` within 1 s of a successful transition.

### FR-1.4 Automated standings (§5.10), contract API-08
- Recomputed from scratch from the event logs on **every** call. Only matches with status `completed` and outcome ≠ `undecided` count as played; all other fixtures are "remaining".
- Field semantics, the ordering algorithm, `resolved_by`, h2h and qualification status: see BR-STAND-01…08 (exact).
- **AC-1.4-01a (edge case 4):** a three-way tie on points resolves through `h2h_points` computed only among the three tied teams. When a criterion splits off a subgroup of size > 1, that subgroup restarts from the first criterion (restart-on-split).
- **AC-1.4-01b:** `draw_lots` with seed 42 and league `lg-1` ranks t1 (key `0613…`), then t3 (`c8f2…`), then t2 (`e3e3…`) (App. A vector 2).
- **AC-1.4-01c:** The `h2h` map contains every ordered pair of distinct teams, with zeros when they never met.

### FR-2.1 Club profiles and tenant isolation
- **FR-2.1-01 (P1):** A club has `club_id, tenant_id, name, home_venue {name, lat, lng}, socials {…}, staff [{name, role: coach|manager|physio}]`, a historical stats view across seasons (played/won/drawn/lost per season, derived), and an active roster (players currently registered to the club's squads). Served by APP-30.
- **FR-2.1-02:** A tenant has `tenant_id, name, logo_url, colors {primary, secondary}`. The mobile app applies the tenant's name, logo and colors after login (§8.6 area 2). Tenant isolation is absolute (FR-5.1-01).
- **AC-2.1:** The manager logs in → the club profile shows the venue, roster and staff with tenant-alpha branding. A tenant-alpha token on `GET /api/v1/clubs/club-beta-1` → 403.

### FR-2.2 Roster and player registry (§5.11), contracts API-09…API-11
- **FR-2.2-01:** `/roster/setup` builds a scenario. Re-sending the same `league_id` replaces that league's roster state (squads, registrations, in-progress matches and that league's roster audit entries; see OQ-10).
- **FR-2.2-02:** Transfer, loan and release requests are checked in the **exact order** of BR-ROST-01. The first failure is returned. Effects follow BR-ROST-02.
- **FR-2.2-03:** Automatic loan return: the day after `loan_end_date` the player is back with the lender (role `substitute`). It appears as one `loan_return` audit entry (`who:"system"`), written once and never duplicated.
- **FR-2.2-04:** Every accepted roster change appends one immutable audit entry. Rejected requests change nothing and write no entry. Request idempotency uses `request_id`.
- **FR-2.2-05 (P1):** Managers can add a new player to their squad and set roles (captain, vice_captain, starter, substitute) through APP-31/APP-32.
- **AC-2.2-a:** Every row of the BR-ROST-01 table has a positive and a negative test, and the precedence is tested by requests that violate two rules at once (the earlier code must win).
- **AC-2.2-b (edge case 6):** a transfer on the last window day while the player's squad is in `matches_in_progress` → 201 with `state:"deferred_until_match_end"` and `blocking_match_id`.
- **AC-2.2-c:** A loan 2026-09-10..2026-09-20, then history `as_of=2026-09-21` → `current_squad_id` = lender, plus exactly one `loan_return` entry. Calling it again → still exactly one.

### FR-2.3 Integrated club merchandise store (§5.12), contracts API-12 and API-13
- **FR-2.3-01:** Products (`apparel` | `accessory` | `digital`) with variants (size, color), each variant priced in integer minor units (PKR). Scheduled price changes (`price_schedules`: `variant_id, price_minor, effective_from`) are applied at checkout time. Discount codes: Phase I has exactly one valid code, `WELCOME10` = 10% off the subtotal.
- **FR-2.3-02:** Checkout runs in the order of BR-STORE-01 with zero overselling under concurrency (NFR-3), the mock gateway (authorize, capture, fail, refund simulation), a signed receipt (NFR-SIG) and a server-side PDF.
- **FR-2.3-03:** Inventory: `stock` = units available for purchase; `reserved` = units held by in-flight checkouts (0 once all requests return).
- **FR-2.3-04:** Order states and transitions (BR-STORE-03). Each transition writes a structured domain event to the internal queue (not graded by script, but required).
- **FR-2.3-05 (P1):** An organizer pins a product to a match page (APP-14). Connected clients receive `match.pinned_product_changed` in realtime. The match-detail screen shows the pinned showcase.
- **AC-2.3-a (NFR-3):** `/reset` with `stock {"var-jersey-001-M":1}`, then 20 parallel checkouts with distinct `order_id`s → exactly one 201 and nineteen 409 `OUT_OF_STOCK`; inventory shows `stock:0, reserved:0`; all 20 requests finish within 10 s.
- **AC-2.3-b:** `pdf_base64` decodes to bytes starting with `%PDF`, and the extracted text contains the `order_id` and `PKR 4500.00`.
- **AC-2.3-c:** `tok_declined` → 402 `PAYMENT_DECLINED`; `tok_capture_fail` → 402 `PAYMENT_CAPTURE_FAILED`. Released stock is purchasable again (inventory back to the pre-request value, `reserved:0`).

### FR-5.1 Five-tier RBAC
- **FR-5.1-01:** Enforced through one policy-as-code layer (a declarative matrix plus scope predicates). Tenant isolation is absolute. Non-super-admin cross-tenant access → 403, never 404. 404 is only for ids that do not exist at all. Authorization is evaluated before anything else about the request.
- **FR-5.1-02:** `/rbac-matrix` returns JWTs for the five demo users plus scenario ids (API-14). Tokens are valid for ≥ 1 hour. The signature is verified; `alg:none`, a tampered signature or an expired token → 401 `UNAUTHENTICATED`. Login (APP-01) issues equivalent tokens for the §8.3 accounts.
- **AC-5.1:** One automated test per cell of the §2.1 matrix (13 rows × 5 roles = 65 cases, plus the 3 security probes). One unit test per policy rule, covering both allow and deny.

### FR-SYS: system routes
- **FR-SYS-01 (API-01):** `GET /health` → 200 `{"status":"ok"}` only when the DB is reachable **and** the baseline is seeded. No auth, not rate limited. It must be 200 within 120 s of `docker compose up -d --build` returning.
- **FR-SYS-02 (API-02):** `/reset` wipes all state (matches, events, leagues, rosters, orders, offline-sync records, custom sports, audit, users) and recreates the exact baseline. Calling it twice in a row leaves identical data. It must finish in < 10 s.
- **FR-SYS-03 (API-16):** `GET /api/v1/ping` → 200 `{"pong":true}`, rate limited per BR-RL-01.

### FR-OFF-01: Offline sync (§5.14), contract API-17
The mobile app queues actions in exactly this format and syncs through the same code (directly or through APP-40, which calls the identical service). The per-action resolution table is in BR-SYNC-01.
- **AC-OFF-01a:** Re-sending the same request → every action `duplicate`, and nothing changes.
- **AC-OFF-01b:** A stale `base_version` with the rules still satisfied → `applied` + `rebased_append`. `base_version` > current → `rejected` + `INVALID_BASE_VERSION`.
- **AC-OFF-01c:** The whole request → HTTP 200 even when every action is rejected. Only a malformed envelope → 400.

---

## 5. Domain model

All identifiers are client- or seed-chosen strings unless stated: 1–64 chars from `A-Za-z0-9_.:-`, never containing `|`, case-sensitive, and stored and returned verbatim (§5.2). Timestamps are UTC `YYYY-MM-DDTHH:MM:SSZ` (no fractional seconds). Dates are `YYYY-MM-DD`. Money is an integer number of minor units (paisa); currency is always `"PKR"`. Physical schema and indexes: ARCHITECTURE §6.

| Entity | Identifier | Key fields (type; required/optional; constraints) | Relationships / ownership | Lifecycle / deletion |
|---|---|---|---|---|
| Tenant | `tenant_id` | `name` str 1–80 req; `logo_url` str opt; `colors {primary, secondary}` hex str opt | owns leagues, clubs, products, users | seeded; wiped only by `/reset` |
| User | `user_id` (server) | `email` unique req; `password_hash` (scrypt); `role` enum(5); `tenant_id` null only for super_admin; `league_ids[]`, `club_id?`, `player_id?` scope | belongs to tenant | seeded demo users; wiped and reseeded by `/reset` |
| Sport | `sport_id` (regex `^[a-z0-9_-]{2,40}$`) | `name` 1–80; `scoring_model` enum; `config` JSON (API-03 schema) | referenced by leagues and matches | immutable after creation (no update/delete API); custom sports wiped by `/reset` |
| League | `league_id` | `sport_id` (null allowed only for roster-only leagues, OQ-09); `tenant_id` (null for leagues created via `/audit/v1/leagues`); `teams[]`; `points {win,draw,loss}` int; `tie_break_order[]`; `qualification_spots` int; `lots_seed` int; `transfer_window {open, close}` date; `max_squad_size` int; `required_positions {pos:int}` | has matches, squads; owned by tenant + organizer | created; never deleted except by `/reset`; roster part replaced by `/roster/setup` |
| Season / Division / Stage (P2) | `season_id`, `division_id`, `stage_id` | season `start_date`, `end_date`; division `promotion_count`, `relegation_count`; stage `type` (league/group/knockout), `format` | league → seasons → divisions/stages → matches | P2 |
| Match (stream) | `match_id` (globally unique) | `sport_id`; `league_id?`; `home_team_id`, `away_team_id`; `status` (projection; see BR-SCORE-01); `version` int = event count (denormalized, maintained in the same transaction as the append); `scheduled_at?`, `venue_id?` (P2); `pinned_product_id?` | belongs to league (optional) | created by `/leagues` fixtures or `match_init`; never deleted except by `/reset` |
| MatchEvent | `event_id` (globally unique) | `match_id`; `sequence` int ≥ 1 (unique per match); `type` enum; `payload` JSON (stored verbatim); `signature` hex64; `request_hash`; `created_at` | belongs to match | **append-only: never updated or deleted** (except the `/reset` wipe) |
| Team (league entrant) | team id string | referenced from leagues and matches; no separate table required for audit leagues | — | — |
| Club | `club_id` | `tenant_id`; `name`; `home_venue {name, lat (−90..90), lng (−180..180)}`; `socials` map; `staff[]` | tenant owns club; club has squads, products | seeded/created |
| Squad | (`league_id`, `squad_id`) | `club_id`; `tenant_id`; `name` | league-scoped; club owns squad | replaced by `/roster/setup` |
| Player | `player_id` | `name`; `position` str; `club_id?` (home club, used for RBAC P5) | registrations per league | seeded/created |
| Registration | (`league_id`, `player_id`) current + history | `squad_id` (null = released); `parent_squad_id` (lender during a loan); `registration_type` (`initial`, `transfer`, `loan`); `start_date`; `loan_end_date?`; `role` enum; `state` (`active`, `deferred_until_match_end`); `blocking_match_id?` | one active registration per player per league | changed only through transfer/loan/release/loan_return |
| RosterAuditEntry | `audit_id` (`au-NNNN`, sequence restarts at 1 after `/reset`) | `action` (transfer, loan, release, loan_return); `player_id`; `league_id`; `from_squad_id`; `to_squad_id`; `effective_date`; `state`; `who`; `when` (server time); `why` | — | **immutable, append-only** |
| Product | `product_id` | `tenant_id`; `club_id?`; `name`; `category` (apparel, accessory, digital); `description?`; `image_url?` | has variants | P1 CRUD |
| Variant | `variant_id` | `product_id`; `size?`; `color?`; `price_minor` int ≥ 0 (current effective); `stock` int ≥ 0; `reserved` int ≥ 0 | inventory per variant | `stock`/`reserved` change only through checkout and reset |
| DiscountCode | `code` | `percent` int 1..100; `active` bool | — | seeded `WELCOME10` = 10 |
| Order | `order_id` | `customer_id` (free text, see OQ-12); `status` enum; `items[] {variant_id, quantity, unit_price_minor}`; `subtotal_minor`, `discount_minor`, `total_minor`; `payment {authorization_id, capture_id, state}`; `receipt` (payload + signature + pdf); `request_hash` | — | created only on successful payment; status per BR-STORE-03 |
| DomainEvent (outbox) | `id` (bigserial) | `topic`, `type`, `aggregate_id`, `payload` JSON, `created_at`, `published_at?` | — | append-only; relayed to the queue |
| OfflineSyncRecord | (`device_id`, `action_id`) | `result` JSON (as returned) | — | wiped by `/reset` |
| IdempotencyRecord | (`scope`, `client_id`) | `request_hash`, `status_code`, `response` JSON | — | wiped by `/reset` |

**Null vs omitted:** in responses, every documented field is always present; unknown values are `null`, never omitted. In requests, an omitted optional field takes its default; an explicit `null` is accepted only where this document says "null allowed" (e.g. `discount_code`, `to_squad_id` for release, `loan_end_date` for non-loan). Elsewhere `null` → 400.

---

## 6. Business rules (exact)

### 6.1 Signatures (NFR-SIG, §5.3, Appendix A)
- **BR-SIG-01:** `signature = lowercase_hex(HMAC_SHA256(key = UTF-8 bytes of env DAY1_SALT (not trimmed, not hex-decoded), message = UTF-8 bytes of (id + "|" + canonical(payload))))`, 64 chars.
- **BR-SIG-02 (canonical JSON):** byte-identical to Python `json.dumps(obj, sort_keys=True, separators=(",",":"), ensure_ascii=False)`: object keys sorted recursively by Unicode code point; no whitespace; non-ASCII not escaped; integers without a decimal point; `true`/`false`/`null` lowercase; array order preserved. Non-integer numbers are reproduced exactly as the received JSON number lexeme (see ADR-007).
- **BR-SIG-03:** Events: id = `event_id`, payload = the request's `payload` object as received (unknown fields included). Receipts: id = `order_id`, payload = `receipt.payload` exactly as returned.
- **BR-SIG-04:** Test vector: salt `demo-salt`, id `evt-1`, payload `{"team_id":"t1","event_type":"goal"}` → canonical `{"event_type":"goal","team_id":"t1"}` → `972a8b558690b19121cc5bea84978f85e8eb15a3735018db36616bab1d7ec501`. This must be a unit test.

### 6.2 Scoring and projection (§5.9)
- **BR-SCORE-01 (status):** a match created by `match_init` or a league fixture starts as `upcoming`. `match_start` is valid only from `upcoming` → `in_progress`, else 409 `ILLEGAL_TRANSITION`. `match_end` is valid only from `in_progress` → `completed`, else 409 `ILLEGAL_TRANSITION`. `score`, `discipline` and `tiebreak_winner` require `in_progress`, else 409 `MATCH_NOT_IN_PROGRESS`. `compensation` is allowed in any status after init, including `completed`.
- **BR-SCORE-02 (match_end tie):** if the active score is level, `draw_allowed` is false and there is no active `tiebreak_winner` → 409 `TIE_NOT_ALLOWED`.
- **BR-SCORE-03 (score event):** `team_id` must be the home or away team, else 400 `VALIDATION_ERROR` (`fields:["payload.team_id"]`). `event_type` must be a key of the sport's `scoring_events`, else 400 `UNKNOWN_EVENT_TYPE`. Event model: +`points`. Innings model: +`runs`; `legal_ball:true` → +1 ball; `wicket:true` → +1 wicket. Round model: +`rounds`.
- **BR-SCORE-04 (limits):** innings: if the team's active legal balls ≥ `innings_per_team × overs_per_innings × balls_per_over` **or** its active wickets ≥ `innings_per_team × wickets_per_innings` → 409 `INNINGS_COMPLETE` for further score events of that team. Round: once either team has ≥ `(best_of + 1) / 2` rounds → 409 `SERIES_ALREADY_DECIDED` for further score events. Compensated events do not count.
- **BR-SCORE-05 (discipline):** `{team_id, points}` (integer, usually negative) adds to that team's fair-play total (higher is better).
- **BR-SCORE-06 (tiebreak_winner):** `{team_id}` (home or away) declares the shootout/overtime/super-over winner without changing the score.
- **BR-SCORE-07 (compensation):** `{compensates, reason}`. The target must be a `score`, `discipline` or `tiebreak_winner` event of the same match. An unknown `event_id` → 404 `EVENT_NOT_FOUND`. A target that is already compensated, of another type, or in another match → 409 `INVALID_COMPENSATION`. The projection treats the compensated event **and** the compensation itself as neutral.
- **BR-SCORE-08 (projection fields):** `score`: event → sum of points; innings → total runs; round → rounds won (active events only). `wickets`, `balls`, `overs`: innings model only, else `null`. `balls` = legal balls faced. `overs` = the string `"{balls div bpo}.{balls mod bpo}"` (e.g. `"3.2"`). `fair_play` = the sum of active discipline points (0 if none). `winner_team_id` = the higher score; if level, the active tiebreak_winner team; else null. `outcome`: `pending` while not completed; once completed: `home_win`, `away_win`, `draw` (level, draw allowed, no active tiebreak winner) or `undecided` (level, draw not allowed, no active tiebreak winner, e.g. after the tie-break event was compensated). An active tiebreak winner on a level score gives `home_win`/`away_win`, even when draws are allowed.
- **BR-SCORE-09 (sequence/version):** `sequence` = the 1-based position in the match's log (every type counts, compensations included). `match_version` = the number of events in the log after the append. League fixtures start with 0 events (OQ-07).
- **BR-SCORE-10 (check order for /events):** 1) body schema → 400; 2) identical replay of a stored `event_id` → 200 stored response; 3) existence: the match for non-init types → 404 `MATCH_NOT_FOUND`, the sport for `match_init` → 404 `SPORT_NOT_FOUND`, the compensation target → 404 `EVENT_NOT_FOUND`; 4) payload semantics (team/event_type) → 400; 5) conflicts: `DUPLICATE_EVENT_ID`, `MATCH_EXISTS` (match_init on an existing stream), state machine, limits, compensation validity → 409. Steps 4 and 5 follow the global rule that 400 comes before 404 before 409 wherever the spec allows; see OQ-05 for the 400-after-404 exception on payload team checks.

### 6.3 Standings (§5.10)
- **BR-STAND-01:** Played = status `completed` and outcome ≠ `undecided`. A win decided by `tiebreak_winner` counts as a win (and a loss for the opponent). `points = won×win + drawn×draw + lost×loss`.
- **BR-STAND-02:** `scored`/`conceded` = the sum of `score` for/against. `diff`: event and round models → scored − conceded (round: rounds won − rounds lost). Innings → NRR = runs scored ÷ overs faced − runs conceded ÷ overs bowled, rounded to 3 decimals. Overs = legal balls ÷ `balls_per_over` (decimal). An innings that ended with wickets ≥ `wickets_per_innings` counts as the full `overs_per_innings`. Overs bowled = the opponent's overs faced. A term with 0 overs counts as 0 (our rule, OQ-14). Rounding is identical to Python `round(x, 3)` (half-even on the exact binary value; e.g. 0.0625 → 0.062).
- **BR-STAND-03:** `fair_play` = the sum of the team's active discipline points over played matches.
- **BR-STAND-04 (ordering, exact):** (1) sort by points desc; teams with equal points form a tied group. (2) `resolve(group)`: for each criterion in `tie_break_order` (with `draw_lots` always applied after the other listed criteria, even if omitted or listed earlier; OQ-15), compute the criterion for every team of the group. If the values are not all equal, split into subgroups by value (best first); resolve every subgroup of size > 1 by calling `resolve` again **from the first criterion**; stop. (3) `h2h_points` = points earned only in completed matches among the teams of the current group. `h2h_diff` = diff over the same matches (NRR over them for innings sports). `overall_diff`, `scored` and `fair_play` use all completed league matches. Higher is better for all. (4) `draw_lots`: ascending `SHA256_hex(lots_seed + "|" + league_id + "|" + team_id)` (decimal seed, UTF-8); first = best.
- **BR-STAND-05 (resolved_by):** for a team whose next-ranked team has equal points, this is the name of the criterion that separated them; otherwise `null` (including the last team of a tied group; OQ-16). Innings `diff` values are compared after rounding (OQ-17).
- **BR-STAND-06 (h2h):** `h2h[a][b]` = `{played, points, scored, conceded}` of a against b over all completed matches between them, present for every ordered pair (a ≠ b), with zeros when they never met.
- **BR-STAND-07 (qualification, exact; points only):** W = win points, R(T) = remaining fixtures of team T, max(T) = points(T) + W×R(T), k = `qualification.spots`. `clinched` if fewer than k **other** teams X satisfy max(X) ≥ points(T). `eliminated` if at least k other teams X satisfy points(X) > max(T). Otherwise `still_possible`. Clinched is checked first.
- **BR-STAND-08:** The table has one row per team in `teams`, including teams with 0 played.

### 6.4 Fixtures (§5.7): see FR-1.3-01…04 for the exact rules. Additional rules we chose:
- **BR-FIX-01:** Validation limits: round_robin 2–40 teams, swiss 2–64, single_elim 2–128, double_elim 3–128. Team ids must be unique. Violations → 400 `VALIDATION_ERROR`.
- **BR-FIX-02:** Swiss `history` must contain exactly rounds 1..round−1 (each once, in any order), with `matches[].result` ∈ {home, away, draw} and `bye` = a team id or null. Any team in history must be in `teams`. Violations → 400.
- **BR-FIX-03:** Swiss `total_rounds` integer 1..n−1, default ⌈log2 n⌉. `round` 1..total_rounds, default 1.
- **BR-FIX-04:** Elimination `results` are applied in dependency order regardless of their order in the request. A result whose match has no known two participants, an unknown `match_id`, a non-participant winner, a duplicate match_id in results, or a result on GF2 when `required` is false → 400.
- **BR-FIX-05:** A bye match's `away_seed` is `null`; its `loser` is `null`.
- **BR-FIX-06:** A losers-bracket slot fed by a WR1 bye (no loser) is "dead". A losers-bracket match with one dead slot is auto-advanced (`bye:true`, winner = the present team). Not graded.
- **BR-FIX-07:** In double elimination, `GF1.winner_to = {GF2, home}` and `GF1.loser_to = {GF2, away}` when `bracket_reset:true`. GF2 `home`/`away` are populated only when `required` becomes true (OQ-18). Every double-elim MATCH also carries `conditional` (false except GF2) and `required` (true except GF2).

### 6.5 Roster (§5.11)
- **BR-ROST-01 (transfer check order, exact; first failure wins):**

| # | Check | Result |
|---|---|---|
| 1 | Schema, dates, `loan_end_date > effective_date` (loan), `to_squad_id` present unless release | 400 `VALIDATION_ERROR` |
| 2 | League, player and squads exist (checked in that order: league, player, from squad, to squad) | 404 `LEAGUE_NOT_FOUND`, `PLAYER_NOT_FOUND`, `SQUAD_NOT_FOUND` |
| 3 | From and to squads belong to the league's tenant | 409 `CROSS_TENANT_TRANSFER` |
| 4 | The player's current squad in this league equals `from_squad_id` | 409 `NOT_IN_SQUAD` |
| 5 | transfer/loan: `effective_date` inside the window (inclusive); release is allowed on any date | 409 `TRANSFER_WINDOW_CLOSED` |
| 6 | The player is not currently on loan (transfer/loan/release of a loaned player is refused) | 409 `PLAYER_ON_LOAN` |
| 7 | transfer/loan: destination squad count + 1 ≤ `max_squad_size` | 409 `SQUAD_FULL` |
| 8 | After the move, the from squad still has ≥ the required count for the player's position | 409 `MIN_POSITION_VIOLATION` |

The idempotent replay check (same `request_id` and identical body → 200 stored response) runs between steps 1 and 2. "Current" state is evaluated as of the request's `effective_date`, after materializing any due loan returns (BR-ROST-03).
- **BR-ROST-02 (effects):** *transfer*: the player moves permanently; new role `substitute`; if the old role was captain/vice_captain, that slot in the old squad becomes vacant. *loan*: the player belongs to the borrower from `effective_date` through `loan_end_date` inclusive; `parent_squad_id` = the lender; the player counts toward the borrower's squad size and no longer toward the lender's. *release*: the player leaves the league (no squad; `registration: null` in the response). *In-progress match*: if the player's current squad is the home or away squad of any entry in `matches_in_progress` (first in list order wins), the request is still accepted (the window is judged on `effective_date`) with `state:"deferred_until_match_end"` and `blocking_match_id`, and the player stays eligible for that match with the old squad. Otherwise `state:"active"`, `blocking_match_id:null`.
- **BR-ROST-03 (loan return):** the return becomes due on `loan_end_date + 1`. It is materialized lazily, exactly once (unique per loan), whenever a read or write evaluates the player at a date ≥ the due date, as `{action:"loan_return", from_squad_id: borrower, to_squad_id: lender, effective_date: loan_end_date+1, state:"active", who:"system", when: server time, why:"loan period ended"}`. The player returns with role `substitute`.
- **BR-ROST-04 (counting):** squad count = players whose registration in that league is in that squad as of the evaluation date (borrowed players included, loaned-out players excluded).
- **BR-ROST-05 (defaults):** if `max_squad_size`/`required_positions` are omitted in setup, they default from the sport's `roster` config (`max_squad_size`, `required_positions`).
- **BR-ROST-06 (history):** entries oldest-first (append order); `as_of` default = today's server date (UTC); `current_squad_id`/`parent_squad_id` as of that date (null if released); `league_id` = the league of the player's most recent registration. An unknown player → 404 `PLAYER_NOT_FOUND`.

### 6.6 Store (§5.12)
- **BR-STORE-01 (checkout order and guarantees):** 1) validate → 400; identical replay of a stored `order_id` → 200 with the stored body; variants exist → 404 `VARIANT_NOT_FOUND`; discount code → 400 `INVALID_DISCOUNT_CODE` (the spec places this after the 404 step); same `order_id` with a different body → 409 `DUPLICATE_ORDER_ID`. 2) Atomically reserve stock for **all** items; if any item lacks stock, reserve nothing and return 409 `OUT_OF_STOCK` with `details.variant_id`. 3) Call the mock gateway: `tok_declined` → release the reservation and return 402 `PAYMENT_DECLINED`; `tok_capture_fail` → void the authorization, release the reservation and return 402 `PAYMENT_CAPTURE_FAILED`. 4) On success commit the reservation (stock decreases permanently), set order status `paid` and generate the receipt and PDF. Overselling or negative stock is a failure of NFR-3.
- **BR-STORE-02 (money):** `unit_price_minor` = the variant's effective price at checkout time. `subtotal_minor = Σ unit_price_minor × quantity`. `discount_minor = floor(subtotal_minor × 10 / 100)` for WELCOME10, else 0. `total_minor = subtotal_minor − discount_minor`. The PDF shows the total as `PKR <major>.<2-digit minor>` with no thousands separator (450000 → `PKR 4500.00`).
- **BR-STORE-03 (order state machine):** `pending → paid` (checkout success). `paid → packed → shipped → delivered`. `pending|paid|packed → cancelled` (a paid order is refunded through the gateway first). `paid|packed|shipped|delivered → refunded`. Any other transition → 409 `ILLEGAL_TRANSITION`. Every transition writes one outbox domain event `{type:"order.status_changed", order_id, from, to, at}`. Cancelled/refunded before `shipped` restocks the units (P2, our rule).
- **BR-STORE-04:** Failed payments do **not** create an order row (the order_id stays free; a replay is re-evaluated). The attempt is recorded in `payment_attempts`, and an `order.payment_failed` domain event is emitted.
- **BR-STORE-05 (mock gateway ids):** `authorization_id = "auth_<n>"`, `capture_id = "cap_<n>"`, where n is a per-reset counter starting at 1.

### 6.7 Offline sync (§5.14)
- **BR-SYNC-01 (per-action resolution, evaluated in this precedence):**

| Order | Situation (when this action is processed) | status | resolution | error_code |
|---|---|---|---|---|
| 1 | (`device_id`, `action_id`) already processed before (including earlier in the same request), or a `score_event` whose `event_id` already exists with an identical payload | `duplicate` | `skipped_duplicate` | null |
| 2 | The action payload fails schema validation | `rejected` | `server_wins` | `VALIDATION_ERROR` (or `UNKNOWN_EVENT_TYPE`) |
| 3 | An unknown id is referenced (match, player, squad, league, event, sport) | `rejected` | `server_wins` | the matching `*_NOT_FOUND` |
| 4 | `base_version` > current version | `rejected` | `server_wins` | `INVALID_BASE_VERSION` |
| 5 | Any rule of §5.9/§5.11 would reject it | `rejected` | `server_wins` | that rule's code |
| 6 | Rules allow it and `base_version == current` | `applied` | `appended` | null |
| 7 | Rules allow it but `base_version < current` | `applied` | `rebased_append` | null |

- **BR-SYNC-02:** Actions are sorted by `queued_at` ascending (ties: array order) and processed one by one, each against the state left by the previous one. Results are returned in **request order**, with `processed_order` (1-based). Current version: `score_event` → the match's version (event count); `roster_transfer` → the number of audit entries of that player (all leagues). `server_version` = the version after processing (unchanged for rejected/duplicate; 0 for an unknown id). `signature` = the event signature for applied `score_event` actions, else null. Every processed action (applied **or** rejected) is recorded, so a re-send yields `duplicate` for all.

### 6.8 Authorization, rate limiting, protocol
- **BR-AUTH-01:** Probe routes: 401 (missing/invalid token) → 404 if the path id does not exist at all (OQ-11) → 403 `FORBIDDEN` per §2.1 → 200 `{"authorized":true}`. No mutation and no body validation.
- **BR-AUTH-02:** JWT HS256 only; the algorithm list is pinned; `exp` is required and is ≥ 1 h after issue (we use 12 h). Claims: `sub` (user_id), `role`, `tenant_id`, `league_ids`, `club_id`, `player_id`, `iat`, `exp`, `jti`. The grader treats tokens as opaque.
- **BR-RL-01:** `/api/v1/*` is limited to 100 requests per rolling 10 s per client IP (socket address; `X-Forwarded-For` is ignored). Only allowed requests consume quota. Over the limit → 429 `RATE_LIMITED` with `Retry-After` = whole seconds until the oldest counted request leaves the window (≥ 1). `/audit/v1/*` and `/health` are exempt.

---

## 7. Shared protocol rules (§5.2)

| Topic | Rule |
|---|---|
| Base URL | `http://localhost:8080` (host port **8080**). |
| Bodies | JSON, UTF-8. We parse the body as JSON regardless of `Content-Type`. An empty body counts as `{}` only where the body is optional (`/reset`, `/rbac-matrix`, probes). |
| Naming | `snake_case` field names exactly as in §5 and §8 of this file. |
| Identifiers | 1–64 chars from `A-Za-z0-9_.:-`; never `\|`; case-sensitive; stored and returned verbatim. Exception: `sport_id` has the stricter regex `^[a-z0-9_-]{2,40}$`. `customer_id` is free text (OQ-12). |
| Timestamps / dates | `YYYY-MM-DDTHH:MM:SSZ` UTC (no millis) / `YYYY-MM-DD`. A date must be a real calendar date. |
| Money | Integer minor units; `currency:"PKR"`. |
| Numbers | Integers where stated (booleans are not integers; `1.0` is not an integer). Net run rate is rounded to 3 decimals. |
| Unknown fields | Ignored (never an error), at every nesting level. |
| Missing required field / wrong type | 400 `VALIDATION_ERROR`, `details.fields` = **all** offending field names (dotted paths for nested fields, e.g. `"periods.count"`, `"items[0].quantity"`). |
| Malformed JSON | 400 `VALIDATION_ERROR`, `details.fields: ["body"]`. |
| Validation order | 1) malformed JSON/schema → 400; 2) referenced id does not exist → 404; 3) business rule → 409 (or 402 for payment). The first failing step wins. |
| Idempotency | Requests carrying `event_id`, `order_id`, `request_id` or `action_id`: an identical replay (canonical-JSON-equal body) of an earlier **success** → 200 with the stored body; nothing changes. Same id with a different body → the route's `DUPLICATE_*` code (`DUPLICATE_EVENT_ID`, `DUPLICATE_ORDER_ID`; roster: OQ-06). Failed requests are not stored and are re-evaluated on retry. |
| Concurrency on the same client id | Serialized (per-id lock); the second request sees the stored result. |
| Body size | > 1 MB (1,048,576 bytes) → 413 `PAYLOAD_TOO_LARGE` on any route. This is checked before authentication, since the transport rejects it before routing. |
| Rate limiting | BR-RL-01. |
| Error body | Every non-2xx: `{"error":{"code":"UPPER_SNAKE","message":"plain text","details":{}}}`. `details` is always an object. |
| Pagination (production lists only) | `?limit` 1–100 (default 50), `?offset` ≥ 0 → `{"data":[…],"total":n,"limit":l,"offset":o}`. Order: documented per endpoint, always with `id` ascending as the final tie-break. `/audit/v1/*` is never paginated. |
| Missing vs forbidden | A non-existent id → 404 `*_NOT_FOUND`; exists but out of scope → 403 `FORBIDDEN` (tenant boundary included). |
| Unknown route / method | 404 `ROUTE_NOT_FOUND` (implementation code, not in Appendix B). |
| Unexpected failure | 500 `INTERNAL_ERROR` with a generic message; no stack, SQL or paths. Must never happen for hostile input (§5.13). |
| Not ready | `/health` → 503 `{"error":{"code":"SERVICE_UNAVAILABLE",…}}` until ready. |

**Error code catalogue (Appendix B, compared literally):**

| HTTP | Codes |
|---|---|
| 400 | `VALIDATION_ERROR`, `UNKNOWN_EVENT_TYPE`, `INVALID_DISCOUNT_CODE` |
| 401 | `UNAUTHENTICATED` |
| 402 | `PAYMENT_DECLINED`, `PAYMENT_CAPTURE_FAILED` |
| 403 | `FORBIDDEN` |
| 404 | `SPORT_NOT_FOUND`, `MATCH_NOT_FOUND`, `LEAGUE_NOT_FOUND`, `EVENT_NOT_FOUND`, `PLAYER_NOT_FOUND`, `SQUAD_NOT_FOUND`, `VARIANT_NOT_FOUND` |
| 409 | `SPORT_EXISTS`, `LEAGUE_EXISTS`, `MATCH_EXISTS`, `DUPLICATE_EVENT_ID`, `DUPLICATE_ORDER_ID`, `ILLEGAL_TRANSITION`, `MATCH_NOT_IN_PROGRESS`, `TIE_NOT_ALLOWED`, `INNINGS_COMPLETE`, `SERIES_ALREADY_DECIDED`, `INVALID_COMPENSATION`, `NO_VALID_PAIRING`, `OUT_OF_STOCK`, `CROSS_TENANT_TRANSFER`, `NOT_IN_SQUAD`, `TRANSFER_WINDOW_CLOSED`, `PLAYER_ON_LOAN`, `SQUAD_FULL`, `MIN_POSITION_VIOLATION` |
| — | `INVALID_BASE_VERSION` (only inside an offline-sync per-action result) |
| 413 | `PAYLOAD_TOO_LARGE` |
| 429 | `RATE_LIMITED` |

Implementation-only codes (never used where a catalogue code applies): `ROUTE_NOT_FOUND` 404, `CLUB_NOT_FOUND`/`TENANT_NOT_FOUND`/`PRODUCT_NOT_FOUND`/`ORDER_NOT_FOUND` 404 (production/probe only), `SCHEDULE_CONFLICT` 409 (P2), `INVALID_CREDENTIALS` 401 (login), `INTERNAL_ERROR` 500, `SERVICE_UNAVAILABLE` 503.

---

## 8. External contracts

Shapes in this section are binding. `/audit/v1/*` shapes are copied from the spec. If a spec example and this file disagree, **the spec wins**.
"Req" = required. Every endpoint returns the §7 error body on failure.

### 8.1 Autograder interface (`/audit/v1/*`, no auth except probes; not rate limited)

#### API-01 `GET /health`: FR-SYS-01
200 `{"status":"ok"}` (exactly this body). 503 `SERVICE_UNAVAILABLE` until the DB is reachable and the baseline is seeded.

#### API-02 `POST /audit/v1/reset`: FR-SYS-02
Body optional: `{"seed": 42, "stock": {"var-jersey-001-M": 1, "var-jersey-001-L": 5}}`. `seed`: integer, default 42. `stock`: map variant_id → integer ≥ 0; unspecified variants get the defaults M = 1, L = 5; an unknown variant key → 404 `VARIANT_NOT_FOUND`.
Response 200:
```json
{"status":"reset_complete","seed":42,"sports":["football","basketball","cricket","esports"],"tenants":["tenant-alpha","tenant-beta"],"stock":{"var-jersey-001-M":1,"var-jersey-001-L":5}}
```
**Baseline (exact ids):** tenants `tenant-alpha` ("Alpha Sports") and `tenant-beta` ("Beta Athletics"); product `prod-jersey-001` (tenant-alpha) with variants `var-jersey-001-M` and `var-jersey-001-L`, each `price_minor = 450000`, PKR; discount `WELCOME10` = 10% off the subtotal; leagues `league-alpha-1` and `league-alpha-2` (tenant-alpha) and `league-beta-1` (tenant-beta); clubs `club-alpha-1`, `club-alpha-2` and `club-beta-1`; players `player-alpha-1` (club-alpha-1), `player-alpha-2` (club-alpha-2) and `player-beta-1` (club-beta-1); the five demo users of §8.3 bound to that scenario; the four sports of FR-1.1-02. Seeded leagues use sport `football` (our choice; the spec does not specify) and have no fixtures. Optional demo enrichment is controlled by `SEED_DEMO_DATA` (ARCHITECTURE §9); it is **off** for the grader.

#### API-03 `POST /audit/v1/sports`: FR-1.1-01
| Field | Type | Rules |
|---|---|---|
| `sport_id` | string | Req. `^[a-z0-9_-]{2,40}$`. Duplicate → 409 `SPORT_EXISTS`. |
| `name` | string | Req, 1–80 chars. |
| `scoring_model` | enum | Req: `event` \| `innings` \| `round`. |
| `periods` | object | Req. event: `count` ≥ 1, `duration_minutes` ≥ 1. innings: `innings_per_team`, `overs_per_innings`, `balls_per_over`, `wickets_per_innings` (ints ≥ 1). round: `best_of` (odd int ≥ 1). |
| `scoring_events` | object | Req, ≥ 1 key; key regex `^[a-z0-9_]{1,40}$`. Value per model: event `{points}` (int ≥ 1); innings `{runs}` (int ≥ 0), `legal_ball` (bool), `wicket` (bool); round `{rounds}` (int ≥ 1). |
| `draw_allowed` | boolean | Req. |
| `overtime` | object | Req: `policy` ∈ `none`, `extra_time`, `shootout`, `golden_score`, `super_over`; optional `duration_minutes` (int ≥ 0). |
| `tie_break_order` | array | Optional. Items from `h2h_points`, `h2h_diff`, `overall_diff`, `scored`, `fair_play`, `draw_lots` (no repeats). Default = the full list. `draw_lots` is always applied last, even if omitted. |
| `roster` | object | Req: `min_squad_size`, `max_squad_size` (ints ≥ 1, min ≤ max), `required_positions` (position → minimum count int ≥ 0, may be `{}`). |

201 `{"sport_id":"kabaddi","status":"created","config":{…the stored config, echoed (all fields above, with tie_break_order defaulted)…}}`. 400 `VALIDATION_ERROR` (`details.fields`). 409 `SPORT_EXISTS`.
Integers must be JSON integers (`2.0` and `true` are rejected). Unknown keys inside `periods` and the other objects are ignored and not stored.

#### API-04 `POST /audit/v1/fixtures`: FR-1.3 (pure computation, stores nothing, 200)
Request `{format, teams, params}`. `format` ∈ `round_robin`, `swiss`, `single_elim`, `double_elim`; `teams` = unique team-id strings (array order = seed order for swiss/single/double).
- **round_robin** params: `legs` 1|2 (default 1), `withdrawals` `[{team_id, after_round}]` (default []), `withdrawal_policy` `void_all` \| `forfeit_remaining` (default). Response:
```json
{"format":"round_robin","legs":1,"team_count":5,"round_count":5,
 "rounds":[{"round":1,"matches":[{"match_id":"RR-L1-R1-M1","leg":1,"home":"t2","away":"t5","status":"scheduled","awarded_to":null}],"byes":["t1"]}],
 "summary":{"total":10,"scheduled":8,"forfeit":2,"voided":0}}
```
- **swiss** params: `total_rounds`, `round`, `history [{round, matches:[{home, away, result}], bye}]`. Response:
```json
{"format":"swiss","round":2,"total_rounds":3,"pairings":[{"match_id":"SW-R2-M1","home":"t1","away":"t2"}],"bye":"t3",
 "standings":[{"rank":1,"team_id":"t1","score":1.0,"buchholz":0.0}]}
```
`score` and `buchholz` are serialized as JSON numbers (e.g. `1.0`, `0.5`). `bye` is `null` when there is none. 409 `NO_VALID_PAIRING` with `details.round`.
- **single_elim** params: `third_place_match` (bool, default false), `results [{match_id, winner}]` (default []). Response `{"format":"single_elim","bracket_size":8,"rounds":[{"round":1,"matches":[MATCH…]},…]}` (TP is listed in the final round's `matches`; OQ-19). MATCH = `{"match_id":"R1M2","bracket":"main","round":1,"index":2,"home":"t4","away":"t5","home_seed":4,"away_seed":5,"bye":false,"winner":null,"loser":null,"winner_to":{"match_id":"R2M1","slot":"away"},"loser_to":null}`.
- **double_elim** params: `bracket_reset` (bool, default false; OQ-20), `results`. Response `{"format":"double_elim","bracket_size":8,"bracket_reset":true,"winners":[{"round":1,"matches":[…]}],"losers":[…],"grand_final":[GF1,GF2]}`. MATCH additionally has `conditional` and `required`.

#### API-05 `POST /audit/v1/leagues`: FR-1.2-02
```json
{"league_id":"lg-1","sport_id":"football","teams":["t1","t2","t3","t4"],
 "fixtures":[{"match_id":"m1","home":"t1","away":"t2"},{"match_id":"m2","home":"t3","away":"t4"}],
 "points":{"win":3,"draw":1,"loss":0},
 "tie_break_order":["h2h_points","h2h_diff","overall_diff","scored","fair_play","draw_lots"],
 "qualification":{"spots":2},"lots_seed":42}
```
Req: `league_id`, `sport_id`, `teams` (unique, 2–40), `fixtures` (array; teams must be in `teams`, home ≠ away), `qualification.spots` (int 1..team count). Optional: `points` (ints, default 3/1/0; each of win/draw/loss individually optional, OQ-21), `tie_break_order` (same tokens as API-03, default the sport's), `lots_seed` (int, default the last reset seed). 201 `{"league_id":"lg-1","status":"created","team_count":4,"fixture_count":2}`. 404 `SPORT_NOT_FOUND`; 409 `LEAGUE_EXISTS`; 409 `MATCH_EXISTS` (also for a match_id duplicated inside the request).

#### API-06 `POST /audit/v1/events`: FR-1.1-04
Request `{"event_id":"evt-0003","match_id":"m1","type":"score","payload":{"team_id":"t1","event_type":"goal"}}`. Types and payloads:

| type | payload | rule |
|---|---|---|
| `match_init` | `{sport_id, home_team_id, away_team_id, league_id?}` | Creates a stand-alone match, status `upcoming`. Unknown sport → 404 `SPORT_NOT_FOUND`; existing match_id → 409 `MATCH_EXISTS`; home = away → 400. If `league_id` is given it must exist (404 `LEAGUE_NOT_FOUND`), and the match joins that league's standings (OQ-22). |
| `match_start` | `{}` | BR-SCORE-01 |
| `score` | `{team_id, event_type}` | BR-SCORE-01/03/04 |
| `discipline` | `{team_id, points}` (int) | BR-SCORE-05 |
| `tiebreak_winner` | `{team_id}` | BR-SCORE-06 |
| `match_end` | `{}` | BR-SCORE-01/02 |
| `compensation` | `{compensates, reason}` | BR-SCORE-07 (`reason` string 1–500) |

Response 201 (200 on idempotent replay): `{"event_id":"evt-0003","match_id":"m1","type":"score","sequence":3,"match_version":3,"signature":"<64 lowercase hex>"}`. Any other event on a missing stream → 404 `MATCH_NOT_FOUND`.

#### API-07 `GET /audit/v1/score/{match_id}`: FR-1.1-04
```json
{"match_id":"m1","sport_id":"football","league_id":"lg-1","status":"completed","outcome":"home_win","winner_team_id":"t1",
 "tiebreak_winner_team_id":null,
 "home":{"team_id":"t1","score":2,"wickets":null,"balls":null,"overs":null,"fair_play":0},
 "away":{"team_id":"t2","score":1,"wickets":null,"balls":null,"overs":null,"fair_play":-1},
 "version":9,
 "events":[{"sequence":1,"event_id":"evt-0001","type":"match_init","payload":{},"signature":"…","compensated":false,"compensated_by":null}]}
```
`league_id` is null for stand-alone matches. `events` are in sequence order and include compensated events and compensations. 404 `MATCH_NOT_FOUND`.

#### API-08 `GET /audit/v1/standings/{league_id}`: FR-1.4-01
```json
{"league_id":"lg-1","sport_id":"football","qualification_spots":2,
 "table":[{"rank":1,"team_id":"t1","played":3,"won":2,"drawn":1,"lost":0,"scored":7,"conceded":2,"diff":5,"points":7,"fair_play":0,"status":"clinched","resolved_by":null}],
 "h2h":{"t1":{"t2":{"played":1,"points":3,"scored":2,"conceded":1}}}}
```
`diff` is an int (event/round) or a 3-decimal number (innings). `status` ∈ `clinched`, `eliminated`, `still_possible`. 404 `LEAGUE_NOT_FOUND`.

#### API-09 `POST /audit/v1/roster/setup`: FR-2.2-01
```json
{"league":{"league_id":"lg-r1","tenant_id":"tenant-alpha","sport_id":"football","transfer_window":{"open":"2026-09-01","close":"2026-09-30"},"max_squad_size":3,"required_positions":{"gk":1}},
 "squads":[{"squad_id":"sq-a","club_id":"club-a","tenant_id":"tenant-alpha","name":"A"}],
 "players":[{"player_id":"p1","name":"Ali","position":"gk","squad_id":"sq-a","role":"captain"}],
 "matches_in_progress":[{"match_id":"m-live","home_squad_id":"sq-a","away_squad_id":"sq-b"}]}
```
`role` ∈ `captain`, `vice_captain`, `starter`, `substitute`. `max_squad_size`/`required_positions` are optional (they default from the sport's roster config). The window dates are inclusive, with `open ≤ close`. `matches_in_progress` is optional (default []). Unknown tenants/clubs are created implicitly (our rule, OQ-09). A player or match referencing a squad not in `squads` → 400. Unknown sport → 404 `SPORT_NOT_FOUND`. 201 `{"league_id":"lg-r1","status":"configured","squad_counts":{"sq-a":2,"sq-b":0}}`.

#### API-10 `POST /audit/v1/roster/transfer`: FR-2.2-02
```json
{"request_id":"tr-001","league_id":"lg-r1","player_id":"p2","type":"transfer","from_squad_id":"sq-a","to_squad_id":"sq-b","effective_date":"2026-09-30","loan_end_date":null,"reason":"Tactical move","requested_by":"user-77"}
```
`type` ∈ `transfer`, `loan`, `release`. `to_squad_id` is null for release (required otherwise; equal to from → 400). `loan_end_date` is required and must be > `effective_date` only for loan (ignored otherwise). `reason` string 1–500 is required. `requested_by` (id) is required. Response 201 (200 on replay):
```json
{"request_id":"tr-001","status":"accepted","state":"active","blocking_match_id":null,
 "registration":{"player_id":"p2","league_id":"lg-r1","squad_id":"sq-b","parent_squad_id":null,"registration_type":"transfer","start_date":"2026-09-30","loan_end_date":null,"role":"substitute"},
 "audit_entry":{"audit_id":"au-0001","action":"transfer","player_id":"p2","league_id":"lg-r1","from_squad_id":"sq-a","to_squad_id":"sq-b","effective_date":"2026-09-30","state":"active","who":"user-77","when":"2026-09-30T08:12:44Z","why":"Tactical move"}}
```
Release: `registration:null`. Loan: `registration_type:"loan"`, `parent_squad_id` = the lender, `loan_end_date` set. Errors: BR-ROST-01.

#### API-11 `GET /audit/v1/roster/history/{player_id}?as_of=YYYY-MM-DD`: FR-2.2-04
200 `{"player_id":"p2","as_of":"2027-01-05","league_id":"lg-r1","current_squad_id":"sq-a","parent_squad_id":null,"history":[{…audit_entry…}]}`. A bad `as_of` → 400; an unknown player → 404 `PLAYER_NOT_FOUND`.

#### API-12 `POST /audit/v1/checkout`: FR-2.3-02
```json
{"order_id":"ord-001","customer_id":"cust-001","items":[{"variant_id":"var-jersey-001-M","quantity":1}],"discount_code":null,"payment":{"token":"tok_success"}}
```
`items` 1–10 entries, `quantity` int 1..10, unique `variant_id`s. `discount_code` is null/absent or a string; only `WELCOME10` is valid. `payment.token` ∈ `tok_success`, `tok_declined`, `tok_capture_fail` (others → 400). Response 201 (200 on replay):
```json
{"order_id":"ord-001","status":"paid","currency":"PKR",
 "items":[{"variant_id":"var-jersey-001-M","quantity":1,"unit_price_minor":450000}],
 "subtotal_minor":450000,"discount_minor":0,"total_minor":450000,
 "payment":{"authorization_id":"auth_1","capture_id":"cap_1","state":"captured"},
 "receipt":{"payload":{"order_id":"ord-001","customer_id":"cust-001","items":[{"variant_id":"var-jersey-001-M","quantity":1,"unit_price_minor":450000}],"subtotal_minor":450000,"discount_minor":0,"total_minor":450000,"currency":"PKR","paid_at":"2026-10-17T11:20:05Z"},
            "signature":"<hex>","pdf_base64":"<base64 of the PDF>"}}
```
Errors: 400, 404 `VARIANT_NOT_FOUND`, 400 `INVALID_DISCOUNT_CODE`, 409 `OUT_OF_STOCK` (`details.variant_id`), 409 `DUPLICATE_ORDER_ID`, 402 `PAYMENT_DECLINED`/`PAYMENT_CAPTURE_FAILED`.

#### API-13 `GET /audit/v1/inventory/{variant_id}`: FR-2.3-03
200 `{"variant_id":"var-jersey-001-M","stock":0,"reserved":0}`; 404 `VARIANT_NOT_FOUND`.

#### API-14 `POST /audit/v1/rbac-matrix`: FR-5.1-02 (no body, no auth)
```json
{"tokens":{"super_admin":"<jwt>","league_organizer":"<jwt>","club_manager":"<jwt>","player":"<jwt>","viewer":"<jwt>"},
 "context":{"tenant_id":"tenant-alpha","foreign_tenant_id":"tenant-beta","own_league_id":"league-alpha-1","other_league_id":"league-alpha-2","foreign_league_id":"league-beta-1","own_club_id":"club-alpha-1","other_club_id":"club-alpha-2","foreign_club_id":"club-beta-1","own_player_id":"player-alpha-1","other_player_id":"player-alpha-2","foreign_player_id":"player-beta-1"}}
```

#### API-15 Probe routes (`Authorization: Bearer <jwt>`; the grader sends `{}` on POST/PATCH)
| # | Route | Path variable |
|---|---|---|
| P1 | `POST /audit/v1/rbac/tenants` | — |
| P2 | `POST /audit/v1/rbac/leagues/{league_id}/fixtures` | league |
| P3 | `POST /audit/v1/rbac/clubs/{club_id}/roster` | club |
| P4 | `POST /audit/v1/rbac/clubs/{club_id}/products` | club |
| P5 | `PATCH /audit/v1/rbac/players/{player_id}` | player |
| P6 | `GET /audit/v1/rbac/clubs/{club_id}` | club |
| P7 | `GET /audit/v1/rbac/platform/config` | — |

Allowed → 200 `{"authorized":true}`; denied → 403 `FORBIDDEN`; missing/invalid token → 401 `UNAUTHENTICATED`. Matrix: §2.1. Security probes: P7 with no header → 401; a super-admin token with an altered signature or `alg:none` → 401.

#### API-16 `GET /api/v1/ping`: FR-SYS-03
200 `{"pong":true}`; 429 `RATE_LIMITED` + `Retry-After`. No auth required.

#### API-17 `POST /audit/v1/offline-sync`: FR-OFF-01
```json
{"device_id":"dev-1","actions":[
  {"action_id":"a1","type":"score_event","queued_at":"2026-10-17T11:00:00Z","base_version":3,"payload":{"event_id":"evt-9","match_id":"m1","type":"score","payload":{"team_id":"t1","event_type":"goal"}}},
  {"action_id":"a2","type":"roster_transfer","queued_at":"2026-10-17T11:01:00Z","base_version":1,"payload":{"request_id":"…","league_id":"…"}}]}
```
`actions` 1–100; `type` ∈ `score_event` (payload = the API-06 body), `roster_transfer` (payload = the API-10 body); `base_version` int ≥ 0; `queued_at` timestamp. Response 200:
```json
{"device_id":"dev-1","results":[
  {"action_id":"a1","status":"applied","resolution":"rebased_append","error_code":null,"processed_order":1,"server_version":5,"signature":"<hex>"},
  {"action_id":"a2","status":"rejected","resolution":"server_wins","error_code":"SQUAD_FULL","processed_order":2,"server_version":1,"signature":null}],
 "summary":{"applied":1,"rejected":1,"duplicate":0}}
```
Only a malformed envelope → 400.

### 8.2 Production API for the mobile app (`/api/v1/*`, Bearer JWT, rate limited per BR-RL-01)
These reuse the same domain services as §8.1 (identical code paths), with authentication and RBAC added. Error codes as in §7. Lists use the §7 pagination envelope.

| ID | Method & path | Who | Body / query | Success |
|---|---|---|---|---|
| APP-01 | `POST /api/v1/auth/login` | public | `{email, password}` | 200 `{token, expires_at, user:{user_id,email,role,tenant_id,display_name,league_ids,club_id,player_id}, tenant:{tenant_id,name,logo_url,colors:{primary,secondary}} \| null}`; 401 `INVALID_CREDENTIALS` (same message for an unknown email and a wrong password) |
| APP-02 | `GET /api/v1/me` | any | — | 200 same `user` + `tenant` |
| APP-10 | `GET /api/v1/leagues` | any | — | 200 list of leagues visible in tenant `{league_id,name,sport_id,tenant_id,season?}` |
| APP-11 | `GET /api/v1/leagues/{league_id}/fixtures?status=` | any (tenant) | status filter optional | 200 list `{match_id,home_team_id,away_team_id,status,scheduled_at,venue,score:{home,away},version}` ordered by `scheduled_at` asc nulls last, then `match_id` |
| APP-12 | `POST /api/v1/matches/{match_id}/status` | organizer (own league) | `{status: postponed\|cancelled\|abandoned\|upcoming, reason, scheduled_at?}` | 200 match; 409 `ILLEGAL_TRANSITION` (P2) |
| APP-13 | `GET /api/v1/matches/{match_id}` | any (tenant) | — | 200 = the API-07 projection + `pinned_product` (product summary or null) + `venue`, `scheduled_at` |
| APP-14 | `PUT /api/v1/matches/{match_id}/pin` | organizer (own league), super admin | `{product_id \| null}` | 200 `{match_id, pinned_product_id}`; broadcasts RT-01 |
| APP-15 | `POST /api/v1/matches/{match_id}/events` | organizer (own league) | the API-06 body (`match_id` must equal the path) | as API-06 |
| APP-16 | `GET /api/v1/leagues/{league_id}/standings` | any (tenant) | — | as API-08 |
| APP-20…22 | `POST /api/v1/leagues/{id}/seasons`, `/divisions`, `/stages` | organizer | P2 | P2 |
| APP-23 | `PATCH /api/v1/matches/{match_id}/schedule` | organizer | `{scheduled_at, venue_id}` | 200; 409 `SCHEDULE_CONFLICT` (P2) |
| APP-30 | `GET /api/v1/clubs/{club_id}` | any (tenant) | — | 200 `{club_id,tenant_id,name,home_venue,socials,staff,stats_by_season,roster:[{player_id,name,position,squad_id,role,on_loan}]}` |
| APP-31 | `POST /api/v1/clubs/{club_id}/players` | club mgr (own) | `{player_id?, name, position, league_id, squad_id, role}` | 201 player + registration |
| APP-32 | `POST /api/v1/roster/transfers` | club mgr (own from- or to-club) | the API-10 body; `requested_by` = the caller's user_id (server-set) | as API-10 |
| APP-33 | `GET /api/v1/players/{player_id}/history?as_of=` | any (tenant) | — | as API-11 |
| APP-34 | `PATCH /api/v1/players/{player_id}` | P5 rule | `{name?, position?}` | 200 player |
| APP-50 | `GET /api/v1/store/products?club_id=` | any (tenant) | — | 200 list `{product_id,name,category,image_url,variants:[{variant_id,size,color,price_minor,stock}]}` |
| APP-51 | `GET /api/v1/store/products/{product_id}` | any (tenant) | — | 200 product |
| APP-52 | `POST /api/v1/store/checkout` | any | the API-12 body; `customer_id` = the caller's user_id (server-set) | as API-12 |
| APP-53 | `GET /api/v1/store/orders` / `{order_id}` | owner, club mgr, super admin | — | 200 order (without pdf) |
| APP-54 | `GET /api/v1/store/orders/{order_id}/receipt.pdf` | owner, club mgr, super admin | — | 200 `application/pdf` |
| APP-55 | `POST /api/v1/store/orders/{order_id}/transition` | club mgr (own club), super admin | `{to}` | 200 order; 409 `ILLEGAL_TRANSITION` (P2) |
| APP-40 | `POST /api/v1/offline-sync` | organizer/manager (each action authorized as its online equivalent; unauthorized → `rejected`/`FORBIDDEN`) | the API-17 body | as API-17 |

### 8.3 Realtime (RT)
- **RT-01 WebSocket** `GET /api/v1/ws?token=<jwt>` (the token is in the query string because RN WebSocket headers are limited; it is verified on upgrade; an invalid token closes with code 4401). Client → server: `{"type":"subscribe","topic":"match:<id>" | "league:<id>"}`, `{"type":"unsubscribe",…}`. Server → client: `{"type":"match.event_appended","match_id","version","event":{…}}`, `{"type":"match.status_changed","match_id","from","to"}`, `{"type":"match.pinned_product_changed","match_id","product":{…}|null}`, `{"type":"standings.changed","league_id"}`, `{"type":"inventory.changed","variant_id","stock"}`. Tenant isolation applies to subscriptions (a foreign topic → error frame `FORBIDDEN`). The server pings every 25 s.
- Events from both `/audit/v1` and `/api/v1` writes are broadcast (same services).

### 8.4 Unsupported operations
No update or delete of sports, events or audit entries. No deletion of leagues, matches or orders. No pagination on `/audit/v1/*`. No user self-registration. No real payment provider. No iOS client.

---

## 9. UI requirements (mobile, §8)

| ID | Screen / behavior | Must show / do | Linked |
|---|---|---|---|
| MOB-01 | Login | Email + password; a role-aware home after login; plain-language errors; a server address setting reachable from login | APP-01, §8.1 |
| MOB-02 | Fixtures | List of matches with status and time; tap opens the match | APP-11 |
| MOB-03 | Match detail | Live score (realtime), event timeline (compensated events visibly struck through), pinned product showcase | APP-13, RT-01 |
| MOB-04 | Standings | Points table for a league with qualification status (shown by text/icon as well as color) | APP-16 |
| MOB-05 | Club profile | Club info, roster, staff, home venue | APP-30 |
| MOB-06 | Store | Catalogue, variant picker, cart, checkout with the mock gateway, receipt view/download | APP-50…54 |
| MOB-07 | Roster management (Club Manager) | Add / transfer / loan / release a player, with confirmation before risky actions | APP-31/32 |
| MOB-08 | Scoring entry (League Organizer) | Append a score event and a compensating event | APP-15 |
| MOB-09 | Sync status | An always-visible online / offline / syncing indicator and the pending-action queue | APP-40 |
| MOB-10 | Settings | Server base URL (default `http://10.0.2.2:8080` for the emulator; editable to the laptop's LAN IP), logout | §8.1 |
| MOB-11 | Offline cache | Fixtures, standings and club profiles cached in **SQLite**; cached screens open offline with an "Offline" indicator | NFR-4 |
| MOB-12 | Offline queue | Scoring and roster actions are queued persistently in SQLite in the exact §5.14 action format, survive a force-close, appear as "pending", sync automatically on reconnect (plus a Sync button), show per-action results (applied / rejected + plain-language reason) and clear the queue | NFR-4, FR-OFF-01 |

**Role-specific home and navigation:** bottom tabs Fixtures · Standings · Store · Club/Profile (+ Scoring for organizers, + Roster for managers). Each role sees only what it can use. Super Admin sees all tenants (tenant switcher).

**UI states (every data screen):** loading (spinner/skeleton), empty (helpful message, e.g. "No matches yet"), error (plain language plus a retry, never raw codes such as "Error 500"), success feedback (toast/snackbar), offline (cached data plus a banner).

**HCI/accessibility (§8.6, judged):** the same colors, fonts, spacing and button styles on every screen; the score and Buy button stand out; the tenant logo and colors are applied; text is ≥ 14 sp (body) and dynamic type is respected; contrast ≥ 4.5:1; tap targets ≥ 48 dp; icons have `accessibilityLabel`; meaning is never conveyed by color alone; back/undo always works; no dead ends; nothing breaks or overflows at 360×640 dp or after rotation.

**Session:** the JWT is stored in Android Keystore (via the Keychain wrapper), never in SQLite/AsyncStorage. On 401 → clear the session and return to Login with "Your session expired, please sign in again" (queued offline actions are kept). Logout clears the token and the cached tenant data, but asks before discarding pending actions.

**Error-code → message mapping:** the mobile app keeps one table that maps each Appendix B code to a plain-language sentence (e.g. `SQUAD_FULL` → "That squad is already full."). Unknown codes → "Something went wrong. Please try again."

**Judged journeys (§8.6):**
- **J-A:** Login (MOB-01) → Standings tab (MOB-04, FR-1.4) → tap a team/fixture → Match detail (MOB-03, FR-1.1-04).
- **J-B:** Store (MOB-06) → product → variant → cart → checkout with the mock payment (FR-2.3-02) → receipt view/download.
- **J-C:** Login as manager → Roster (MOB-07, FR-2.2-02) → transfer → confirm → result. Airplane mode → repeat one action → it shows as pending (MOB-12) → force-close/reopen → still pending → network on → auto/explicit sync → per-action results shown → queue cleared (FR-OFF-01).

---

## 10. Non-functional requirements

| ID | Requirement | Measurable acceptance | Method |
|---|---|---|---|
| NFR-3 | Concurrency correctness | 20 simultaneous buyers of the last unit → exactly 1 × 201, 19 × 409, `stock:0`, `reserved:0`, never negative | pytest burst test (barrier, 20 threads), repeated 20× |
| NFR-4 | Offline tolerance | Desk check §8.4 steps 1–5 pass on the release APK | Manual script in `docs/MOBILE.md` + offline-sync pytest |
| NFR-5 | Security | OWASP API Top 10 items addressed (BOLA → policy layer; broken auth → pinned HS256 + exp; resource consumption → 1 MB limit + rate limit; SSRF n/a; misconfiguration → no stack traces); parameterized SQL only; 65-cell RBAC test plus 3 security probes pass; hostile strings never produce a 5xx; tokens in the Keystore; passwords hashed with scrypt | pytest security suite, grep for SQL string concatenation in CI |
| NFR-7 | Reproducibility | `DAY1_SALT=<salt> docker compose up -d --build` on clean Ubuntu 22.04 (4 vCPU / 8 GB) finishes in ≤ 10 min, with `/health` 200 within 120 s after; no manual steps; no host software except Docker; running services need no internet | CI cold start + `scripts/preflight` + a timed run on a clean VM/`docker system prune` machine |
| NFR-PERF-01 | Latency bounds | Every request < 5 s; `/reset` < 10 s; the 20-checkout burst completes < 10 s; the grader may send 200 req/s to `/audit/v1/*` | k6/pytest timing assertions |
| NFR-PERF-02 | Internal target (proposed, not agreed) | p95 < 300 ms for `/audit/v1/*` reads at 50 req/s on the grader hardware profile | k6 smoke (`tests/perf`) |
| NFR-SIG | Signature exactness | App. A vector 1 reproduces; canonicalization unit tests (unicode, nested, arrays, floats) | unit tests |
| NFR-REL-01 | Restart safety | Backend restart → health returns within 30 s; no data loss for committed writes; reservations orphaned by a crash are released within 60 s | integration test (destructive marker) |
| NFR-ACC-01 | Mobile accessibility | §9 HCI list | judge checklist dry-run |
| NFR-COMP-01 | Compatibility | Android 10 (API 29)+; release APK at `mobile/release/app-release.apk` | install on an API 29 emulator + a physical device |

---

## 11. Acceptance and delivery requirements

| ID | Deliverable (repo root unless noted) | Requirement |
|---|---|---|
| DEL-01 | `docker-compose.yml` | Brings up the entire backend: API on **host port 8080**, database, cache, queue, object store, workers. Forwards the salt as `DAY1_SALT: ${DAY1_SALT}`. |
| DEL-02 | `.env.example` | Lists every environment variable; **never** the real salt. |
| DEL-03 | `README.md` | Run instructions and the five demo accounts of §8.3. |
| DEL-04 | `TRACEABILITY.md` | Maps every FR/NFR ID to source files and automated tests. |
| DEL-05 | `tests/`, `run_tests.sh`, `COVERAGE.json` | Unit tests; one script runs them; `{"fixtures":…,"scoring":…,"standings":…,"store":…,"roster":…,"rbac":…}` line-coverage percentages that `./run_tests.sh` reproduces within 2 points. |
| DEL-06 | `mobile/` + `mobile/release/app-release.apk` | Source plus a built, installable APK (API 29+). |
| DEL-07 | Git process | Public repo registered by 11:15; ≥ 1 pushed commit in each of the four windows; last push ≤ 15:05:00 PKT; nothing pushed later counts. |
| DEL-08 | Demo accounts (§8.3) exist after every startup and every `/reset` | `admin@nascon.test`, `organizer@nascon.test`, `manager@nascon.test`, `player@nascon.test`, `viewer@nascon.test`, all with password `Nascon@26` |

**Pre-submission checklist (Appendix C):** clean-machine compose up with health < 2 min; reset twice gives identical data and all seed ids exist; every response matches the §5 field names character by character; signatures match vector 1; 20 parallel checkouts → 1/19/0/0; `/audit/v1/*` not rate limited while `/api/v1/ping` is; COVERAGE.json, TRACEABILITY.md, README.md, .env.example and the APK are committed and pushed; last commit before 15:05:00 PKT.

---

## 12. Assumptions, open questions and change policy

### 12.1 Assumptions
- A1: The grader reaches the API at `localhost:8080`, so all host clients appear as the Docker bridge gateway IP to the rate limiter. That is acceptable because the limiter is per client IP.
- A2: Server "today" is UTC. During the event (05:45–10:00 UTC) the UTC and PKT dates coincide.
- A3: The grader's numeric payload values are integers, except those explicitly decimal.
- A4: Seeded leagues use sport `football`; seeded clubs and players belong to their tenant as in §5.5.

### 12.2 Open questions (raise in writing before 13:00 PKT if they matter; our default applies until answered)
| ID | Question | Our default |
|---|---|---|
| OQ-05 | Should a payload team_id check (400) on a missing match rank after its 404? | The match's 404 wins (the team check needs the match). |
| OQ-06 | Roster `request_id` reused with a different body: which code? | 409 `DUPLICATE_REQUEST_ID` (non-catalogue). |
| OQ-07 | Do league fixtures carry an implicit `match_init` event (version 1)? | No; version 0 and the first event gets sequence 1. |
| OQ-09 | `/roster/setup` with unknown tenant/club ids; league id collision with `/leagues` | Auto-create tenant/club; setup merges roster config into an existing league row; `/leagues` on any existing id → 409. |
| OQ-10 | Does re-setup clear the league's roster audit entries? | Yes (a scenario reset for that league). |
| OQ-11 | A probe on an id that does not exist | 404 with the matching `*_NOT_FOUND` (`CLUB_NOT_FOUND` for clubs) after 401. |
| OQ-12 | Is `customer_id` an identifier (regex) or free text? | Free text 1–200 chars, stored verbatim (§5.13 "stored/returned as plain data"). |
| OQ-14 | NRR with 0 overs faced | That term = 0. |
| OQ-15 | `draw_lots` listed mid-order | Applied last. |
| OQ-16 | `resolved_by` for the last team of a tied group | `null`. |
| OQ-17 | Compare NRR rounded or raw in tie-breaks | Rounded to 3 decimals. |
| OQ-18 | GF2 slot feeding / population | GF1 winner→GF2.home, loser→GF2.away; populated only when required. |
| OQ-19 | Where TP appears in the single-elim response | Inside the last round's `matches`, after the final. |
| OQ-20 | `bracket_reset` default | false. |
| OQ-21 | Partial `points` object | Missing keys take their defaults. |
| OQ-22 | `match_init` with `league_id` | The match joins that league's standings if its teams are league teams; else 400. |

### 12.3 Change policy
1. The spec PDF is immutable and wins over everything except an organizer's **written** clarification. Record every clarification in `docs/CHANGELOG.md` and here (move the OQ row into §12.1 with the answer).
2. Any behavior or contract change updates this file **first**, in the same commit as the code and tests (see AGENTS.md).
3. IDs are stable: never renumber; deprecate with a strikethrough and a note.
