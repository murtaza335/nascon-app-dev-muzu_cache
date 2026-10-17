'use strict';
// The only file that reads process.env. Everything else imports this frozen object.

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(String(value).toLowerCase());
}

const env = process.env;

module.exports = Object.freeze({
  port: int(env.PORT, 3000),
  nodeEnv: env.NODE_ENV || 'development',
  databaseUrl: env.DATABASE_URL || 'postgres://app:app@localhost:5432/app',
  redisUrl: env.REDIS_URL || 'redis://localhost:6379',
  cacheEnabled: bool(env.CACHE_ENABLED, true),
  cacheTtlSeconds: int(env.CACHE_TTL_SECONDS, 60),
  cacheTimeoutMs: int(env.CACHE_TIMEOUT_MS, 200),
  logLevel: env.LOG_LEVEL || 'info',
});
