'use strict';
// In-process Part II caches (D2-ADR-08). Single API instance, so they are updated synchronously in the same
// after-commit hooks that publish events; /audit reads never serve stale data. Reset and boot rebuild them.
const { query } = require('../db');

const qr = new Map();          // entity_id → {short_code, entity_type, scan_count}
const matchStatus = new Map(); // match_id → status
const dlq = { depth: 0 };
const state = { qrScansTotal: 0 };
const erased = new Set();      // user ids whose JWTs are dead (BR-PRIV-02 token_version bump)
const chatWindows = new Map(); // `${room}|${sender}` → [timestamps]

async function reloadCounters() {
  const d = await query('SELECT count(*)::int AS n FROM notification_dlq');
  dlq.depth = d.rows[0].n;
  const s = await query('SELECT coalesce(sum(scan_count),0)::bigint AS n FROM qr_codes');
  state.qrScansTotal = Number(s.rows[0].n);
  erased.clear();
  for (const r of (await query('SELECT user_id FROM users WHERE erased_at IS NOT NULL')).rows) erased.add(r.user_id);
}

async function resetAll() {
  qr.clear(); matchStatus.clear(); chatWindows.clear();
  await reloadCounters();
}

module.exports = { erased, qr, matchStatus, dlq, state, chatWindows, reloadCounters, resetAll };
