# Frontend mock data

Use [`tests/fixtures/mockData.ts`](tests/fixtures/mockData.ts) to populate initial
screen layouts. Everything is synthetic; this does not seed the backend, log in,
make requests, persist data or implement sync. No runtime dependencies are added.

The fixture lives under tests because AGENTS section 3 permits sport/event name
literals only in seed data and tests. Import it explicitly for prototypes; replace
those imports with services during integration. There is no automatic fallback.

## Usage

From `src/features/fixtures/FixturesScreen.tsx`, inside the screen component:

```tsx
import { useState } from 'react';
import { createMockData } from '../../../tests/fixtures/mockData';

const [data] = useState(createMockData);
const fixtures = data.api.fixtures_by_league['league-alpha-1'].data;
const account = data.api.me_by_role.viewer;
const match = data.api.matches_by_id['demo-live'];
```

For read-only previews import `mockData` directly. Do not mutate the shared export;
`createMockData()` returns an independent mutable copy for each screen/session.
Fixtures do not filter by principal, status, club or tenant automatically. Select
the appropriate records explicitly. Real authorization must come from services.

| Screens in SCREEN-PLAN | Data |
|---|---|
| S01 Login, S07 Account | `api.me_by_role` contains all five roles and scopes; no fake login token. |
| S02 Settings | `prototype.settings`. |
| S03 Fixtures | `api.leagues`, `api.fixtures_by_league`, `prototype.team_labels`. Second league is empty. |
| S04 Standings | `api.standings_by_league`, `prototype.qualification_examples`. |
| S05 Match Detail | `api.matches_by_id`: completed, live with compensated event/pinned product, upcoming with null time/venue. |
| S06 Club Profile, S08 Player Profile | `api.clubs_by_id`, `api.player_history_by_id`; known player fields come from club rosters. |
| S09 Store, S10 Product | `api.products`, `api.products_by_id`: sizes, stock and sold-out accessory. |
| S11 Cart, S12 Checkout | `prototype.cart`, `prototype.payment_choices`, `requests.checkout`. |
| S13 Receipt, S14 Orders, S15 Order Detail | `prototype.receipt`, `prototype.orders`; preview only. |
| S16 Roster, S17 Add Player, S18 Roster Action | Club roster, `prototype.squads`, `requests.add_player/transfer/loan/release`, `outcomes.transfer_accepted/transfer_deferred`. |
| S19 Scoring, S20 Compensation | `prototype.sport_config`, live timeline, `requests.score/compensation`; event choices come from config. |
| S21 Sync Status | `prototype.offline_sessions`, `outcomes.organizer_sync`, manager applied/rejected/duplicate alternatives. |
| All screens | `prototype.ui_states`: loading, empty, error/retry, success, offline, syncing, pending, deferred, rejected; sample API envelopes in `errors`. |

## Contract boundaries and remaining gaps

- `api` follows REQUIREMENTS sections 7/8.2: lists use
  `{data,total,limit,offset}` (50/0 defaults), names use snake_case, money is
  integer paisa and timestamps are UTC without milliseconds. Detail objects are
  unwrapped. These are hand-checked fixtures, not generated API types.
- `requests` follows documented mutation bodies. `customer_id` and `requested_by`
  illustrate API-12/API-10; production services set them from the caller.
- `outcomes` contains independent alternatives, not simultaneous changes to the
  read snapshot. The rejected manager scenario assumes a destination that filled
  before replay. Accepted/deferred results do not mutate the initial roster.
- `prototype` contains local state and unresolved read fields: tenant/club/squad
  discovery, team names and explicit team-to-squad links, sport config, loan end
  dates, detailed orders and PDF availability. No new endpoint or open-question
  default is established. `stats_by_season` items and the pinned product summary
  also use provisional nested shapes; complete fields are not defined in APP-30/13.
- Tenant logos and product images are empty strings; render local fallbacks.
  Sample tenant colors do not replace the app palette in DESIGN-BRIEF.
- Signatures contain 64 zero characters: unsigned placeholders, never valid
  HMACs. No JWT, password, signing key or PDF is supplied. The prototype receipt
  has `pdf_base64:null`, so it is not an APP-52 success response. Real checkout and
  download must use backend-confirmed totals, signatures and PDF bytes.
- Organizer/Manager queues have separate user/server/tenant scopes. Only their
  inner `request` has the APP-40 envelope. Fixed IDs/times support repeatable
  previews, not live writes. Persistence, retry and session handling remain unbuilt.
- The roster is shortened for layout work, not a full competition-ready squad.
  Its sample active loan ends on 2026-10-24.

## Markdown review (2026-10-17)

Read all seven root Markdown files and all four mobile Markdown files present
during the review, plus the required implementation plan. Dependency/generated
Markdown is excluded. DESIGN-BRIEF appeared during this task and was included.

| Document | Finding used here |
|---|---|
| `AGENTS.md` | Keep sport/event data in tests; document structure and verification. |
| `REQUIREMENTS.md` | Owns MOB-01–12, APP shapes, pagination, money, UTC, compensation and queue envelopes. Section 12.2 defaults unchanged. |
| `ARCHITECTURE.md` | Retain feature/service boundaries; fixtures do not implement planned services. |
| `ADR.md` | ADR-017 records existing Expo scaffold and planned native capabilities. |
| `TRACEABILITY.md` | Fixture checks do not establish functional acceptance; requirement statuses stay Todo. |
| `PRODUCT.md` | Five-role Android context, tenant identity, judged journeys, explicit pending/deferred/rejected state. |
| `README.md` | Already labels backend examples as legacy: port 3000, old errors and Node 20 describe the starter, not mobile target contracts. |
| `mobile/AGENTS.md` | Strict TypeScript, approved dependencies and existing feature boundaries. |
| `mobile/README.md` | Scaffold commands/public API URL; no implemented offline claim. |
| `mobile/SCREEN-PLAN.md` | All 21 primary screens mapped above; discovery/player/role-edit gaps stay visible. |
| `mobile/DESIGN-BRIEF.md` | Respect chronological fixtures, sequence-only timeline, null states and image fallbacks; no invented clock, video or audience data. |

The already documented starter/target mismatch and incomplete production reads
remain integration risks. No new contract/default change was needed. Concurrent
screen-planning work was preserved; these exports are available for its future
preview-data adapter, which is outside this data-file task.

## Verification

From `mobile/` run `npm run typecheck` and `npm run test:mock-data`.
Six fixture checks cover event/score relationships, standings, prices, scoped
roster references, sync versions/results, UTC/list shapes and copy isolation.
They use Node built-ins and the existing TypeScript dev dependency. Backend API,
SQLite/force-close, visual/device and APK checks remain for functional integration.
