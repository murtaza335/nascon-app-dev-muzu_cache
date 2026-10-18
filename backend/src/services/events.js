'use strict';
// FR-1.1-04: append a signed event to a match stream (API-06). Check order follows BR-SCORE-10:
// 1) schema 400 → 2) identical replay 200 → 3) existence 404 → 4) payload semantics 400 → 5) conflicts 409.
const crypto = require('node:crypto');
const config = require('../config');
const { withTx, advisoryXactLock } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { check, t } = require('../lib/validate');
const { canonicalAt } = require('../lib/canonical');
const { sign } = require('../lib/signature');
const rules = require('../domain/scoring/eventRules');
const projection = require('../domain/scoring/projection');
const sportsRepo = require('../repos/sports');
const matchesRepo = require('../repos/matches');
const eventsRepo = require('../repos/events');
const idem = require('../repos/idempotency');
const outbox = require('../repos/outbox');
const leaguesRepo = require('../repos/leagues');
const hooks = require('./hooks');

const ENVELOPE = {
  event_id: t.id({ required: true }),
  match_id: t.id({ required: true }),
  type: t.enum(rules.EVENT_TYPES, { required: true }),
  payload: t.object({}, { required: true }),
};

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const STATUS_AFTER = { match_start: 'in_progress', match_end: 'completed', ...Object.fromEntries(Object.entries(rules.LIFECYCLE)) };

// Step 1. Returns the validated event; throws 400 with every offending field.
function validateEvent(rawBody) {
  const body = rawBody && typeof rawBody === 'object' && typeof rawBody.type === 'string'
    ? { ...rawBody, type: rules.normalizeType(rawBody.type, rawBody.payload) } : rawBody;
  const env = check(ENVELOPE, body);
  const fields = env.ok ? [] : [...env.fields];
  let payload = body && typeof body === 'object' ? body.payload : undefined;
  const typeOk = body && rules.EVENT_TYPES.includes(body.type);
  if (typeOk && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const p = check(rules.payloadShape(body.type), payload);
    if (!p.ok) fields.push(...p.fields.map((f) => `payload.${f}`));
  }
  if (fields.length) throw validationError([...new Set(fields)]);
  payload = body.payload;
  return { event_id: body.event_id, match_id: body.match_id, type: body.type, payload };
}

// Hash of the canonical request (known fields only; payload lexemes preserved).
function requestHash(ev, canonicalPayload) {
  return sha256(`{"event_id":${JSON.stringify(ev.event_id)},"match_id":${JSON.stringify(ev.match_id)},"payload":${canonicalPayload},"type":${JSON.stringify(ev.type)}}`);
}

const reject = (result) => new AppError(result.error, result.details);

// Core append inside an open transaction. Used by /events and by offline-sync.
async function appendInTx(client, ev, canonicalPayload) {
  const hash = requestHash(ev, canonicalPayload);
  await advisoryXactLock(client, `event:${ev.event_id}`);
  const prior = await idem.find(client, 'event', ev.event_id);
  if (prior) {
    if (prior.request_hash === hash) return { status: 200, body: prior.response };
    throw new AppError(E.DUPLICATE_EVENT_ID);
  }

  let match;
  let sport;
  if (ev.type === 'match_init') {
    sport = await sportsRepo.getSport(ev.payload.sport_id, client);
    if (!sport) throw new AppError(E.SPORT_NOT_FOUND);
    let league = null;
    if (ev.payload.league_id) {
      league = await leaguesRepo.getLeague(ev.payload.league_id, client);
      if (!league) throw new AppError(E.LEAGUE_NOT_FOUND);
    }
    const sem = rules.checkSemantics('match_init', ev.payload, {});
    if (!sem.ok) throw reject(sem);
    if (league && !(league.teams.includes(ev.payload.home_team_id) && league.teams.includes(ev.payload.away_team_id))) {
      throw validationError(['payload.league_id']);
    }
    const created = await matchesRepo.insertMatch(client, {
      match_id: ev.match_id, sport_id: ev.payload.sport_id, league_id: ev.payload.league_id ?? null,
      home_team_id: ev.payload.home_team_id, away_team_id: ev.payload.away_team_id,
    });
    if (!created) throw new AppError(E.MATCH_EXISTS);
    match = await matchesRepo.getMatch(ev.match_id, client);
  } else {
    match = await matchesRepo.lockMatch(client, ev.match_id);
    if (!match) throw new AppError(E.MATCH_NOT_FOUND);
    sport = await sportsRepo.getSport(match.sport_id, client);
    let target;
    if (ev.type === 'compensation') {
      target = await eventsRepo.getEvent(ev.payload.compensates, client);
      if (!target) throw new AppError(E.EVENT_NOT_FOUND);
    }
    const events = await eventsRepo.listByMatch(match.match_id, client);
    const cfg = sport.config;
    const sem = rules.checkSemantics(ev.type, ev.payload, { match, config: cfg });
    if (!sem.ok) throw reject(sem);
    const view = projection.build({ match, config: cfg, events });
    const state = rules.checkState(ev.type, ev.payload, { match, config: cfg, view, target });
    if (!state.ok) throw reject(state);
  }

  const sequence = match.version + 1;
  const signature = sign(config.day1Salt, ev.event_id, canonicalPayload);
  await eventsRepo.insertEvent(client, {
    event_id: ev.event_id, match_id: ev.match_id, sequence, type: ev.type,
    payload_canonical: canonicalPayload, signature, request_hash: hash,
  });
  await matchesRepo.setVersion(client, ev.match_id, sequence, STATUS_AFTER[ev.type] || match.status_cache);
  const body = { event_id: ev.event_id, match_id: ev.match_id, type: ev.type, sequence, match_version: sequence, signature };
  await outbox.insert(client, {
    topic: 'match', type: 'match.event_appended', aggregate_id: ev.match_id,
    payload: { match_id: ev.match_id, version: sequence, event_type: ev.type, league_id: match.league_id },
  });
  await idem.store(client, 'event', ev.event_id, hash, 201, body);
  return { status: 201, body, match };
}

// After-commit: cache invalidation + realtime frames for one appended event (also used by offline-sync).
async function announce(ev, out) {
  const event = {
    sequence: out.body.sequence, event_id: ev.event_id, type: ev.type, payload: ev.payload, signature: out.body.signature,
    compensated: false, compensated_by: null,
  };
  await hooks.eventAppended({ matchId: ev.match_id, leagueId: out.match && out.match.league_id, version: out.body.match_version, event });
}

// body: parsed request; rawBody: the exact request text (for lossless payload canonicalization).
async function appendEvent(body, rawBody) {
  const ev = validateEvent(body);
  const canonicalPayload = canonicalAt(rawBody, ['payload']);
  const out = await withTx((client) => appendInTx(client, ev, canonicalPayload));
  if (out.status === 201) await announce(ev, out);
  return out;
}

module.exports = { appendEvent, appendInTx, announce, validateEvent, requestHash };
