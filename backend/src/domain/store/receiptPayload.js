'use strict';
// Receipt payload (API-12). Field set is signed exactly as returned (BR-SIG-03). Pure.
function receiptPayload({ order_id, customer_id, items, subtotal_minor, discount_minor, total_minor, paid_at }) {
  return {
    order_id, customer_id,
    items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity, unit_price_minor: i.unit_price_minor })),
    subtotal_minor, discount_minor, total_minor, currency: 'PKR', paid_at,
  };
}

module.exports = { receiptPayload };
