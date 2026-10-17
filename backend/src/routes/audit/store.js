'use strict';
const { Router } = require('express');
const { checkout, getInventory } = require('../../services/store');
const { validationError } = require('../../errors');

const router = Router();

// API-12 / FR-2.3-02: 201 on success, 200 on identical replay.
router.post('/checkout', async (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    const r = await checkout(req.body);
    res.status(r.status).json(r.body);
  } catch (err) { next(err); }
});

// API-13 / FR-2.3-03
router.get('/inventory/:variant_id', async (req, res, next) => {
  try { res.status(200).json(await getInventory(req.params.variant_id)); } catch (err) { next(err); }
});

module.exports = router;
