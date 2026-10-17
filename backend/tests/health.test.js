'use strict';
// Integration smoke against a running backend (docker compose up first).
const test = require('node:test');
const assert = require('node:assert');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test('req00_health_returns_ok', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  const body = await res.json();
  assert.strictEqual(body.status, 'ok');
  assert.strictEqual(body.db, true);
  assert.strictEqual(typeof body.cache, 'boolean');
});
