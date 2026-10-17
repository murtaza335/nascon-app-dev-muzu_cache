'use strict';
const { Router } = require('express');
const { AppError, E } = require('../errors');
const { isBaselineReady } = require('../services/reset');

const router = Router();

// API-01: 200 {"status":"ok"} only when the DB is reachable and the baseline is seeded. No MinIO dependency.
router.get('/health', async (req, res, next) => {
  if (!(await isBaselineReady())) return next(new AppError(E.SERVICE_UNAVAILABLE));
  res.status(200).json({ status: 'ok' });
});

module.exports = router;
