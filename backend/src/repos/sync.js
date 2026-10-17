'use strict';
async function find(client, deviceId, actionId) {
  const { rows } = await client.query('SELECT result FROM offline_sync_actions WHERE device_id = $1 AND action_id = $2', [deviceId, actionId]);
  return rows[0] || null;
}

async function record(client, deviceId, actionId, result) {
  await client.query(
    'INSERT INTO offline_sync_actions (device_id, action_id, result) VALUES ($1,$2,$3) ON CONFLICT (device_id, action_id) DO NOTHING',
    [deviceId, actionId, JSON.stringify(result)]);
}

module.exports = { find, record };
