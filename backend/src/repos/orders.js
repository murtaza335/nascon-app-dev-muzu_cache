'use strict';
const { query } = require('../db');

const COLS = 'order_id, customer_id, status, club_id, items, subtotal_minor, discount_minor, total_minor, payment, receipt, response';

async function getOrder(orderId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${COLS}, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at FROM orders WHERE order_id = $1`, [orderId]);
  return rows[0] || null;
}

async function lockOrder(client, orderId) {
  const { rows } = await client.query(`SELECT ${COLS} FROM orders WHERE order_id = $1 FOR UPDATE`, [orderId]);
  return rows[0] || null;
}

// Orders visible to a caller: filter = {customer_id} | {club_id} | {} (all).
async function listOrders(filter, db = { query }) {
  const where = [];
  const params = [];
  if (filter.customer_id) { params.push(filter.customer_id); where.push(`customer_id = $${params.length}`); }
  if (filter.club_id) { params.push(filter.club_id); where.push(`club_id = $${params.length}`); }
  const { rows } = await db.query(
    `SELECT ${COLS}, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at FROM orders
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, order_id`, params);
  return rows;
}

async function getPdf(orderId, db = { query }) {
  const { rows } = await db.query('SELECT pdf FROM orders WHERE order_id = $1', [orderId]);
  return rows[0] ? rows[0].pdf : null;
}

async function setStatus(client, orderId, status) {
  await client.query('UPDATE orders SET status = $2 WHERE order_id = $1', [orderId, status]);
}

async function restock(client, items) {
  for (const it of [...items].sort((a, b) => (a.variant_id < b.variant_id ? -1 : 1))) {
    await client.query('UPDATE variants SET stock = stock + $2 WHERE variant_id = $1', [it.variant_id, it.quantity]);
  }
}

module.exports = { getOrder, lockOrder, listOrders, getPdf, setStatus, restock };
