'use strict';
const { Router } = require('express');
const auth = require('../../services/auth');
const { validationError } = require('../../errors');

const publicRouter = Router();
const protectedRouter = Router();

// APP-01 (public)
publicRouter.post('/auth/login', async (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    res.status(200).json(await auth.login(req.body));
  } catch (err) { next(err); }
});

// APP-02
protectedRouter.get('/me', async (req, res, next) => {
  try { res.status(200).json(await auth.me(req.principal)); } catch (err) { next(err); }
});

module.exports = { publicRouter, protectedRouter };
