'use strict';
const config = require('../../config');
const { AppError, E } = require('../../errors');
const { RateLimiter } = require('../../lib/rateLimiter');

const limiter = new RateLimiter(config.rateLimitMax, config.rateLimitWindowMs);

// BR-RL-01: per socket address; X-Forwarded-For is ignored. Mounted on /api/v1 only.
function rateLimit(req, res, next) {
  const r = limiter.hit(req.socket.remoteAddress || 'unknown', Date.now());
  if (r.allowed) return next();
  const err = new AppError(E.RATE_LIMITED, { retry_after_seconds: r.retryAfterSeconds });
  err.headers = { 'Retry-After': String(r.retryAfterSeconds) };
  next(err);
}

module.exports = { rateLimit };
