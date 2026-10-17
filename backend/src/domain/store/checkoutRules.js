'use strict';
// Checkout request validation (API-12, BR-STORE-01 step 1). Pure.
const { E } = require('../../errors');
const { check, t } = require('../../lib/validate');
const { TOKENS } = require('./mockGateway');

const SHAPE = {
  order_id: t.id({ required: true }),
  customer_id: t.string({ required: true, min: 1, max: 200 }), // free text, OQ-12
  items: t.array(t.object({
    variant_id: t.id({ required: true }),
    quantity: t.int({ required: true, min: 1, max: 10 }),
  }), { required: true, min: 1, max: 10 }),
  discount_code: t.string({ nullable: true }),
  payment: t.object({ token: t.enum(TOKENS, { required: true }) }, { required: true }),
};

function validateCheckout(input) {
  const r = check(SHAPE, input);
  const fields = r.ok ? [] : [...r.fields];
  if (r.ok) {
    const seen = new Set();
    r.value.items.forEach((it, i) => { if (seen.has(it.variant_id)) fields.push(`items[${i}].variant_id`); seen.add(it.variant_id); });
  }
  if (fields.length) return { ok: false, error: E.VALIDATION_ERROR, details: { fields: [...new Set(fields)] } };
  const v = r.value;
  if (v.discount_code === undefined) v.discount_code = null;
  return { ok: true, value: v };
}

// First item (request order) lacking stock, or null. stockOf: Map variant_id → available units.
function firstOutOfStock(items, stockOf) {
  for (const it of items) if ((stockOf.get(it.variant_id) ?? 0) < it.quantity) return it.variant_id;
  return null;
}

module.exports = { validateCheckout, firstOutOfStock };
