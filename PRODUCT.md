> Current status (2026-10-17): earlier prototype descriptions below are historical.
> Real APIs, APP-03 discovery, Keychain/SQLite, NetInfo and server PDFs are wired.
> Mock data/engine, Screen Studio and unsupported P2 controls are removed.
> Native acceptance remains pending; see ADR-022 and mobile/README.md.

# Sportron

<!-- impeccable:product-schema 1 -->

Product context for the Android app, confirmed by the user on 2026-10-17.
This file captures durable product facts for design work. It does not replace
[REQUIREMENTS.md](REQUIREMENTS.md), which owns behavior and API contracts,
[ARCHITECTURE.md](ARCHITECTURE.md), which owns structure, or
[ADR.md](ADR.md), which records technical decisions. The binding competition
specification and the precedence rules in [AGENTS.md](AGENTS.md) still apply.

## Platform

android

## Users

Use the documented competition audience; no additional market or audience is
assumed. All five roles must have appropriate navigation and resource access:

| Role | Job and scope |
|---|---|
| Platform Super Admin | Access platform resources across tenants and select an explicit tenant/resource context for management. |
| League Organizer | Follow and operate owned leagues, record scoring events and corrections, and pin merchandise on owned match pages. |
| Club Manager | View and manage their own club's roster and players; carry out permitted merchandise/order operations. |
| Player | Follow tenant competitions and clubs, view their own player information and edit permitted self fields. |
| General Viewer | Read tenant competitions and club information without management controls; signed-in viewers may purchase merchandise. |

Every signed-in role can use the store within authorized scope. A role label
alone does not grant ownership: tenant, league, club, player and order scope
remain authoritative on the server (FR-5.1-01/02).

## Product Purpose

Help people follow and operate multi-sport leagues and clubs from an Android
phone: find fixtures and standings, understand a live match, manage roster
changes, purchase club merchandise, and understand pending offline work.

Mobile success means completing the competition's three judged journeys
without assistance, passing the offline persistence/sync desk check, and
meeting the HCI/accessibility requirements. The 21-screen inventory in
[mobile/SCREEN-PLAN.md](mobile/SCREEN-PLAN.md) is implemented as a UI-only preview;
this does not establish functional acceptance.

## Operating Context

- Competition use on Android phones, including a 360x640 dp viewport and rotation.
  Required delivery is an installable Android 10/API 29+ APK.
- The backend runs on a team laptop. Users must be able to change the server
  address; Settings is reachable before login. The default emulator address is
  `http://10.0.2.2:8080`; phones use the laptop LAN address or configured USB routing.
- Connectivity is unreliable. The desk check intentionally uses airplane mode,
  force-close/reopen, and reconnection. Cached reads and queued writes must remain
  understandable throughout that sequence.
- J-A: sign in, find league standings, and open a match through its fixtures.
- J-B: choose merchandise and a variant, use cart/mock checkout, then view or
  download the receipt. Orders must remain reachable for return visits.
- J-C: as Manager, review/confirm a roster action, repeat an action offline,
  reopen with the action still pending, then sync and read the per-action result.
- The offline check also exercises Organizer scoring. The app must distinguish
  locally pending work from server-accepted changes and deferred roster effects.

## Capabilities and Constraints

The following are requirements and planned capabilities, not implemented claims
(MOB-01 through MOB-12, NFR-4/5, RT-01, DEL-06):

- Email/password login, role-aware home/navigation, Account and Settings.
  No self-registration or password-reset contract is defined.
- Fixtures, standings with qualification labels, club/staff/venue/roster profiles,
  and live match detail with timeline and pinned merchandise.
- Scoring uses sport configuration. Corrections append compensating events;
  original events remain visible and are never edited or deleted.
- Club Managers can add players and request transfers, loans or releases within
  their authorized scope. Risky actions require review/confirmation.
- Store catalogue, variants, cart, online mock checkout, order/receipt retrieval.
  Amounts use integer paisa and display PKR. No real payment provider.
- Fixtures, standings and club profiles persist in SQLite for offline reads.
  Scoring and supported roster actions persist in the exact API-17 queue format,
  survive force-close and sync through APP-40. Add-player, checkout and product
  pinning have no specified offline queue action type.
- Connectivity is always visible. Loading, empty, error/retry, success and offline
  states are required. Rejected sync outcomes have plain-language reasons;
  an HTTP success for the sync batch does not imply every action was applied.
- JWTs live only in Android Keystore through Keychain. An expired session keeps
  queued work. Logout clears tenant cache and asks before discarding pending work.
  Retained data/work must not leak or replay across users, tenants or servers.
- Public mobile APIs are authenticated production `/api/v1` contracts. Grader
  reset/setup/token-probe routes must not become app management shortcuts.
- Existing priorities remain: exact audit contracts, reproducible backend,
  offline-capable mobile/APK, then P2. P2 surfaces in the screen plan remain a
  separate backlog. No contract or open-question default is changed by design.

The existing scaffold uses Expo 54.0.37, React Native 0.81.5 and React 19.1.0
according to the lockfile and ADR-017. All 21 screen designs and navigation
are implemented as a mock-data preview. Keychain, SQLite, NetInfo and sync remain planned. Use the existing
feature/service structure and approved dependencies; do not introduce a new
framework or runtime service as a design side effect.

## Brand Commitments

The user named the app **Sportron** on 2026-10-18. This supersedes the earlier
NaSCon Sports display name. The competition/project identity and backend IDs stay
unchanged. Tenants supply their own name, logo and colors;
that identity must appear after login while preserving readable contrast.

Use plain-language status, confirmation and error copy, as required by the
project. After init, the user supplied a mobile sports-app reference and selected
its charcoal/olive/electric-lime color family, requesting professional typography
and design language. This overrides the unselected Impeccable alternatives.
The user subsequently approved
[mobile/DESIGN-BRIEF.md](mobile/DESIGN-BRIEF.md) and authorized screen implementation.
Actual system tokens are documented in DESIGN.md and implemented in the mobile theme. The reference does not expand the documented product capabilities.

## Evidence on Hand

- [REQUIREMENTS.md](REQUIREMENTS.md): roles, acceptance criteria, APP/RT contracts,
  mobile states, security and accessibility rules.
- [mobile/SCREEN-PLAN.md](mobile/SCREEN-PLAN.md): 21 planned screens, shared
  selectors/dialogs, role routes, judged journeys and integration gaps.
- [docs/spec/nascon26-part1-spec.pdf](docs/spec/nascon26-part1-spec.pdf) and its
  [text copy](docs/spec/nascon26-part1-spec.txt): binding specification.
- [docs/MOBILE.md](docs/MOBILE.md): release and desk-check checklist.
- [mobile/app.json](mobile/app.json), [mobile/package-lock.json](mobile/package-lock.json)
  and [mobile/src/app/App.tsx](mobile/src/app/App.tsx): existing scaffold evidence.
- `mobile/assets/` contains starter icon/splash assets; its fonts folder has only
  a placeholder. Their presence does not establish approved final branding.
- No completed screen design, release APK, backend integration result or native
  visual-verification evidence was established by this init. Never invent
  customers, testimonials, performance claims or live product data.

## Product Principles

1. Make the three judged journeys easy to discover and complete without help.
2. Make state trustworthy: live, cached, pending, accepted, deferred and rejected
   must be distinguishable in words, not inferred from decoration or color.
3. Preserve permissions and tenant boundaries throughout navigation and recovery.
4. Keep work understandable and durable across connection loss and app restart.
5. Treat Android behavior and accessibility as part of task completion, including
   system Back, keyboard/window insets, font scaling and usable confirmations.

## Accessibility & Inclusion

Preserve the project's stronger explicit requirements: body text at least 14 sp,
contrast at least 4.5:1, touch targets at least 48 dp, labeled icons, status text
in addition to color, and system font scaling. Verify at 360x640 dp and after
rotation. Avoid clipped forms, hidden keyboard actions and navigation dead ends.
Respect Android accessibility semantics and reduced-motion preferences when
later implementing interactions. No additional languages or device classes have
been confirmed for this scope.

## Open Decisions and Integration Dependencies

- The dark charcoal/olive/lime design brief is user-approved and implemented
  as UI previews. Native visual approval is pending emulator/device captures.
  Login lands on Fixtures for every role; Match Detail uses one scroll ordered
  score, timeline, then pinned product, as explicitly selected by the user.
- Tenant/club/squad discovery, scoring-config reads, missing player detail data
  and existing-player role editing need backend contract coordination, as listed
  in the screen plan. Do not invent endpoints or selectable production resources.
- Receipt PDF viewing/downloading and server-change queue-retention interaction
  still need implementation decisions within the existing requirements.
- APK build, secure storage/persistence integration, backend availability and
  native behavior must be verified later. Documented coverage is not passing
  implementation evidence.

### Sportron presentation refinement (2026-10-18)
The user requests concise screen copy, close grouping of headings and related
content, and a light interface complemented by deliberate dark surfaces. Keep
existing dark mode. Preserve labels, recovery, offline state and confirmation
consequences; remove repeated instructions and promotional filler.
