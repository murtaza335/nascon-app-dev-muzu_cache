'use strict';
// FR-SYS-02 / API-02: wipe all domain state and recreate the exact baseline in ONE transaction.
const { withTx, query } = require('../db');
const { E, appError } = require('../errors');
const hooks = require('./hooks');
const day2Cache = require('./day2Cache');
const { seedBaseline, defaultStock, SPORTS, TENANTS, DEFAULT_SEED, BASELINE_VERSION } = require('../seed/baseline');

const RESET_LOCK = 727273;
// Every table except schema_migrations. RESTART IDENTITY makes audit ids restart at au-0001.
const TABLES = [
  'tenants', 'users', 'sports', 'clubs', 'players', 'leagues', 'matches', 'match_events', 'squads', 'registrations',
  'roster_matches_in_progress', 'roster_audit', 'products', 'variants', 'price_schedules', 'discount_codes',
  'reservations', 'orders', 'payment_attempts', 'idempotency', 'offline_sync_actions', 'outbox', 'counters', 'app_state',
  // Part II
  'stream_keys', 'vods', 'costream_sessions', 'costream_participant_state', 'qr_codes', 'qr_scan_buckets', 'guest_tokens',
  'guest_cart_items', 'carts', 'cart_items', 'chat_rooms', 'chat_messages', 'moderation_actions', 'notification_dlq', 'follows',
];

async function resetAll({ seed = DEFAULT_SEED, stock = {} } = {}) {
  const known = defaultStock();
  for (const id of Object.keys(stock)) {
    if (!Object.hasOwn(known, id)) throw appError(E.VARIANT_NOT_FOUND, { variant_id: id });
  }
  await withTx(async (client) => {
    await client.query('SET LOCAL statement_timeout = 9000');
    await client.query('SET LOCAL app.allow_mutation = \'on\'');
    await client.query('SELECT pg_advisory_xact_lock($1)', [RESET_LOCK]);
    await client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
    await seedBaseline(client, { seed, stock });
  });
  await hooks.everythingChanged();
  await day2Cache.resetAll();
  return {
    status: 'reset_complete',
    seed,
    sports: SPORTS.map((s) => s.sport_id),
    tenants: TENANTS.map((t) => t.tenant_id),
    stock: { ...known, ...stock },
  };
}

// Boot: seed only when the baseline is absent. Never wipes an existing database.
async function ensureBaseline() {
  const { rows } = await query("SELECT value FROM app_state WHERE key = 'baseline_version'");
  if (rows.length && rows[0].value === BASELINE_VERSION) { await day2Cache.resetAll(); return false; }
  await withTx(async (client) => {
    await client.query('SET LOCAL app.allow_mutation = \'on\'');
    await client.query('SELECT pg_advisory_xact_lock($1)', [RESET_LOCK]);
    const again = await client.query("SELECT value FROM app_state WHERE key = 'baseline_version'");
    if (again.rows.length && again.rows[0].value === BASELINE_VERSION) return;
    // Fresh database, or a Phase I database upgraded to Part II: (re)seed the whole baseline once.
    if (again.rows.length) await client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
    await seedBaseline(client, { seed: DEFAULT_SEED });
  });
  await day2Cache.resetAll();
  return true;
}

async function isBaselineReady() {
  try {
    const { rows } = await query("SELECT value FROM app_state WHERE key = 'baseline_version'");
    return rows.length === 1 && rows[0].value === BASELINE_VERSION;
  } catch {
    return false;
  }
}

module.exports = { resetAll, ensureBaseline, isBaselineReady };
