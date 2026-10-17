'use strict';
const { Router } = require('express');

const router = Router();

// API-16 / FR-SYS-03. No auth; rate limited by the /api/v1 mount.
router.get('/ping', (req, res) => res.status(200).json({ pong: true }));

module.exports = router;
