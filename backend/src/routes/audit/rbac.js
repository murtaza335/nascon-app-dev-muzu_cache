'use strict';
const { Router } = require('express');
const { AppError, E } = require('../../errors');
const { authenticate } = require('../../http/middleware/authenticate');
const { authorize } = require('../../domain/rbac/policy');
const resources = require('../../repos/resources');
const auth = require('../../services/auth');

const router = Router();

// API-14: no auth, no body.
router.post('/rbac-matrix', async (req, res, next) => {
  try { res.status(200).json(await auth.rbacMatrix()); } catch (err) { next(err); }
});

// API-15 probes. Order (BR-AUTH-01): 401 → 404 (id does not exist, OQ-11) → 403 → 200. Never mutates, never reads the body.
function probe(method, path, action, loader, notFound) {
  router[method](path, authenticate, async (req, res, next) => {
    try {
      let resource = {};
      if (loader) {
        resource = await loader(req.params.id);
        if (!resource) throw new AppError(notFound);
      }
      if (!authorize(req.principal, action, resource)) throw new AppError(E.FORBIDDEN);
      res.status(200).json({ authorized: true });
    } catch (err) { next(err); }
  });
}

probe('post', '/rbac/tenants', 'tenant.create');
probe('post', '/rbac/leagues/:id/fixtures', 'league.manage', resources.getLeague, E.LEAGUE_NOT_FOUND);
probe('post', '/rbac/clubs/:id/roster', 'club.roster', resources.getClub, E.CLUB_NOT_FOUND);
probe('post', '/rbac/clubs/:id/products', 'club.products', resources.getClub, E.CLUB_NOT_FOUND);
probe('patch', '/rbac/players/:id', 'player.update', resources.getPlayer, E.PLAYER_NOT_FOUND);
probe('get', '/rbac/clubs/:id', 'club.read', resources.getClub, E.CLUB_NOT_FOUND);
probe('get', '/rbac/platform/config', 'platform.config');

module.exports = router;
