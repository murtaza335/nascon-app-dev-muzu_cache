'use strict';
// FR-2.3-02 / API-12: concurrency-safe checkout (NFR-3).
// One transaction per checkout: order-id advisory lock → replay check → variants locked in variant_id order →
// stock check → pure gateway decision → stock decrement + order + receipt + outbox + replay record, or ROLLBACK
// (which is the "release"). A failed payment is recorded afterwards in its own small transaction (BR-STORE-04).
// Deviation from the two-phase reservation in ARCHITECTURE §6.3 is logged in docs/CHANGELOG.md.
const crypto = require('node:crypto');
const config = require('../config');
const { withTx, advisoryXactLock } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { canonical } = require('../lib/canonical');
const { sign } = require('../lib/signature');
const rules = require('../domain/store/checkoutRules');
const pricing = require('../domain/store/pricing');
const gateway = require('../domain/store/mockGateway');
const { receiptPayload } = require('../domain/store/receiptPayload');
const { renderReceipt } = require('../pdf/receiptPdf');
const store = require('../repos/store');
const idem = require('../repos/idempotency');
const outbox = require('../repos/outbox');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoSeconds = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

class PaymentFailure extends Error {
  constructor(code, token, orderId) { super(code); this.code = code; this.token = token; this.orderId = orderId; }
}

async function checkoutInTx(client, v, hash) {
  await advisoryXactLock(client, `order:${v.order_id}`);
  const prior = await idem.find(client, 'order', v.order_id);
  if (prior) {
    if (prior.request_hash === hash) return { status: 200, body: prior.response };
    throw new AppError(E.DUPLICATE_ORDER_ID);
  }

  const ids = v.items.map((i) => i.variant_id);
  const locked = await store.lockVariants(client, ids);
  const byId = new Map(locked.map((r) => [r.variant_id, r]));
  const missing = ids.find((id) => !byId.has(id));
  if (missing) throw new AppError(E.VARIANT_NOT_FOUND, { variant_id: missing });

  let percent = 0;
  if (v.discount_code !== null) {
    const d = await store.findDiscount(client, v.discount_code);
    if (!d) throw new AppError(E.INVALID_DISCOUNT_CODE);
    percent = d.percent;
  }

  const stockOf = new Map(locked.map((r) => [r.variant_id, r.stock]));
  const short = rules.firstOutOfStock(v.items, stockOf);
  if (short) throw new AppError(E.OUT_OF_STOCK, { variant_id: short });

  const now = new Date();
  const schedules = await store.schedulesFor(client, ids);
  const lines = v.items.map((i) => {
    const row = byId.get(i.variant_id);
    const own = schedules.filter((s) => s.variant_id === i.variant_id);
    return { variant_id: i.variant_id, quantity: i.quantity, unit_price_minor: pricing.effectivePrice(row.price_minor, own, isoSeconds(now)) };
  });
  const totals = pricing.totals(lines, percent);

  if (config.mockGatewayLatencyMs > 0) await sleep(config.mockGatewayLatencyMs);
  const n = await store.nextCounter(client, 'auth');
  const charge = gateway.charge(v.payment.token, n);
  if (!charge.ok) throw new PaymentFailure(charge.error, v.payment.token, v.order_id);
  await store.nextCounter(client, 'cap');

  for (const l of lines) {
    if (!(await store.decrementStock(client, l.variant_id, l.quantity))) throw new AppError(E.OUT_OF_STOCK, { variant_id: l.variant_id });
  }

  const paidAt = isoSeconds(now);
  const payload = receiptPayload({ order_id: v.order_id, customer_id: v.customer_id, items: lines, ...totals, paid_at: paidAt });
  const signature = sign(config.day1Salt, v.order_id, canonical(payload));
  const pdf = renderReceipt(payload);
  const body = {
    order_id: v.order_id, status: 'paid', currency: 'PKR',
    items: lines.map((l) => ({ variant_id: l.variant_id, quantity: l.quantity, unit_price_minor: l.unit_price_minor })),
    ...totals,
    payment: { authorization_id: charge.authorization_id, capture_id: charge.capture_id, state: 'captured' },
    receipt: { payload, signature, pdf_base64: pdf.toString('base64') },
  };
  await store.insertOrder(client, {
    order_id: v.order_id, customer_id: v.customer_id, club_id: byId.get(ids[0]).club_id, items: body.items, ...totals,
    payment: body.payment, receipt: { payload, signature }, pdf, request_hash: hash, response: body,
  });
  await outbox.insert(client, {
    topic: 'order', type: 'order.status_changed', aggregate_id: v.order_id,
    payload: { type: 'order.status_changed', order_id: v.order_id, from: 'pending', to: 'paid', at: paidAt },
  });
  await idem.store(client, 'order', v.order_id, hash, 201, body);
  return { status: 201, body, variantIds: ids };
}

// input: parsed request body. Returns {status, body}.
async function checkout(input) {
  const r = rules.validateCheckout(input);
  if (!r.ok) throw validationError(r.details.fields);
  const v = r.value;
  const hash = crypto.createHash('sha256').update(canonical(v)).digest('hex');
  try {
    return await withTx((client) => checkoutInTx(client, v, hash));
  } catch (err) {
    if (!(err instanceof PaymentFailure)) throw err;
    await withTx(async (client) => {
      await store.insertPaymentAttempt(client, err.orderId, err.token, err.code);
      await outbox.insert(client, {
        topic: 'order', type: 'order.payment_failed', aggregate_id: err.orderId,
        payload: { type: 'order.payment_failed', order_id: err.orderId, reason: err.code, at: isoSeconds(new Date()) },
      });
    });
    throw new AppError(err.code === 'PAYMENT_DECLINED' ? E.PAYMENT_DECLINED : E.PAYMENT_CAPTURE_FAILED);
  }
}

async function getInventory(variantId) {
  const row = await store.getInventory(variantId);
  if (!row) throw new AppError(E.VARIANT_NOT_FOUND, { variant_id: variantId });
  return { variant_id: row.variant_id, stock: row.stock, reserved: row.reserved };
}

module.exports = { checkout, getInventory };
