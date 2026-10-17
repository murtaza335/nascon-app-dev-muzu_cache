# NaSCon Sports: mobile design brief

Status: user-approved design direction, implemented as a 21-screen UI preview on
2026-10-17. This document records the design intent; source tokens/components and
root DESIGN.md record the implemented system. Backend and native verification remain open.
Product authority: [PRODUCT.md](../PRODUCT.md). Behavior/contracts:
[REQUIREMENTS.md](../REQUIREMENTS.md). Screen scope:
[SCREEN-PLAN.md](SCREEN-PLAN.md). Existing technical structure remains unchanged.

## 1. Job, audience and outcome

Mode: **Operate**, for these native Android app surfaces. People must understand
competition context, find a fixture, read a match and complete authorized actions
on a small phone with unreliable connectivity. The five roles and their scopes
remain those in REQUIREMENTS. Brand expression supports the work.

This brief specifies the shared shell, S01 Login, S03 Fixtures and S05 Match Detail,
with a reusable system for all 21 planned screens. Success: a new user reaches a
match without help, understands the score and connection/data state, and sees
only permitted management actions. The three judged journeys remain intact.

## 2. Confirmed direction and boundaries

The user's attached reference establishes **dark charcoal, olive undertones and
electric lime** as the preferred color family, with more professional typography
and design language. It supersedes the previous unselected direction options.
Exact colors and measurements below are proposed translations of the reference,
not pixel samples or already approved implementation tokens.

Confirmed interaction decisions:

- Successful login opens **Fixtures for everyone**. Authorized Organizer/Manager
  roles additionally have Scoring/Roster destinations.
- Match Detail is **one scroll: score, event timeline, then pinned product**.

Structural thesis: a quiet dark shell, explicit league/tenant context, highly
readable match information and restrained lime for priority actions/selection.
The signature is a stable score-and-state grouping: the score stays visually
anchored as its update/status text changes, including when cached or pending.
Do not simulate score progression; render only server projections and clearly
identified pending work.

Use native Android Material interaction conventions: labeled navigation,
standard inputs/buttons, accessible dialogs/sheets, ripple/pressed feedback,
system Back and keyboard/window insets. No new UI library is selected by this
brief. Prefer existing React Native capabilities and approved dependencies.

The reference's photography, logos, betting controls and video-player treatment
do not create product features or content requirements. Match Detail is the
documented score/timeline/showcase experience. Use real tenant/product assets
when available, with intentional empty/fallback treatments.

## 3. Approved semantic palette

Dark is the reference-led design target. Avoid large pure-black fields, repeated
lime-filled cards, translucent text backgrounds and glow effects. Separate depth
with solid surface tones; keep body text on a predictable background.

| Token | Value | Role |
|---|---|---|
| `background` | `#11150F` | Main screen canvas. |
| `surface` | `#1C2118` | Cards, input backgrounds and navigation surface. |
| `surfaceRaised` | `#262D21` | Sheets, selected containers and dialogs. |
| `overlay` / `overlayEdge` | `#262C27` / `#4A5548` (light `#FFFFFF` / `#D5DCCD`) | Sheets, dialogs and the loading overlay: raised tone, hairline edge and elevation so overlays read above content. |
| `scrim` + `frost` | translucent | Frosted backdrop behind every overlay (dim + tinted veil; no native blur). |
| `inverse` / `onInverse` | `#E6EBE2` / `#1B2117` (light inverted) | Toasts/snackbars. |
| `surfaceOlive` | `#202918` | Quiet context/brand areas. |
| `divider` | `#3B4533` | Decorative separators only; not a control's sole boundary. |
| `outline` | `#74806A` | Visible input/control boundary. |
| `textPrimary` | `#F3F5EE` | Names, labels, score and main content. |
| `textSecondary` | `#BBC4AF` | Supporting content. |
| `textMuted` | `#A0AC94` | Lower-priority readable metadata. |
| `accent` | `#C5F545` | Primary action, selection and focus emphasis. |
| `onAccent` | `#18200B` | Text/icons on lime fills. |
| `success` / `successContainer` | `#A8DAB5` / `#1D3022` | Accepted/applied outcomes, always labeled. |
| `warning` / `warningContainer` | `#E7C874` / `#352F1F` | Offline/stale/pending attention, with specific text. |
| `error` / `errorContainer` | `#FFB4AB` / `#38221F` | Validation/rejection/failure messages. |
| `info` / `infoContainer` | `#B7D5F2` / `#20303E` | Neutral sync/deferred explanations. |

Lime is not the generic success/status color. A selected filter, primary button
and pending action must remain distinguishable without color. Use one filled
primary action per action group; quiet secondary actions use text or outlines.
The normal fixture list does not use large lime backgrounds.

Tenant branding: preserve the tenant name/logo and apply supplied primary and
secondary colors in dedicated context marks and branding areas. Keep semantic
status colors independent. Choose readable foregrounds after contrast checks;
if a tenant color cannot safely fill a text surface, use it as a separate logo
or decorative mark beside a readable name. Lime remains the proposed app accent,
not a substitute tenant identity.

A supporting light scheme can use `#F4F6EF` canvas, white surfaces, `#1B2117`
text and `#405B16` filled primary buttons with white text; retain lime as a
decorative/selected-container accent with dark text. System-theme behavior and
whether to ship that scheme need a separate implementation decision. This brief
does not add a theme setting or change current Expo configuration.

## 4. Typography and numeric information

Use the Android system **Roboto** family through native text roles. No remote
font requests, custom font package or new font asset is needed. Define the roles
once; do not tune each screen independently.

| Role | Default size / line height (sp) | Weight | Use |
|---|---|---|---|
| Screen heading | 28 / 36 | 600 | Login title and major screen heading when separate from app bar. |
| App-bar title | 22 / 28 | 500 | Fixtures, Match Detail and other destinations. |
| Section title | 20 / 28 | 600 | Timeline, Club roster, Order summary. |
| Item title | 16 / 24 | 600 | Team/product/player name. |
| Body | 16 / 24 | 400 | Forms, descriptions, event details and explanations. |
| Action label | 16 / 24 | 600 | Buttons and primary actions. |
| Supporting label | 14 / 20 | 400 or 500 | Metadata, state labels and navigation labels. |
| Match score | 44 / 52 | 700 | Main score; tabular numerals where supported. |

Use sentence case, short headings and descriptive labels. Avoid italic display
headings, thin light-on-dark text, condensed body fonts and decorative all-caps.
Respect font scaling, Android text metrics and TalkBack. Numbers align; text
wraps. Large scores and long names may push metadata below, never overlap it.

## 5. Spacing, shape and layout rules

- Base spacing units: **4, 8, 12, 16, 24, 32 dp**. Screen horizontal padding 16 dp;
  section gaps 24 dp; related content gaps 8-12 dp. Increase gaps when text scales.
- Controls have at least **48x48 dp** hit targets and 8 dp separation. Buttons
  normally have 52 dp minimum height; inputs 56 dp minimum. Heights grow with text.
- App bar starts at 56 dp plus system insets; labeled bottom navigation starts
  at 80 dp plus the navigation inset and grows if scaled labels need it.
- Cards use 16 dp corners; fields and standard buttons 12 dp; chips 20 dp.
  Use consistent shapes and tonal elevation, not a different radius per screen.
- Keep screen content vertically scrollable. A 360x640 dp frame includes system
  bars, navigation, keyboard and accessibility growth; do not budget all 640 dp
  as content. No whole-screen fixed heights in the implementation.
- Rotation retains content order and reading position. Broader width may give
  score columns more room, but does not replace the agreed single-scroll flow.
  Expanded-device layouts are future scope unless explicitly added.

## 6. Shared shell and navigation

The default four base destinations remain Fixtures, Standings, Store and
Club/Profile. Managers add Roster; Organizers add Scoring. Admin management actions
are reached in relevant scoped stacks, keeping compact navigation at five or
fewer destinations. Every role can reach Account from Club/Profile.

The app bar states the current destination and tenant identity. A labeled
Settings action is available globally. A persistent, accessible connectivity
control shows Online, Offline or Syncing and opens Sync Status after login.
It expands with text, rather than squeezing state into an unlabeled dot.

League selection is explicit on Fixtures and Standings. Preserve scope when
opening a match and returning. An Admin context switch clears incompatible
league/club selections; tenant discovery remains a contract dependency. Tab
visibility is not authorization: enforce role and ownership at action boundaries.

Cold launch restores secure session and scoped cache. First successful login
opens Fixtures; navigating back from match/forms restores the caller's context.
Expired sessions go to Login with the required explanation and retain queued work.

## 7. First four surface plans

### Shared app shell

Hierarchy: system insets -> app bar/context -> connectivity -> active content ->
labeled role-aware navigation -> navigation inset. Avoid stacked decorative
headers. Scrolling content cannot hide behind bottom navigation. Details/form
stacks retain a clear Back action; they may omit bottom tabs to give tasks space.

### S01 Login

Use the dark canvas with a small app identity, a clear Sign in heading, brief
purpose text, visible Email and Password labels, show-password control and one
lime Sign in button. Server address/Settings is a visible secondary action, even
before login. The currently configured address is secondary information, not
the visual headline. No bottom tabs or role picker on Login.

Keep the form reachable above the keyboard by scrolling and moving focus to
invalid fields. Signing in shows progress and prevents duplicate submission.
Credential failures are consistent and plain-language. Offline first sign-in
explains the connection requirement; an existing session's offline cache restore
must not be confused with a new offline authentication attempt.

### S03 Fixtures

Hierarchy: tenant/destination app bar -> labeled connectivity -> league selector
-> status filters -> chronological date-grouped fixture rows. Use stable time,
team-name, score and state alignment, with room for names to wrap. Whole rows
open the match; no competing embedded action targets on the normal fixture row.

Keep chronological ordering from APP-11; no unsupported live-first reordering.
Status filters are labeled and scroll horizontally or wrap without shrinking
targets. Missing schedule shows Time to be confirmed; missing venue is handled
plainly. Format supplied UTC times for the displayed locale/timezone explicitly.

With no leagues: explain the absence and offer refresh. With an empty filter:
offer Clear filter. Offline cached rows show their saved state and last-refresh
time; a cached in-progress match is not represented as a fresh live feed.

### S05 Match Detail

One scroll, in the confirmed order:

1. **Score:** team identities, large aligned scores, written status and schedule/
   venue where available. Show model-specific fields only when supplied by the
   projection. Offline/reconnecting state stays adjacent to score context.
2. **Event timeline:** sequence-ordered events with readable descriptions and
   correction labels. Original compensated events stay struck through with
   explicit Corrected text; the compensating append remains visible. State is
   accessible to screen readers, not only through strike styling.
3. **Pinned product:** a compact product showcase with real image/fallback,
   readable name and product action; absent pin has an intentional empty state.

The first viewport establishes teams, score and data freshness, then starts the
timeline where space allows. It does not promise an exact event count at enlarged
font sizes. Do not invent a match clock, event timestamp, video stream or audience
count absent from APP-13. Sequence labels work when timestamps are not supplied.

Organizer/Admin controls depend on owned scope: Record event opens S19, eligible
correction opens S20, Pin product opens the picker. Keep management below the
score context, with one primary action and labeled secondary actions. Confirm
compensation. Offline supported writes show Pending separately from confirmed
score/history. Pinning remains an online action under current contracts.

WebSocket recovery re-fetches the projection and uses the planned polling fallback.
Update changed values gently without moving the reader's timeline position or
announcing every refresh to TalkBack. Honor reduced-motion preferences.

## 8. Reusable component and state vocabulary

Plan these primitives inside the existing shared folders; this is not a package
selection or a list of modules already implemented:

| Primitive | Shared responsibility |
|---|---|
| Screen/AppBar/TabBar | Insets, scrolling, destination/context, Back, role-aware navigation. |
| ConnectivityStatus | Explicit Online/Offline/Syncing label, pending count where known, Sync entry. |
| ContextPicker/FilterChip | League/club selection, label, selection and disabled state. |
| Button/IconAction/TextField | Shared type, targets, labels, progress, focus and error behavior. |
| FixtureRow/ScoreSummary | Stable team/score/status hierarchy without sport-specific literals. |
| StatusLabel/FeedbackMessage | Named pending/deferred/applied/rejected states and plain-language reasons. |
| TimelineEntry | Sequence, event description, compensation and permitted correction action. |
| EmptyState/ErrorState/LoadingState | Helpful recovery, in-place loading and preserved readable cached data. |
| ProductSummary/ConfirmationSheet | Merchandise entry and review of consequential actions. |

Every data surface plans these states:

| State | Presentation and recovery |
|---|---|
| Loading | Stable placeholders/progress; retain cached content during background refresh. |
| Empty | Explain what is missing and provide the applicable refresh, filter reset or Back action. |
| Error | Specific plain-language explanation, inline field feedback or retry; preserve entered data. |
| Success | Clear feedback that does not block the next task; only announce confirmed outcomes. |
| Offline | Persistent connectivity label, cache age, explicit unavailable actions and queued-work state. |
| Pending/syncing | Separate local action from server projection; show count/progress and Sync Status link. |
| Rejected/deferred | Explain why and what happens next; deferred acceptance is not a failed transfer. |

## 9. Extension across all 21 screens

| Screen family | Inherit from this brief |
|---|---|
| S01/S02/S07 Login, Settings, Account | Labeled form/list rows, restrained primary action, safe session/server confirmations. |
| S03/S04 Fixtures, Standings | Shared context/filter controls; aligned data rows and qualification labels. |
| S05 Match Detail | Score hierarchy, model-generic fields, timeline and compact pinned product. |
| S06/S08 Club and Player Profile | Tenant identity, section hierarchy, roster rows, readable audit history. |
| S09-S15 Store through Order Detail | Product surfaces, stable PKR totals, variant/form controls, primary Buy/Pay action and retrievable receipts. |
| S16-S18 Roster flows | Player rows, shared fields, review sheet and explicit pending/deferred results. |
| S19/S20 Scoring and Compensation | Large team/score context, config-driven controls, confirmation and correction semantics. |
| S21 Sync Status | Same status labels, pending queue, result history, reasons and recoverable actions. |

P2 management remains separate. Do not introduce extra dashboards or new
registration, betting, video or social flows as visual filler.

## 10. Content ranges, verification and remaining decisions

Design for 0/1/many fixtures, a full page of up to 100 list entries, long names
that wrap, null schedules/venues/products, all match statuses, growing score
values and long event logs. Use IDs as a readable fallback where display names
are unavailable; do not assume team IDs map directly to club IDs. Paginate or
virtualize per the production contract when implemented.

Planned verification: 360x640 dp portrait and rotation; system font scale at least
1.3 plus a larger exploratory size; TalkBack order/labels; keyboard/IME insets;
Back; role/tenant boundaries; all shared states; offline force-close recovery.
Native screenshots/device testing are required later; planning sketches are not
proof of native behavior.

Color calculations completed before implementation: primary text/surface 14.93:1,
secondary/surface 9.08:1, muted/raised 5.96:1, button text/lime 13.21:1,
warning pair 8.18:1, error pair 8.73:1, success pair 8.92:1, info pair 8.89:1.
Control outline/surface is 3.94:1. Supporting light pairs are 15.10:1 and 7.70:1.
These are sRGB calculations for solid pairs, not rendered-device certification;
tenant-supplied colors and interaction states must be checked separately.

Open integration dependencies stay those in SCREEN-PLAN.md: resource discovery,
scoring configuration reads, player read/role-edit gaps, PDF handling and release
delivery. No endpoints, libraries, defaults or priorities changed here.

The user approved this direction and subsequently authorized UI implementation.
All 21 screens now consume the shared system; DESIGN.md records the actual tokens.
The finish review returned recapture because native screenshots are unavailable.
Layout, rotation, enlarged fonts and TalkBack remain to be verified on Android.
