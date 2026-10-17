'use strict';
const config = require('./config');
const { installProcessHandlers } = require('./errors');
const db = require('./db');
const cache = require('./cache');
const { runMigrations } = require('./migrate');
const { createApp } = require('./app');

installProcessHandlers();

async function main() {
  await db.waitForDb();
  await runMigrations();
  cache.connect(); // non-blocking: the API works (BYPASS) while Redis is unavailable

  const server = createApp().listen(config.port, '0.0.0.0', () => {
    console.log(`[boot] listening on 0.0.0.0:${config.port} (cache ${config.cacheEnabled ? 'enabled' : 'disabled'})`);
  });
  server.keepAliveTimeout = 65000;

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received`);
    const force = setTimeout(() => process.exit(1), 5000);
    force.unref();
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeIdleConnections(); // keep-alive sockets would otherwise hold close() open
    await closed;
    await db.pool.end().catch(() => {});
    await cache.disconnect();
    clearTimeout(force);
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[boot] fatal:', err);
  process.exit(1);
});
