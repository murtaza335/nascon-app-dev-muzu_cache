'use strict';
const { query } = require('../db');

async function ensureRoom(client, roomId) {
  await client.query('INSERT INTO chat_rooms (chat_room_id) VALUES ($1) ON CONFLICT DO NOTHING', [roomId]);
}

// Callers pass rows already sorted by (user_id, action): consistent lock order → no deadlocks (EC-3).
async function insertActions(client, rows) {
  for (const r of rows) {
    await client.query(
      `INSERT INTO moderation_actions (chat_room_id, user_id, action, reason, signature) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (chat_room_id, user_id, action) DO NOTHING`, [r.chat_room_id, r.user_id, r.action, r.reason, r.signature]);
  }
}

async function isMuted(roomId, userId, db = { query }) {
  const { rows } = await db.query("SELECT 1 FROM moderation_actions WHERE chat_room_id = $1 AND user_id = $2 AND action IN ('mute','kick')", [roomId, userId]);
  return rows.length > 0;
}

module.exports = { ensureRoom, insertActions, isMuted };
