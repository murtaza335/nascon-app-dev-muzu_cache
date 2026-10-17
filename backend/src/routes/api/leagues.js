'use strict';
const { Router } = require('express');
const reads = require('../../services/appReads');
const { parsePage } = require('../../http/guard');
const { validationError } = require('../../errors');

const router = Router();
const STATUSES = ['upcoming', 'in_progress', 'completed', 'postponed', 'abandoned', 'cancelled'];

// APP-10
router.get('/leagues', async (req, res, next) => {
  try { res.status(200).json(await reads.listLeagues(req.principal, parsePage(req.query))); } catch (err) { next(err); }
});

// APP-11
router.get('/leagues/:id/fixtures', async (req, res, next) => {
  try {
    const { status } = req.query;
    if (status !== undefined && !STATUSES.includes(status)) throw validationError(['status']);
    res.status(200).json(await reads.leagueFixtures(req.principal, req.params.id, status, parsePage(req.query)));
  } catch (err) { next(err); }
});

// APP-16
router.get('/leagues/:id/standings', async (req, res, next) => {
  try { res.status(200).json(await reads.leagueStandings(req.principal, req.params.id)); } catch (err) { next(err); }
});

module.exports = router;
