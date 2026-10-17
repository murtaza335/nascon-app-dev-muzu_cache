'use strict';
const { Router } = require('express');
const { createSport } = require('../../services/sports');
const { validationError } = require('../../errors');

const router = Router();

// API-03 / FR-1.1-01. The domain validator owns the field rules (all offending fields reported at once).
router.post('/sports', async (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    res.status(201).json(await createSport(req.body));
  } catch (err) { next(err); }
});

module.exports = router;
