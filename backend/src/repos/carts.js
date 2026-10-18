'use strict';
const { query } = require('../db');
const pricing = require('../domain/store/pricing');

async function personExists(id, db = { query }) {
  const { rows } = await db.query('SELECT 1 FROM players WHERE player_id = $1 UNION ALL SELECT 1 FROM users WHERE user_id = $1', [id]);
  return rows.length > 0;
}

async function variantsInfo(db, ids) {
  const { rows } = await db.query('SELECT variant_id, price_minor, stock, reserved FROM variants WHERE variant_id = ANY($1) ORDER BY variant_id', [ids]);
  return rows;
}

async function lockVariants(client, ids) {
  const { rows } = await client.query('SELECT variant_id, price_minor, stock, reserved FROM variants WHERE variant_id = ANY($1) ORDER BY variant_id FOR UPDATE', [ids]);
  return rows;
}

// Current price: latest schedule entry in effect, else the base price (same rule as checkout).
async function priceRows(db, rows) {
  const ids = rows.map((r) => r.variant_id);
  if (!ids.length) return [];
  const sched = await db.query(`SELECT variant_id, to_char(effective_from AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS effective_from, price_minor
    FROM price_schedules WHERE variant_id = ANY($1)`, [ids]);
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const base = await variantsInfo(db, ids);
  const byId = new Map(base.map((v) => [v.variant_id, v.price_minor]));
  return rows.map((r) => ({
    ...r, unit_price_minor: pricing.effectivePrice(byId.get(r.variant_id), sched.rows.filter((s) => s.variant_id === r.variant_id), now),
  }));
}

async function memberItems(db, userId) {
  const { rows } = await db.query('SELECT variant_id, quantity FROM cart_items WHERE user_id = $1', [userId]);
  return rows;
}

async function addMemberItems(client, userId, sums) {
  await client.query('INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET updated_at = now()', [userId]);
  for (const [variantId, qty] of [...sums].sort(([a], [b]) => (a < b ? -1 : 1))) {
    await client.query(
      `INSERT INTO cart_items (user_id, variant_id, quantity) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, variant_id) DO UPDATE SET quantity = cart_items.quantity + $3`, [userId, variantId, qty]);
  }
}

async function getToken(client, token) {
  const { rows } = await client.query('SELECT guest_token, status, linked_user_id, merged_request_hash, merge_receipt FROM guest_tokens WHERE guest_token = $1', [token]);
  return rows[0] || null;
}

async function ensureToken(client, token, ttlSeconds) {
  await client.query(
    `INSERT INTO guest_tokens (guest_token, status, expires_at) VALUES ($1,'active', now() + make_interval(secs => $2)) ON CONFLICT DO NOTHING`, [token, ttlSeconds]);
}

async function markMerged(client, token, userId, hash, receipt) {
  await client.query(
    `UPDATE guest_tokens SET status = 'merged', linked_user_id = $2, merged_request_hash = $3, merge_receipt = $4 WHERE guest_token = $1`,
    [token, userId, hash, JSON.stringify(receipt)]);
  await client.query('DELETE FROM guest_cart_items WHERE guest_token = $1', [token]);
}

module.exports = { personExists, variantsInfo, lockVariants, priceRows, memberItems, addMemberItems, getToken, ensureToken, markMerged };
