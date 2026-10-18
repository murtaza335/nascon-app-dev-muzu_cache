'use strict';
// FR-3.3-03 / API-D2-45,46: chat with synchronous moderation; seq assigned under a row lock on chat_rooms (D2-ADR-10).
const { query, withTx } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { check, t } = require('../lib/validate');
const { sign2 } = require('../lib/signature');
const engine = require('../domain/moderation/engine');
const modRepo = require('../repos/moderation');
const cache = require('./day2Cache');
const hooks = require('./hooks');

const ISO = `to_char(sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
const COLS = `message_id, chat_room_id, seq, sender, text, flagged, reason, ${ISO} AS sent_at`;

// Frames go to the match / co-stream sockets of the room, and to /api/v1/ws `chat:{room}`.
function publishMessage(room, message) {
  const frame = { type: 'chat.message', chat_room_id: room, message };
  hooks.publish(`chat:${room}`, frame);
  if (room.startsWith('chat-match-')) hooks.publish(`ws:match:${room.slice('chat-match-'.length)}`, frame);
  else if (room.startsWith('chat-')) hooks.publish(`ws:costream:${room.slice('chat-'.length)}`, frame);
}

const rowActions = (room, user, action, reason) => [{
  chat_room_id: room, user_id: user, action, reason,
  signature: sign2(room, { action, chat_room_id: room, reason, user_id: user }),
}];

async function post(principal, input) {
  const c = check({
    chat_room_id: t.string({ required: true, min: 1, max: 128 }),
    text: t.string({ required: true, min: 1, max: 2000 }),
    client_message_id: t.string({ required: true, min: 1, max: 128 }),
  }, input);
  if (!c.ok) throw validationError(c.fields);
  const v = c.value;
  const sender = principal.user_id;

  const prior = await query(`SELECT ${COLS} FROM chat_messages WHERE chat_room_id = $1 AND client_message_id = $2`, [v.chat_room_id, v.client_message_id]);
  if (prior.rows[0]) return { status: 200, body: prior.rows[0] };

  if (await modRepo.isMuted(v.chat_room_id, sender)) throw new AppError(E.RATE_LIMITED, { reason: 'muted' });
  if (!cache.chatWindows.has(v.chat_room_id)) cache.chatWindows.set(v.chat_room_id, new Map());
  const res = engine.evaluate([{ message_id: v.client_message_id, sender, text: v.text }], {
    now: Date.now(), windows: cache.chatWindows.get(v.chat_room_id), useRateWindow: true,
  });
  if (res.dropped.length) {
    const reason = res.dropped[0].reason;
    await withTx(async (client) => { await modRepo.ensureRoom(client, v.chat_room_id); await modRepo.insertActions(client, rowActions(v.chat_room_id, sender, 'mute', reason)); });
    throw new AppError(E.RATE_LIMITED, { reason });
  }
  const m = res.filtered[0];
  const body = await withTx(async (client) => {
    await modRepo.ensureRoom(client, v.chat_room_id);
    if (res.kicked.length) await modRepo.insertActions(client, rowActions(v.chat_room_id, sender, 'kick', 'profanity_leetspeak'));
    const { rows } = await client.query('UPDATE chat_rooms SET last_seq = last_seq + 1 WHERE chat_room_id = $1 RETURNING last_seq', [v.chat_room_id]);
    const seq = rows[0].last_seq;
    const ins = await client.query(
      `INSERT INTO chat_messages (chat_room_id, seq, message_id, client_message_id, sender, text, flagged, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${COLS}`, [v.chat_room_id, seq, `${v.chat_room_id}-${seq}`, v.client_message_id, sender, m.text, m.flagged, m.reason]);
    return ins.rows[0];
  });
  publishMessage(v.chat_room_id, body);
  return { status: 201, body };
}

async function history(roomId, q) {
  const after = q.after_seq === undefined ? 0 : Number(q.after_seq);
  const limit = q.limit === undefined ? 50 : Number(q.limit);
  const bad = [];
  if (!Number.isInteger(after) || after < 0) bad.push('after_seq');
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) bad.push('limit');
  if (bad.length) throw validationError(bad);
  const { rows } = await query(`SELECT ${COLS} FROM chat_messages WHERE chat_room_id = $1 AND seq > $2 ORDER BY seq LIMIT $3`, [roomId, after, limit]);
  const last = await query('SELECT last_seq FROM chat_rooms WHERE chat_room_id = $1', [roomId]);
  return { chat_room_id: roomId, messages: rows, last_seq: last.rows[0] ? last.rows[0].last_seq : 0 };
}

module.exports = { post, history };
