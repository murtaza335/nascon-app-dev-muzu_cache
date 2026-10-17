'use strict';
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.pgPoolMax,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
  statement_timeout: 4000, // keeps every request under the 5 s bound (the reset session raises it)
});

// An idle client erroring (e.g. Postgres restart) must not crash the process.
pool.on('error', (err) => console.error('[db] idle client error:', err.message));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDb(retries = 30, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log(`[db] connected (attempt ${attempt})`);
      return;
    } catch (err) {
      console.log(`[db] not ready (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
}

async function ping() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

const query = (text, params) => pool.query(text, params);

// Runs fn(client) in a transaction; commits on return, rolls back on throw.
async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Transaction-scoped advisory lock keyed by a string (e.g. "event:evt-1"). Call inside withTx.
async function advisoryXactLock(client, key) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
}

module.exports = { pool, query, waitForDb, ping, withTx, advisoryXactLock };
