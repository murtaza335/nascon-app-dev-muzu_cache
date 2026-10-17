'use strict';
// Stream consumer group (ADR-011/012): logs every domain event; archives the receipt PDF of a paid order to MinIO.
const Minio = require('minio');
const config = require('../config');
const { query } = require('../db');
const { STREAM } = require('./outbox');

const GROUP = 'workers';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function s3Client() {
  const u = new URL(config.s3Endpoint);
  return new Minio.Client({
    endPoint: u.hostname, port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80), useSSL: u.protocol === 'https:',
    accessKey: config.s3AccessKey, secretKey: config.s3SecretKey,
  });
}

// Retries with exponential backoff (0.5 s → 10 s cap) until `fn` succeeds or `stopped()` turns true.
async function retrying(label, fn, stopped) {
  let delay = 500;
  for (;;) {
    try { return await fn(); } catch (err) {
      if (stopped()) throw err;
      console.error(`[worker] ${label} failed (${err.message}); retrying in ${delay} ms`);
      await sleep(delay);
      delay = Math.min(delay * 2, 10000);
    }
  }
}

async function ensureBucket(s3) {
  if (!(await s3.bucketExists(config.s3Bucket))) await s3.makeBucket(config.s3Bucket);
}

async function archiveReceipt(s3, orderId) {
  const { rows } = await query('SELECT pdf FROM orders WHERE order_id = $1', [orderId]);
  if (!rows.length || !rows[0].pdf) return false;
  await s3.putObject(config.s3Bucket, `${orderId}.pdf`, rows[0].pdf, rows[0].pdf.length, { 'Content-Type': 'application/pdf' });
  return true;
}

async function handle(s3, fields, stopped) {
  const payload = JSON.parse(fields.payload);
  console.log(`[event] ${fields.type} ${fields.aggregate_id} ${fields.payload}`);
  if (fields.type === 'order.status_changed' && payload.to === 'paid') {
    await retrying(`archive ${fields.aggregate_id}`, async () => { await ensureBucket(s3); return archiveReceipt(s3, fields.aggregate_id); }, stopped);
    console.log(`[worker] archived receipt ${fields.aggregate_id}.pdf`);
  }
}

async function createGroup(redis) {
  try { await redis.xGroupCreate(STREAM, GROUP, '0', { MKSTREAM: true }); } catch (err) { if (!String(err.message).includes('BUSYGROUP')) throw err; }
}

// One read pass: own pending entries first (crash recovery), then new ones.
async function consumeOnce(redis, s3, consumer, stopped, blockMs = 1000) {
  let handled = 0;
  for (const id of ['0', '>']) {
    const res = await redis.xReadGroup(GROUP, consumer, { key: STREAM, id }, { COUNT: 10, BLOCK: id === '>' ? blockMs : undefined });
    for (const stream of res || []) {
      for (const msg of stream.messages) {
        await handle(s3, msg.message, stopped);
        await redis.xAck(STREAM, GROUP, msg.id);
        handled += 1;
      }
    }
  }
  return handled;
}

module.exports = { GROUP, s3Client, createGroup, consumeOnce, handle, ensureBucket, retrying };
