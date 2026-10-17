'use strict';
// Replay store (ADR-006): successes only, written in the same transaction as the effect.
async function find(client, scope, clientId) {
  const { rows } = await client.query(
    'SELECT request_hash, status_code, response FROM idempotency WHERE scope = $1 AND client_id = $2', [scope, clientId]);
  if (!rows[0]) return null;
  return { ...rows[0], response: JSON.parse(rows[0].response) };
}

async function store(client, scope, clientId, requestHash, statusCode, response) {
  await client.query(
    'INSERT INTO idempotency (scope, client_id, request_hash, status_code, response) VALUES ($1,$2,$3,$4,$5)',
    [scope, clientId, requestHash, statusCode, JSON.stringify(response)]);
}

module.exports = { find, store };
