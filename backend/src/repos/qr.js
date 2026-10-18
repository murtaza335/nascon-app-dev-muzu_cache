'use strict';
const { query } = require('../db');

async function byEntity(entityId, db = { query }) {
  const { rows } = await db.query('SELECT entity_id, short_code, entity_type, scan_count FROM qr_codes WHERE entity_id = $1', [entityId]);
  return rows[0] || null;
}

async function byCode(code, db = { query }) {
  const { rows } = await db.query('SELECT entity_id, short_code, entity_type, scan_count FROM qr_codes WHERE short_code = $1', [code]);
  return rows[0] || null;
}

async function insertIfAbsent(db, entityId, code, type) {
  await db.query('INSERT INTO qr_codes (entity_id, short_code, entity_type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [entityId, code, type]);
}

// Table + key column per entity type; the id column is never interpolated from user input.
const EXISTS_SQL = {
  match: 'SELECT 1 FROM matches WHERE match_id = $1',
  player: 'SELECT 1 FROM players WHERE player_id = $1',
  club: 'SELECT 1 FROM clubs WHERE club_id = $1',
  costream: 'SELECT 1 FROM costream_sessions WHERE session_id = $1',
};
async function entityExists(type, id, db = { query }) {
  return (await db.query(EXISTS_SQL[type], [id])).rows.length === 1;
}

async function costreamStatus(id, db = { query }) {
  const { rows } = await db.query('SELECT status FROM costream_sessions WHERE session_id = $1', [id]);
  return rows[0] ? rows[0].status : null;
}

// Atomic increment (BR-QR-04) plus hour/device bucket (NFR-9: nothing else is stored).
async function recordScan(client, entityId, family) {
  const { rows } = await client.query('UPDATE qr_codes SET scan_count = scan_count + 1 WHERE entity_id = $1 RETURNING scan_count', [entityId]);
  await client.query(
    `INSERT INTO qr_scan_buckets (entity_id, bucket_hour, device_family, scans) VALUES ($1, date_trunc('hour', now()), $2, 1)
     ON CONFLICT (entity_id, bucket_hour, device_family) DO UPDATE SET scans = qr_scan_buckets.scans + 1`, [entityId, family]);
  return rows[0].scan_count;
}

module.exports = { byEntity, byCode, insertIfAbsent, entityExists, costreamStatus, recordScan };
