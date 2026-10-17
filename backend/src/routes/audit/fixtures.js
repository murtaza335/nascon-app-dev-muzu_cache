'use strict';
const { Router } = require('express');
const fixtures = require('../../domain/fixtures');
const { AppError, validationError } = require('../../errors');

const router = Router();

// API-04: pure computation, stores nothing. The route only parses and maps; all rules live in the domain.
router.post('/fixtures', (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    const r = fixtures.generate(req.body);
    if (!r.ok) throw new AppError(r.error, r.details);
    res.status(200).json(r.value);
  } catch (err) { next(err); }
});

module.exports = router;
