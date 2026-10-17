'use strict';
const { Router } = require('express');
const reads = require('../../services/appReads');
const writes = require('../../services/appWrites');

const router = Router();

// APP-30
router.get('/clubs/:id', async (req, res, next) => {
  try { res.status(200).json(await reads.clubProfile(req.principal, req.params.id)); } catch (err) { next(err); }
});

// APP-31
router.post('/clubs/:id/players', async (req, res, next) => {
  try { res.status(201).json(await writes.addPlayer(req.principal, req.params.id, req.body)); } catch (err) { next(err); }
});

module.exports = router;
