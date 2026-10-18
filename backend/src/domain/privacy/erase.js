'use strict';
// BR-PRIV-02: anonymised replacement values. Pure.
const crypto = require('node:crypto');

const erasedEmail = (id) => `erased-${crypto.createHash('sha256').update(id).digest('hex').slice(0, 12)}@invalid`;
const pseudonym = (id) => `erased-${crypto.createHash('sha256').update(id).digest('hex').slice(0, 8)}`;

module.exports = { erasedEmail, pseudonym, ERASED_NAME: 'Erased User', ANON_PLAYER_NAME: 'Anonymized Player' };
