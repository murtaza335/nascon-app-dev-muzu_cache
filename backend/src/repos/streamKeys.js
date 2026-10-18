'use strict';
const { query } = require('../db');

const COLS = 'stream_key, player_id, label, status, match_id, live';

async function keysOf(client, playerId) {
  const { rows } = await client.query(`SELECT ${COLS} FROM stream_keys WHERE player_id = $1 ORDER BY seq DESC`, [playerId]);
  return rows;
}

async function revokeActive(client, playerId) {
  const { rows } = await client.query(
    `UPDATE stream_keys SET status = 'revoked', revoked_at = now() WHERE player_id = $1 AND status = 'active' RETURNING stream_key, live`, [playerId]);
  return rows;
}

// An override naming an existing (revoked) key re-activates it for this player (BR-SK-03).
async function upsertActive(client, { stream_key, player_id, label, signature }) {
  await client.query(
    `INSERT INTO stream_keys (stream_key, player_id, label, status, signature) VALUES ($1,$2,$3,'active',$4)
     ON CONFLICT (stream_key) DO UPDATE SET player_id = $2, label = $3, status = 'active', revoked_at = NULL, live = false,
       seq = nextval(pg_get_serial_sequence('stream_keys','seq')), signature = $4`,
    [stream_key, player_id, label, signature]);
}

async function revokeOne(client, streamKey, signature) {
  await client.query(`UPDATE stream_keys SET status = 'revoked', revoked_at = now(), signature = $2 WHERE stream_key = $1`, [streamKey, signature]);
}

async function getKey(streamKey, db = { query }) {
  const { rows } = await db.query(`SELECT ${COLS} FROM stream_keys WHERE stream_key = $1`, [streamKey]);
  return rows[0] || null;
}

async function activeOf(playerId, db = { query }) {
  const { rows } = await db.query(`SELECT ${COLS} FROM stream_keys WHERE player_id = $1 AND status = 'active'`, [playerId]);
  return rows[0] || null;
}

async function playerExists(playerId, db = { query }) {
  const { rows } = await db.query('SELECT 1 FROM players WHERE player_id = $1', [playerId]);
  return rows.length === 1;
}

async function setLive(streamKey, live, db = { query }) {
  await db.query('UPDATE stream_keys SET live = $2 WHERE stream_key = $1', [streamKey, live]);
}

async function notActiveLive(db = { query }) {
  const { rows } = await db.query(`SELECT stream_key FROM stream_keys WHERE status <> 'active' AND live`);
  return rows.map((r) => r.stream_key);
}

module.exports = { keysOf, revokeActive, upsertActive, revokeOne, getKey, activeOf, playerExists, setLive, notActiveLive };
