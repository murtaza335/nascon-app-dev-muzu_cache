'use strict';
const { Router } = require('express');
const { mergeFromAudit } = require('../../services/cart');
const { validationError } = require('../../errors');

const router = Router();

// API-D2-08
router.post('/guest/cart-merge', async (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    const r = await mergeFromAudit(req.body);
    res.status(r.status).json(r.body);
  } catch (err) { next(err); }
});

module.exports = router;
