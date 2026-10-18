'use strict';
const { Router } = require('express');
const { createSession } = require('../../services/costream');
const { validationError } = require('../../errors');

const router = Router();

// API-D2-04
router.post('/costream/session', async (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    const r = await createSession(req.body);
    res.status(r.status).json(r.body);
  } catch (err) { next(err); }
});

module.exports = router;
