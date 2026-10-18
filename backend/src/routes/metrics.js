'use strict';
const { Router } = require('express');
const metrics = require('../services/metrics');

const router = Router();

// API-D2-10. Express would append "; charset=utf-8" to a string body, so write the bytes directly.
router.get('/metrics', (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.setHeader('Cache-Control', 'no-store');
  res.end(Buffer.from(metrics.body(), 'utf8'));
});

module.exports = router;
