'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { RateLimiter } = require('../../../src/lib/rateLimiter');

test('BR-RL-01 allows 100 per 10 s, rejects the 101st with Retry-After >= 1', () => {
  const rl = new RateLimiter(100, 10000);
  for (let i = 0; i < 100; i++) assert.ok(rl.hit('ip', 1000 + i).allowed);
  const r = rl.hit('ip', 1500);
  assert.deepStrictEqual(r, { allowed: false, retryAfterSeconds: 10 });
});

test('BR-RL-01 rejected requests do not consume quota; window slides', () => {
  const rl = new RateLimiter(2, 10000);
  assert.ok(rl.hit('ip', 0).allowed);
  assert.ok(rl.hit('ip', 5000).allowed);
  for (let i = 0; i < 20; i++) assert.ok(!rl.hit('ip', 6000).allowed);
  assert.ok(rl.hit('ip', 10001).allowed); // first hit left the window; rejected ones were not counted
  assert.ok(!rl.hit('ip', 10002).allowed);
});

test('BR-RL-01 keys are independent; retry-after is never below 1', () => {
  const rl = new RateLimiter(1, 10000);
  assert.ok(rl.hit('a', 0).allowed);
  assert.ok(rl.hit('b', 0).allowed);
  assert.strictEqual(rl.hit('a', 9999).retryAfterSeconds, 1);
});
