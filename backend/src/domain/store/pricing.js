'use strict';
// Money is integer paisa (BR-STORE-02). Pure.

// Latest schedule entry with effective_from <= atIso wins; otherwise the variant's base price.
function effectivePrice(basePriceMinor, schedules, atIso) {
  let best = null;
  for (const s of schedules) {
    if (s.effective_from <= atIso && (!best || s.effective_from > best.effective_from)) best = s;
  }
  return best ? best.price_minor : basePriceMinor;
}

function totals(lines, discountPercent) {
  const subtotal = lines.reduce((sum, l) => sum + l.unit_price_minor * l.quantity, 0);
  const discount = discountPercent ? Math.floor((subtotal * discountPercent) / 100) : 0;
  return { subtotal_minor: subtotal, discount_minor: discount, total_minor: subtotal - discount };
}

// 450000 → "PKR 4500.00" (major units, two decimals, no thousands separator).
function formatPkr(minor) {
  return `PKR ${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

module.exports = { effectivePrice, totals, formatPkr };
