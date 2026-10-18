'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sk = require('../../../src/domain/streaming/streamKey');

test('newKey matches the spec pattern', () => assert.match(sk.newKey('9f83a1b2c3d4e5f6'), /^sk_live_[a-f0-9]{16}$/));
test('generate / rotate issue; status codes 201 / 200', () => {
  assert.deepEqual(sk.decide('generate', []), { op: 'issue', status: 201 });
  assert.deepEqual(sk.decide('rotate', [{ status: 'active' }]), { op: 'issue', status: 200 });
});
test('revoke without any key → STREAM_NOT_FOUND', () => assert.deepEqual(sk.decide('revoke', []), { op: 'error', code: 'STREAM_NOT_FOUND' }));
test('revoke when latest is revoked → KEY_REVOKED', () => assert.equal(sk.decide('revoke', [{ status: 'revoked' }, { status: 'active' }]).code, 'KEY_REVOKED'));
test('revoke active key', () => {
  const d = sk.decide('revoke', [{ status: 'active', stream_key: 'k' }]);
  assert.equal(d.op, 'revoke'); assert.equal(d.key.stream_key, 'k'); assert.equal(d.status, 200);
});
test('signature payload has exactly the four spec keys', () => {
  assert.deepEqual(Object.keys(sk.sigPayload('rotate', 'p', 'active', 'k')).sort(), ['action', 'player_id', 'status', 'stream_key']);
});
