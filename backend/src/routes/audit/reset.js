'use strict';
const { Router } = require('express');
const { t, validateOptional } = require('../../http/validate');
const { resetAll } = require('../../services/reset');

const router = Router();

// API-02 / FR-SYS-02. Body optional: {seed?: int, stock?: {variant_id: int >= 0}}.
router.post('/reset', async (req, res, next) => {
  try {
    const input = validateOptional({
      seed: t.int(),
      stock: t.map(t.int({ min: 0 })),
    }, req.body);
    res.status(200).json(await resetAll(input));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
