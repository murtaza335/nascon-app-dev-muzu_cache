'use strict';
// FR-5.2-02 / BR-DLQ-01: bounded retry. Pure: the transport and the sleeper are injected.
const MAX_ATTEMPTS = 3;

const backoffMs = (baseMs, attemptIndex) => baseMs * 2 ** attemptIndex; // waits after attempt 1, 2 → base, 2·base

// → {delivered:true, attempts} | {delivered:false, attempts, last_error}
async function deliver(send, { baseMs = 5, sleep = () => Promise.resolve() } = {}) {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await send(attempt);
      return { delivered: true, attempts: attempt };
    } catch (err) {
      lastError = err && err.message ? err.message : 'delivery_failed';
      if (attempt < MAX_ATTEMPTS) await sleep(backoffMs(baseMs, attempt - 1));
    }
  }
  return { delivered: false, attempts: MAX_ATTEMPTS, last_error: lastError };
}

const dlqEventId = (n) => `dlq-${String(n).padStart(6, '0')}`;

module.exports = { MAX_ATTEMPTS, backoffMs, deliver, dlqEventId };
