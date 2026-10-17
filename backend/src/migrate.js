'use strict';
// Idempotent startup migrations (ADR-002). Safe on a cold DB, on restart and after `down -v`.
const { pool } = require('./db');

const MIGRATIONS = [
  // EXAMPLE table for routes/example.js. Replace with the spec's schema on the day.
  `CREATE TABLE IF NOT EXISTS items (
     id SERIAL PRIMARY KEY,
     name VARCHAR(100) NOT NULL,
     description VARCHAR(500),
     quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

// Seeding must be deterministic and idempotent: fixed values, fixed ids, and
// INSERT ... ON CONFLICT DO NOTHING so a restart never duplicates rows.
async function seed(client) { // eslint-disable-line no-unused-vars
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Advisory lock: if two backend replicas boot together, only one migrates at a time.
    await client.query('SELECT pg_advisory_lock(727272)');
    await client.query('BEGIN');
    for (const sql of MIGRATIONS) await client.query(sql);
    await seed(client);
    await client.query('COMMIT');
    console.log(`[migrate] ${MIGRATIONS.length} migration(s) applied`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727272)').catch(() => {});
    client.release();
  }
}

module.exports = { runMigrations, seed };
