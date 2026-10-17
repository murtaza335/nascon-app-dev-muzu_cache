'use strict';
// Crash recovery for stock reservations (NFR-REL-01): releases `held` reservations past expires_at.
// Checkout currently holds stock only inside a transaction, so this normally finds nothing; it is the safety net for
// any future two-phase flow and keeps `reserved` from drifting.
const { withTx } = require('../db');

async function sweepExpired() {
  return withTx(async (client) => {
    const { rows } = await client.query(
      "SELECT reservation_id, items FROM reservations WHERE state = 'held' AND expires_at < now() ORDER BY reservation_id FOR UPDATE SKIP LOCKED");
    for (const r of rows) {
      for (const it of [...r.items].sort((a, b) => (a.variant_id < b.variant_id ? -1 : 1))) {
        await client.query('UPDATE variants SET stock = stock + $2, reserved = GREATEST(reserved - $2, 0) WHERE variant_id = $1', [it.variant_id, it.quantity]);
      }
      await client.query("UPDATE reservations SET state = 'released' WHERE reservation_id = $1", [r.reservation_id]);
    }
    return rows.length;
  });
}

module.exports = { sweepExpired };
