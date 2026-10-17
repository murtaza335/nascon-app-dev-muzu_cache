'use strict';
// Baseline data (REQUIREMENTS §8.1 API-02). This is the ONLY module where sport and event names may appear (FR-1.1-05).
const { demoPasswordHash } = require('./passwords');
const { validateSport } = require('../domain/scoring/sportSchema');
const { insertSport } = require('../repos/sports');
const config = require('../config');

const DEFAULT_TIE_BREAK = ['h2h_points', 'h2h_diff', 'overall_diff', 'scored', 'fair_play', 'draw_lots'];

const SPORTS = [
  {
    sport_id: 'football', name: 'Football', scoring_model: 'event',
    config: {
      name: 'Football', scoring_model: 'event', periods: { count: 2, duration_minutes: 45 },
      scoring_events: { goal: { points: 1 } }, draw_allowed: true, overtime: { policy: 'none' },
      tie_break_order: DEFAULT_TIE_BREAK,
      roster: { min_squad_size: 11, max_squad_size: 25, required_positions: { gk: 1 } },
    },
  },
  {
    sport_id: 'basketball', name: 'Basketball', scoring_model: 'event',
    config: {
      name: 'Basketball', scoring_model: 'event', periods: { count: 4, duration_minutes: 12 },
      scoring_events: { free_throw: { points: 1 }, two_pointer: { points: 2 }, three_pointer: { points: 3 } },
      draw_allowed: false, overtime: { policy: 'extra_time', duration_minutes: 5 },
      tie_break_order: DEFAULT_TIE_BREAK,
      roster: { min_squad_size: 5, max_squad_size: 15, required_positions: {} },
    },
  },
  {
    sport_id: 'cricket', name: 'Cricket', scoring_model: 'innings',
    config: {
      name: 'Cricket', scoring_model: 'innings',
      periods: { innings_per_team: 1, overs_per_innings: 20, balls_per_over: 6, wickets_per_innings: 10 },
      scoring_events: {
        dot_ball: { runs: 0, legal_ball: true, wicket: false },
        single: { runs: 1, legal_ball: true, wicket: false },
        two: { runs: 2, legal_ball: true, wicket: false },
        four: { runs: 4, legal_ball: true, wicket: false },
        six: { runs: 6, legal_ball: true, wicket: false },
        wide: { runs: 1, legal_ball: false, wicket: false },
        no_ball: { runs: 1, legal_ball: false, wicket: false },
        wicket: { runs: 0, legal_ball: true, wicket: true },
      },
      draw_allowed: true, overtime: { policy: 'super_over' },
      tie_break_order: DEFAULT_TIE_BREAK,
      roster: { min_squad_size: 11, max_squad_size: 18, required_positions: { wicketkeeper: 1 } },
    },
  },
  {
    sport_id: 'esports', name: 'Esports', scoring_model: 'round',
    config: {
      name: 'Esports', scoring_model: 'round', periods: { best_of: 3 },
      scoring_events: { round_win: { rounds: 1 } }, draw_allowed: false, overtime: { policy: 'none' },
      tie_break_order: DEFAULT_TIE_BREAK,
      roster: { min_squad_size: 5, max_squad_size: 8, required_positions: {} },
    },
  },
];

const TENANTS = [
  { tenant_id: 'tenant-alpha', name: 'Alpha Sports', logo_url: null, colors: { primary: '#0B5FFF', secondary: '#FFB800' } },
  { tenant_id: 'tenant-beta', name: 'Beta Athletics', logo_url: null, colors: { primary: '#0A7D4F', secondary: '#E8F5EE' } },
];

const CLUBS = [
  { club_id: 'club-alpha-1', tenant_id: 'tenant-alpha', name: 'Alpha Lions', home_venue: { name: 'Alpha Arena', lat: 31.5204, lng: 74.3587 }, socials: { twitter: '@alphalions' }, staff: [{ name: 'Sara Khan', role: 'manager' }, { name: 'Bilal Ahmed', role: 'coach' }] },
  { club_id: 'club-alpha-2', tenant_id: 'tenant-alpha', name: 'Alpha Hawks', home_venue: { name: 'Hawk Park', lat: 33.6844, lng: 73.0479 }, socials: {}, staff: [{ name: 'Usman Raza', role: 'coach' }] },
  { club_id: 'club-beta-1', tenant_id: 'tenant-beta', name: 'Beta Bulls', home_venue: { name: 'Bull Ground', lat: 24.8607, lng: 67.0011 }, socials: {}, staff: [{ name: 'Hina Malik', role: 'manager' }] },
];

const PLAYERS = [
  { player_id: 'player-alpha-1', name: 'Ali Alpha', position: 'gk', club_id: 'club-alpha-1' },
  { player_id: 'player-alpha-2', name: 'Omar Alpha', position: 'fw', club_id: 'club-alpha-2' },
  { player_id: 'player-beta-1', name: 'Zain Beta', position: 'mf', club_id: 'club-beta-1' },
];

const LEAGUES = [
  { league_id: 'league-alpha-1', tenant_id: 'tenant-alpha', name: 'Alpha League 1' },
  { league_id: 'league-alpha-2', tenant_id: 'tenant-alpha', name: 'Alpha League 2' },
  { league_id: 'league-beta-1', tenant_id: 'tenant-beta', name: 'Beta League 1' },
];

// Demo accounts (DEL-08): all use the same password.
const USERS = [
  { user_id: 'user-super-admin', email: 'admin@nascon.test', display_name: 'Platform Admin', role: 'super_admin', tenant_id: null, league_ids: [], club_id: null, player_id: null },
  { user_id: 'user-organizer', email: 'organizer@nascon.test', display_name: 'League Organizer', role: 'league_organizer', tenant_id: 'tenant-alpha', league_ids: ['league-alpha-1'], club_id: null, player_id: null },
  { user_id: 'user-club-manager', email: 'manager@nascon.test', display_name: 'Club Manager', role: 'club_manager', tenant_id: 'tenant-alpha', league_ids: [], club_id: 'club-alpha-1', player_id: null },
  { user_id: 'user-player', email: 'player@nascon.test', display_name: 'Ali Alpha', role: 'player', tenant_id: 'tenant-alpha', league_ids: [], club_id: 'club-alpha-1', player_id: 'player-alpha-1' },
  { user_id: 'user-viewer', email: 'viewer@nascon.test', display_name: 'General Viewer', role: 'viewer', tenant_id: 'tenant-alpha', league_ids: [], club_id: null, player_id: null },
];

const VARIANTS = [
  { variant_id: 'var-jersey-001-M', size: 'M', color: 'blue', price_minor: 450000, stock: 1 },
  { variant_id: 'var-jersey-001-L', size: 'L', color: 'blue', price_minor: 450000, stock: 5 },
];

const DEFAULT_SEED = 42;
const BASELINE_VERSION = '1';

function defaultStock() {
  return Object.fromEntries(VARIANTS.map((v) => [v.variant_id, v.stock]));
}

// Inserts the whole baseline inside the caller's transaction. Works on a wiped or a fresh database.
async function seedBaseline(client, { seed = DEFAULT_SEED, stock = {} } = {}) {
  const q = (text, params) => client.query(text, params);

  for (const s of SPORTS) {
    // Same validation and normalization as POST /audit/v1/sports (FR-1.1-02).
    const r = validateSport({ sport_id: s.sport_id, ...s.config });
    if (!r.ok) throw new Error(`seed sport ${s.sport_id} is invalid: ${JSON.stringify(r.details)}`);
    await insertSport(client, r.value, true);
  }
  for (const t of TENANTS) {
    await q('INSERT INTO tenants (tenant_id, name, logo_url, colors) VALUES ($1,$2,$3,$4)',
      [t.tenant_id, t.name, t.logo_url, JSON.stringify(t.colors)]);
  }
  for (const c of CLUBS) {
    await q('INSERT INTO clubs (club_id, tenant_id, name, home_venue, socials, staff) VALUES ($1,$2,$3,$4,$5,$6)',
      [c.club_id, c.tenant_id, c.name, JSON.stringify(c.home_venue), JSON.stringify(c.socials), JSON.stringify(c.staff)]);
  }
  for (const p of PLAYERS) {
    await q('INSERT INTO players (player_id, name, position, club_id) VALUES ($1,$2,$3,$4)', [p.player_id, p.name, p.position, p.club_id]);
  }
  const base = SPORTS[0];
  for (const l of LEAGUES) {
    await q(
      `INSERT INTO leagues (league_id, tenant_id, sport_id, name, tie_break_order, lots_seed, max_squad_size, required_positions, organizer_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [l.league_id, l.tenant_id, base.sport_id, l.name, base.config.tie_break_order, seed,
        base.config.roster.max_squad_size, JSON.stringify(base.config.roster.required_positions),
        l.league_id === 'league-alpha-1' ? 'user-organizer' : null]);
  }
  const hash = demoPasswordHash();
  for (const u of USERS) {
    await q(
      `INSERT INTO users (user_id, email, password_hash, display_name, role, tenant_id, league_ids, club_id, player_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [u.user_id, u.email, hash, u.display_name, u.role, u.tenant_id, u.league_ids, u.club_id, u.player_id]);
  }
  await q(`INSERT INTO products (product_id, tenant_id, club_id, name, category, description)
           VALUES ('prod-jersey-001','tenant-alpha','club-alpha-1','Alpha Lions Home Jersey','apparel','Official home jersey')`);
  for (const v of VARIANTS) {
    await q('INSERT INTO variants (variant_id, product_id, size, color, price_minor, stock, reserved) VALUES ($1,$2,$3,$4,$5,$6,0)',
      [v.variant_id, 'prod-jersey-001', v.size, v.color, v.price_minor, Object.hasOwn(stock, v.variant_id) ? stock[v.variant_id] : v.stock]);
  }
  await q("INSERT INTO discount_codes (code, percent, active) VALUES ('WELCOME10', 10, true)");
  await q("INSERT INTO counters (name, value) VALUES ('auth', 0), ('cap', 0)");
  await q(`INSERT INTO app_state (key, value) VALUES ('last_reset_seed', $1), ('baseline_version', $2)`, [String(seed), BASELINE_VERSION]);
  if (config.seedDemoData) await require('./demo').seedDemo(client); // OFF for the grader
}

module.exports = { seedBaseline, defaultStock, VARIANTS, SPORTS, TENANTS, DEFAULT_SEED, BASELINE_VERSION };
