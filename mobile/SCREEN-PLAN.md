> Current UX architecture (2026-10-18): Home is the initial destination for all
> roles; bottom tabs are Home, Fixtures, Standings, Store and Club. Roster/Scoring
> are prominent Home work actions and scoped stack destinations. The original
> S01-S21 inventory remains reachable, plus Home and the supported Management/
> Order Fulfillment screens. Search/date groups, expandable standings, responsive
> catalogue, club/match/sync tabs and staged forms replace the earlier layouts.
> Shared components are split by responsibility; see DESIGN-BRIEF.md. Earlier
> visual/navigation descriptions below are historical, not current authority.

> Active implementation update (2026-10-18): All S01-S21 screens and the existing
> Management/OrderManagement routes are rebuilt in fresh `src/`, integrated with
> production APIs. Original source is preserved at `src1/`. The sections below
> describing preview-only screens, Screen Studio, missing discovery or unimplemented
> services are historical planning records superseded by ADR-022/023 and this update.
> Discovery APP-03 exists; product/order detail reads use APP-51/53. Native and full
> backend journey acceptance are still pending. TypeScript and 18 mobile tests pass.

> Current status (2026-10-17): earlier prototype descriptions below are historical.
> Real APIs, APP-03 discovery, Keychain/SQLite, NetInfo and server PDFs are wired.
> Mock data/engine, Screen Studio and unsupported P2 controls are removed.
> Native acceptance remains pending; see ADR-022 and mobile/README.md.

# Mobile readiness review and screen plan

Reviewed 2026-10-17. All S01–S21 screen components and typed role-aware navigation
now exist as a UI-only preview. The behavior below remains the integration target;
screen presence does not establish persistence, authentication or API acceptance.
Behavior remains owned by [REQUIREMENTS](../REQUIREMENTS.md) sections 8–10.

## Documentation review

All 14 project Markdown files present at the start of this review were read,
excluding installed dependencies and generated output. The mobile requirements
were also checked against the binding spec's text copy, sections 8.1–8.6 and 5.14.

| Document | Finding for mobile |
|---|---|
| `AGENTS.md` | Work on master; use approved dependencies; record structure changes; implement all UI states and secure token storage. |
| `REQUIREMENTS.md` | Owns MOB-01–12, APP contracts, role scope, offline behavior and HCI. No behavior or open-question defaults changed in this review. |
| `ARCHITECTURE.md` | The proposed flat screen/service tree differed from the existing feature folders. Section 11 now maps the existing layout explicitly. |
| `ADR.md` | ADR-017 described a bare RN app with a TBD version. The existing Expo/RN versions and generated-native workflow are now recorded separately from planned capabilities. |
| `TRACEABILITY.md` | Mobile storage paths pointed to nonexistent top-level `db`/`sync` folders. Planned paths now match `services/storage` and `services/sync`; features remain Todo. |
| `README.md` | Still describes the legacy backend starter. A mobile handoff pointer distinguishes the existing scaffold from that historical description. |
| `docs/IMPLEMENTATION-PLAN.md` | Mobile sequence remains useful. Readiness review is recorded without marking the mobile skeleton or later slices complete. |
| `docs/MOBILE.md` | App creation, port 3000, old error parsing and AsyncStorage suggestions conflicted with the current app/canonical docs. Replaced with a handoff to the existing setup and a desk-check checklist. |
| `docs/CACHING.md` | Historical backend guide; corrected the ADR reference and target health shape. Use architecture section 8 for cache policy; mobile persistence is SQLite, not Redis. |
| `docs/TEAM.md` | Corrected Node 22 target, master branch, human-authorized push windows and port 8080; points mobile setup to the existing scaffold. |
| `docs/SPEC-CHECKLIST.md` | Historical blank intake checklist; corrected baseline port, health/error shapes, timestamps, IDs and pagination. Use populated requirements and Appendix C for acceptance. |
| `docs/CHANGELOG.md` | Records known starter conflicts; this review adds the mobile reconciliation. |
| `mobile/AGENTS.md` | Retains the configured Windows JDK/SDK workflow; now points to this plan and makes dependency approval explicit. |
| `mobile/README.md` | Accurate scaffold inventory; now links this plan and distinguishes environment defaults from the future in-app server setting. |

The legacy backend documents still contain historical examples. This review does
not establish that the backend satisfies APP contracts or that any API is running.

## Directory decision

Keep the existing directory structure. It already separates features from shared
infrastructure; moving empty folders into a flat `screens/` tree would add churn.
The theme, components, navigation, preview adapter and all feature screen files
now contain source. Unimplemented services retain placeholders. The root `App.tsx` and
`index.ts` already delegate to the app root correctly.

| Existing location | Responsibility when implemented |
|---|---|
| `src/app/` | Startup, providers and the global connectivity indicator; compose services here. |
| `src/navigation/` | Auth gate, typed route parameters, role-aware tabs and detail stacks. Route parameters carry IDs rather than copied API objects. |
| `src/features/<feature>/` | Feature screens, feature-only components, hooks and request/view adapters. Start flat within each feature; add subfolders only when needed. |
| `src/components/` | Shared Screen, Button, Card, form fields, banners and loading/empty/error/confirmation UI. |
| `src/theme/` | Shared spacing, typography, colors and tenant branding; check contrast for injected colors. |
| `src/hooks/` | Cross-feature hooks such as `useCachedQuery`; feature-specific hooks stay in their feature. |
| `src/types/` | Shared wire types and role/tenant types; keep JSON names in snake_case. |
| `src/config/` | Public backend default and future runtime settings; no secrets. |
| `src/services/api/` | One HTTP transport, timeout, endpoint helpers and `errorMessages.ts`. |
| `src/services/auth/` | Keychain session and authentication lifecycle. Login UI belongs in `features/auth`. |
| `src/services/storage/` | SQLite migrations and repositories for `kv`, `cache_entries`, `outbox`, `sync_results`. |
| `src/services/sync/` | Connectivity, stable device/action IDs and queue draining. Queue UI belongs in `features/sync`. |
| `src/services/realtime/` | WebSocket lifecycle, subscriptions and reconnection. |

Dependency direction: app/navigation compose features; features use shared hooks,
UI and services; services never import feature screens. Screens do not open SQLite,
read tokens or create WebSockets directly. Avoid global barrel exports and empty
per-screen folders before there is code to organize.

## Screen completeness review (2026-10-17)

The first inventory covered the named MOB screen groups but was not a complete
route/interaction plan. This revision adds the missing supporting screens and
makes previously implicit flows explicit. All entries are planned, not built.

| Review finding | Resolution |
|---|---|
| Orders and Order Detail missing despite APP-53 | Added S14/S15 so receipts and order status remain reachable after checkout. |
| Club/Profile tab did not give every role an account destination | Added S07 Account; Club Profile remains S06 and Player Profile remains S08. |
| League/tenant/club selection mentioned without a defined surface | Added selection sheets and their navigation/data dependencies. |
| Product pinning had an API reference but no organizer interaction | Added a product-picker sheet from Match Detail with pin/unpin confirmation. |
| Player editing and history were bundled without specifying the flow | S08 now includes history and a scoped edit sheet; unresolved read/role-edit contracts are listed below. |
| Sync results and action confirmation were implicit | Defined queue/result sections, action detail sheet, confirmation and pending/deferred feedback. |
| P2 management features had no UI inventory | Added a separate extension backlog; existing priorities and delivery order are unchanged. |

## Primary screen inventory

Implementation status: every file listed below exists under `src/features/`.
`src/navigation/screenRegistry.ts` provides the 21-entry preview inventory.
`npm run test:screens` checks inventory, role visibility, tenant isolation and
adapter behavior. `Settings → Screen Studio` exposes all presentation states and
role-specific routes. Product actions remain disconnected; success/offline states
are explicitly labeled previews. Backend integration and native visual/accessibility
checks remain open. Admin roster management uses a stack route with club context;
manager/organizer action tabs retain their documented role scope.

Plan **21 primary screens** in existing feature folders, plus the shared sheets
and states below. The count is a design inventory, not a new requirement that all
screens have equal priority. Orders, Account and Player Profile support existing
APP capabilities; the judged MOB journeys remain the delivery priority. An extra
Home dashboard is optional and excluded from the count: the role-aware tab shell
is the home after login. No new feature directories are needed for this inventory.

Access shorthand: **All** = signed-in users in their authorized resource scope;
**Organizer** = own leagues; **Manager** = own club; **Admin** = Super Admin with
an explicit resource/tenant context. Every write still requires server authorization.

| ID | Proposed file under `src/features/` | Content and main actions | Entry and onward navigation | Access / contracts |
|---|---|---|---|---|
| S01 | `auth/LoginScreen.tsx` | Email/password, show password, sign in, friendly credential/server errors; session-expired message. | App auth gate; open Settings before login; success opens role-aware tabs. | Public; MOB-01, APP-01/02. |
| S02 | `settings/SettingsScreen.tsx` | Server URL, validation/save feedback, current server, logout; pending-work confirmation where needed. | Login and global Settings action; return to caller after save or auth gate after logout. | Public URL setting; signed-in logout; MOB-10. |
| S03 | `fixtures/FixturesScreen.tsx` | League picker, status filter, teams, score, time/venue, status text, cache age. | Fixtures tab; select match -> S05; same league context as S04. | All; MOB-02/11, APP-10/11. |
| S04 | `standings/StandingsScreen.tsx` | League picker, ranks, points, played/won/drawn/lost, qualification text, tie-break explanation. | Standings tab; team/row action -> S03 filtered locally for that team -> S05. | All; MOB-04/11, APP-16. |
| S05 | `matches/MatchDetailScreen.tsx` | Live score, status, venue/time, timeline with compensated events, pinned product. Authorized scoring and pin controls. | S03 or S04 via fixtures; pinned product -> S10; Score -> S19; correction -> S20. | All read; Organizer/Admin actions; MOB-03, APP-13/14, RT-01. |
| S06 | `clubs/ClubProfileScreen.tsx` | Club identity, venue, socials, staff, season stats, active roster, loan/role labels. | Club/Profile area or club selector; player -> S08; authorized Manage roster -> S16. | All tenant-scoped reads; MOB-05/11, APP-30. |
| S07 | `home/AccountScreen.tsx` | Display name, email, role, tenant; links to My club/player when available, Orders, Settings, Sync. No invented account-edit API. | Profile destination available to every role; open S06/S08/S14/S02/S21. | All; APP-02, FR-5.1-01/02. |
| S08 | `clubs/PlayerProfileScreen.tsx` | Known player name/position, registration/loan information, append-only history with as-of date; scoped edit name/position sheet. | Club roster, manager roster or Account for self; back to origin after edit. | Tenant-scoped history; edit self/own-club player/Admin only; APP-33/34. Player read-data gap below. |
| S09 | `store/StoreScreen.tsx` | Catalogue, club filter where discoverable, category, item price/availability, cart and Orders links. | Store tab; product -> S10; cart -> S11; Orders -> S14. | All; MOB-06, APP-50. |
| S10 | `store/ProductDetailScreen.tsx` | Product, variant size/color picker, price in PKR, availability, quantity, Add to cart feedback. | S09 or pinned showcase on S05; cart -> S11; preserve return path to match. | All; MOB-06, APP-51. |
| S11 | `store/CartScreen.tsx` | Selected variants, quantity/remove controls, estimated integer-paisa totals; clear empty state. | Store/product cart action; continue shopping -> S09; Checkout -> S12. | All; local cart; MOB-06. |
| S12 | `store/CheckoutScreen.tsx` | Item summary, optional discount code, mock payment choice, server-confirmed totals; submit once with stable order ID. | S11; success -> S13; failure stays with cart retained and useful recovery. | All; MOB-06, APP-52. Online required; never show paid from local state alone. |
| S13 | `store/ReceiptScreen.tsx` | Paid order ID, items/totals/currency/time, receipt view/download status; PDF preview or platform viewer. | Checkout success or S15; open/download PDF; return to order/store. | Order owner, authorized Manager/Admin; MOB-06, APP-54. PDF viewer mechanism unchosen. |
| S14 | `store/OrdersScreen.tsx` | Purchase history with order ID, date, total and status; empty state. Scope manager/Admin views only to what server permits. | Account or Store Orders link; order -> S15. | Owner, authorized Manager/Admin; APP-53. |
| S15 | `store/OrderDetailScreen.tsx` | Items, totals, payment/order status, receipt action. Later authorized P2 transitions reuse this screen. | S14; receipt -> S13; back to Orders. | Owner, authorized Manager/Admin; APP-53/54; APP-55 extension. |
| S16 | `roster/RosterScreen.tsx` | Own-club league/squad selection, player roles/loan state, Add player and transfer/loan/release actions; Pending/Deferred labels. | Manager Roster tab or authorized S06 link; S08/S17/S18. | Manager/Admin in context; MOB-07, APP-30/31/32. |
| S17 | `roster/AddPlayerScreen.tsx` | Name, position, league, squad, role, optional ID; inline field errors and success. | S16; successful save returns to refreshed roster. | Manager/Admin; MOB-07, APP-31. Online required; no defined add-player queue action. |
| S18 | `roster/RosterActionScreen.tsx` | One form with transfer/loan/release modes; player/from/to, effective date, loan end date, reason, review/confirm and result. | S16 or authorized S08 action; accepted -> roster/history; offline -> Pending and S21 link. | Manager/Admin; MOB-07/12, APP-32/40. Show deferred acceptance separately from rejection. |
| S19 | `scoring/ScoringEntryScreen.tsx` | Owned league/match selection, team, config-driven scoring event; lifecycle start/end controls where valid, submit result or Pending. | Organizer Scoring tab or S05 Score; correction -> S20; success refreshes match. | Organizer/Admin; MOB-08/12, APP-15/40. Never hard-code sport event choices. |
| S20 | `scoring/CompensationScreen.tsx` | Select eligible event, show original details, require reason, confirm compensating append. Preserve original history. | S05 eligible timeline action or S19 corrections link; result -> refreshed S05 or Pending. | Organizer/Admin; MOB-08/12, APP-15/40. Offline requires cached target/version and valid action data. |
| S21 | `sync/SyncStatusScreen.tsx` | Connectivity, pending queue, Sync now, progress, applied/duplicate/rejected result history with reasons, per-item detail. | Tap global status indicator or Account Sync; return to originating screen. | All can see their own status/work; replay each action under authorized Organizer/Manager/Admin scope; MOB-09/12, APP-40. |

## Shared sheets, dialogs and shell states

These are part of design coverage, not extra top-level screens. Use accessible
full-height presentation when a sheet's content would not fit a small phone.

| Surface | Entry / behavior | Contract or dependency |
|---|---|---|
| Session bootstrap state | App startup restores secure session and scoped cache; show loading/retry; offline restore must not strand previously signed-in users. | APP-02, NFR-4/5; expired-session recovery preserves queued work. |
| League picker | Shared by Fixtures, Standings, Roster and Scoring; synchronize selected context where appropriate; zero leagues has a helpful empty state. | APP-10; management choices filtered to owned scope. |
| Club selector | Club/Profile area and Store filter; a viewer without `club_id` can still reach a club profile. | Club discovery contract missing; APP-30 reads a known club only. |
| Tenant switcher | Admin context control; select a tenant before scoped actions; reset selected league/club and read state on change. | Tenant discovery/context contract missing; do not fabricate tenants or change JWT claims locally. |
| Pin product picker | Organizer/Admin opens from S05; choose tenant-visible product or remove current pin, confirm and show feedback. | APP-50/14, RT-01; online interaction until an offline pin contract exists. |
| Player edit sheet | S08 name/position fields; save only for self/own-club player/Admin; readonly history remains visible. | APP-34. Existing-player role assignment is not defined by this body. |
| Roster review dialog | S18 shows player, source/destination, dates and reason before transfer/loan/release. | APP-32; confirm before risky actions; do not invent reversal of an accepted audit event. |
| Scoring confirmations | Confirm compensation and consequential lifecycle changes; explain correction through an append rather than deleting an event. | APP-15, BR-SCORE-01/07. |
| Sync item detail | S21 exposes action summary, queued time, Pending/Applied/Rejected/Duplicate, reason and server result where available. | APP-40; rejected outcomes are history, not pending retries. |
| Logout / server-change confirmation | Settings explains pending work and offers a safe exit/cancel; scoped retained work never goes to another server/user. | MOB-10/12, NFR-5; exact server-change retention UX remains an implementation decision. |
| Resource unavailable / forbidden state | In-place plain-language state with Back, Retry or context selection; no broken detail route or raw status code. | 401 auth recovery; 403 scope; 404 missing resource; no separate Error screen required. |
| Connectivity and feedback | Always-visible labeled Online/Offline/Syncing control opens S21; loading, empty, retry, success, stale-data and pending states shared across screens. | MOB-09/11/12, NFR-ACC-01. |

## Role navigation and complete journeys

The base destinations remain Fixtures, Standings, Store and Club/Profile, as in
REQUIREMENTS section 9. The Club/Profile area exposes both club information and
Account, so a missing `club_id` never becomes a dead end. Settings and Sync are
global labeled actions. Preserve the active stack and sensible Back behavior.

| Role | Home/tab destinations and management access |
|---|---|
| Viewer | Fixtures, Standings, Store, Club/Profile; Account, Orders, Settings and Sync status. No roster/scoring write controls. |
| Player | Same base destinations; self profile/edit via Account, tenant club profiles and permitted checkout. |
| Club Manager | Base destinations plus Roster for own club; own-club player edits and authorized order reads. |
| League Organizer | Base destinations plus Scoring for owned leagues; pin/unpin on owned matches. |
| Super Admin | Base destinations with tenant context; authorized roster/scoring controls exposed in relevant club/match stacks; discovery contract needed for tenant selection. |

Do not put all Admin management actions into an overcrowded bottom bar. Route
guards and server authorization must enforce ownership as well as role.

- **J-A, standings to match:** S01 -> S04 -> league selection -> team fixture
  action on S03 -> S05. A team ID is not automatically a club ID; this path does
  not require an undocumented team-to-club mapping.
- **J-B, purchase:** S09 -> S10 (variant/quantity) -> S11 -> S12 -> S13 (PDF).
  Later: Account/S09 -> S14 -> S15 -> S13. Failed checkout stays recoverable.
- **J-C, roster and offline:** manager login -> S16 -> S18 -> review/confirm ->
  accepted/deferred result. Repeat offline -> Pending -> force-close/reopen ->
  S21 -> reconnect/Sync -> per-action outcome -> updated roster/history.
- **Organizer offline check:** S05/S19 -> score or S20 compensation -> Pending
  -> reopen offline -> S21 -> sync -> refreshed S05 and S04 when online.
- **Profile/session:** Club/Profile -> S07 -> own player S08 or club S06;
  Settings is reachable both before login and after authentication; expired
  session returns to S01 while retaining pending work in its original scope.

## Requirement coverage review

This is planned coverage only. No requirement is marked implemented or tested.

| Requirement | Planned screen/surface coverage | Review result |
|---|---|---|
| MOB-01 | S01, S02, auth bootstrap and role-aware tab home | Covered in plan. |
| MOB-02 | S03, league picker, S05 navigation | Covered in plan. |
| MOB-03 | S05, live/reconnect states and pin picker | Covered; scoring config/pin integration still pending. |
| MOB-04 | S04, qualification text, team-to-fixtures path | Covered in plan. |
| MOB-05 | S06, club selector, S08 | Covered; club discovery remains a contract gap. |
| MOB-06 | S09-S15, variants, mock payment and PDF flow | Covered; viewer/download implementation unchosen. |
| MOB-07 | S16-S18, roster review dialog, S08 history | Covered for add/transfer/loan/release; existing-player role-edit contract needs clarification. |
| MOB-08 | S19/S20, match lifecycle/correction confirmations | Covered; sport config read data is missing. |
| MOB-09 | S21 plus global connectivity control | Covered in plan. |
| MOB-10 | S02, Account link, Login entry and logout confirmation | Covered in plan. |
| MOB-11 | S03/S04/S06 cached views and stale/offline states | Covered in plan; SQLite still unimplemented. |
| MOB-12 | S18-S21 pending/result flows, force-close recovery and scoped queue | Covered in plan; synchronization still unimplemented. |
| FR-2.1-02, FR-5.1-01/02 | Tenant branding/context, role navigation, scoped actions and auth recovery | Covered in plan; tenant discovery needs a contract. |
| NFR-4/5, NFR-ACC-01, RT-01 | Persistent cache/queue, Keychain session, accessible states and realtime match refresh | Architecture/design coverage only; requires device/integration verification. |

## Additional management surfaces at existing P2 priority

These are mapped for completeness, not promoted into the judged-screen critical
path. Backend audit test endpoints are not a substitute for authenticated mobile
management APIs. No new endpoint or payload is approved by this inventory.

| Surface | Planned host | Existing requirement / contract and gap |
|---|---|---|
| League/tournament setup and fixture generation/preview | Future organizer management stack | FR-1.2-01/02, FR-1.3-01-04; audit fixture generation/league registration exist in the spec, but production creation/generation contracts are not defined. |
| Season/division/stage configuration | Forms within future league workspace | APP-20/21/22 are P2 placeholders; define field/read contracts before implementation, including hybrid seeding and promotion/relegation settings. |
| Match status and rescheduling | S05 action sheet plus reschedule form | APP-12/23, FR-1.3-05/06; show reason, date/venue and structured conflicts. Venue discovery contract missing. |
| Order fulfillment/cancel/refund | Authorized action sheet on S15; scoped S14 list | APP-55, FR-2.3-04; confirmation and legal transitions; existing order response detail must support displayed actions. |
| Catalogue/variant/price-schedule management | Future store management forms | FR-2.3-01, product-management permission matrix; production write contracts missing. |
| Existing-player role assignment | Future S16/S08 role editor | FR-2.2-05; APP-31 accepts role on add, APP-32 transfer sets substitute, APP-34 edits only name/position. No existing-player role-update contract. |

Platform tenant/configuration and sport-configuration administration are required
backend capabilities (FR-5.1, FR-1.1), but separate mobile admin screens are not
explicitly required by MOB-01-12. If a mobile admin workspace is requested, plan
its tenant/sport/config forms after authenticated production contracts are agreed;
do not expose grader `/reset`, `/roster/setup` or `/rbac-matrix` in the app.

## Reference-led design brief

[DESIGN-BRIEF.md](DESIGN-BRIEF.md) records the approved shared system and shell/Login/
Fixtures/Match Detail layouts. The user selected a charcoal/olive/lime reference,
Fixtures as the landing tab for every role, and one Match Detail scroll ordered
score, timeline, then pinned product. All 21 screen designs are now implemented
as UI-only previews; the MOB traceability row is In progress. Backend, durable
offline behavior and native acceptance remain pending.

## Design sequence and completion gate

1. Shared tokens/components, navigation, all global states, S01/S02/S07 and selectors.
2. J-A: S03-S06, including the standings-to-match path and tenant branding.
3. J-B: S09-S13, then S14/S15 for return visits.
4. J-C: S16-S18, then S08 for player/history/edit detail.
5. Organizer: S19/S20 with event-config choices and confirmation.
6. S21 and persistent queue behavior throughout both write flows; design it with
   the first offline state, not as a late addition.
7. Role/ownership pass, all error/empty/offline variants, 360x640 dp, rotation,
   keyboard/back behavior, then the separate P2 management backlog.

A screen is ready for implementation when its entry/exit, data contract, allowed
roles/resource scope, key actions, loading/empty/error/success/offline states,
confirmation behavior and small-screen layout are specified. Contract gaps may
use labeled prototype data during design; they cannot be called integrated.

## Shared behavior to preserve during design

- Design loading, empty, error with retry, success and offline states together.
  Show Online/Offline/Syncing globally, cached-data age and pending actions clearly.
- Use body text at least 14 sp, scaling fonts, 48 dp targets, 4.5:1 contrast,
  icon labels and textual status; verify rotation and keyboard behavior.
- Cache fixtures, standings and club profiles in SQLite. Scope cached records
  and queued work to the authenticated user/tenant/server so another session
  cannot display or replay them accidentally. Tokens belong only in Keychain.
- Only scoring and supported roster transfers/loans/releases use the specified
  offline queue. Checkout needs a server-confirmed result; add-player has no
  defined offline action type. Clearly explain unavailable offline operations.
- Persist the exact API-17 action envelope before showing Pending. Retain IDs
  across retry; use UTC timestamps without milliseconds and the correct base
  version (match event count or player's audit count across all leagues).
- Process batches of at most 100 through APP-40. Applied/duplicate items leave
  the pending queue; keep rejected outcomes in sync history with plain-language
  reasons. Do not retry rejected actions automatically as new actions.
- A 401 clears the session and keeps queued actions. Explicit logout clears
  cached tenant data and asks before discarding pending actions. Changing servers
  must not replay old work to a different backend; settle the exact UX before
  implementing Settings.
- Fetch fresh match data after reconnect; use realtime with the planned polling
  fallback. Do not treat cached stock as a purchase guarantee.

## Integration gaps before functional implementation

1. The scaffold has Expo 54.0.37, RN 0.81.5 and React 19.1.0 in the lockfile.
   Navigation, SQLite, Keychain and NetInfo are not installed. Native compatibility
   and an Android build remain unverified; do not substitute libraries silently.
2. APP contracts do not describe tenant discovery for the Super Admin switcher,
   a club list for users without `club_id`, roster destination/squad discovery,
   or a sport-config read for scoring choices. Coordinate with the backend owner
   and update REQUIREMENTS before adding contracts. Do not invent production data.
3. The environment URL exists, but runtime Settings, session bootstrap, error
   mapping and all shared UI/services are still unimplemented.
4. Release HTTP configuration, signing, receipt viewing/downloading and the
   release build/copy workflow still need implementation and device verification.
5. Player detail has no dedicated APP read endpoint: APP-30 supplies known roster
   fields, APP-33 supplies history and APP-02 identifies self. Resolve missing
   player fields/lookup and existing-player role updates with the backend owner.
6. Backend APP/RT availability was not exercised in this documentation review.
   Screen prototypes can use clearly identified contract-shaped fixtures later;
   functional completion requires real backend integration.

Open-question defaults in REQUIREMENTS section 12.2 remain unchanged. The next
phase can design the common shell and Login/Settings, then the three judged
journeys: standings to match, store to receipt, and roster to offline sync.
