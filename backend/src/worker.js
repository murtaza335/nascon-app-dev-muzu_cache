'use strict';
// Worker process (same image as the API): outbox relay → Redis Stream, consumer group, reservation sweeper.
const fs = require('node:fs');
const { createClient } = require('redis');
const config = require('./config');
const db = require('./db');
const { installProcessHandlers } = require('./errors');
const { relayBatch } = require('./queue/outbox');
const consumers = require('./queue/consumers');
const { sweepExpired } = require('./queue/sweeper');
const reconciler = require('./queue/mediaReconciler');

installProcessHandlers();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let stopping = false;
const stopped = () => stopping;

async function loop(name, intervalMs, fn) {
  let backoff = 500;
  while (!stopping) {
    try {
      const worked = await fn();
      backoff = 500;
      if (!worked) await sleep(intervalMs);
    } catch (err) {
      if (stopping) break;
      console.error(`[worker] ${name} error: ${err.message}; retrying in ${backoff} ms`);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 10000);
    }
  }
}

async function main() {
  await db.waitForDb();
  const redis = createClient({ url: config.redisUrl, socket: { reconnectStrategy: (n) => Math.min(n * 100, 3000) } });
  redis.on('error', (err) => console.error(`[worker] redis error: ${err.message}`));
  await redis.connect();
  await consumers.createGroup(redis);
  const consumerRedis = redis.duplicate(); // blocking reads need their own connection
  consumerRedis.on('error', () => {});
  await consumerRedis.connect();
  const s3 = consumers.s3Client();
  console.log('[worker] started (relay, consumer, sweeper, media reconciler)');

  const heartbeat = setInterval(() => { try { fs.writeFileSync(config.workerHeartbeatFile, String(Date.now())); } catch { /* read-only fs */ } }, 5000);
  fs.writeFileSync(config.workerHeartbeatFile, String(Date.now()));

  const loops = [
    loop('relay', 250, async () => (await relayBatch(redis)) > 0),
    loop('consumer', 0, async () => (await consumers.consumeOnce(consumerRedis, s3, 'worker-1', stopped)) > 0),
    loop('media-reconcile', 1000, async () => { await reconciler.run(); return false; }),
    loop('sweeper', 10000, async () => { await sweepExpired(); return false; }),
  ];

  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`[worker] ${signal} received, draining`);
    clearInterval(heartbeat);
    setTimeout(() => process.exit(0), 5000).unref();
    await Promise.allSettled(loops);
    await db.pool.end().catch(() => {});
    await redis.quit().catch(() => {});
    await consumerRedis.quit().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => { console.error('[worker] fatal:', err); process.exit(1); });
