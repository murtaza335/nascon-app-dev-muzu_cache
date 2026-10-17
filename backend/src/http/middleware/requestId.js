'use strict';
const crypto = require('node:crypto');

// Sets X-Request-Id and logs "METHOD path status ms request_id" when the response finishes.
function requestId(req, res, next) {
  const start = process.hrtime.bigint();
  req.id = crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(1)}ms ${req.id}`);
  });
  next();
}

module.exports = { requestId };
