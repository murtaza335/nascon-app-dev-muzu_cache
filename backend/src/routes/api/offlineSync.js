'use strict';
const { Router } = require('express');
const sync = require('../../services/sync');
const writes = require('../../services/appWrites');
const { validationError } = require('../../errors');

const router = Router();

// APP-40: identical processing to API-17; each action is authorized as its online equivalent.
router.post('/offline-sync', async (req, res, next) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) throw validationError(['body']);
    const authorize = (action) => writes.authorizeSyncAction(req.principal, action);
    res.status(200).json(await sync.process(req.body, req.rawBody, { authorize }));
  } catch (err) { next(err); }
});

module.exports = router;
