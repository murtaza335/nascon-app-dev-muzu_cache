'use strict';
// Minimal S3-compatible object store for the receipt archive (bucket + object PUT/GET/HEAD/DELETE/list), backed by a
// directory. It exists because MinIO no longer publishes images and the alternatives are 1 GB downloads; the worker's
// `minio` client talks to it unchanged. Not hardened for the internet: it sits on the compose network only and accepts
// any credentials. Receipts of record live in PostgreSQL; this holds archive copies.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(process.env.OBJECT_DIR || '/data');
const PORT = Number.parseInt(process.env.OBJECTSTORE_PORT || '4566', 10);
const MAX_BYTES = 20 * 1024 * 1024;
const NS = 'http://s3.amazonaws.com/doc/2006-03-01/';
const xml = (body) => `<?xml version="1.0" encoding="UTF-8"?>${body}`;
const esc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

function send(res, code, body = '', headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(code, { 'Content-Length': buf.length, 'Server': 'objectstore', ...headers });
  res.end(buf);
}
const error = (res, code, name, message) => send(res, code, xml(`<Error><Code>${name}</Code><Message>${esc(message)}</Message></Error>`), { 'Content-Type': 'application/xml' });

// Resolves bucket/key to a path inside ROOT, or null for anything that could escape it.
function resolve(bucket, key) {
  if (!/^[a-z0-9][a-z0-9.-]{1,62}$/.test(bucket)) return null;
  const full = path.resolve(ROOT, bucket, key || '');
  return full === path.join(ROOT, bucket) || full.startsWith(path.join(ROOT, bucket) + path.sep) ? full : null;
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > MAX_BYTES) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/_health') return send(res, 200, 'ok');
  const parts = url.pathname.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return null; } });
  if (parts.includes(null)) return error(res, 400, 'InvalidURI', 'Bad path');
  const [bucket, ...rest] = parts;
  if (!bucket) return send(res, 200, xml(`<ListAllMyBucketsResult xmlns="${NS}"><Buckets/></ListAllMyBucketsResult>`), { 'Content-Type': 'application/xml' });
  const key = rest.join('/');
  const target = resolve(bucket, key);
  if (!target) return error(res, 400, 'InvalidArgument', 'Invalid bucket or key');

  if (!key) { // bucket operations
    if (req.method === 'PUT') { fs.mkdirSync(target, { recursive: true }); return send(res, 200, '', { Location: `/${bucket}` }); }
    if (!fs.existsSync(target)) return req.method === 'HEAD' ? send(res, 404) : error(res, 404, 'NoSuchBucket', 'The specified bucket does not exist');
    if (req.method === 'HEAD') return send(res, 200, '', { 'x-amz-bucket-region': 'us-east-1' });
    if (req.method === 'GET' && url.searchParams.has('location')) return send(res, 200, xml(`<LocationConstraint xmlns="${NS}"></LocationConstraint>`), { 'Content-Type': 'application/xml' });
    if (req.method === 'GET') {
      const items = fs.readdirSync(target, { withFileTypes: true }).filter((d) => d.isFile())
        .map((d) => `<Contents><Key>${esc(d.name)}</Key><Size>${fs.statSync(path.join(target, d.name)).size}</Size></Contents>`).join('');
      return send(res, 200, xml(`<ListBucketResult xmlns="${NS}"><Name>${esc(bucket)}</Name>${items}</ListBucketResult>`), { 'Content-Type': 'application/xml' });
    }
    return error(res, 405, 'MethodNotAllowed', 'Not supported');
  }

  if (req.method === 'PUT') {
    if (!fs.existsSync(path.join(ROOT, bucket))) return error(res, 404, 'NoSuchBucket', 'The specified bucket does not exist');
    const body = await readBody(req);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(`${target}.tmp`, body);
    fs.renameSync(`${target}.tmp`, target); // atomic: readers never see a partial object
    return send(res, 200, '', { ETag: `"${crypto.createHash('md5').update(body).digest('hex')}"` });
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return req.method === 'HEAD' ? send(res, 404) : error(res, 404, 'NoSuchKey', 'The specified key does not exist');
    const data = fs.readFileSync(target);
    return send(res, 200, req.method === 'HEAD' ? '' : data, { 'Content-Type': 'application/octet-stream', 'Content-Length': data.length, ETag: `"${crypto.createHash('md5').update(data).digest('hex')}"` });
  }
  if (req.method === 'DELETE') { fs.rmSync(target, { force: true }); return send(res, 204); }
  return error(res, 405, 'MethodNotAllowed', 'Not supported');
}

if (require.main === module) {
  fs.mkdirSync(ROOT, { recursive: true });
  const server = http.createServer((req, res) => { handle(req, res).catch((err) => { console.error('[objectstore]', err.message); if (!res.headersSent) error(res, 500, 'InternalError', 'Internal error'); }); });
  server.listen(PORT, '0.0.0.0', () => console.log(`[objectstore] listening on :${PORT}, data in ${ROOT}`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { handle, resolve };
