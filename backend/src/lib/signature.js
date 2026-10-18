'use strict';
// NFR-SIG / BR-SIG-01: lowercase_hex(HMAC_SHA256(key = DAY1_SALT bytes, message = id + "|" + canonicalPayload)).
const crypto = require('node:crypto');

function sign(salt, id, canonicalPayload) {
  return crypto.createHmac('sha256', Buffer.from(salt, 'utf8')).update(`${id}|${canonicalPayload}`, 'utf8').digest('hex');
}

// Phase II recipe (API-CONTRACT §1.3): same HMAC, key = DAY2_SALT, payload is a plain object canonicalised here.
function sign2(id, payload) {
  const { canonical } = require('./canonical');
  return sign(require('../config').day2Salt, id, canonical(payload));
}

module.exports = { sign, sign2 };
