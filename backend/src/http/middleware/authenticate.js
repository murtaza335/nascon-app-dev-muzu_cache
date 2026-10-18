'use strict';
const { AppError, E } = require('../../errors');
const auth = require('../../services/auth');
const day2Cache = require('../../services/day2Cache');

// 401 UNAUTHENTICATED for a missing/invalid/expired token; otherwise sets req.principal.
function authenticate(req, res, next) {
  const m = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
  const claims = m ? auth.verifyToken(m[1]) : null;
  if (!claims || day2Cache.erased.has(claims.sub)) return next(new AppError(E.UNAUTHENTICATED));
  req.principal = auth.principalFromClaims(claims);
  next();
}

module.exports = { authenticate };
