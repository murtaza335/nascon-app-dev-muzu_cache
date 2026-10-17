'use strict';
const { Router } = require('express');
const sync = require('../../services/sync');
const { validationError } = require('../../errors');

const router = Router();

// API-17 / FR-OFF-01: always HTTP 200 unless the envelope itself is malformed.
router.post('/offline-sync', async (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    res.status(200).json(await sync.process(req.body, req.rawBody));
  } catch (err) { next(err); }
});

module.exports = router;
