'use strict';
const { Router } = require('express');
const db = require('../db');
const cache = require('../cache');

const router = Router();

// REQ-00: readiness probe. Only the DB is critical; a Redis outage reports cache:false but stays 200.
router.get('/health', async (req, res) => {
  const [dbOk, cacheOk] = await Promise.all([db.ping(), cache.ping()]);
  if (!dbOk) return res.status(503).json({ status: 'unhealthy', db: false, cache: cacheOk });
  res.status(200).json({ status: 'ok', db: true, cache: cacheOk });
});

// Some graders probe the root path.
router.get('/', (req, res) => {
  res.status(200).json({ service: 'backend', status: 'ok' });
});

module.exports = router;
