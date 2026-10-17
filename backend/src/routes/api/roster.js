'use strict';
const { Router } = require('express');
const writes = require('../../services/appWrites');

const router = Router();

// APP-32: requested_by is the caller (server-set)
router.post('/roster/transfers', async (req, res, next) => {
  try {
    const r = await writes.transfer(req.principal, req.body);
    res.status(r.status).json(r.body);
  } catch (err) { next(err); }
});

// APP-33
router.get('/players/:id/history', async (req, res, next) => {
  try { res.status(200).json(await writes.playerHistory(req.principal, req.params.id, req.query.as_of)); } catch (err) { next(err); }
});

// APP-34
router.patch('/players/:id', async (req, res, next) => {
  try { res.status(200).json(await writes.patchPlayer(req.principal, req.params.id, req.body)); } catch (err) { next(err); }
});

module.exports = router;
