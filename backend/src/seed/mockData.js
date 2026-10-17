'use strict';
// Small, realistic mock data set for demos and the desk check. Run it with scripts/seed-mock-data.sh (or
// `node src/seed/mockData.js` inside the backend container). It writes through the application's own services, so every
// event is signed with DAY1_SALT and caches/outbox stay consistent. Safe to re-run (skips if already present).
// Everything lands in tenant-alpha / league-alpha-2; ids are prefixed `mock-`. `POST /audit/v1/reset` wipes it again.
const { pool, query } = require('../db');
const cache = require('../cache');
const roster = require('../services/roster');
const events = require('../services/events');
const store = require('../services/store');
const { AppError } = require('../errors');

const LEAGUE = 'league-alpha-2';
const TENANT = 'tenant-alpha';

const SQUADS = [
  { squad_id: 'sq-lions', club_id: 'club-alpha-1', name: 'Alpha Lions' },
  { squad_id: 'sq-hawks', club_id: 'club-alpha-2', name: 'Alpha Hawks' },
  { squad_id: 'sq-eagles', club_id: 'club-mock-1', name: 'Islamabad Eagles' },
  { squad_id: 'sq-royals', club_id: 'club-mock-2', name: 'Multan Royals' },
];

const EXTRA_CLUBS = [
  { club_id: 'club-mock-1', name: 'Islamabad Eagles', home_venue: { name: 'Jinnah Sports Ground', lat: 33.7077, lng: 73.0498 }, socials: { instagram: '@isb_eagles' }, staff: [{ name: 'Tariq Mehmood', role: 'coach' }, { name: 'Dr. Ayesha Farooq', role: 'physio' }] },
  { club_id: 'club-mock-2', name: 'Multan Royals', home_venue: { name: 'Qasim Bagh Stadium', lat: 30.1978, lng: 71.4697 }, socials: { instagram: '@multan_royals' }, staff: [{ name: 'Nadeem Akram', role: 'manager' }] },
];

// [id, name, position, squad, role]
const PLAYERS = [
  ['mock-p-01', 'Ahmed Raza', 'gk', 'sq-lions', 'captain'], ['mock-p-02', 'Hamza Yousuf', 'df', 'sq-lions', 'starter'],
  ['mock-p-03', 'Bilal Anwar', 'df', 'sq-lions', 'vice_captain'], ['mock-p-04', 'Saad Qureshi', 'mf', 'sq-lions', 'starter'],
  ['mock-p-05', 'Usman Tariq', 'fw', 'sq-lions', 'starter'],
  ['mock-p-06', 'Faizan Malik', 'gk', 'sq-hawks', 'starter'], ['mock-p-07', 'Zain Abbas', 'df', 'sq-hawks', 'captain'],
  ['mock-p-08', 'Danish Mirza', 'mf', 'sq-hawks', 'starter'], ['mock-p-09', 'Hassan Javed', 'mf', 'sq-hawks', 'substitute'],
  ['mock-p-10', 'Talha Siddiqui', 'fw', 'sq-hawks', 'starter'],
  ['mock-p-11', 'Rehan Akhtar', 'gk', 'sq-eagles', 'starter'], ['mock-p-12', 'Imran Sheikh', 'df', 'sq-eagles', 'captain'],
  ['mock-p-13', 'Kamran Bashir', 'mf', 'sq-eagles', 'starter'], ['mock-p-14', 'Shahid Noor', 'fw', 'sq-eagles', 'starter'],
  ['mock-p-15', 'Adeel Hussain', 'gk', 'sq-royals', 'starter'], ['mock-p-16', 'Waqas Ahmed', 'df', 'sq-royals', 'vice_captain'],
  ['mock-p-17', 'Junaid Khalid', 'mf', 'sq-royals', 'captain'], ['mock-p-18', 'Naveed Iqbal', 'fw', 'sq-royals', 'starter'],
];

// Goals: [minute, scoring squad, scorer id]. `extra` entries: ['card', squad, points, minute] or ['void', index-of-goal].
const MATCHES = [
  { id: 'mock-m1', home: 'sq-lions', away: 'sq-hawks', at: '2026-10-03T14:00:00Z', state: 'done',
    goals: [[23, 'sq-lions', 'mock-p-05'], [41, 'sq-hawks', 'mock-p-10'], [78, 'sq-lions', 'mock-p-04']] },
  { id: 'mock-m2', home: 'sq-eagles', away: 'sq-royals', at: '2026-10-03T16:30:00Z', state: 'done', goals: [] },
  { id: 'mock-m3', home: 'sq-royals', away: 'sq-lions', at: '2026-10-10T14:00:00Z', state: 'done',
    goals: [[12, 'sq-lions', 'mock-p-05'], [34, 'sq-royals', 'mock-p-18'], [58, 'sq-lions', 'mock-p-04'], [66, 'sq-lions', 'mock-p-05'], [81, 'sq-lions', 'mock-p-02']],
    extra: [['void', 4]] },
  { id: 'mock-m4', home: 'sq-hawks', away: 'sq-eagles', at: '2026-10-10T16:30:00Z', state: 'done',
    goals: [[19, 'sq-hawks', 'mock-p-10'], [52, 'sq-eagles', 'mock-p-14'], [63, 'sq-hawks', 'mock-p-08'], [88, 'sq-eagles', 'mock-p-13']],
    extra: [['card', 'sq-eagles', -1, 47]] },
  { id: 'mock-m5', home: 'sq-lions', away: 'sq-eagles', at: '2026-10-17T15:00:00Z', state: 'live', goals: [[17, 'sq-lions', 'mock-p-05']] },
  { id: 'mock-m6', home: 'sq-hawks', away: 'sq-royals', at: '2026-10-24T15:00:00Z', state: 'upcoming', goals: [] },
];

async function post(body) {
  const r = await events.appendEvent(body, JSON.stringify(body));
  return r.body;
}

async function playMatch(m) {
  if (m.state === 'upcoming') return;
  const mk = (n, type, payload) => ({ event_id: `${m.id}-e${n}`, match_id: m.id, type, payload });
  let n = 0;
  await post(mk(++n, 'match_start', {}));
  const goalEvents = [];
  const timeline = [
    ...m.goals.map((g, i) => ({ minute: g[0], kind: 'goal', i, g })),
    ...(m.extra || []).filter((x) => x[0] === 'card').map((x) => ({ minute: x[3], kind: 'card', x })),
  ].sort((a, b) => a.minute - b.minute);
  for (const t of timeline) {
    if (t.kind === 'goal') {
      const body = mk(++n, 'score', { team_id: t.g[1], event_type: 'goal', player_id: t.g[2], minute: t.g[0] });
      await post(body);
      goalEvents[t.i] = body.event_id;
    } else {
      await post(mk(++n, 'discipline', { team_id: t.x[1], points: t.x[2], reason: 'yellow card', minute: t.x[3] }));
    }
  }
  for (const x of m.extra || []) {
    if (x[0] === 'void') await post(mk(++n, 'compensation', { compensates: goalEvents[x[1]], reason: 'Goal disallowed after VAR review (offside)' }));
  }
  if (m.state === 'done') await post(mk(++n, 'match_end', {}));
}

async function seedStore() {
  await query(`INSERT INTO products (product_id, tenant_id, club_id, name, category, description) VALUES
    ('mock-prod-hoodie', $1, 'club-alpha-1', 'Alpha Lions Training Hoodie', 'apparel', 'Heavyweight fleece hoodie with embroidered crest'),
    ('mock-prod-cap', $1, 'club-alpha-1', 'Match Day Cap', 'accessory', 'Adjustable cotton cap'),
    ('mock-prod-pass', $1, 'club-alpha-1', 'Season Pass 2026/27 (digital)', 'digital', 'Digital pass for all home fixtures')`, [TENANT]);
  await query(`INSERT INTO variants (variant_id, product_id, size, color, price_minor, stock) VALUES
    ('mock-var-hoodie-S', 'mock-prod-hoodie', 'S', 'charcoal', 380000, 12), ('mock-var-hoodie-M', 'mock-prod-hoodie', 'M', 'charcoal', 380000, 20),
    ('mock-var-hoodie-L', 'mock-prod-hoodie', 'L', 'charcoal', 380000, 18), ('mock-var-hoodie-XL', 'mock-prod-hoodie', 'XL', 'charcoal', 380000, 8),
    ('mock-var-cap-black', 'mock-prod-cap', 'OS', 'black', 120000, 40), ('mock-var-cap-red', 'mock-prod-cap', 'OS', 'red', 120000, 25),
    ('mock-var-pass', 'mock-prod-pass', NULL, NULL, 750000, 200)`);
  // A scheduled price rise (applied automatically at checkout time from 1 Dec 2026).
  await query(`INSERT INTO price_schedules (variant_id, effective_from, price_minor)
    SELECT variant_id, '2026-12-01T00:00:00Z', 420000 FROM variants WHERE product_id = 'mock-prod-hoodie'`);

  const order = (id, customer, items, code, token) => ({
    order_id: id, customer_id: customer, items, discount_code: code, payment: { token },
  });
  const orders = [
    order('mock-ord-1001', 'user-viewer', [{ variant_id: 'mock-var-cap-black', quantity: 2 }], null, 'tok_success'),
    order('mock-ord-1002', 'user-player', [{ variant_id: 'mock-var-hoodie-M', quantity: 1 }], 'WELCOME10', 'tok_success'),
    order('mock-ord-1003', 'user-viewer', [{ variant_id: 'mock-var-pass', quantity: 1 }], null, 'tok_declined'),
    order('mock-ord-1004', 'user-club-manager', [{ variant_id: 'mock-var-hoodie-L', quantity: 1 }, { variant_id: 'mock-var-cap-red', quantity: 1 }], null, 'tok_success'),
  ];
  for (const o of orders) {
    try { await store.checkout(o); } catch (err) {
      if (!(err instanceof AppError) || err.status !== 402) throw err; // a declined payment is part of the story
    }
  }
}

async function main() {
  const { rows } = await query("SELECT 1 FROM matches WHERE match_id = 'mock-m1'");
  if (rows.length) { console.log('[mock] already present — nothing to do (POST /audit/v1/reset removes it)'); return; }
  const base = await query("SELECT 1 FROM leagues WHERE league_id = $1 AND tenant_id = $2", [LEAGUE, TENANT]);
  if (!base.rows.length) throw new Error(`${LEAGUE} (${TENANT}) is missing — run POST /audit/v1/reset first`);

  for (const c of EXTRA_CLUBS) {
    await query('INSERT INTO clubs (club_id, tenant_id, name, home_venue, socials, staff) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
      [c.club_id, TENANT, c.name, JSON.stringify(c.home_venue), JSON.stringify(c.socials), JSON.stringify(c.staff)]);
  }

  await roster.setup({
    league: { league_id: LEAGUE, tenant_id: TENANT, sport_id: 'football', transfer_window: { open: '2026-08-01', close: '2026-12-31' }, max_squad_size: 18, required_positions: { gk: 1 } },
    squads: SQUADS.map((s) => ({ ...s, tenant_id: TENANT })),
    players: PLAYERS.map(([player_id, name, position, squad_id, role]) => ({ player_id, name, position, squad_id, role })),
    matches_in_progress: [{ match_id: 'mock-m5', home_squad_id: 'sq-lions', away_squad_id: 'sq-eagles' }],
  });

  await query('UPDATE leagues SET name = $2, teams = $3, qualification_spots = 2 WHERE league_id = $1', [LEAGUE, 'Alpha Premier Division', SQUADS.map((s) => s.squad_id)]);
  for (const m of MATCHES) {
    await query("INSERT INTO matches (match_id, sport_id, league_id, home_team_id, away_team_id, scheduled_at) VALUES ($1,'football',$2,$3,$4,$5)", [m.id, LEAGUE, m.home, m.away, m.at]);
    await playMatch(m);
  }

  await seedStore();
  await query("UPDATE matches SET pinned_product_id = 'mock-prod-hoodie' WHERE match_id = 'mock-m5'");

  // A realistic roster move, recorded in the audit trail: a winger loaned to the other club for a month.
  await roster.transfer({
    request_id: 'mock-tr-001', league_id: LEAGUE, player_id: 'mock-p-09', type: 'loan', from_squad_id: 'sq-hawks', to_squad_id: 'sq-royals',
    effective_date: '2026-10-12', loan_end_date: '2026-11-12', reason: 'Loan for first-team minutes', requested_by: 'user-club-manager',
  });

  const counts = await query(`SELECT (SELECT count(*) FROM matches WHERE league_id = $1) AS matches, (SELECT count(*) FROM registrations WHERE league_id = $1) AS players,
    (SELECT count(*) FROM orders WHERE order_id LIKE 'mock-%') AS orders, (SELECT count(*) FROM products WHERE product_id LIKE 'mock-%') AS products`, [LEAGUE]);
  console.log('[mock] added', JSON.stringify(counts.rows[0]), `to ${LEAGUE} (${TENANT})`);
}

async function run() {
  cache.connect();
  for (let i = 0; i < 20 && !(await cache.ping()); i++) await new Promise((r) => setTimeout(r, 100)); // let Redis connect so caches refresh
  try {
    await main();
    await cache.invalidate('epoch'); // make every cached /api/v1 read see the new data immediately
  } catch (err) {
    console.error('[mock] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await cache.disconnect();
    await pool.end();
  }
}

if (require.main === module) run();

module.exports = { run };
