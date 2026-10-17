'use strict';
// Forward-only SQL migrations (ADR-002): src/migrations/NNN_name.sql, applied in order under an
// advisory lock and recorded in schema_migrations. Safe on a cold DB, on restart and after `down -v`.
const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('./db');

const DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  const files = fs.readdirSync(DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  const client = await pool.connect();
  let applied = 0;
  try {
    // If two replicas boot together, only one migrates at a time.
    await client.query('SELECT pg_advisory_lock(727272)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await client.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
    for (const file of files) {
      if (done.has(file)) continue;
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied++;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
    }
    console.log(`[migrate] ${applied} applied, ${files.length - applied} already present`);
  } finally {
    await client.query('SELECT pg_advisory_unlock(727272)').catch(() => {});
    client.release();
  }
}

module.exports = { runMigrations };
