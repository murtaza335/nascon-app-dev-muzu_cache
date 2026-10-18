'use strict';
// Part II baseline (day2/REQUIREMENTS §5), seeded inside the reset transaction after the Phase I baseline.
// Sport and event names may appear here (FR-1.1-05). match-m1's events are signed with DAY1_SALT like any other event.
const config = require('../config');
const { canonical } = require('../lib/canonical');
const { appendInTx } = require('../services/events');

const SEED_QR = [
  ['match-m1', 'm1-live', 'match'], ['player-alpha-1', 'p-alpha-1', 'player'], ['club-alpha-1', 'c-alpha-1', 'club'],
];

async function seedDay2(client) {
  const q = (text, params) => client.query(text, params);
  await q("INSERT INTO players (player_id, name, position, club_id) VALUES ('player-beta-2','Bilal Beta','df','club-beta-1') ON CONFLICT DO NOTHING");

  const events = [
    ['seed-m1-init', 'match_init', { sport_id: 'football', home_team_id: 'club-alpha-1', away_team_id: 'club-alpha-2' }],
    ['seed-m1-start', 'match_start', {}],
    ['seed-m1-goal-1', 'score', { team_id: 'club-alpha-1', event_type: 'goal' }],
  ];
  for (const [event_id, type, payload] of events) {
    await appendInTx(client, { event_id, match_id: 'match-m1', type, payload }, canonical(payload));
  }
  await q("UPDATE matches SET pinned_product_id = 'prod-jersey-001' WHERE match_id = 'match-m1'");

  for (const [entity_id, short_code, entity_type] of SEED_QR) {
    await q('INSERT INTO qr_codes (entity_id, short_code, entity_type) VALUES ($1,$2,$3)', [entity_id, short_code, entity_type]);
  }
  await q(`INSERT INTO guest_tokens (guest_token, status, expires_at) VALUES ('guest_anon_tok_7721','active', now() + interval '24 hours')`);
  await q("INSERT INTO carts (user_id) VALUES ('player-alpha-1')");
  await q("INSERT INTO chat_rooms (chat_room_id) VALUES ('chat-cs-session-101'), ('chat-match-match-m1')");
  return config;
}

module.exports = { seedDay2, SEED_QR };
