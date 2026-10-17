'use strict';
const { Router } = require('express');
const reads = require('../../services/appReads');
const writes = require('../../services/appWrites');

const router = Router();

// APP-13
router.get('/matches/:id', async (req, res, next) => {
  try { res.status(200).json(await reads.matchDetail(req.principal, req.params.id)); } catch (err) { next(err); }
});

// APP-14
router.put('/matches/:id/pin', async (req, res, next) => {
  try { res.status(200).json(await writes.pinProduct(req.principal, req.params.id, req.body)); } catch (err) { next(err); }
});

// APP-15
router.post('/matches/:id/events', async (req, res, next) => {
  try {
    const r = await writes.appendMatchEvent(req.principal, req.params.id, req.body, req.rawBody);
    res.status(r.status).json(r.body);
  } catch (err) { next(err); }
});

module.exports = router;
