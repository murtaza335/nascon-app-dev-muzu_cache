'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const guard = require('../../../src/domain/guest/guard');
const cart = require('../../../src/domain/guest/cartMerge');

test('guest bearer + write on a non-allow-listed route is blocked', () => {
  for (const [m, p] of [['POST', '/api/v1/chat'], ['POST', '/audit/v1/checkout'], ['POST', '/audit/v1/events'], ['PUT', '/api/v1/athletes/p/follow'], ['DELETE', '/api/v1/x'], ['PATCH', '/api/v1/y']]) {
    assert.equal(guard.blockedGuestToken(m, p, 'Bearer guest_anon_tok_7721'), 'guest_anon_tok_7721', `${m} ${p}`);
  }
});
test('reads, member tokens and the allow-list pass', () => {
  assert.equal(guard.blockedGuestToken('GET', '/api/v1/chat/x/messages', 'Bearer guest_a'), null);
  assert.equal(guard.blockedGuestToken('POST', '/api/v1/chat', 'Bearer eyJabc.def.ghi'), null);
  assert.equal(guard.blockedGuestToken('POST', '/api/v1/chat', undefined), null);
  assert.equal(guard.blockedGuestToken('POST', '/api/v1/guest/session', 'Bearer guest_a'), null);
  assert.equal(guard.blockedGuestToken('POST', '/api/v1/guest/cart/items', 'Bearer guest_a'), null);
  assert.equal(guard.blockedGuestToken('DELETE', '/api/v1/guest/cart/items/var-1', 'Bearer guest_a'), null);
  assert.equal(guard.blockedGuestToken('POST', '/audit/v1/guest/cart-merge', 'Bearer guest_a'), null);
  assert.equal(guard.blockedGuestToken('POST', '/api/v1/auth/login', 'Bearer guest_a'), null);
});
test('lower-case scheme and bare "guest_" prefix still count as guest', () => {
  assert.equal(guard.guestTokenOf('bearer guest_x'), 'guest_x'); assert.equal(guard.guestTokenOf('Bearer notguest_x'), null);
});
test('sumLines adds duplicate variants', () => {
  assert.deepEqual([...cart.sumLines([{ variant_id: 'a', quantity: 1 }, { variant_id: 'b', quantity: 2 }, { variant_id: 'a', quantity: 3 }])], [['a', 4], ['b', 2]]);
});
test('firstShort uses merged quantity and reports the first offender', () => {
  const g = new Map([['a', 3], ['b', 9]]);
  const r = cart.firstShort(g, new Map([['a', 3]]), new Map([['a', 5], ['b', 20]]));
  assert.deepEqual(r, { variant_id: 'a', requested: 6, available: 5 });
  assert.equal(cart.firstShort(new Map([['a', 1]]), new Map(), new Map([['a', 1]])), null);
  assert.equal(cart.firstShort(new Map([['z', 1]]), new Map(), new Map()).available, 0);
});
test('requestHash is order independent and user dependent', () => {
  const a = cart.requestHash('u', new Map([['a', 1], ['b', 2]]));
  assert.equal(a, cart.requestHash('u', new Map([['b', 2], ['a', 1]])));
  assert.notEqual(a, cart.requestHash('v', new Map([['a', 1], ['b', 2]])));
  assert.notEqual(a, cart.requestHash('u', new Map([['a', 2], ['b', 2]])));
});
test('cartView sorts items and computes totals', () => {
  const v = cart.cartView('u', [{ variant_id: 'b', quantity: 2, unit_price_minor: 10 }, { variant_id: 'a', quantity: 1, unit_price_minor: 5 }]);
  assert.deepEqual(v.items.map((i) => i.variant_id), ['a', 'b']); assert.equal(v.total_items, 3); assert.equal(v.subtotal_minor, 25); assert.equal(v.currency, 'PKR');
  const sp = cart.sigPayload({ cart_merged: true, guest_token: 'g', write_rejection_code: 403, active_cart: v });
  assert.equal(sp.registered_user_id, 'u'); assert.equal(sp.total_items, 3);
});
