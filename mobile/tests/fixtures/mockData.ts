/**
 * Synthetic frontend fixtures, never live data or an authentication bypass.
 * MOB-01..12; APP-02/10/11/13/16/30/33/50/51; API-10/17.
 * See mobile/MOCK-DATA.md for imports, screen mapping and contract gaps.
 * Sport/event literals intentionally live in test fixtures (AGENTS section 3).
 */
export type Role = 'super_admin' | 'league_organizer' | 'club_manager' | 'player' | 'viewer';
export type MatchStatus = 'upcoming' | 'in_progress' | 'completed' | 'postponed' | 'abandoned' | 'cancelled';
export type EventType = 'match_start' | 'score' | 'discipline' | 'compensation' | 'match_end';
export type Page<T> = { data: T[]; total: number; limit: number; offset: number };
export type User = {
  user_id: string; email: string; display_name: string; role: Role;
  tenant_id: string | null; league_ids: string[]; club_id: string | null; player_id: string | null;
};
export type ScoreEventRequest = {
  event_id: string; match_id: string; type: EventType; payload: Record<string, string | number>;
};
export type RosterRequest = {
  request_id: string; league_id: string; player_id: string; type: 'transfer' | 'loan' | 'release';
  from_squad_id: string; to_squad_id: string | null; effective_date: string;
  loan_end_date: string | null; reason: string; requested_by: string;
};
export type QueueAction = {
  action_id: string; queued_at: string; base_version: number;
} & ({ type: 'score_event'; payload: ScoreEventRequest } | { type: 'roster_transfer'; payload: RosterRequest });
export type ApiError = { error: { code: string; message: string; details: Record<string, unknown> } };

// Shape-only sentinel: deliberately NOT an HMAC. Never use for verification.
const unsigned = '0'.repeat(64);
const snapshotAt = '2026-10-17T07:15:00Z';
const tenant = {
  tenant_id: 'tenant-alpha', name: 'Alpha Sports', logo_url: '',
  colors: { primary: '#163D32', secondary: '#F2D675' },
};
const otherTenant = {
  tenant_id: 'tenant-beta', name: 'Beta Athletics', logo_url: '',
  colors: { primary: '#243B64', secondary: '#E7EEF8' },
};
const users: Record<Role, User> = {
  super_admin: { user_id: 'demo-admin', email: 'admin@nascon.test', display_name: 'Platform Admin', role: 'super_admin', tenant_id: null, league_ids: [], club_id: null, player_id: null },
  league_organizer: { user_id: 'demo-organizer', email: 'organizer@nascon.test', display_name: 'Sara Ahmed', role: 'league_organizer', tenant_id: tenant.tenant_id, league_ids: ['league-alpha-1'], club_id: null, player_id: null },
  club_manager: { user_id: 'demo-manager', email: 'manager@nascon.test', display_name: 'Hassan Raza', role: 'club_manager', tenant_id: tenant.tenant_id, league_ids: [], club_id: 'club-alpha-1', player_id: null },
  player: { user_id: 'demo-player', email: 'player@nascon.test', display_name: 'Ali Khan', role: 'player', tenant_id: tenant.tenant_id, league_ids: [], club_id: 'club-alpha-1', player_id: 'player-alpha-1' },
  viewer: { user_id: 'demo-viewer', email: 'viewer@nascon.test', display_name: 'Ayesha Malik', role: 'viewer', tenant_id: tenant.tenant_id, league_ids: [], club_id: null, player_id: null },
};

function page<T>(data: T[]): Page<T> {
  return { data, total: data.length, limit: 50, offset: 0 };
}

const leagues = [
  { league_id: 'league-alpha-1', name: 'Alpha Campus League', sport_id: 'football', tenant_id: tenant.tenant_id, season: '2026' },
  { league_id: 'league-alpha-2', name: 'Alpha Invitational', sport_id: 'basketball', tenant_id: tenant.tenant_id, season: '2026' },
];
const product = {
  product_id: 'prod-jersey-001', name: 'Alpha Club Jersey', category: 'apparel', image_url: '',
  variants: [
    { variant_id: 'var-jersey-001-M', size: 'M', color: 'Forest', price_minor: 450000, stock: 1 },
    { variant_id: 'var-jersey-001-L', size: 'L', color: 'Forest', price_minor: 450000, stock: 5 },
  ],
};
const products = [product,
  { product_id: 'demo-scarf', name: 'Alpha Supporter Scarf', category: 'accessory', image_url: '', variants: [
    { variant_id: 'demo-scarf-one', size: 'One size', color: 'Forest', price_minor: 120000, stock: 0 },
  ] },
  { product_id: 'demo-programme', name: 'Season Programme PDF', category: 'digital', image_url: '', variants: [
    { variant_id: 'demo-programme-pdf', size: 'Digital', color: 'N/A', price_minor: 30000, stock: 50 },
  ] },
];

type TimelineEvent = {
  sequence: number; event_id: string; type: EventType; payload: Record<string, string | number>;
  signature: string; compensated: boolean; compensated_by: string | null;
};
function event(sequence: number, eventId: string, type: EventType, payload: TimelineEvent['payload'] = {}, compensatedBy: string | null = null): TimelineEvent {
  return { sequence, event_id: eventId, type, payload, signature: unsigned, compensated: compensatedBy !== null, compensated_by: compensatedBy };
}
// Registered league fixtures start at version zero: no implicit match_init.
const completedEvents = [
  event(1, 'demo-done-start', 'match_start'),
  event(2, 'demo-done-score-1', 'score', { team_id: 'demo-t1', event_type: 'goal' }),
  event(3, 'demo-done-score-2', 'score', { team_id: 'demo-t1', event_type: 'goal' }),
  event(4, 'demo-done-end', 'match_end'),
];
const liveEvents = [
  event(1, 'demo-live-start', 'match_start'),
  event(2, 'demo-live-score-1', 'score', { team_id: 'demo-t2', event_type: 'goal' }),
  event(3, 'demo-live-score-2', 'score', { team_id: 'demo-t3', event_type: 'goal' }),
  event(4, 'demo-live-score-3', 'score', { team_id: 'demo-t2', event_type: 'goal' }, 'demo-live-correction'),
  event(5, 'demo-live-correction', 'compensation', { compensates: 'demo-live-score-3', reason: 'Duplicate entry' }),
];
function side(teamId: string, score: number) {
  return { team_id: teamId, score, wickets: null, balls: null, overs: null, fair_play: 0 };
}
const matches = {
  'demo-completed': {
    match_id: 'demo-completed', sport_id: leagues[0].sport_id, league_id: leagues[0].league_id,
    status: 'completed' as MatchStatus, outcome: 'home_win', winner_team_id: 'demo-t1', tiebreak_winner_team_id: null,
    home: side('demo-t1', 2), away: side('demo-t2', 0), version: completedEvents.length, events: completedEvents,
    pinned_product: null, venue: 'Campus Ground A', scheduled_at: '2026-10-17T05:30:00Z',
  },
  'demo-live': {
    match_id: 'demo-live', sport_id: leagues[0].sport_id, league_id: leagues[0].league_id,
    status: 'in_progress' as MatchStatus, outcome: 'pending', winner_team_id: null, tiebreak_winner_team_id: null,
    home: side('demo-t2', 1), away: side('demo-t3', 1), version: liveEvents.length, events: liveEvents,
    pinned_product: product, venue: 'Campus Ground B', scheduled_at: '2026-10-17T07:00:00Z',
  },
  'demo-upcoming': {
    match_id: 'demo-upcoming', sport_id: leagues[0].sport_id, league_id: leagues[0].league_id,
    status: 'upcoming' as MatchStatus, outcome: 'pending', winner_team_id: null, tiebreak_winner_team_id: null,
    home: side('demo-t1', 0), away: side('demo-t3', 0), version: 0, events: [] as TimelineEvent[],
    pinned_product: null, venue: null, scheduled_at: null,
  },
};
const fixtures = Object.values(matches).map(match => ({
  match_id: match.match_id, home_team_id: match.home.team_id, away_team_id: match.away.team_id,
  status: match.status, scheduled_at: match.scheduled_at, venue: match.venue,
  score: { home: match.home.score, away: match.away.score }, version: match.version,
}));
// Only demo-completed counts. Live/upcoming fixtures remain in qualification math.
const standings = {
  league_id: leagues[0].league_id, sport_id: leagues[0].sport_id, qualification_spots: 1,
  table: [
    { rank: 1, team_id: 'demo-t1', played: 1, won: 1, drawn: 0, lost: 0, scored: 2, conceded: 0, diff: 2, points: 3, fair_play: 0, status: 'still_possible', resolved_by: null },
    { rank: 2, team_id: 'demo-t3', played: 0, won: 0, drawn: 0, lost: 0, scored: 0, conceded: 0, diff: 0, points: 0, fair_play: 0, status: 'still_possible', resolved_by: 'overall_diff' },
    { rank: 3, team_id: 'demo-t2', played: 1, won: 0, drawn: 0, lost: 1, scored: 0, conceded: 2, diff: -2, points: 0, fair_play: 0, status: 'still_possible', resolved_by: null },
  ],
  h2h: {
    'demo-t1': { 'demo-t2': { played: 1, points: 3, scored: 2, conceded: 0 }, 'demo-t3': { played: 0, points: 0, scored: 0, conceded: 0 } },
    'demo-t2': { 'demo-t1': { played: 1, points: 0, scored: 0, conceded: 2 }, 'demo-t3': { played: 0, points: 0, scored: 0, conceded: 0 } },
    'demo-t3': { 'demo-t1': { played: 0, points: 0, scored: 0, conceded: 0 }, 'demo-t2': { played: 0, points: 0, scored: 0, conceded: 0 } },
  },
};
const clubs = {
  'club-alpha-1': {
    club_id: 'club-alpha-1', tenant_id: tenant.tenant_id, name: 'Alpha Falcons',
    home_venue: { name: 'Campus Ground A', lat: 33.656, lng: 73.016 }, socials: {},
    staff: [{ name: 'Hassan Raza', role: 'manager' }, { name: 'Nadia Shah', role: 'coach' }],
    stats_by_season: [{ season: '2025', played: 8, won: 5, drawn: 1, lost: 2 }],
    roster: [
      { player_id: 'player-alpha-1', name: 'Ali Khan', position: 'gk', squad_id: 'demo-sq-a', role: 'captain', on_loan: false },
      { player_id: 'demo-player-3', name: 'Bilal Ahmed', position: 'forward', squad_id: 'demo-sq-a', role: 'starter', on_loan: false },
      { player_id: 'demo-player-4', name: 'Zain Malik', position: 'defender', squad_id: 'demo-sq-a', role: 'substitute', on_loan: true },
    ],
  },
  'club-alpha-2': {
    club_id: 'club-alpha-2', tenant_id: tenant.tenant_id, name: 'Alpha Rangers',
    home_venue: { name: 'Campus Ground B', lat: 33.657, lng: 73.017 }, socials: {},
    staff: [{ name: 'Omar Aziz', role: 'manager' }], stats_by_season: [],
    roster: [{ player_id: 'player-alpha-2', name: 'Hamza Noor', position: 'gk', squad_id: 'demo-sq-b', role: 'captain', on_loan: false }],
  },
};
const auditEntry = {
  audit_id: 'au-0001', action: 'loan', player_id: 'demo-player-4', league_id: leagues[0].league_id,
  from_squad_id: 'demo-sq-b', to_squad_id: 'demo-sq-a', effective_date: '2026-10-16',
  state: 'active', who: 'demo-manager', when: '2026-10-16T06:00:00Z', why: 'Short-term squad cover',
};
const rosterTransfer: RosterRequest = {
  request_id: 'demo-transfer-1', league_id: leagues[0].league_id, player_id: 'demo-player-3', type: 'transfer',
  from_squad_id: 'demo-sq-a', to_squad_id: 'demo-sq-b', effective_date: '2026-10-17', loan_end_date: null,
  reason: 'More playing time', requested_by: users.club_manager.user_id,
};
const scoreRequest: ScoreEventRequest = {
  event_id: 'demo-next-score', match_id: 'demo-live', type: 'score',
  payload: { team_id: 'demo-t2', event_type: 'goal' },
};
const compensationRequest: ScoreEventRequest = {
  event_id: 'demo-next-correction', match_id: 'demo-live', type: 'compensation',
  payload: { compensates: 'demo-live-score-2', reason: 'Incorrect team selected' },
};
const organizerActions: QueueAction[] = [
  { action_id: 'demo-score-action', type: 'score_event', queued_at: '2026-10-17T07:13:00Z', base_version: 4, payload: scoreRequest },
  { action_id: 'demo-correction-action', type: 'score_event', queued_at: '2026-10-17T07:14:00Z', base_version: 5, payload: compensationRequest },
];
const managerActions: QueueAction[] = [
  { action_id: 'demo-roster-action', type: 'roster_transfer', queued_at: '2026-10-17T07:13:00Z', base_version: 0, payload: rosterTransfer },
];
const transferAudit = {
  audit_id: 'au-0002', action: 'transfer', player_id: rosterTransfer.player_id, league_id: rosterTransfer.league_id,
  from_squad_id: rosterTransfer.from_squad_id, to_squad_id: rosterTransfer.to_squad_id,
  effective_date: rosterTransfer.effective_date, state: 'active', who: rosterTransfer.requested_by,
  when: snapshotAt, why: rosterTransfer.reason,
};
const acceptedTransfer = {
  request_id: rosterTransfer.request_id, status: 'accepted', state: 'active', blocking_match_id: null,
  registration: {
    player_id: rosterTransfer.player_id, league_id: rosterTransfer.league_id, squad_id: rosterTransfer.to_squad_id,
    parent_squad_id: null, registration_type: 'transfer', start_date: rosterTransfer.effective_date, loan_end_date: null, role: 'substitute',
  }, audit_entry: transferAudit,
};
const checkoutItems = [{ variant_id: 'var-jersey-001-M', quantity: 1, unit_price_minor: 450000 }];
const receiptPayload = {
  order_id: 'demo-order-1', customer_id: users.viewer.user_id, items: checkoutItems,
  subtotal_minor: 450000, discount_minor: 45000, total_minor: 405000, currency: 'PKR', paid_at: '2026-10-17T07:10:00Z',
};
const errors = {
  invalid_credentials: { error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.', details: {} } },
  session_expired: { error: { code: 'UNAUTHENTICATED', message: 'Your session expired. Please sign in again.', details: {} } },
  forbidden: { error: { code: 'FORBIDDEN', message: 'You do not have access to this resource.', details: {} } },
  missing_match: { error: { code: 'MATCH_NOT_FOUND', message: 'This match is no longer available.', details: {} } },
  validation: { error: { code: 'VALIDATION_ERROR', message: 'Check the highlighted fields.', details: { fields: ['name', 'position'] } } },
  out_of_stock: { error: { code: 'OUT_OF_STOCK', message: 'That size has sold out.', details: { variant_id: 'var-jersey-001-M' } } },
  squad_full: { error: { code: 'SQUAD_FULL', message: 'That squad is already full.', details: {} } },
  payment_declined: { error: { code: 'PAYMENT_DECLINED', message: 'Payment was declined. Choose another mock payment option.', details: {} } },
  capture_failed: { error: { code: 'PAYMENT_CAPTURE_FAILED', message: 'Payment could not be completed. Please try again.', details: {} } },
} satisfies Record<string, ApiError>;

export const mockData = {
  meta: {
    synthetic: true, snapshot_at: snapshotAt, default_role: 'viewer' as Role,
    default_league_id: leagues[0].league_id, default_club_id: 'club-alpha-1', default_match_id: 'demo-live',
    signatures_are_placeholders: true, images_use_local_fallback: true,
  },
  // Contract-shaped read fixtures; nested fields with unspecified schemas are
  // identified in MOCK-DATA.md. No fake JWT, login handler or network adapter.
  api: {
    me_by_role: Object.fromEntries(Object.entries(users).map(([role, user]) => [role, { user, tenant: user.tenant_id ? tenant : null }])) as Record<Role, { user: User; tenant: typeof tenant | null }>,
    leagues: page(leagues),
    fixtures_by_league: { 'league-alpha-1': page(fixtures), 'league-alpha-2': page<typeof fixtures[number]>([]) },
    matches_by_id: matches,
    standings_by_league: { 'league-alpha-1': standings },
    clubs_by_id: clubs,
    products: page(products),
    products_by_id: Object.fromEntries(products.map(item => [item.product_id, item])),
    player_history_by_id: {
      'player-alpha-1': { player_id: 'player-alpha-1', as_of: '2026-10-17', league_id: leagues[0].league_id, current_squad_id: 'demo-sq-a', parent_squad_id: null, history: [] },
      'demo-player-4': { player_id: 'demo-player-4', as_of: '2026-10-17', league_id: leagues[0].league_id, current_squad_id: 'demo-sq-a', parent_squad_id: 'demo-sq-b', history: [auditEntry] },
    },
  },
  requests: {
    score: scoreRequest, compensation: compensationRequest,
    add_player: { name: 'Usman Shah', position: 'forward', league_id: leagues[0].league_id, squad_id: 'demo-sq-a', role: 'substitute' },
    transfer: rosterTransfer,
    loan: { ...rosterTransfer, request_id: 'demo-loan-1', type: 'loan', loan_end_date: '2026-10-24' } satisfies RosterRequest,
    release: { ...rosterTransfer, request_id: 'demo-release-1', type: 'release', to_squad_id: null } satisfies RosterRequest,
    checkout: { order_id: 'demo-order-1', customer_id: users.viewer.user_id, items: [{ variant_id: 'var-jersey-001-M', quantity: 1 }], discount_code: 'WELCOME10', payment: { token: 'tok_success' } },
    pin: { product_id: product.product_id }, unpin: { product_id: null },
    edit_player: { name: 'Ali Khan', position: 'gk' },
  },
  // Alternative outcomes, not simultaneous mutations of the read snapshot.
  outcomes: {
    transfer_accepted: acceptedTransfer,
    transfer_deferred: { ...acceptedTransfer, state: 'deferred_until_match_end', blocking_match_id: 'demo-live', audit_entry: { ...transferAudit, state: 'deferred_until_match_end' } },
    organizer_sync: {
      device_id: 'demo-organizer-device', results: [
        { action_id: organizerActions[0].action_id, status: 'applied', resolution: 'rebased_append', error_code: null, processed_order: 1, server_version: 6, signature: unsigned },
        { action_id: organizerActions[1].action_id, status: 'applied', resolution: 'rebased_append', error_code: null, processed_order: 2, server_version: 7, signature: unsigned },
      ], summary: { applied: 2, rejected: 0, duplicate: 0 },
    },
    manager_sync_rejected: {
      device_id: 'demo-manager-device', results: [
        { action_id: managerActions[0].action_id, status: 'rejected', resolution: 'server_wins', error_code: 'SQUAD_FULL', processed_order: 1, server_version: 0, signature: null },
      ], summary: { applied: 0, rejected: 1, duplicate: 0 },
    },
    manager_sync_applied: {
      device_id: 'demo-manager-device', results: [
        { action_id: managerActions[0].action_id, status: 'applied', resolution: 'appended', error_code: null, processed_order: 1, server_version: 1, signature: null },
      ], summary: { applied: 1, rejected: 0, duplicate: 0 },
    },
    manager_sync_duplicate: {
      device_id: 'demo-manager-device', results: [
        { action_id: managerActions[0].action_id, status: 'duplicate', resolution: 'skipped_duplicate', error_code: null, processed_order: 1, server_version: 1, signature: null },
      ], summary: { applied: 0, rejected: 0, duplicate: 1 },
    },
  },
  errors,
  // UI-only data and unresolved contract fields. Never spread into HTTP bodies.
  prototype: {
    tenant_options: [tenant, otherTenant],
    team_labels: { 'demo-t1': 'Falcons XI', 'demo-t2': 'Rangers XI', 'demo-t3': 'Campus United' },
    club_options: Object.values(clubs).map(club => ({ club_id: club.club_id, name: club.name, tenant_id: club.tenant_id })),
    squads: [
      { squad_id: 'demo-sq-a', club_id: 'club-alpha-1', league_id: leagues[0].league_id, tenant_id: tenant.tenant_id, name: 'Falcons First Squad' },
      { squad_id: 'demo-sq-b', club_id: 'club-alpha-2', league_id: leagues[0].league_id, tenant_id: tenant.tenant_id, name: 'Rangers First Squad' },
    ],
    // Explicit prototype relation: teams must not be inferred to be clubs.
    team_squad_links: [
      { team_id: 'demo-t1', squad_id: 'demo-sq-b' },
      { team_id: 'demo-t2', squad_id: 'demo-sq-a' },
    ],
    sport_config: {
      sport_id: leagues[0].sport_id, name: 'Football', scoring_model: 'event',
      periods: { count: 2, duration_minutes: 45 }, scoring_events: { goal: { points: 1 } },
      draw_allowed: true, overtime: { policy: 'none' },
      tie_break_order: ['h2h_points', 'h2h_diff', 'overall_diff', 'scored', 'fair_play', 'draw_lots'],
      roster: { min_squad_size: 11, max_squad_size: 25, required_positions: { gk: 1 } },
    },
    transfer_window: { open: '2026-10-01', close: '2026-10-31' },
    player_loan_end_dates: { 'demo-player-4': '2026-10-24' },
    qualification_examples: [
      { status: 'clinched', label: 'Qualified' }, { status: 'still_possible', label: 'Still in contention' }, { status: 'eliminated', label: 'Eliminated' },
    ],
    cart: { items: [{ variant_id: 'var-jersey-001-M', quantity: 1 }], estimated_subtotal_minor: 450000, currency: 'PKR' },
    // APP-53 order details and APP-13 product-summary fields are not fully specified.
    orders: [{ order_id: 'demo-order-1', customer_id: users.viewer.user_id, status: 'paid', currency: 'PKR', items: checkoutItems, subtotal_minor: 450000, discount_minor: 45000, total_minor: 405000, paid_at: receiptPayload.paid_at }],
    receipt: { payload: receiptPayload, signature: unsigned, pdf_base64: null, availability: 'preview_only' },
    payment_choices: [
      { token: 'tok_success', label: 'Successful mock payment' },
      { token: 'tok_declined', label: 'Declined mock payment' },
      { token: 'tok_capture_fail', label: 'Failed mock capture' },
    ],
    settings: { server_base_url: 'http://10.0.2.2:8080' },
    // A queue belongs to one principal/server, not a combined role demo queue.
    offline_sessions: {
      organizer: { scope: { user_id: users.league_organizer.user_id, tenant_id: tenant.tenant_id, server_base_url: 'http://10.0.2.2:8080' }, request: { device_id: 'demo-organizer-device', actions: organizerActions } },
      manager: { scope: { user_id: users.club_manager.user_id, tenant_id: tenant.tenant_id, server_base_url: 'http://10.0.2.2:8080' }, request: { device_id: 'demo-manager-device', actions: managerActions } },
    },
    ui_states: {
      loading: { status: 'loading', message: 'Loading your fixtures…' },
      empty: { status: 'empty', message: 'No matches yet.', fixtures: page<typeof fixtures[number]>([]) },
      error: { status: 'error', message: 'Could not load your fixtures. Please try again.', retry_label: 'Try again' },
      success: { status: 'success', message: 'Roster request accepted.' },
      offline: { status: 'offline', message: 'Offline · Showing saved data', cached_at: snapshotAt, fixtures: page(fixtures) },
      syncing: { status: 'syncing', message: 'Syncing 2 pending actions…', pending_count: 2 },
      pending: { status: 'pending', message: 'Saved on this device. Waiting to sync.' },
      deferred: { status: 'deferred', message: 'Accepted. Takes effect after the current match ends.' },
      rejected: { status: 'rejected', message: errors.squad_full.error.message },
    },
  },
};

/** Fresh mutable copy for component state; one preview cannot corrupt another. */
export function createMockData(): typeof mockData {
  return JSON.parse(JSON.stringify(mockData)) as typeof mockData;
}
