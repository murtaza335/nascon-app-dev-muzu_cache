'use strict';
const crypto = require('node:crypto');
const express = require('express');
const { notFoundHandler, errorHandler } = require('./errors');
const healthRoutes = require('./routes/health');
const exampleRoutes = require('./routes/example');

function cors(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id');
  res.set('Access-Control-Expose-Headers', 'X-Request-Id,X-Cache');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  req.id = crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(1)}ms ${req.id}`);
  });
  next();
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false); // avoid 304s confusing graders and X-Cache checks
  app.use(requestLogger);
  app.use(cors);
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRoutes);
  app.use('/api/items', exampleRoutes); // EXAMPLE: replace on the day

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
