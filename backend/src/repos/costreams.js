'use strict';
const { query } = require('../db');

async function get(sessionId, db = { query }) {
  const { rows } = await db.query('SELECT * FROM costream_sessions WHERE session_id = $1', [sessionId]);
  return rows[0] || null;
}

async function upsert(client, s) {
  await client.query(
    `INSERT INTO costream_sessions (session_id, host_player_id, active_host, participants, active_participants, layout, status,
       handoff_occurred, request_hash, response)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (session_id) DO UPDATE SET host_player_id = $2, active_host = $3, participants = $4, active_participants = $5,
       layout = $6, status = $7, handoff_occurred = $8, request_hash = $9, response = $10, updated_at = now()`,
    [s.session_id, s.host_player_id, s.active_host, JSON.stringify(s.participants), JSON.stringify(s.active_participants), s.layout,
      s.status, s.handoff_occurred, s.request_hash, JSON.stringify(s.response)]);
}

async function missingPlayer(client, ids) {
  const { rows } = await client.query('SELECT player_id FROM players WHERE player_id = ANY($1)', [ids]);
  const have = new Set(rows.map((r) => r.player_id));
  return ids.find((id) => !have.has(id)) ?? null;
}

module.exports = { get, upsert, missingPlayer };
