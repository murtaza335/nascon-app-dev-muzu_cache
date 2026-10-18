'use strict';
const { Router } = require('express');
const { manageKey } = require('../../services/streaming');
const { validationError } = require('../../errors');

const router = Router();

// API-D2-03
router.post('/stream/key', async (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    const r = await manageKey(req.body);
    res.status(r.status).json(r.body);
  } catch (err) { next(err); }
});

module.exports = router;
