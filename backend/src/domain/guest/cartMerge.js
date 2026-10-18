'use strict';
// Pure cart-merge rules (BR-CART). Quantities are summed per variant; order of first occurrence is kept for "first failure".
const crypto = require('node:crypto');
const { canonical } = require('../../lib/canonical');

function sumLines(lines) {
  const m = new Map();
  for (const l of lines) m.set(l.variant_id, (m.get(l.variant_id) || 0) + l.quantity);
  return m;
}

// First variant whose merged quantity (existing member cart + guest lines) exceeds availability, else null.
function firstShort(guestSums, memberSums, available) {
  for (const [variantId, qty] of guestSums) {
    const requested = qty + (memberSums.get(variantId) || 0);
    const have = available.get(variantId) ?? 0;
    if (requested > have) return { variant_id: variantId, requested, available: have };
  }
  return null;
}

// Replay identity (EC-4): same member + same summed lines. test_write_block is a probe flag, not part of identity.
function requestHash(userId, guestSums) {
  const lines = [...guestSums].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([variant_id, quantity]) => ({ variant_id, quantity }));
  return crypto.createHash('sha256').update(canonical({ registered_user_id: userId, lines })).digest('hex');
}

function cartView(userId, rows) {
  const items = [...rows].sort((a, b) => (a.variant_id < b.variant_id ? -1 : a.variant_id > b.variant_id ? 1 : 0))
    .map((r) => ({ variant_id: r.variant_id, quantity: r.quantity, unit_price_minor: r.unit_price_minor }));
  return {
    user_id: userId, currency: 'PKR', total_items: items.reduce((s, i) => s + i.quantity, 0),
    subtotal_minor: items.reduce((s, i) => s + i.quantity * i.unit_price_minor, 0), items,
  };
}

const sigPayload = (r) => ({
  cart_merged: r.cart_merged, guest_token: r.guest_token, registered_user_id: r.active_cart.user_id,
  total_items: r.active_cart.total_items, write_rejection_code: r.write_rejection_code,
});

module.exports = { sumLines, firstShort, requestHash, cartView, sigPayload };
