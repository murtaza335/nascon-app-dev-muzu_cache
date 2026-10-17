'use strict';
const crypto = require('node:crypto');

const sha256Hex = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

module.exports = { sha256Hex };
