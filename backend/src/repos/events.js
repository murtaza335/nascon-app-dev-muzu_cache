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

// All events of many matches in one query, ordered for projection (ARCHITECTURE §6.2).
async function listByMatches(matchIds, db = { query }) {
  if (!matchIds.length) return new Map();
  const { rows } = await db.query(
    'SELECT match_id, event_id, sequence, type, payload, signature FROM match_events WHERE match_id = ANY($1) ORDER BY match_id, sequence', [matchIds]);
  const byMatch = new Map();
  for (const r of rows) {
    if (!byMatch.has(r.match_id)) byMatch.set(r.match_id, []);
    byMatch.get(r.match_id).push(r);
  }
  return byMatch;
}

module.exports.listByMatches = listByMatches;
