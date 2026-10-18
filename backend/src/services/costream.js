'use strict';
// FR-3.3-01 / API-D2-04. Validation order is binding (BR-CS 1–6); replay and re-initialisation per BR-CS-07.
const crypto = require('node:crypto');
const { withTx, advisoryXactLock } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { check, t } = require('../lib/validate');
const { canonical } = require('../lib/canonical');
const { sign2 } = require('../lib/signature');
const { compositeUrl } = require('../lib/urls');
const rules = require('../domain/costream/session');
const repo = require('../repos/costreams');
const qrService = require('./qr');
const hooks = require('./hooks');

const SCHEMA = {
  session_id: t.string({ required: true, min: 1 }),
  host_player_id: t.string({ required: true, min: 1 }),
  participants: t.array(t.string({ min: 1 }), { required: true, min: 1, unique: true }),
  simulate_host_drop: t.bool({ default: false }),
  layout: t.enum(rules.LAYOUTS, { default: 'grid_4' }),
};

function response(sessionId, layout, st) {
  const r = {
    session_id: sessionId, status: st.status, active_host: st.active_host, handoff_occurred: st.handoff_occurred,
    participant_count: st.active_participants.length, active_participants: st.active_participants, layout,
    composite_playback_url: compositeUrl(sessionId), chat_room_id: `chat-${sessionId}`,
  };
  return { ...r, signature: sign2(sessionId, rules.sigPayload(r)) };
}

async function createSession(input) {
  const c = check(SCHEMA, input);
  if (!c.ok) throw validationError(c.fields);
  const v = c.value;
  const hash = crypto.createHash('sha256').update(canonical(v)).digest('hex');
  const out = await withTx(async (client) => {
    const missing = await repo.missingPlayer(client, [v.host_player_id, ...v.participants]);
    if (missing) throw new AppError(E.PLAYER_NOT_FOUND, { player_id: missing });
    if (!v.participants.includes(v.host_player_id)) throw validationError(['host_player_id']);
    if (rules.isFull(v.participants)) throw new AppError(E.COSTREAM_SESSION_FULL, { max_participants: rules.MAX_PARTICIPANTS });
    const st = rules.handoff(v.host_player_id, v.participants, v.simulate_host_drop);
    if (!rules.layoutFits(v.layout, st.active_participants.length)) {
      throw new AppError(E.UNSUPPORTED_LAYOUT, { layout: v.layout, participant_count: st.active_participants.length });
    }
    await advisoryXactLock(client, `costream:${v.session_id}`);
    const prior = await repo.get(v.session_id, client);
    if (prior && prior.request_hash === hash) return { status: 200, body: prior.response, fresh: false };
    const body = response(v.session_id, v.layout, st);
    await repo.upsert(client, {
      session_id: v.session_id, host_player_id: v.host_player_id, active_host: st.active_host, participants: v.participants,
      active_participants: st.active_participants, layout: v.layout, status: st.status, handoff_occurred: st.handoff_occurred,
      request_hash: hash, response: body,
    });
    await client.query('INSERT INTO chat_rooms (chat_room_id) VALUES ($1) ON CONFLICT DO NOTHING', [`chat-${v.session_id}`]);
    await qrService.ensureCode(client, v.session_id, 'costream');
    return { status: 201, body, fresh: true };
  });
  if (out.fresh) hooks.costreamChanged(v.session_id, out.body);
  return { status: out.status, body: out.body };
}

// Real host drop / leave (FR-3.3-04, API-D2-44): the next participant in array order takes over; nobody left → terminated.
async function dropParticipant(sessionId, playerId) {
  const out = await withTx(async (client) => {
    await advisoryXactLock(client, `costream:${sessionId}`);
    const row = await repo.get(sessionId, client);
    if (!row || row.status === 'terminated' || !row.active_participants.includes(playerId)) return null;
    const next = rules.removeParticipant(row.participants, row.active_participants, row.active_host, playerId);
    const handoff = row.handoff_occurred || next.handoff_occurred;
    const body = response(sessionId, row.layout, { ...next, handoff_occurred: handoff });
    await repo.upsert(client, {
      session_id: sessionId, host_player_id: row.host_player_id, active_host: next.active_host, participants: row.participants,
      active_participants: next.active_participants, layout: row.layout, status: next.status, handoff_occurred: handoff,
      request_hash: row.request_hash, response: body,
    });
    return { body, from: row.active_host, next };
  });
  if (!out) return null;
  hooks.costreamChanged(sessionId, out.body);
  const topic = `ws:costream:${sessionId}`;
  if (out.next.status === 'terminated') hooks.publish(topic, { type: 'costream.terminated', session_id: sessionId });
  else if (out.next.handoff_occurred) hooks.publish(topic, { type: 'costream.host_changed', from: out.from, to: out.next.active_host, handoff_occurred: true });
  else hooks.publish(topic, { type: 'costream.participant_changed', session: out.body });
  return out.body;
}

// ---- Product API (API-D2-40..44, 61) ----
const { query } = require('../db');
const { hlsUrl, whepUrl } = require('../lib/urls');
const config = require('../config');

const INVITE_TTL_MS = 10 * 60 * 1000;
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const inviteMac = (payload) => crypto.createHmac('sha256', Buffer.from(config.day2Salt, 'utf8')).update(payload).digest('base64url');

function signInvite(sessionId, playerId, nowMs = Date.now()) {
  const exp = nowMs + INVITE_TTL_MS;
  const payload = b64u({ s: sessionId, p: playerId, exp });
  return { invite_token: `${payload}.${inviteMac(payload)}`, expires_at: new Date(exp).toISOString().replace(/\.\d{3}Z$/, 'Z') };
}

// → the invited player id when valid for this session, else null.
function verifyInvite(token, sessionId, nowMs = Date.now()) {
  if (typeof token !== 'string') return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;
  const want = Buffer.from(inviteMac(payload)); const got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const c = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return c.s === sessionId && c.exp > nowMs ? c.p : null;
  } catch { return null; }
}

async function publicView(sessionId) {
  const row = await repo.get(sessionId);
  if (!row) throw new AppError(E.STREAM_NOT_FOUND, { session_id: sessionId });
  const states = new Map((await query('SELECT player_id, muted, spotlight FROM costream_participant_state WHERE session_id = $1', [sessionId])).rows.map((r) => [r.player_id, r]));
  const names = new Map((await query('SELECT player_id, name FROM players WHERE player_id = ANY($1)', [row.participants])).rows.map((r) => [r.player_id, r.name]));
  const keys = new Map((await query("SELECT player_id, stream_key FROM stream_keys WHERE player_id = ANY($1) AND status = 'active'", [row.participants])).rows.map((r) => [r.player_id, r.stream_key]));
  return {
    session_id: sessionId, status: row.status, layout: row.layout, active_host: row.active_host,
    active_participants: row.active_participants.map((pid) => ({
      player_id: pid, name: names.get(pid) || pid, muted: !!(states.get(pid) || {}).muted, spotlight: !!(states.get(pid) || {}).spotlight,
      hls_url: keys.has(pid) ? hlsUrl(keys.get(pid)) : null, whep_url: keys.has(pid) ? whepUrl(keys.get(pid)) : null,
    })),
    composite_playback_url: compositeUrl(sessionId), chat_room_id: `chat-${sessionId}`,
  };
}

// Host (or admin) gate shared by invites and controls.
async function requireHost(principal, sessionId) {
  const row = await repo.get(sessionId);
  if (!row) throw new AppError(E.STREAM_NOT_FOUND, { session_id: sessionId });
  if (principal.role !== 'super_admin' && principal.player_id !== row.active_host) throw new AppError(E.FORBIDDEN);
  return row;
}

async function createForMember(principal, input) {
  if (!principal.player_id && principal.role !== 'super_admin') throw new AppError(E.FORBIDDEN);
  const c = check({ session_id: t.string({ min: 1, max: 100, pattern: /^cs-session-/ }), layout: t.enum(rules.LAYOUTS, { default: 'grid_4' }) }, input || {});
  if (!c.ok) throw validationError(c.fields);
  const sessionId = c.value.session_id || `cs-session-${crypto.randomBytes(4).toString('hex')}`;
  const host = principal.player_id || 'player-alpha-1';
  const r = await createSession({ session_id: sessionId, host_player_id: host, participants: [host], layout: c.value.layout });
  return { status: r.status, body: await publicView(sessionId) };
}

async function invite(principal, sessionId, input) {
  await requireHost(principal, sessionId);
  const c = check({ player_id: t.string({ required: true, min: 1 }) }, input);
  if (!c.ok) throw validationError(c.fields);
  if (!(await query('SELECT 1 FROM players WHERE player_id = $1', [c.value.player_id])).rows.length) throw new AppError(E.PLAYER_NOT_FOUND, { player_id: c.value.player_id });
  const out = signInvite(sessionId, c.value.player_id);
  hooks.publish(`user:${c.value.player_id}`, { type: 'costream.invite', session_id: sessionId, invite_token: out.invite_token });
  return out;
}

async function join(principal, sessionId, input) {
  const c = check({ invite_token: t.string({ required: true, min: 1 }) }, input);
  if (!c.ok) throw validationError(c.fields);
  const row0 = await repo.get(sessionId);
  if (!row0) throw new AppError(E.STREAM_NOT_FOUND, { session_id: sessionId });
  const invited = verifyInvite(c.value.invite_token, sessionId);
  if (!invited || invited !== principal.player_id) throw new AppError(E.FORBIDDEN);
  const body = await withTx(async (client) => {
    await advisoryXactLock(client, `costream:${sessionId}`);
    const row = await repo.get(sessionId, client);
    if (row.status === 'terminated') throw new AppError(E.STREAM_NOT_FOUND, { session_id: sessionId });
    if (row.active_participants.includes(invited)) return row.response;
    if (row.active_participants.length >= rules.MAX_PARTICIPANTS) throw new AppError(E.COSTREAM_SESSION_FULL, { max_participants: rules.MAX_PARTICIPANTS });
    const participants = row.participants.includes(invited) ? row.participants : [...row.participants, invited];
    const active = [...row.active_participants, invited];
    const resp = response(sessionId, row.layout, { status: 'active', active_host: row.active_host, handoff_occurred: row.handoff_occurred, active_participants: active });
    await repo.upsert(client, { ...row, participants, active_participants: active, response: resp });
    return resp;
  });
  hooks.costreamChanged(sessionId, body);
  hooks.publish(`ws:costream:${sessionId}`, { type: 'costream.participant_changed', session: body });
  const key = (await query("SELECT stream_key FROM stream_keys WHERE player_id = $1 AND status = 'active'", [invited])).rows[0];
  const urls = key ? require('../lib/urls').liveUrls(key.stream_key) : null;
  return { ...(await publicView(sessionId)), publish: { whip_url: urls ? urls.ingest_endpoints.webrtc : null, rtmp_url: urls ? urls.ingest_endpoints.rtmp : null } };
}

const CONTROLS = ['mute', 'unmute', 'spotlight', 'kick'];
async function control(principal, sessionId, playerId, action) {
  if (!CONTROLS.includes(action)) throw new AppError(E.ROUTE_NOT_FOUND);
  const row = await requireHost(principal, sessionId);
  if (!row.participants.includes(playerId)) throw new AppError(E.PLAYER_NOT_FOUND, { player_id: playerId });
  if (action === 'kick') await dropParticipant(sessionId, playerId);
  else {
    const on = action !== 'unmute';
    if (action === 'spotlight') {
      await query(
        `INSERT INTO costream_participant_state (session_id, player_id, spotlight) VALUES ($1,$2,$3)
         ON CONFLICT (session_id, player_id) DO UPDATE SET spotlight = $3`, [sessionId, playerId, on]);
    } else {
      await query(
        `INSERT INTO costream_participant_state (session_id, player_id, muted) VALUES ($1,$2,$3)
         ON CONFLICT (session_id, player_id) DO UPDATE SET muted = $3`, [sessionId, playerId, on]);
    }
  }
  const view = await publicView(sessionId);
  hooks.publish(`ws:costream:${sessionId}`, { type: 'costream.participant_changed', session: view, player_id: playerId, action });
  return view;
}

async function leave(principal, sessionId) {
  if (!(await repo.get(sessionId))) throw new AppError(E.STREAM_NOT_FOUND, { session_id: sessionId });
  if (principal.player_id) await dropParticipant(sessionId, principal.player_id);
  return publicView(sessionId);
}

// Compositor input list (API-D2-37): text lines `layout <name>` then `input <player_id> <hls_url>`.
async function compositorInputs(sessionId) {
  const v = await publicView(sessionId);
  return [`layout ${v.layout}`, ...v.active_participants.map((p) => `input ${p.player_id} ${p.hls_url || ''}`.trim())].join('\n') + '\n';
}

module.exports = { createSession, dropParticipant, response, publicView, createForMember, invite, join, control, leave, compositorInputs, signInvite, verifyInvite };
