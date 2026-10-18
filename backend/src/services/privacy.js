'use strict';
// NFR-9 / API-D2-11: one transaction, idempotent (BR-PRIV-02).
const { withTx } = require('../db');
const { AppError, E } = require('../errors');
const erase = require('../domain/privacy/erase');
const repo = require('../repos/privacy');
const cache = require('./day2Cache');

async function eraseSubject(id) {
  const userIds = await withTx(async (client) => {
    const found = await repo.lookup(client, id);
    if (!found.userIds.length && !found.isPlayer) throw new AppError(E.PLAYER_NOT_FOUND, { user_id: id });
    for (const uid of found.userIds) await repo.eraseUser(client, uid, erase.erasedEmail(uid), erase.ERASED_NAME);
    if (found.isPlayer) await repo.anonymizePlayer(client, id, erase.ANON_PLAYER_NAME);
    const subjects = [...new Set([id, ...found.userIds])];
    await repo.wipeGuestTokens(client, subjects);
    await repo.pseudonymiseChat(client, subjects, erase.pseudonym(id));
    await repo.deleteFollows(client, subjects);
    return found.userIds;
  });
  for (const uid of userIds) cache.erased.add(uid);
  return { user_id: id, status: 'anonymized', pii_retained: false, tokens_wiped: true };
}

module.exports = { eraseSubject };
