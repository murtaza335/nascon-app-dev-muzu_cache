'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const jwt = require('../../../src/lib/jwt');

const SECRET = 'test-secret';
const NOW = 1_800_000_000;
const mint = () => jwt.sign({ sub: 'u1', role: 'viewer' }, SECRET, { nowSec: NOW, ttlSeconds: 3600 });
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

test('FR-5.1-02 jwt: valid token verifies and carries claims', () => {
  const { token, claims } = mint();
  const got = jwt.verify(token, SECRET, NOW + 10);
  assert.strictEqual(got.sub, 'u1');
  assert.strictEqual(got.exp - got.iat, 3600);
  assert.ok(claims.jti);
});

test('FR-5.1-02 jwt: tampered signature, payload and wrong secret are rejected', () => {
  const { token } = mint();
  const [h, p, s] = token.split('.');
  assert.strictEqual(jwt.verify(`${h}.${p}.${s.slice(0, -2)}AA`, SECRET, NOW), null);
  const forged = b64u({ sub: 'u1', role: 'super_admin', exp: NOW + 3600 });
  assert.strictEqual(jwt.verify(`${h}.${forged}.${s}`, SECRET, NOW), null);
  assert.strictEqual(jwt.verify(token, 'other', NOW), null);
});

test('FR-5.1-02 jwt: alg none and non-HS256 headers are rejected', () => {
  const payload = b64u({ sub: 'u1', role: 'super_admin', exp: NOW + 3600 });
  assert.strictEqual(jwt.verify(`${b64u({ alg: 'none', typ: 'JWT' })}.${payload}.`, SECRET, NOW), null);
  assert.strictEqual(jwt.verify(`${b64u({ alg: 'none' })}.${payload}.x`, SECRET, NOW), null);
  const h = b64u({ alg: 'HS512', typ: 'JWT' });
  const sig = crypto.createHmac('sha512', SECRET).update(`${h}.${payload}`).digest('base64url');
  assert.strictEqual(jwt.verify(`${h}.${payload}.${sig}`, SECRET, NOW), null);
});

test('FR-5.1-02 jwt: expired, missing exp and malformed tokens are rejected', () => {
  const { token } = mint();
  assert.strictEqual(jwt.verify(token, SECRET, NOW + 3600), null);
  const h = b64u({ alg: 'HS256', typ: 'JWT' });
  const p = b64u({ sub: 'u1' });
  const sig = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  assert.strictEqual(jwt.verify(`${h}.${p}.${sig}`, SECRET, NOW), null);
  for (const bad of ['', 'a.b', 'a.b.c.d', 'not a token', null, undefined, 42]) assert.strictEqual(jwt.verify(bad, SECRET, NOW), null);
});

test('FR-5.1-02 jwt: derived secret is stable and salt-dependent', () => {
  assert.strictEqual(jwt.deriveSecret('s1'), jwt.deriveSecret('s1'));
  assert.notStrictEqual(jwt.deriveSecret('s1'), jwt.deriveSecret('s2'));
});
