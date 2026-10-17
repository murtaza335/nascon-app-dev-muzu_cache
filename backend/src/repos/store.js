'use strict';
const { query } = require('../db');

// Locks existing variants in variant_id order (deadlock-free, ARCHITECTURE §6.3) and returns them.
async function lockVariants(client, ids) {
  const { rows } = await client.query(
    `SELECT v.variant_id, v.product_id, v.price_minor, v.stock, v.reserved, p.club_id
     FROM variants v JOIN products p ON p.product_id = v.product_id
     WHERE v.variant_id = ANY($1) ORDER BY v.variant_id FOR UPDATE OF v`, [ids]);
  return rows;
}

async function schedulesFor(client, ids) {
  const { rows } = await client.query(
    `SELECT variant_id, to_char(effective_from AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS effective_from, price_minor
     FROM price_schedules WHERE variant_id = ANY($1)`, [ids]);
  return rows;
}

async function findDiscount(client, code) {
  const { rows } = await client.query('SELECT code, percent FROM discount_codes WHERE code = $1 AND active', [code]);
  return rows[0] || null;
}

async function decrementStock(client, variantId, qty) {
  const { rowCount } = await client.query('UPDATE variants SET stock = stock - $2 WHERE variant_id = $1 AND stock >= $2', [variantId, qty]);
  return rowCount === 1;
}

async function nextCounter(client, name) {
  const { rows } = await client.query('UPDATE counters SET value = value + 1 WHERE name = $1 RETURNING value', [name]);
  return rows[0].value;
}

async function insertOrder(client, o) {
  await client.query(
    `INSERT INTO orders (order_id, customer_id, status, club_id, items, subtotal_minor, discount_minor, total_minor, payment, receipt, pdf, request_hash, response)
     VALUES ($1,$2,'paid',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [o.order_id, o.customer_id, o.club_id, JSON.stringify(o.items), o.subtotal_minor, o.discount_minor, o.total_minor,
      JSON.stringify(o.payment), JSON.stringify(o.receipt), o.pdf, o.request_hash, JSON.stringify(o.response)]);
}

async function insertPaymentAttempt(client, orderId, token, outcome) {
  await client.query('INSERT INTO payment_attempts (order_id, token, outcome) VALUES ($1,$2,$3)', [orderId, token, outcome]);
}

async function getInventory(variantId, db = { query }) {
  const { rows } = await db.query('SELECT variant_id, stock, reserved FROM variants WHERE variant_id = $1', [variantId]);
  return rows[0] || null;
}

module.exports = { lockVariants, schedulesFor, findDiscount, decrementStock, nextCounter, insertOrder, insertPaymentAttempt, getInventory };
