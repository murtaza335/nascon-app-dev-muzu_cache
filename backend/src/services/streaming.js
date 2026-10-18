'use strict';
// FR-3.2-01 / API-D2-03. One transaction per player (advisory lock); revocation kicks live ingest after commit.
const crypto = require('node:crypto');
const { withTx, advisoryXactLock } = require('../db');
const { AppError, E } = require('../errors');
const { validate, t } = require('../lib/validate');
const { sign2 } = require('../lib/signature');
const { liveUrls } = require('../lib/urls');
const rules = require('../domain/streaming/streamKey');
const repo = require('../repos/streamKeys');
const media = require('./media');

const SCHEMA = {
  action: t.enum(rules.ACTIONS, { required: true }),
  player_id: t.string({ required: true, min: 1 }),
  label: t.string({ min: 1, max: 64, default: 'default' }),
  stream_key_override: t.string({ min: 1, max: 128 }),
};

function view(action, key, status) {
  const base = { player_id: key.player_id, label: key.label, stream_key: key.stream_key, status };
  const urls = status === 'active' ? liveUrls(key.stream_key) : { ingest_endpoints: null, playback_url: null };
  return {
    ...base, ingest_endpoints: urls.ingest_endpoints, playback_url: urls.playback_url,
    signature: sign2(key.stream_key, rules.sigPayload(action, key.player_id, status, key.stream_key)),
  };
}

// → {status, body}. `input` is the raw parsed body (audit) or the validated equivalent (api).
async function manageKey(input, { ownerOnly = null } = {}) {
  const v = validate(SCHEMA, input);
  const kicks = [];
  const out = await withTx(async (client) => {
    if (!(await repo.playerExists(v.player_id, client))) throw new AppError(E.PLAYER_NOT_FOUND, { player_id: v.player_id });
    if (ownerOnly && ownerOnly !== v.player_id) throw new AppError(E.FORBIDDEN);
    await advisoryXactLock(client, `streamkey:${v.player_id}`);
    const keys = await repo.keysOf(client, v.player_id);
    const d = rules.decide(v.action, keys);
    if (d.op === 'error') {
      throw new AppError(d.code === 'KEY_REVOKED' ? E.KEY_REVOKED : E.STREAM_NOT_FOUND, { player_id: v.player_id, ...(d.key ? { stream_key: d.key.stream_key } : {}) });
    }
    if (d.op === 'revoke') {
      const sig = sign2(d.key.stream_key, rules.sigPayload('revoke', v.player_id, 'revoked', d.key.stream_key));
      await repo.revokeOne(client, d.key.stream_key, sig);
      if (d.key.live) kicks.push(d.key.stream_key);
      return { status: 200, body: view('revoke', d.key, 'revoked') };
    }
    for (const r of await repo.revokeActive(client, v.player_id)) if (r.live) kicks.push(r.stream_key);
    const stream_key = v.stream_key_override ?? rules.newKey(crypto.randomBytes(8).toString('hex'));
    const key = { stream_key, player_id: v.player_id, label: v.label };
    await repo.upsertActive(client, { ...key, signature: sign2(stream_key, rules.sigPayload(v.action, v.player_id, 'active', stream_key)) });
    return { status: d.status, body: view(v.action, key, 'active') };
  });
  // After commit: FR-3.2-03 severs the old ingest (the worker reconciler is the safety net).
  await Promise.all(kicks.map((k) => media.kickPath(`live/${k}`)));
  return out;
}

module.exports = { manageKey };

// ---- Product API (API-D2-31..34) ----
const { query } = require('../db');
const { validationError } = require('../errors');

function requirePlayer(principal) {
  if (!principal.player_id && principal.role !== 'super_admin') throw new AppError(E.FORBIDDEN);
}

function manageForMember(principal, input) {
  requirePlayer(principal);
  const body = { ...(input && typeof input === 'object' ? input : {}), stream_key_override: undefined };
  if (body.player_id === undefined && principal.player_id) body.player_id = principal.player_id;
  return manageKey(body, { ownerOnly: principal.role === 'super_admin' ? null : principal.player_id });
}

async function myKey(principal) {
  requirePlayer(principal);
  const row = await repo.activeOf(principal.player_id);
  if (!row) throw new AppError(E.STREAM_NOT_FOUND, { player_id: principal.player_id });
  return { ...view('generate', row, 'active'), live: row.live, match_id: row.match_id };
}

async function bindMatch(principal, input) {
  requirePlayer(principal);
  if (!input || typeof input.match_id !== 'string' || !input.match_id) throw validationError(['match_id']);
  const row = await repo.activeOf(principal.player_id);
  if (!row) throw new AppError(E.STREAM_NOT_FOUND, { player_id: principal.player_id });
  if (!(await query('SELECT 1 FROM matches WHERE match_id = $1', [input.match_id])).rows.length) throw new AppError(E.MATCH_NOT_FOUND);
  await query('UPDATE stream_keys SET match_id = $2 WHERE stream_key = $1', [row.stream_key, input.match_id]);
  return { player_id: principal.player_id, match_id: input.match_id };
}

module.exports.manageForMember = manageForMember;
module.exports.myKey = myKey;
module.exports.bindMatch = bindMatch;
