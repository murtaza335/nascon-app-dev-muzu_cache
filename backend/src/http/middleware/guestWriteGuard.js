'use strict';
// Mounted first after jsonBody (D2-ADR-07): authentication-layer decision, before validation, 404 and 401.
const { AppError, E } = require('../../errors');
const { blockedGuestToken } = require('../../domain/guest/guard');

function guestWriteGuard(req, res, next) {
  if (!req.path.startsWith('/api/v1') && !req.path.startsWith('/audit/v1')) return next();
  const token = blockedGuestToken(req.method, req.path, req.get('authorization'));
  if (token) return next(new AppError(E.GUEST_WRITE_FORBIDDEN, { guest_token: token }));
  next();
}

module.exports = { guestWriteGuard };
