'use strict';
const { Router } = require('express');
const { eraseSubject } = require('../../services/privacy');

const router = Router();

// API-D2-11
router.delete('/privacy/user/:user_id', async (req, res, next) => {
  try { res.status(200).json(await eraseSubject(req.params.user_id)); } catch (err) { next(err); }
});

module.exports = router;
