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
  port: int(env.PORT, 8080),
  nodeEnv: env.NODE_ENV || 'development',
  databaseUrl: env.DATABASE_URL || 'postgres://app:app@localhost:5432/app',
  pgPoolMax: int(env.PG_POOL_MAX, 20),
  redisUrl: env.REDIS_URL || 'redis://localhost:6379',
  cacheEnabled: bool(env.CACHE_ENABLED, true),
  cacheTtlSeconds: int(env.CACHE_TTL_SECONDS, 60),
  cacheTimeoutMs: int(env.CACHE_TIMEOUT_MS, 200),
  logLevel: env.LOG_LEVEL || 'info',
  // Secret: never trimmed, never logged. Boot refuses to start without it (index.js).
  day1Salt: env.DAY1_SALT || '',
  jwtTtlSeconds: int(env.JWT_TTL_SECONDS, 43200),
  rateLimitMax: int(env.RATE_LIMIT_MAX, 100),
  rateLimitWindowMs: int(env.RATE_LIMIT_WINDOW_MS, 10000),
  reservationTtlSeconds: int(env.RESERVATION_TTL_SECONDS, 60),
  mockGatewayLatencyMs: int(env.MOCK_GATEWAY_LATENCY_MS, 0),
  seedDemoData: bool(env.SEED_DEMO_DATA, false),
});
