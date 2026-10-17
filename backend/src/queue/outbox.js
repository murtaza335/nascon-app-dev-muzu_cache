'use strict';
// Transactional outbox relay (ADR-011): rows written in the business transaction are published to a Redis Stream.
const { withTx } = require('../db');

const STREAM = 'domain-events';

// Publishes up to `batch` unpublished rows in id order. Returns how many were relayed.
async function relayBatch(redis, batch = 100) {
  return withTx(async (client) => {
    const { rows } = await client.query(
      'SELECT id, topic, type, aggregate_id, payload FROM outbox WHERE published_at IS NULL ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED', [batch]);
    for (const r of rows) {
      await redis.xAdd(STREAM, '*', { id: String(r.id), topic: r.topic, type: r.type, aggregate_id: r.aggregate_id, payload: JSON.stringify(r.payload) });
    }
    if (rows.length) await client.query('UPDATE outbox SET published_at = now() WHERE id = ANY($1)', [rows.map((r) => r.id)]);
    return rows.length;
  });
}

module.exports = { STREAM, relayBatch };
