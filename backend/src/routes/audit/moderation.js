'use strict';
const { Router } = require('express');
const { runProbe } = require('../../services/moderation');
const { validationError } = require('../../errors');

const router = Router();

// API-D2-09
router.post('/moderation/test', async (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    res.status(200).json(await runProbe(req.body));
  } catch (err) { next(err); }
});

module.exports = router;
