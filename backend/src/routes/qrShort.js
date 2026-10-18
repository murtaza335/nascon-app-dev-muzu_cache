'use strict';
const { Router } = require('express');
const qr = require('../services/qr');

const router = Router();

// API-D2-07: 302 to the relative target route; never cached, never rate limited. UA is read once and discarded.
router.get('/q/:code', async (req, res, next) => {
  try {
    const target = await qr.followShortCode(req.params.code, req.get('user-agent'));
    res.status(302).set('Location', target).set('Cache-Control', 'no-store').end();
  } catch (err) { next(err); }
});

module.exports = router;
