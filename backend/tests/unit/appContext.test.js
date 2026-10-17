'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const file = path.resolve(__dirname, '../../src/services/appReads.js');
const localRequire = createRequire(file);
const requested = [];
const appRepo = { getTenant: async id => id === 'known' ? { tenant_id: id } : null, context: async scope => { requested.push(scope); return { scope }; } };
const loaded = { exports: {} };
new Function('require', 'module', 'exports', fs.readFileSync(file, 'utf8'))(name => name === '../repos/app' ? appRepo : ['../errors', '../http/guard', '../lib/validate'].includes(name) ? localRequire(name) : {}, loaded, loaded.exports);
const { context } = loaded.exports;

test('APP-03: P6 scopes non-admin context to the authenticated tenant', async () => {
  assert.deepEqual(await context({ role: 'viewer', tenant_id: 'known' }), { scope: 'known' });
});
test('APP-03: foreign scope is denied before any directory query', async () => {
  const count = requested.length;
  await assert.rejects(context({ role: 'viewer', tenant_id: 'known' }, 'foreign'), e => e.code === 'FORBIDDEN');
  assert.equal(requested.length, count);
});
test('APP-03: admin can discover all or one existing tenant', async () => {
  assert.deepEqual(await context({ role: 'super_admin' }), { scope: null });
  assert.deepEqual(await context({ role: 'super_admin' }, 'known'), { scope: 'known' });
});
test('APP-03: invalid selector and authorized missing tenant preserve error contracts', async () => {
  await assert.rejects(context({ role: 'super_admin' }, ['known']), e => e.code === 'VALIDATION_ERROR');
  await assert.rejects(context({ role: 'super_admin' }, 'bad id'), e => e.code === 'VALIDATION_ERROR');
  await assert.rejects(context({ role: 'super_admin' }, 'missing'), e => e.code === 'TENANT_NOT_FOUND');
});
