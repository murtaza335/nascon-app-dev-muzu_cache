'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const retry = require('../../../src/domain/notify/retry');
const metrics = require('../../../src/domain/observability/metrics');
const erase = require('../../../src/domain/privacy/erase');

test('retry: delivered on 2nd attempt', async () => {
  let n = 0;
  const r = await retry.deliver(async () => { if (++n < 2) throw new Error('boom'); }, { baseMs: 1 });
  assert.deepEqual(r, { delivered: true, attempts: 2 });
});
test('retry: three attempts then dead-letter with exponential waits', async () => {
  const waits = [];
  const r = await retry.deliver(async () => { throw new Error('simulated_delivery_failure'); }, { baseMs: 5, sleep: async (ms) => waits.push(ms) });
  assert.deepEqual(r, { delivered: false, attempts: 3, last_error: 'simulated_delivery_failure' });
  assert.deepEqual(waits, [5, 10]);
});
test('retry: non-Error rejection gets a default message; ids pad to six digits', async () => {
  const r = await retry.deliver(async () => { throw {}; }, { baseMs: 0 });
  assert.equal(r.last_error, 'delivery_failed'); assert.equal(retry.dlqEventId(7), 'dlq-000007');
});
test('metrics text exposition', () => {
  const t = metrics.render({ ws_connections: 3, active_streams: 1, bitrate_kbps: 2480.4, dlq_depth: 0, qr_scans: 1, sse_connections: 2, per_stream: new Map([['live/sk_live_9f83a1b2c3d4e5f6', 2480]]) });
  for (const name of ['nascon_active_ws_connections 3', 'nascon_active_streams_total 1', 'nascon_stream_bitrate_kbps 2480', 'nascon_dlq_depth 0', 'nascon_qr_scans_total 1', 'nascon_sse_connections 2']) assert.ok(t.includes(name), name);
  assert.ok(t.includes('# TYPE nascon_qr_scans_total counter')); assert.ok(t.includes('# HELP nascon_dlq_depth'));
  assert.ok(t.includes('{stream="live/sk_live_9f83"}')); assert.ok(!t.includes('9f83a1b2c3d4e5f6'));
  assert.ok(metrics.render({}).includes('nascon_dlq_depth 0'));
});
test('erasure values are deterministic', () => {
  assert.match(erase.erasedEmail('u1'), /^erased-[0-9a-f]{12}@invalid$/); assert.equal(erase.erasedEmail('u1'), erase.erasedEmail('u1'));
  assert.notEqual(erase.pseudonym('a'), erase.pseudonym('b'));
});
