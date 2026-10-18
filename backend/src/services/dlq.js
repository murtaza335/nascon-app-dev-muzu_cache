'use strict';
// FR-5.2: bounded retry then persistent DLQ. Depth is count(*) (loaded at boot/reset) mirrored in memory (D2-ADR-11).
const config = require('../config');
const { withTx } = require('../db');
const retry = require('../domain/notify/retry');
const repo = require('../repos/dlq');
const cache = require('./day2Cache');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Dispatches `n` notifications through the real retry path against a transport that always fails (probe),
// then stores the dead letters in one transaction.
async function simulateFailures(n, topic = 'notification.simulated', target = 'simulated-subscriber') {
  if (n <= 0) return 0;
  const failing = async () => { throw new Error('simulated_delivery_failure'); };
  const outcomes = await Promise.all(Array.from({ length: n }, () => retry.deliver(failing, { baseMs: config.dlqBackoffMs, sleep })));
  const dead = outcomes.filter((o) => !o.delivered).map((o) => ({ topic, target, attempts: o.attempts, last_error: o.last_error }));
  await withTx((client) => repo.insertMany(client, dead));
  cache.dlq.depth += dead.length;
  return dead.length;
}

// Real notification path: deliver via `send`; on exhaustion the event is dead-lettered.
async function dispatch(send, { topic, target, payload }) {
  const out = await retry.deliver(send, { baseMs: config.dlqBackoffMs, sleep });
  if (!out.delivered) {
    await withTx((client) => repo.insertMany(client, [{ topic, target, payload, attempts: out.attempts, last_error: out.last_error }]));
    cache.dlq.depth += 1;
  }
  return out;
}

async function status() {
  const depth = cache.dlq.depth;
  return { queue_depth: depth, undelivered_events: depth > 0 ? await repo.list() : [] };
}

module.exports = { simulateFailures, dispatch, status };
