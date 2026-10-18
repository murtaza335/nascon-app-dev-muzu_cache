'use strict';
const { query } = require('../db');

async function lookup(client, id) {
  const u = await client.query('SELECT user_id FROM users WHERE user_id = $1 OR player_id = $1', [id]);
  const p = await client.query('SELECT 1 FROM players WHERE player_id = $1', [id]);
  return { userIds: u.rows.map((r) => r.user_id), isPlayer: p.rows.length === 1 };
}

async function eraseUser(client, userId, email, name) {
  await client.query(
    `UPDATE users SET email = $2, display_name = $3, password_hash = NULL, token_version = token_version + 1,
       erased_at = coalesce(erased_at, now()) WHERE user_id = $1`, [userId, email, name]);
}

async function anonymizePlayer(client, playerId, name) {
  await client.query('UPDATE players SET name = $2 WHERE player_id = $1', [playerId, name]);
}

async function wipeGuestTokens(client, ids) {
  const r = await client.query(
    `UPDATE guest_tokens SET status = 'wiped', linked_user_id = NULL, merge_receipt = NULL, merged_request_hash = NULL
     WHERE linked_user_id = ANY($1)`, [ids]);
  return r.rowCount;
}

async function pseudonymiseChat(client, ids, pseudonym) {
  await client.query('UPDATE chat_messages SET sender = $2 WHERE sender = ANY($1)', [ids, pseudonym]);
}

async function deleteFollows(client, ids) {
  await client.query('DELETE FROM follows WHERE follower_id = ANY($1)', [ids]);
}

module.exports = { lookup, eraseUser, anonymizePlayer, wipeGuestTokens, pseudonymiseChat, deleteFollows, query };
