'use strict';
const { Router } = require('express');
const { registerLeague } = require('../../services/leagues');
const { getStandings } = require('../../services/standings');
const { validationError } = require('../../errors');

const router = Router();

// API-05 / FR-1.2-02
router.post('/leagues', async (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    res.status(201).json(await registerLeague(req.body));
  } catch (err) { next(err); }
});

// API-08 / FR-1.4-01
router.get('/standings/:league_id', async (req, res, next) => {
  try { res.status(200).json(await getStandings(req.params.league_id)); } catch (err) { next(err); }
});

module.exports = router;
