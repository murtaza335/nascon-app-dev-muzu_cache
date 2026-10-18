'use strict';
// Docker-network-only endpoints for the media server (API-D2-30/36/37). Events and inputs need the shared hook token.
const { Router } = require('express');
const config = require('../config');
const { AppError, E } = require('../errors');
const hooks = require('../services/mediaHooks');
const costream = require('../services/costream');

const router = Router();

function needToken(req, res, next) {
  if (req.get('x-media-hook-token') !== config.mediaHookToken) return next(new AppError(E.UNAUTHENTICATED));
  next();
}

router.post('/internal/media/auth', async (req, res, next) => {
  try { await hooks.authorize(req.body || {}); res.status(200).json({}); } catch (err) { next(err); }
});
router.post('/internal/media/events', needToken, async (req, res, next) => {
  try { await hooks.onEvent(req.body || {}); res.status(200).json({}); } catch (err) { next(err); }
});
router.get('/internal/costream/:id/inputs', needToken, async (req, res, next) => {
  try { res.status(200).type('text/plain').send(await costream.compositorInputs(req.params.id)); } catch (err) { next(err); }
});

module.exports = router;
