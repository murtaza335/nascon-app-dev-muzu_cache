'use strict';
const express = require('express');
const { notFoundHandler, errorHandler } = require('../errors');
const { requestId } = require('./middleware/requestId');
const { jsonBody } = require('./middleware/jsonBody');
const healthRoutes = require('../routes/health');
const resetRoutes = require('../routes/audit/reset');
const sportsRoutes = require('../routes/audit/sports');
const eventsRoutes = require('../routes/audit/events');
const rbacRoutes = require('../routes/audit/rbac');
const pingRoutes = require('../routes/api/ping');
const { rateLimit } = require('./middleware/rateLimit');

// Middleware order (ARCHITECTURE §7.1): requestId → bodyLimit/jsonBody → routers → notFound → errorHandler.
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  app.use(requestId);
  app.use(jsonBody);

  app.use(healthRoutes);
  app.use('/audit/v1', resetRoutes);
  app.use('/audit/v1', rbacRoutes);
  app.use('/audit/v1', sportsRoutes);
  app.use('/audit/v1', eventsRoutes);
  app.use('/api/v1', rateLimit, pingRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
