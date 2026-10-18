'use strict';
// API-D2-30/36: media-server callbacks. Auth decides who may publish / read; events keep live state and index recordings.
const crypto = require('node:crypto');
const config = require('../config');
const { query } = require('../db');
const { AppError, E } = require('../errors');
const repo = require('../repos/streamKeys');
const hooks = require('./hooks');

const LIVE = /^live\/(.+)$/;
const COSTREAM = /^costream\/(.+)$/;

// → resolves when allowed; throws AppError (409 KEY_REVOKED / 404 STREAM_NOT_FOUND / 401) when denied.
async function authorize({ user, password, action, path }) {
  const p = String(path || '');
  const live = LIVE.exec(p);
  if (live) {
    const key = await repo.getKey(live[1]);
    if (!key) throw new AppError(E.STREAM_NOT_FOUND, { path: p });
    if (key.status === 'revoked') throw new AppError(E.KEY_REVOKED, { path: p });
    return;
  }
  if (COSTREAM.test(p)) {
    if (action === 'publish' && !(user === 'compositor' && password === config.mediaHookToken)) throw new AppError(E.UNAUTHENTICATED);
    return;
  }
  if (action === 'publish') throw new AppError(E.UNAUTHENTICATED);
}

async function onEvent({ event, path, segment_path: segmentPath, duration_s: duration }) {
  const live = LIVE.exec(String(path || ''));
  if (live && (event === 'ready' || event === 'not_ready')) {
    const key = await repo.getKey(live[1]);
    if (!key) return;
    await repo.setLive(key.stream_key, event === 'ready');
    if (key.match_id) hooks.publish(`ws:match:${key.match_id}`, { type: 'overlay.updated', match_id: key.match_id, stream: { status: event === 'ready' ? 'live' : 'offline' } });
    return;
  }
  if (live && event === 'segment_complete' && segmentPath) {
    const key = await repo.getKey(live[1]);
    if (!key) return;
    const id = `vod-${crypto.createHash('sha1').update(segmentPath).digest('hex').slice(0, 12)}`;
    await query(
      `INSERT INTO vods (vod_id, stream_key, player_id, match_id, object_key, duration_s, recorded_at) VALUES ($1,$2,$3,$4,$5,$6, now()) ON CONFLICT DO NOTHING`,
      [id, key.stream_key, key.player_id, key.match_id, segmentPath, Number.isInteger(duration) ? duration : null]);
  }
}

module.exports = { authorize, onEvent };
