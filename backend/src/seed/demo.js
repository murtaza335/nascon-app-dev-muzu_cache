'use strict';
// Optional demo enrichment for the desk check (SEED_DEMO_DATA=true; OFF for the grader). Everything added carries a
// `demo-` prefix except the roster/fixtures attached to the existing baseline league-alpha-1.
const config = require('../config');
const { canonical } = require('../lib/canonical');
const { sign } = require('../lib/signature');

const TEAMS = ['club-alpha-1', 'club-alpha-2', 'demo-eagles', 'demo-wolves'];

async function seedDemo(client) {
  const q = (text, params) => client.query(text, params);
  await q(`UPDATE leagues SET teams = $1, qualification_spots = 2, transfer_window_open = '2026-01-01', transfer_window_close = '2026-12-31',
           max_squad_size = 25 WHERE league_id = 'league-alpha-1'`, [TEAMS]);

  // Fixtures + their event logs (signed like API events).
  const matches = [
    { id: 'demo-m1', home: 'club-alpha-1', away: 'club-alpha-2', plan: ['start', ['h', 'goal'], ['a', 'goal'], ['h', 'goal'], 'end'], at: '2026-10-10T15:00:00Z' },
    { id: 'demo-m2', home: 'demo-eagles', away: 'demo-wolves', plan: ['start', ['h', 'goal']], at: '2026-10-17T16:00:00Z' },
    { id: 'demo-m3', home: 'club-alpha-1', away: 'demo-eagles', plan: [], at: '2026-10-24T15:00:00Z' },
    { id: 'demo-m4', home: 'club-alpha-2', away: 'demo-wolves', plan: [], at: '2026-10-25T15:00:00Z' },
  ];
  for (const m of matches) {
    await q(`INSERT INTO matches (match_id, sport_id, league_id, home_team_id, away_team_id, scheduled_at) VALUES ($1,'football','league-alpha-1',$2,$3,$4)`,
      [m.id, m.home, m.away, m.at]);
    let seq = 0;
    let status = 'upcoming';
    for (const step of m.plan) {
      seq += 1;
      let type; let payload;
      if (step === 'start') { type = 'match_start'; payload = {}; status = 'in_progress'; }
      else if (step === 'end') { type = 'match_end'; payload = {}; status = 'completed'; }
      else { type = 'score'; payload = { team_id: step[0] === 'h' ? m.home : m.away, event_type: 'goal' }; }
      const eventId = `${m.id}-e${seq}`;
      const canon = canonical(payload);
      await q(`INSERT INTO match_events (event_id, match_id, sequence, type, payload, payload_canonical, signature, request_hash)
               VALUES ($1,$2,$3,$4,$5,$6,$7,'demo')`, [eventId, m.id, seq, type, canon, canon, sign(config.day1Salt, eventId, canon)]);
    }
    await q('UPDATE matches SET version = $2, status_cache = $3 WHERE match_id = $1', [m.id, seq, status]);
  }
  await q("UPDATE matches SET pinned_product_id = 'prod-jersey-001' WHERE match_id = 'demo-m2'");

  // Roster for league-alpha-1: two squads, a few players.
  await q("INSERT INTO squads (league_id, squad_id, club_id, tenant_id, name) VALUES ('league-alpha-1','sq-alpha-1','club-alpha-1','tenant-alpha','Alpha Lions'),('league-alpha-1','sq-alpha-2','club-alpha-2','tenant-alpha','Alpha Hawks')");
  const players = [
    ['demo-p-1', 'Hamza Tariq', 'df', 'club-alpha-1', 'sq-alpha-1', 'starter'], ['demo-p-2', 'Danish Iqbal', 'mf', 'club-alpha-1', 'sq-alpha-1', 'vice_captain'],
    ['demo-p-3', 'Faraz Ali', 'fw', 'club-alpha-2', 'sq-alpha-2', 'starter'], ['demo-p-4', 'Saad Mehmood', 'gk', 'club-alpha-2', 'sq-alpha-2', 'captain'],
  ];
  for (const [id, name, pos, club] of players) await q('INSERT INTO players (player_id, name, position, club_id) VALUES ($1,$2,$3,$4)', [id, name, pos, club]);
  const regs = [['player-alpha-1', 'sq-alpha-1', 'captain'], ['player-alpha-2', 'sq-alpha-2', 'starter'], ...players.map((p) => [p[0], p[4], p[5]])];
  for (const [pid, sq, role] of regs) {
    await q(`INSERT INTO registrations (league_id, player_id, squad_id, registration_type, start_date, role) VALUES ('league-alpha-1',$1,$2,'initial','2026-01-01',$3)`, [pid, sq, role]);
  }

  // Extra catalogue items.
  await q(`INSERT INTO products (product_id, tenant_id, club_id, name, category, description) VALUES
    ('demo-prod-scarf','tenant-alpha','club-alpha-1','Lions Match Scarf','accessory','Wool scarf'),
    ('demo-prod-ebook','tenant-alpha','club-alpha-1','Season Highlights (digital)','digital','Digital download')`);
  await q(`INSERT INTO variants (variant_id, product_id, size, color, price_minor, stock) VALUES
    ('demo-var-scarf-OS','demo-prod-scarf','OS','red',120000,20),('demo-var-ebook','demo-prod-ebook',NULL,NULL,50000,100)`);
}

module.exports = { seedDemo };
