# Sportron mobile redesign

Approved direction, 2026-10-18: replace the former charcoal/olive/lime interface
with a minimal mineral and forest Android workspace. This session's direction
supersedes the older visual reference; product contracts and priorities are unchanged.

## Preservation and implementation

The previous `mobile/src` is preserved intact as `mobile/src1`. The active app
uses a self-contained `mobile/src`, with no imports from its backup. Existing
native infrastructure, dependencies, Keychain/SQLite schema and API contracts
are preserved. All 21 screen-plan screens and the supported Management and
Order Fulfillment destinations have new compositions.

## Visual system

- Light default: mineral #F4F7F5 canvas, white surfaces, forest #17654B actions,
  ink #162C24 text, sage #DCECE3 selection containers.
- Complete intentional dark scheme; Settings offers Light, Dark and Device.
- Native Android type scale: 14sp minimum body metadata, 16sp body, 20sp section,
  28sp screen heading and 44sp tabular match scores. System font scaling remains enabled.
- Shared spacing: 4, 8, 12, 16, 24, 32dp. Screen inset 20dp; fields 56dp;
  primary buttons 52dp; every action at least 48dp.
- Flat divided lists for people, orders, settings, history and operations.
  Distinct fixture and score containers have a purpose; avoid card piles.
- Opaque surfaces, native ripple/pressed feedback, immediate accessible navigation.
  No glass, decorative gradients, generated product images or synthetic data.
- Real tenant logos and product photography are rendered from API data. Missing
  images use a labeled neutral fallback, never invented merchandise.

## Screen structure and journeys

A compact organization row leads to Account from every signed-in screen. The
screen title and relevant competition selector establish context. The compact
connection strip names offline/syncing/connected and pending count; network
connectivity is not presented as proof that data is current. Five stable tabs
(Home, Fixtures, Standings, Store, Club) keep discovery consistent across roles.
Home exposes scoped Roster/Scoring workspaces. Admin tools require an explicit
organization context and remain reachable through Account and scoped details.

Fixtures use team identity and tabular scores; standings retain qualification
text and the team-to-fixtures path. Match Detail separates the score/featured product overview from the event
timeline. Corrected events retain strike-through and a written label.
Club and player screens favor identity, divided lists and permanent history.
Store uses real images, clearly priced options, an explicit cart and prominent
purchase action. Checkout requires a server result. Receipts open/download the
server PDF through the existing native bridge. Roster/scoring forms explain
pending status and confirm consequential writes. Sync separates pending work
from per-action outcomes and readable rejection reasons.

## Functional safeguards

The default server is the documented emulator URL, overridden by public config
or Settings. Saved loopback addresses are not silently migrated. Product/order
detail destinations refresh APP-51/APP-53 resources by ID. Online roster actions
fetch complete player history before choosing base_version; offline actions
require an existing history snapshot, distinguishing version zero from unknown.
Queue persistence, stable IDs, checkout retry identity, tenant isolation,
WebSocket/polling refresh, Keychain sessions and logout retention remain active.

## Acceptance and limits

Source validation: `npm run typecheck` and `npm test` from mobile. Device QA must
verify 360x640dp, rotation, enlarged text, keyboard/system Back, both themes,
TalkBack and all three judged journeys against a reachable backend. Source tests
and a Metro bundle are not native acceptance evidence. This redesign adds no
backend routes, dependencies, managed services, commits or pushes.


## Substantive UX replacement, 2026-10-18

Following explicit user feedback, the screen structure has been redesigned again.
The Home dashboard is now the initial destination for every role. The five base
labels are Home, Fixtures, Standings, Store and Club. Role tools move to prominent
Home workspaces and existing scoped stacks; no six-destination navigation exists.
Admin management requires an explicit selected organization. Real owned/club
matches are preferred without inventing records or presenting cache as live data.

The new appbar combines a small real tenant logo, title/context and Account in a
single compact row. Connectivity remains a 48dp control. Refresh failures use a
compact disclosure and inline retry, retaining task context and saved content.

Fixtures have team/venue search, status segments and date groups. Standings fit
phone width and progressively disclose full statistics and team fixtures. Store
uses a search/category catalogue, adaptive product grid and actionable cart
summary. Product and checkout actions stay in a safe-area footer. Club has
Overview/Roster/Staff tabs, roster search and a scoped management entry. Match
has Overview/Timeline tabs, metadata and real merchandise media. Roster changes
and add-player/scoring forms use visible steps and review. Sync separates Pending
and Results. Settings uses distinct appearance, connection and session panels.
Checkout exposes the contract's mock-payment scenarios and a complete price
review without inventing a discount result before server validation.

Shared implementation is split by responsibility under `components/display`,
`actions`, `feedback`, `forms` and `layout`; `components/ui.tsx` is compatibility
exports only. Feature components handle match/date groups, standings rows,
product cards/media, club roster rows and dashboard sections. Pure selectors
cover discovery filters and role-aware match selection. No service/runtime
changes were made for this UX rearchitecture.

Final native refinements: compact enlarged-text Games/Table labels retain full accessible names; a shorter landscape navigation bar preserves content. Disabled text uses explicit readable palette roles. Source tests20/20 and native reviewed-scope design evaluation pass; live backend/TalkBack/other-role acceptance remains pending.


## Sportron refinement, 2026-10-18

Sportron is the display brand (Expo name Sportron, slug sportron). The Android
application ID, receipt bridge/provider and secure/local storage identifiers stay
unchanged so existing installations and sessions retain their data. The source
backup remains immutable.

Light mineral/white content now contrasts with a deep forest brand appbar and
selective dark match, score, club and operational-work surfaces. Explicit roles
`darkSurface`, `darkRaised`, `onDarkSurface`, `darkMuted` and `darkDivider` exist in
both schemes. Header icons, action buttons and avatar initials take explicit
colors on dark. The status-bar text is light against the dark safe-area header;
scrolling task content retains the light canvas. Native dark mode remains separate.
Text pair contrast on both dark surfaces is included in the existing palette test.

Operational copy is short: no Home greeting, login promotional hero, workspace
slogans, repeated explore descriptions or duplicate club venue section. Login is
one focused Sign in form. Headings sit 10dp from related content, groups retain
24dp separation and panel controls use 12dp gaps. Section actions stay 48dp without
oversized button padding. Data absence, cache/pending labels, field validation,
payment outcomes, confirmation consequences and session/server retention details
remain explicit. This is a bounded visual/copy refinement, with all routes,
features and API/runtime behavior preserved.
