'use strict';
async function insert(client, { topic, type, aggregate_id, payload }) {
  await client.query('INSERT INTO outbox (topic, type, aggregate_id, payload) VALUES ($1,$2,$3,$4)',
    [topic, type, aggregate_id, JSON.stringify(payload)]);
}

module.exports = { insert };
