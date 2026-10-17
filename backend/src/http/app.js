'use strict';
const express = require('express');
const { notFoundHandler, errorHandler } = require('../errors');
const { requestId } = require('./middleware/requestId');
const { jsonBody } = require('./middleware/jsonBody');
const healthRoutes = require('../routes/health');
const resetRoutes = require('../routes/audit/reset');
const sportsRoutes = require('../routes/audit/sports');
const eventsRoutes = require('../routes/audit/events');
const leaguesRoutes = require('../routes/audit/leagues');
const fixturesRoutes = require('../routes/audit/fixtures');
const storeRoutes = require('../routes/audit/store');
const rosterRoutes = require('../routes/audit/roster');
const syncRoutes = require('../routes/audit/offlineSync');
const rbacRoutes = require('../routes/audit/rbac');
const pingRoutes = require('../routes/api/ping');
const authApi = require('../routes/api/auth');
const { authenticate } = require('./middleware/authenticate');
const apiRouters = [
  authApi.protectedRouter, require('../routes/api/leagues'), require('../routes/api/matches'), require('../routes/api/clubs'),
  require('../routes/api/roster'), require('../routes/api/store'), require('../routes/api/offlineSync'),
];
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
  app.use('/audit/v1', leaguesRoutes);
  app.use('/audit/v1', fixturesRoutes);
  app.use('/audit/v1', storeRoutes);
  app.use('/audit/v1', rosterRoutes);
  app.use('/audit/v1', syncRoutes);
  // /api/v1: rate limit → public routes (ping, login) → authentication → protected routes.
  app.use('/api/v1', rateLimit, pingRoutes, authApi.publicRouter, authenticate, ...apiRouters);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
