'use strict';
const { Router } = require('express');
const qr = require('../../services/qr');

const router = Router();

// API-D2-06 (declared first so `export.svg` is never read as an entity id)
router.get('/qr/:entity_id/export.:fmt', async (req, res, next) => {
  try {
    const out = await qr.exportQr(req.params.entity_id, req.params.fmt);
    res.status(200).set('Content-Type', out.type).set('Cache-Control', 'no-store').end(out.body);
  } catch (err) { next(err); }
});

// API-D2-05
router.get('/qr/:entity_id', async (req, res, next) => {
  try {
    const body = await qr.resolve(req.params.entity_id, { inspect: req.query.inspect === 'true', ua: req.get('user-agent') });
    res.status(200).json(body);
  } catch (err) { next(err); }
});

module.exports = router;
