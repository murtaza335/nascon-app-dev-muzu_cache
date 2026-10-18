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
const streamKeyRoutes = require('../routes/audit/streamKey');
const costreamRoutes = require('../routes/audit/costream');
const qrRoutes = require('../routes/audit/qr');
const guestRoutes = require('../routes/audit/guest');
const moderationRoutes = require('../routes/audit/moderation');
const privacyRoutes = require('../routes/audit/privacy');
const internalMediaRoutes = require('../routes/internalMedia');
const webRoutes = require('../routes/web');
const qrShortRoutes = require('../routes/qrShort');
const metricsRoutes = require('../routes/metrics');
const pingRoutes = require('../routes/api/ping');
const authApi = require('../routes/api/auth');
const { authenticate } = require('./middleware/authenticate');
const day2Public = require('../routes/api/day2Public');
const apiRouters = [require('../routes/api/day2Member'),
  authApi.protectedRouter, require('../routes/api/leagues'), require('../routes/api/matches'), require('../routes/api/clubs'),
  require('../routes/api/roster'), require('../routes/api/store'), require('../routes/api/offlineSync'),
];
const { guestWriteGuard } = require('./middleware/guestWriteGuard');
const { rateLimit } = require('./middleware/rateLimit');

// Middleware order (ARCHITECTURE §7.1): requestId → bodyLimit/jsonBody → routers → notFound → errorHandler.
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  app.use(requestId);
  app.use(guestWriteGuard); // header-only decision: runs before the body is read or parsed
  app.use(jsonBody);

  app.use(healthRoutes);
  app.use(metricsRoutes);
  app.use(qrShortRoutes);
  app.use(internalMediaRoutes);
  app.use(webRoutes);
  app.use('/audit/v1', resetRoutes);
  app.use('/audit/v1', rbacRoutes);
  app.use('/audit/v1', sportsRoutes);
  app.use('/audit/v1', eventsRoutes);
  app.use('/audit/v1', leaguesRoutes);
  app.use('/audit/v1', fixturesRoutes);
  app.use('/audit/v1', storeRoutes);
  app.use('/audit/v1', rosterRoutes);
  app.use('/audit/v1', syncRoutes);
  for (const r of [streamKeyRoutes, costreamRoutes, qrRoutes, guestRoutes, moderationRoutes, privacyRoutes]) app.use('/audit/v1', r);
  // /api/v1: rate limit → public routes (ping, login) → authentication → protected routes.
  app.use('/api/v1', rateLimit, pingRoutes, day2Public, authApi.publicRouter, authenticate, ...apiRouters);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
