'use strict';
const test = require('node:test');
const assert = require('node:assert');
const pricing = require('../../../src/domain/store/pricing');
const gateway = require('../../../src/domain/store/mockGateway');
const rules = require('../../../src/domain/store/checkoutRules');
const sm = require('../../../src/domain/store/orderStateMachine');
const { receiptPayload } = require('../../../src/domain/store/receiptPayload');
const { renderReceipt } = require('../../../src/pdf/receiptPdf');

test('FR-2.3-01 effective price: latest schedule not after checkout time; base otherwise', () => {
  const sch = [{ effective_from: '2026-10-01T00:00:00Z', price_minor: 500000 }, { effective_from: '2026-11-01T00:00:00Z', price_minor: 600000 }];
  assert.strictEqual(pricing.effectivePrice(450000, sch, '2026-09-30T23:59:59Z'), 450000);
  assert.strictEqual(pricing.effectivePrice(450000, sch, '2026-10-17T00:00:00Z'), 500000);
  assert.strictEqual(pricing.effectivePrice(450000, sch, '2026-11-01T00:00:00Z'), 600000);
  assert.strictEqual(pricing.effectivePrice(450000, [], '2026-11-01T00:00:00Z'), 450000);
});

test('BR-STORE-02 totals: floor(subtotal*10/100) and PKR formatting', () => {
  const lines = [{ unit_price_minor: 450000, quantity: 1 }, { unit_price_minor: 333, quantity: 3 }];
  assert.deepStrictEqual(pricing.totals(lines, 10), { subtotal_minor: 450999, discount_minor: 45099, total_minor: 405900 });
  assert.deepStrictEqual(pricing.totals(lines, 0), { subtotal_minor: 450999, discount_minor: 0, total_minor: 450999 });
  assert.strictEqual(pricing.formatPkr(450000), 'PKR 4500.00');
  assert.strictEqual(pricing.formatPkr(405), 'PKR 4.05');
  assert.strictEqual(pricing.formatPkr(5), 'PKR 0.05');
  assert.strictEqual(pricing.formatPkr(123456789), 'PKR 1234567.89');
});

test('BR-STORE-05 mock gateway outcomes by token; ids use the counter', () => {
  assert.deepStrictEqual(gateway.charge('tok_success', 1), { ok: true, authorization_id: 'auth_1', capture_id: 'cap_1' });
  assert.deepStrictEqual(gateway.charge('tok_success', 7), { ok: true, authorization_id: 'auth_7', capture_id: 'cap_7' });
  assert.deepStrictEqual(gateway.charge('tok_declined', 1), { ok: false, error: 'PAYMENT_DECLINED' });
  assert.deepStrictEqual(gateway.charge('tok_capture_fail', 1), { ok: false, error: 'PAYMENT_CAPTURE_FAILED' });
});

const body = () => ({ order_id: 'o1', customer_id: 'c1', items: [{ variant_id: 'v1', quantity: 1 }], discount_code: null, payment: { token: 'tok_success' } });
const fieldsOf = (b) => { const r = rules.validateCheckout(b); assert.strictEqual(r.ok, false); return r.details.fields.sort(); };

test('API-12 checkout validation: ok, defaults, and every field rule', () => {
  assert.ok(rules.validateCheckout(body()).ok);
  const noCode = body(); delete noCode.discount_code;
  assert.strictEqual(rules.validateCheckout(noCode).value.discount_code, null);
  assert.deepStrictEqual(fieldsOf({}), ['customer_id', 'items', 'order_id', 'payment']);
  const q0 = body(); q0.items[0].quantity = 0;
  assert.deepStrictEqual(fieldsOf(q0), ['items[0].quantity']);
  const q11 = body(); q11.items[0].quantity = 11;
  assert.deepStrictEqual(fieldsOf(q11), ['items[0].quantity']);
  const qf = body(); qf.items[0].quantity = 1.5;
  assert.deepStrictEqual(fieldsOf(qf), ['items[0].quantity']);
  const dup = body(); dup.items.push({ variant_id: 'v1', quantity: 2 });
  assert.deepStrictEqual(fieldsOf(dup), ['items[1].variant_id']);
  const many = body(); many.items = Array.from({ length: 11 }, (_, i) => ({ variant_id: `v${i}`, quantity: 1 }));
  assert.deepStrictEqual(fieldsOf(many), ['items']);
  assert.deepStrictEqual(fieldsOf({ ...body(), items: [] }), ['items']);
  assert.deepStrictEqual(fieldsOf({ ...body(), payment: { token: 'tok_nope' } }), ['payment.token']);
  assert.deepStrictEqual(fieldsOf({ ...body(), customer_id: '' }), ['customer_id']);
  assert.deepStrictEqual(fieldsOf({ ...body(), discount_code: 5 }), ['discount_code']);
  assert.ok(rules.validateCheckout({ ...body(), customer_id: 'free text with spaces | and é' }).ok); // OQ-12
});

test('BR-STORE-01 first out-of-stock item in request order', () => {
  const items = [{ variant_id: 'a', quantity: 2 }, { variant_id: 'b', quantity: 1 }, { variant_id: 'c', quantity: 5 }];
  assert.strictEqual(rules.firstOutOfStock(items, new Map([['a', 2], ['b', 0], ['c', 0]])), 'b');
  assert.strictEqual(rules.firstOutOfStock(items, new Map([['a', 2], ['b', 1], ['c', 5]])), null);
  assert.strictEqual(rules.firstOutOfStock(items, new Map()), 'a');
});

test('BR-STORE-03 order state machine', () => {
  const ok = [['pending', 'paid'], ['paid', 'packed'], ['packed', 'shipped'], ['shipped', 'delivered'], ['pending', 'cancelled'], ['paid', 'cancelled'],
    ['packed', 'cancelled'], ['paid', 'refunded'], ['packed', 'refunded'], ['shipped', 'refunded'], ['delivered', 'refunded']];
  for (const [a, b] of ok) assert.ok(sm.canTransition(a, b), `${a}→${b}`);
  const no = [['pending', 'packed'], ['paid', 'shipped'], ['paid', 'delivered'], ['shipped', 'cancelled'], ['delivered', 'cancelled'], ['cancelled', 'paid'],
    ['refunded', 'paid'], ['packed', 'paid'], ['paid', 'paid'], ['pending', 'refunded']];
  for (const [a, b] of no) assert.ok(!sm.canTransition(a, b), `${a}→${b}`);
  assert.ok(sm.restocks('paid', 'cancelled') && sm.restocks('packed', 'refunded') && !sm.restocks('shipped', 'refunded'));
});

test('API-12 receipt payload is consistent and PDF carries the order id and total as plain text', () => {
  const p = receiptPayload({ order_id: 'ord-001', customer_id: 'cust-001', items: [{ variant_id: 'v', quantity: 1, unit_price_minor: 450000, extra: 1 }],
    subtotal_minor: 450000, discount_minor: 0, total_minor: 450000, paid_at: '2026-10-17T11:20:05Z' });
  assert.deepStrictEqual(Object.keys(p), ['order_id', 'customer_id', 'items', 'subtotal_minor', 'discount_minor', 'total_minor', 'currency', 'paid_at']);
  assert.deepStrictEqual(Object.keys(p.items[0]), ['variant_id', 'quantity', 'unit_price_minor']);
  const pdf = renderReceipt(p);
  const text = pdf.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.includes('Order: ord-001') && text.includes('PKR 4500.00') && text.trimEnd().endsWith('%%EOF'));
  const m = /startxref\n(\d+)\n/.exec(text);
  assert.ok(text.slice(Number(m[1])).startsWith('xref'));
  assert.ok(renderReceipt({ ...p, order_id: 'a(b)\\c' }).toString('latin1').includes('Order: a\\(b\\)\\\\c'));
});
