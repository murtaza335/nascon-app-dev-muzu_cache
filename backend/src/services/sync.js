'use strict';
// FR-OFF-01 / API-17 (and APP-40): replays queued actions through the SAME event and roster services as the online routes.
// Each action runs in its own transaction, so a rejected action changes nothing; every processed action (applied or
// rejected) is recorded, which makes a re-send answer `duplicate` for all of them (BR-SYNC-02).
const { query, withTx, advisoryXactLock } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { canonicalAt } = require('../lib/canonical');
const resolve = require('../domain/sync/resolve');
const transferRules = require('../domain/roster/transferRules');
const eventsService = require('./events');
const rosterService = require('./roster');
const matchesRepo = require('../repos/matches');
const rosterRepo = require('../repos/roster');
const idem = require('../repos/idempotency');
const syncRepo = require('../repos/sync');
const hooks = require('./hooks');


// Version of the thing an action touches (0 when unknown): match event count, or the player's audit entry count.
async function currentVersion(action, db = { query }) {
  const p = action.payload || {};
  if (action.type === 'score_event') {
    if (typeof p.match_id !== 'string') return 0;
    const m = await matchesRepo.getMatch(p.match_id, db);
    return m ? m.version : 0;
  }
  if (typeof p.player_id !== 'string') return 0;
  return rosterService.auditVersion(db, p.player_id);
}

// Applies one action inside `client`'s transaction. Returns an action result or throws AppError (→ rejected).
async function applyAction(client, action, order, rawBody, index, after) {
  if (action.type === 'score_event') {
    const ev = eventsService.validateEvent(action.payload); // 400 → VALIDATION_ERROR
    const canonicalPayload = canonicalAt(rawBody, ['actions', index, 'payload', 'payload']);
    const prior = await idem.find(client, 'event', ev.event_id);
    if (prior && prior.request_hash === eventsService.requestHash(ev, canonicalPayload)) {
      const m = await matchesRepo.getMatch(ev.match_id, client);
      return resolve.duplicate(action, order, m ? m.version : 0);
    }
    let current = 0;
    if (ev.type !== 'match_init') {
      const match = await matchesRepo.lockMatch(client, ev.match_id);
      if (!match) throw new AppError(E.MATCH_NOT_FOUND);
      current = match.version;
    }
    const res = resolve.appliedResolution(action.base_version, current);
    if (!res) { const e = new AppError(E.INVALID_BASE_VERSION); e.serverVersion = current; throw e; }
    const out = await eventsService.appendInTx(client, ev, canonicalPayload);
    after.push(() => eventsService.announce(ev, out));
    return resolve.applied(action, order, res, out.body.match_version, out.body.signature);
  }

  // roster_transfer
  const r = transferRules.validateTransfer(action.payload);
  if (!r.ok) throw validationError(r.details.fields);
  let current = 0;
  let res = null;
  const out = await rosterService.transferInTx(client, r.value, {
    beforeRules: async (c) => {
      current = await rosterService.auditVersion(c, r.value.player_id);
      res = resolve.appliedResolution(action.base_version, current);
      if (!res) { const e = new AppError(E.INVALID_BASE_VERSION); e.serverVersion = current; throw e; }
    },
  });
  if (out.status === 200) return resolve.duplicate(action, order, await rosterService.auditVersion(client, r.value.player_id));
  return resolve.applied(action, order, res || 'appended', await rosterService.auditVersion(client, r.value.player_id), null);
}

// opts.authorize(action) → error code string or null (APP-40: each action is authorized as its online equivalent).
async function process(input, rawBody, opts = {}) {
  const env = resolve.validateEnvelope(input);
  if (!env.ok) throw validationError(env.details.fields);
  const { device_id: deviceId, actions } = env.value;
  const results = new Array(actions.length);

  let order = 0;
  for (const index of resolve.processingOrder(actions)) {
    order += 1;
    const action = actions[index];
    let result;
    const after = [];
    try {
      result = await withTx(async (client) => {
        await advisoryXactLock(client, `sync:${deviceId}:${action.action_id}`);
        const seen = await syncRepo.find(client, deviceId, action.action_id);
        if (seen) return resolve.duplicate(action, order, await currentVersion(action, client));
        if (opts.authorize) {
          const denied = await opts.authorize(action, client);
          if (denied) { const e = new AppError(E.FORBIDDEN); e.serverVersion = await currentVersion(action, client); throw e; }
        }
        const r = await applyAction(client, action, order, rawBody, index, after);
        if (r.status === 'applied') await syncRepo.record(client, deviceId, action.action_id, r);
        return r;
      });
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      const version = err.serverVersion !== undefined ? err.serverVersion
        : [E.MATCH_NOT_FOUND.code, E.PLAYER_NOT_FOUND.code, E.LEAGUE_NOT_FOUND.code, E.SQUAD_NOT_FOUND.code, E.EVENT_NOT_FOUND.code, E.SPORT_NOT_FOUND.code].includes(err.code)
          ? 0 : await currentVersion(action);
      result = resolve.rejected(action, order, err.code, version);
      await withTx((client) => syncRepo.record(client, deviceId, action.action_id, result));
    }
    if (result.status === 'applied') {
      for (const fn of after) await fn();
      if (action.type === 'roster_transfer') await hooks.clubsChanged();
    }
    results[index] = result;
  }
  return { device_id: deviceId, results, summary: resolve.summarize(results) };
}

module.exports = { process };
