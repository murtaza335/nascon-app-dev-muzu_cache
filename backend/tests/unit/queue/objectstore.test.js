'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'objstore-'));
process.env.OBJECT_DIR = dir;
const { handle, resolve } = require('../../../src/objectstore');

function call(server, method, p, body) {
  return new Promise((ok, fail) => {
    const req = http.request({ port: server.address().port, host: '127.0.0.1', method, path: p, headers: body ? { 'Content-Length': Buffer.byteLength(body) } : {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => ok({ status: res.statusCode, body: Buffer.concat(chunks).toString(), headers: res.headers }));
    });
    req.on('error', fail);
    if (body) req.write(body);
    req.end();
  });
}

test('archive store: bucket lifecycle, object round trip, listing, delete', async () => {
  const server = http.createServer((q, r) => handle(q, r)).listen(0);
  try {
    assert.strictEqual((await call(server, 'HEAD', '/receipts')).status, 404);
    assert.strictEqual((await call(server, 'PUT', '/receipts/a.pdf', 'x')).status, 404, 'no object before the bucket');
    assert.strictEqual((await call(server, 'PUT', '/receipts')).status, 200);
    assert.strictEqual((await call(server, 'HEAD', '/receipts')).status, 200);
    assert.match((await call(server, 'GET', '/receipts?location')).body, /LocationConstraint/);
    const put = await call(server, 'PUT', '/receipts/ord-1.pdf', '%PDF-1.4 hello');
    assert.strictEqual(put.status, 200);
    assert.match(put.headers.etag, /^"[0-9a-f]{32}"$/);
    const got = await call(server, 'GET', '/receipts/ord-1.pdf');
    assert.deepStrictEqual([got.status, got.body], [200, '%PDF-1.4 hello']);
    assert.strictEqual((await call(server, 'HEAD', '/receipts/ord-1.pdf')).headers['content-length'], '14');
    assert.match((await call(server, 'GET', '/receipts')).body, /<Key>ord-1\.pdf<\/Key>/);
    assert.strictEqual((await call(server, 'GET', '/receipts/missing.pdf')).status, 404);
    assert.strictEqual((await call(server, 'DELETE', '/receipts/ord-1.pdf')).status, 204);
    assert.strictEqual((await call(server, 'GET', '/receipts/ord-1.pdf')).status, 404);
    assert.strictEqual((await call(server, 'GET', '/_health')).status, 200);
    assert.deepStrictEqual(fs.readdirSync(path.join(dir, 'receipts')), [], 'no temp files left behind');
  } finally { server.close(); }
});

test('archive store: path traversal and bad bucket names are rejected', async () => {
  const server = http.createServer((q, r) => handle(q, r)).listen(0);
  try {
    await call(server, 'PUT', '/receipts');
    for (const p of ['/receipts/..%2F..%2Fetc%2Fpasswd', '/receipts/%2e%2e/secret', '/..%2Fx/key', '/Bad_Bucket/key', '/a/key', '/receipts/%E0%A4%A']) {
      const r = await call(server, 'PUT', p, 'evil');
      assert.ok([400, 404].includes(r.status), `${p} → ${r.status}`);
    }
    assert.deepStrictEqual(fs.readdirSync(dir), ['receipts']);
    assert.strictEqual(resolve('receipts', '../x'), null);
    assert.ok(resolve('receipts', 'a/b.pdf').startsWith(path.join(dir, 'receipts')));
  } finally { server.close(); }
});
