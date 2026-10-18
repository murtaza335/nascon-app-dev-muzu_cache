'use strict';
const { query } = require('../db');

async function create(token, ttlSeconds) {
  const { rows } = await query(
    `INSERT INTO guest_tokens (guest_token, status, expires_at) VALUES ($1,'active', now() + make_interval(secs => $2))
     RETURNING to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at`, [token, ttlSeconds]);
  return rows[0].expires_at;
}

async function valid(token) {
  const { rows } = await query("SELECT 1 FROM guest_tokens WHERE guest_token = $1 AND status = 'active' AND expires_at > now()", [token]);
  return rows.length === 1;
}

async function items(token) {
  const { rows } = await query('SELECT variant_id, quantity FROM guest_cart_items WHERE guest_token = $1', [token]);
  return rows;
}

async function addItem(token, variantId, qty) {
  await query(
    `INSERT INTO guest_cart_items (guest_token, variant_id, quantity) VALUES ($1,$2,$3)
     ON CONFLICT (guest_token, variant_id) DO UPDATE SET quantity = guest_cart_items.quantity + $3`, [token, variantId, qty]);
}

async function removeItem(token, variantId) {
  await query('DELETE FROM guest_cart_items WHERE guest_token = $1 AND variant_id = $2', [token, variantId]);
}

module.exports = { create, valid, items, addItem, removeItem };
