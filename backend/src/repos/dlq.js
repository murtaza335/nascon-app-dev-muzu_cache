'use strict';
const { query } = require('../db');
const { dlqEventId } = require('../domain/notify/retry');

async function count(db = { query }) {
  return (await db.query('SELECT count(*)::int AS n FROM notification_dlq')).rows[0].n;
}

// Inserts every dead-lettered notification in one statement; ids come from the serial so event ids are dlq-000001…
async function insertMany(client, items) {
  if (!items.length) return;
  const { rows } = await client.query(`SELECT nextval(pg_get_serial_sequence('notification_dlq','dlq_id')) AS id FROM generate_series(1, $1)`, [items.length]);
  for (let i = 0; i < items.length; i++) {
    const it = items[i]; const id = Number(rows[i].id);
    await client.query(
      `INSERT INTO notification_dlq (dlq_id, event_id, topic, target, payload, attempts, last_error) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, dlqEventId(id), it.topic, it.target, JSON.stringify(it.payload || {}), it.attempts, it.last_error]);
  }
}

async function list(limit = 1000, db = { query }) {
  const { rows } = await db.query(
    `SELECT event_id, topic, target, attempts, last_error, to_char(dead_lettered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS dead_lettered_at FROM notification_dlq ORDER BY dlq_id LIMIT $1`, [limit]);
  return rows;
}

module.exports = { count, insertMany, list };
