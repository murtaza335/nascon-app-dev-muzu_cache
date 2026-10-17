'use strict';
const { query } = require('../db');

async function listByMatch(matchId, db = { query }) {
  const { rows } = await db.query(
    'SELECT event_id, sequence, type, payload, signature FROM match_events WHERE match_id = $1 ORDER BY sequence', [matchId]);
  return rows;
}

async function getEvent(eventId, db = { query }) {
  const { rows } = await db.query('SELECT event_id, match_id, type FROM match_events WHERE event_id = $1', [eventId]);
  return rows[0] || null;
}

async function insertEvent(client, e) {
  await client.query(
    `INSERT INTO match_events (event_id, match_id, sequence, type, payload, payload_canonical, signature, request_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [e.event_id, e.match_id, e.sequence, e.type, e.payload_canonical, e.payload_canonical, e.signature, e.request_hash]);
}

module.exports = { listByMatch, getEvent, insertEvent };
