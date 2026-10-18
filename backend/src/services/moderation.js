'use strict';
// FR-5.3 / API-D2-09. Clean messages with no DLQ work never touch the database (NFR-2 hot path).
const { withTx } = require('../db');
const { validate, t } = require('../lib/validate');
const { sign2 } = require('../lib/signature');
const engine = require('../domain/moderation/engine');
const repo = require('../repos/moderation');
const dlq = require('./dlq');

const SCHEMA = {
  chat_room_id: t.string({ required: true, min: 1 }),
  incoming_messages: t.array(t.object({
    message_id: t.string({ required: true }), sender: t.string({ required: true }), text: t.string({ required: true, max: 2000 }),
  }), { required: true, max: 500 }),
  check_dlq: t.bool({ default: true }),
  simulate_failed_notifications: t.int({ min: 0, max: 100, default: 0 }),
};

// BR-MOD-07: sorted keys, idempotent inserts, one transaction.
function actionRows(room, kicked, muted, dropped) {
  const rows = [];
  for (const u of kicked) rows.push({ chat_room_id: room, user_id: u, action: 'kick', reason: 'profanity_leetspeak' });
  for (const u of muted) rows.push({ chat_room_id: room, user_id: u, action: 'mute', reason: (dropped.find((d) => d.sender === u) || {}).reason || 'flood' });
  rows.sort((a, b) => (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : a.action < b.action ? -1 : 1));
  return rows.map((r) => ({ ...r, signature: sign2(r.chat_room_id, { action: r.action, chat_room_id: r.chat_room_id, reason: r.reason, user_id: r.user_id }) }));
}

async function runProbe(input) {
  const v = validate(SCHEMA, input);
  const res = engine.evaluate(v.incoming_messages, { now: 0, windows: new Map(), useRateWindow: true });
  const rows = actionRows(v.chat_room_id, res.kicked, res.muted, res.dropped);
  if (rows.length) {
    await withTx(async (client) => { await repo.ensureRoom(client, v.chat_room_id); await repo.insertActions(client, rows); });
  }
  await dlq.simulateFailures(v.simulate_failed_notifications);
  const dlqStatus = await dlq.status();
  const flagged = res.filtered.filter((m) => m.flagged).length;
  return {
    chat_room_id: v.chat_room_id, filtered_messages: res.filtered, kicked_users: res.kicked, muted_users: res.muted,
    dlq_status: dlqStatus,
    signature: sign2(v.chat_room_id, engine.sigPayload(v.chat_room_id, flagged, res.kicked, dlqStatus.queue_depth)),
  };
}

module.exports = { runProbe };
