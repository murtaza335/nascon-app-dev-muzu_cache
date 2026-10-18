---
name: Sportron
description: A mineral and forest Android competition workspace.
colors:
  background: "#F4F7F5"
  surface: "#FFFFFF"
  primary: "#17654B"
  on-primary: "#FFFFFF"
  text: "#162C24"
  secondary-container: "#DCECE3"
---

# Sportron design system

The user-approved replacement direction of 2026-10-18 supersedes the earlier
charcoal/olive/lime reference. The app is an Android operations interface:
legibility, reliable state, native navigation and quick task completion govern
its appearance. REQUIREMENTS.md owns behavior; mobile/DESIGN-BRIEF.md owns the
current surface brief. The existing design sidecar is historical and is not
implementation authority.

## Color, type and rhythm

`mobile/src/theme/tokens.ts` defines light and dark Material-style color roles.
The light default combines mineral canvas, white surfaces, forest actions and
sage selection containers. Dark mode has separately chosen readable surfaces,
text and semantic pairs. User-supplied tenant logos appear in the organization
bar, with the tenant's primary color used only as a validated identity mark.

Native Android typography follows system scaling. Shared roles are display 36,
heading 28, title 24, section 20, body/strong 16, label/caption 14 and score 44sp.
Scores and numeric tables request tabular figures. Spacing follows 4/8/12/16/24/
32dp steps, with 20dp screen gutters and generous separation between task groups.
No remote fonts or dependencies are required.

## Components and shell

`mobile/src/components/ui.tsx` re-exports focused modules under `components/display`,
`actions`, `feedback`, `forms` and `layout`. These own text, filled/tonal/text/danger buttons,
fields, selectors, chips, semantic messages, divided rows, empty/loading states,
sheets, snackbars and the screen shell. All interactive controls have at least
48dp targets. Fields keep visible labels and written errors. Modal content is
scrollable and dismissible with system Back. Screen content respects safe-area
and keyboard handling and remains scrollable after rotation or text enlargement.

A compact tenant row has a globally accessible Account action. A clear title
precedes a named connection/pending strip; connected does not imply fresh server
data. The five labeled base destinations are Home, Fixtures, Standings, Store and Club.
Home is the initial route; dominant manager/organizer actions lead into existing
management stacks. Admin management requires an explicit tenant context.
Settings is available before login. Screens use divided rows for operational
information and deliberate score/fixture surfaces rather than identical cards.
`components/MatchScore.tsx` shares the confirmed score composition between match
detail and organizer entry. Match detail progressively separates Overview (score, metadata and featured
product) from Timeline (events and corrections).

## State and interaction

Every data journey has loading, empty, error with recovery, saved/offline and
success feedback. Semantic state is always written in text. Primary actions,
prices and scores receive the strongest emphasis. Risky roster/scoring actions
receive review before confirmation. Corrected match events remain visible.
Motion is restrained to native feedback; no glass, blur, gradients or decorative
animation is needed. Images come from real API tenant/product data.

This is a real API app: authenticated `/api/v1` reads/writes, scoped Keychain
sessions and SQLite workspace, exact offline envelopes, stable checkout identity,
WebSocket plus polling refresh and server receipt PDFs. UI availability never
replaces server authorization. No local mock login, fabricated resources or
simulated payment success is introduced.

## Evidence and preservation

The original source is retained at `mobile/src1`; the active app imports only
`mobile/src`. TypeScript excludes the archived tree. Automated palette contrast,
transport, mapping, queue versions and storage-scope tests accompany the source.
Native screenshots and device checks are separate evidence: do not claim native
accessibility, force-close sync or backend journey acceptance from source tests.


## Current screen architecture

This second structural redesign responds to user feedback that a theme-only
replacement was insufficient. Home brings personal context, scoped work actions,
real next/in-progress matches, quick journeys, pending work and recent orders
together. Fixtures are searchable date groups; standings are phone-width rows
with expandable statistics. Store is an adaptive merchandise grid rather than a
vertical sequence of wide product blocks. Club progressively discloses Overview,
Roster and Staff, with search and scoped management. Registration/scoring forms
use visible steps, inline validation and review. Product/checkout purchase actions
remain in a safe-area footer. Sync uses Pending and Results tabs.

Feature components live beside each feature under `components/`: MatchCard and
MatchDateGroup, StandingRow and LeadingTeams, ProductCard and ProductMedia,
ClubRosterRow, dashboard sections and MatchTimeline. Shared FormProgress has a
single responsibility. Native body text and action targets remain scalable;
large fonts increase the navigation height and collapse merchandise to one column.
Refresh failures use an expandable detail notice with inline Retry so cached data
and the app's useful structure remain visible. Cached in-progress matches use
written saved/in-progress labels instead of an unsupported live claim.

Native verification observed light/dark on Pixel 7 Pro and compact360x640 at 1.3 text plus landscape. Compact enlarged-text labels use Games/Table with full Fixtures/Standings accessibility labels. Landscape navigation reduces height. Inactive buttons use explicit muted text on raised surfaces rather than whole-control opacity. Broader acceptance limits remain in mobile/qa-redesign/VERIFICATION.md.


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
