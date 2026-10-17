'use strict';
const { Router } = require('express');
const roster = require('../../services/roster');
const { validationError } = require('../../errors');

const router = Router();
const isObj = (b) => b !== null && typeof b === 'object' && !Array.isArray(b);

// API-09 / FR-2.2-01
router.post('/roster/setup', async (req, res, next) => {
  try {
    if (!isObj(req.body)) throw validationError(['body']);
    res.status(201).json(await roster.setup(req.body));
  } catch (err) { next(err); }
});

// API-10 / FR-2.2-02: 201 accepted, 200 on identical replay
router.post('/roster/transfer', async (req, res, next) => {
  try {
    if (!isObj(req.body)) throw validationError(['body']);
    const r = await roster.transfer(req.body);
    res.status(r.status).json(r.body);
  } catch (err) { next(err); }
});

// API-11 / FR-2.2-04
router.get('/roster/history/:player_id', async (req, res, next) => {
  try { res.status(200).json(await roster.history(req.params.player_id, req.query.as_of)); } catch (err) { next(err); }
});

module.exports = router;
