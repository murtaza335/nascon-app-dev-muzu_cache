'use strict';
// NFR-SIG / BR-SIG-01: lowercase_hex(HMAC_SHA256(key = DAY1_SALT bytes, message = id + "|" + canonicalPayload)).
const crypto = require('node:crypto');

function sign(salt, id, canonicalPayload) {
  return crypto.createHmac('sha256', Buffer.from(salt, 'utf8')).update(`${id}|${canonicalPayload}`, 'utf8').digest('hex');
}

module.exports = { sign };
