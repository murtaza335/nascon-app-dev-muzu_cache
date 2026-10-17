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
  // Explicit secret wins; otherwise lib/jwt.js derives one from the salt (ARCHITECTURE §9).
  jwtSecret: env.JWT_SECRET || '',
  jwtTtlSeconds: int(env.JWT_TTL_SECONDS, 43200),
  rateLimitMax: int(env.RATE_LIMIT_MAX, 100),
  rateLimitWindowMs: int(env.RATE_LIMIT_WINDOW_MS, 10000),
  reservationTtlSeconds: int(env.RESERVATION_TTL_SECONDS, 60),
  mockGatewayLatencyMs: int(env.MOCK_GATEWAY_LATENCY_MS, 0),
  seedDemoData: bool(env.SEED_DEMO_DATA, false),
  s3Endpoint: env.S3_ENDPOINT || 'http://minio:9000',
  s3Bucket: env.S3_BUCKET_RECEIPTS || 'receipts',
  s3AccessKey: env.MINIO_ROOT_USER || 'minioadmin',
  s3SecretKey: env.MINIO_ROOT_PASSWORD || 'minioadmin',
  workerHeartbeatFile: env.WORKER_HEARTBEAT_FILE || '/tmp/worker.heartbeat',
});
