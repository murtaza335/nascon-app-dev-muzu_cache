'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { variants } = require('../../../src/domain/moderation/normalize');
const engine = require('../../../src/domain/moderation/engine');

const msg = (id, sender, text) => ({ message_id: id, sender, text });

test('leetspeak variants', () => {
  assert.ok(variants('b@d_w0rd').includes('badword'));
  assert.ok(variants('s!c@m').includes('sicam') && variants('s!c@m').includes('scam'));
  assert.ok(variants('p0rn').includes('porn')); assert.ok(variants('idiot_spam').includes('idiotspam'));
  assert.ok(variants('SH​1T').includes('shit'));
});
test('spec example: clean kept, profane masked + kicked, flood dropped + muted', () => {
  const r = engine.evaluate([
    msg('1', 'guest', 'Clean sports commentary'), msg('2', 'spammer', 'Watch this illegal stream b@d_w0rd now!'), msg('3', 'flooder', 'GOAL! AAAA!!!'),
  ]);
  assert.deepEqual(r.filtered, [
    { message_id: '1', sender: 'guest', text: 'Clean sports commentary', flagged: false, reason: null },
    { message_id: '2', sender: 'spammer', text: 'Watch this illegal stream *** now!', flagged: true, reason: 'profanity_leetspeak' },
  ]);
  assert.deepEqual(r.kicked, ['spammer']); assert.deepEqual(r.muted, ['flooder']);
});
test('masking keeps trailing punctuation and suffix forms', () => {
  assert.equal(engine.maskText('b@d_w0rd, shits! fucking').text, '***, ***! ***');
  assert.equal(engine.maskText('classic scampi').hit, false);
});
test('flood rules: 4 identical chars case-insensitively, 3 of !/? (mixed counts)', () => {
  for (const t of ['aaaa', 'AaAa', 'wow!!!', 'what???', 'huh?!?', 'xxxxx']) assert.equal(engine.isFlood(t), true, t);
  for (const t of ['aaa', 'ok!!', 'a? b? c?', 'goal!']) assert.equal(engine.isFlood(t), false, t);
});
test('flood is evaluated before profanity: dropped and only muted', () => {
  const r = engine.evaluate([msg('1', 'u', 'b@dword!!!')]);
  assert.deepEqual(r.filtered, []); assert.deepEqual(r.muted, ['u']); assert.deepEqual(r.kicked, []);
});
test('rate limit: 4th message inside the window is dropped and sender muted; dedupe and order', () => {
  const r = engine.evaluate([1, 2, 3, 4, 5].map((n) => msg(String(n), 'u', `hello ${n}`)), { now: 100, windows: new Map() });
  assert.equal(r.filtered.length, 3); assert.deepEqual(r.muted, ['u']); assert.equal(r.dropped[0].reason, 'rate_limit_exceeded');
  const order = engine.evaluate([msg('1', 'b', 'aaaa'), msg('2', 'a', 'oooo'), msg('3', 'b', 'bbbb')]);
  assert.deepEqual(order.muted, ['b', 'a']);
});
test('rate window slides', () => {
  const w = new Map();
  for (let i = 0; i < 3; i++) engine.evaluate([msg('x', 'u', 'hi')], { now: 0, windows: w });
  assert.equal(engine.evaluate([msg('y', 'u', 'hi')], { now: 2500, windows: w }).filtered.length, 1);
});
test('signature payload', () => {
  assert.deepEqual(engine.sigPayload('r', 1, ['k'], 0), { chat_room_id: 'r', flagged_count: 1, kicked_users: ['k'], queue_depth: 0 });
});
