'use strict';
const { Router } = require('express');
const { appendEvent } = require('../../services/events');
const { getScore } = require('../../services/score');
const { validationError } = require('../../errors');

const router = Router();

// API-06 / FR-1.1-04. 201 on append, 200 on identical replay.
router.post('/events', async (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    const r = await appendEvent(req.body, req.rawBody);
    res.status(r.status).json(r.body);
  } catch (err) { next(err); }
});

// API-07
router.get('/score/:match_id', async (req, res, next) => {
  try { res.status(200).json(await getScore(req.params.match_id)); } catch (err) { next(err); }
});

module.exports = router;
