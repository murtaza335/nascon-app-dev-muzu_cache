'use strict';
const crypto = require('node:crypto');

// Sets X-Request-Id and logs "METHOD path status ms request_id" when the response finishes.
function requestId(req, res, next) {
  const start = process.hrtime.bigint();
  req.id = crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  // Hot probe paths (k6, NFR-2) log 1 % of requests; /q and /audit/v1/qr never log IP or UA anyway (NFR-9).
  const hot = req.path.startsWith('/audit/v1/qr') || req.path === '/metrics' || req.path.startsWith('/q/');
  res.on('finish', () => {
    if (hot && Math.random() > 0.01) return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(1)}ms ${req.id}`);
  });
  next();
}

module.exports = { requestId };
