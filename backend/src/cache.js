'use strict';
// REQ-INF-03: Redis cache-aside with version-key invalidation (ADR-003, docs/CACHING.md).
// A Redis failure never fails a request: the loader runs and the result is served as BYPASS.
const { createClient } = require('redis');
const config = require('./config');

const PREFIX = 'nascon:v1';
const verKey = (resource) => `${PREFIX}:ver:${resource}`;

let client = null;
let lastErrorLog = 0;
const inflight = new Map();
// Resources whose invalidation failed: bypassed until an INCR succeeds, so a Redis
// blip during a write can never leave a stale cached read behind.
const pendingInvalidation = new Set();

function logError(msg) {
  const now = Date.now();
  if (now - lastErrorLog > 10000) {
    lastErrorLog = now;
    console.error(`[cache] ${msg}`);
  }
}

function withTimeout(promise, ms = config.cacheTimeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`redis timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const ready = () => client !== null && client.isReady;

// Non-blocking: boot continues even if Redis is down; the client reconnects in the background.
function connect() {
  if (!config.cacheEnabled || client) return;
  client = createClient({
    url: config.redisUrl,
    disableOfflineQueue: true,
    socket: { connectTimeout: 2000, reconnectStrategy: (n) => Math.min(n * 50, 500) },
  });
  client.on('error', (err) => logError(`redis error: ${err.message}`));
  client.on('ready', () => console.log('[cache] redis ready'));
  client.connect().catch((err) => logError(`initial connect failed: ${err.message}`));
}

async function disconnect() {
  if (!client) return;
  try {
    await withTimeout(client.quit(), 1000);
  } catch {
    try { client.disconnect(); } catch { /* already closed */ }
  }
  client = null;
}

// Deterministic JSON: object keys sorted so {a,b} and {b,a} produce the same cache key.
function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

const jitter = (ttl) => Math.max(1, Math.round(ttl * (0.9 + Math.random() * 0.2)));

async function cached(resource, keyParts, loader, { ttl = config.cacheTtlSeconds } = {}) {
  if (!config.cacheEnabled || !ready()) return { value: await loader(), status: 'BYPASS' };
  if (pendingInvalidation.has(resource) && !(await invalidate(resource))) {
    return { value: await loader(), status: 'BYPASS' };
  }

  let key;
  try {
    // Key carries the global epoch (bumped by /reset) and the resource version (bumped by writes).
    const [epoch, version] = await withTimeout(client.mGet([verKey('epoch'), verKey(resource)]));
    key = `${PREFIX}:${resource}:e${epoch || '0'}:v${version || '0'}:${stableStringify(keyParts)}`;
    const hit = await withTimeout(client.get(key));
    if (hit !== null) return { value: JSON.parse(hit), status: 'HIT' };
  } catch (err) {
    logError(`read failed, bypassing: ${err.message}`);
    return { value: await loader(), status: 'BYPASS' };
  }

  // Single-flight: concurrent misses for the same key share one loader call.
  if (inflight.has(key)) return { value: await inflight.get(key), status: 'MISS' };
  const p = (async () => {
    const value = await loader(); // loader errors propagate and are never cached
    if (value !== null && value !== undefined) {
      try {
        await withTimeout(client.set(key, JSON.stringify(value), { EX: jitter(ttl) }));
      } catch (err) {
        logError(`write failed: ${err.message}`);
      }
    }
    return value;
  })();
  inflight.set(key, p);
  try {
    return { value: await p, status: 'MISS' };
  } finally {
    inflight.delete(key);
  }
}

// O(1) invalidation of every key of a resource: bump its version (no SCAN/DEL).
// Version keys carry no TTL so volatile-lru never evicts them.
async function invalidate(resource) {
  if (!config.cacheEnabled) return false;
  if (!ready()) {
    pendingInvalidation.add(resource);
    return false;
  }
  try {
    await withTimeout(client.incr(verKey(resource)));
    pendingInvalidation.delete(resource);
    return true;
  } catch (err) {
    pendingInvalidation.add(resource);
    logError(`invalidate(${resource}) failed: ${err.message}`);
    return false;
  }
}

async function ping() {
  if (!config.cacheEnabled || !ready()) return false;
  try {
    return (await withTimeout(client.ping())) === 'PONG';
  } catch {
    return false;
  }
}

module.exports = { connect, disconnect, cached, invalidate, ping, stableStringify };
