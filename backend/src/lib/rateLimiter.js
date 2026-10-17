'use strict';
// Sliding-log limiter (BR-RL-01, ADR-010). Only ALLOWED requests consume quota.
class RateLimiter {
  constructor(max, windowMs) {
    this.max = max;
    this.windowMs = windowMs;
    this.logs = new Map();
  }

  // Returns {allowed:true} or {allowed:false, retryAfterSeconds}. nowMs is injected.
  hit(key, nowMs) {
    const log = (this.logs.get(key) || []).filter((t) => t > nowMs - this.windowMs);
    if (log.length >= this.max) {
      this.logs.set(key, log);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((log[0] + this.windowMs - nowMs) / 1000)) };
    }
    log.push(nowMs);
    this.logs.set(key, log);
    if (this.logs.size > 10000) this.sweep(nowMs);
    return { allowed: true };
  }

  sweep(nowMs) {
    for (const [k, log] of this.logs) if (!log.length || log[log.length - 1] <= nowMs - this.windowMs) this.logs.delete(k);
  }
}

module.exports = { RateLimiter };
