'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { canonical, canonicalAt } = require('../../../src/lib/canonical');
const { sign } = require('../../../src/lib/signature');

test('NFR-SIG App. A vector 1: demo-salt / evt-1', () => {
  const c = canonical({ team_id: 't1', event_type: 'goal' });
  assert.strictEqual(c, '{"event_type":"goal","team_id":"t1"}');
  assert.strictEqual(sign('demo-salt', 'evt-1', c), '972a8b558690b19121cc5bea84978f85e8eb15a3735018db36616bab1d7ec501');
});

test('NFR-SIG canonical: nested sorting, arrays keep order, no whitespace', () => {
  assert.strictEqual(canonical({ b: [3, { z: 1, a: 2 }], a: null, c: true }), '{"a":null,"b":[3,{"a":2,"z":1}],"c":true}');
});

test('NFR-SIG canonical: non-ASCII is not escaped; control chars use Python escapes', () => {
  assert.strictEqual(canonical({ n: 'é€😀', c: 'a\nb\u0001"\\' }), '{"c":"a\\nb\\u0001\\"\\\\","n":"é€😀"}');
});

test('NFR-SIG canonical: keys sort by code point, not UTF-16 unit (astral after BMP-high)', () => {
  assert.strictEqual(canonical({ '😀': 1, '￿': 2 }), '{"￿":2,"😀":1}');
});

test('NFR-SIG lossless: decimal lexemes are reproduced exactly', () => {
  const raw = '{"type":"score","payload":{"x":1.50,"y":2.0,"big":12345678901234567890,"z":[0.10,-3]}}';
  assert.strictEqual(canonicalAt(raw, ['payload']), '{"big":12345678901234567890,"x":1.50,"y":2.0,"z":[0.10,-3]}');
});

test('NFR-SIG lossless: path into arrays, missing path, duplicate keys keep last', () => {
  const raw = '{"actions":[{"p":{"b":1}},{"p":{"a":2}}],"k":1,"k":2}';
  assert.strictEqual(canonicalAt(raw, ['actions', 1, 'p']), '{"a":2}');
  assert.strictEqual(canonicalAt(raw, ['nope']), undefined);
  assert.strictEqual(canonicalAt(raw, ['k']), '2');
});

test('NFR-SIG lossless: invalid JSON throws', () => {
  assert.throws(() => canonicalAt('{"a":}'), SyntaxError);
  assert.throws(() => canonicalAt('{"a":1} x'), SyntaxError);
});
