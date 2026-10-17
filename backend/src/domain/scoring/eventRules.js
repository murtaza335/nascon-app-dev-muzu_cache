'use strict';
// Event validation split in the order BR-SCORE-10 requires. Pure; returns {ok:true} or {ok:false, error:E.X, details}.
//   payloadShape(type)           → schema for lib/validate (400, step 1)
//   checkSemantics(...)          → 400 team / UNKNOWN_EVENT_TYPE (step 4)
//   checkState(...)              → 409 state machine, limits, compensation validity (step 5)
const { E } = require('../../errors');
const { t } = require('../../lib/validate');

const EVENT_TYPES = ['match_init', 'match_start', 'score', 'discipline', 'tiebreak_winner', 'match_end', 'compensation'];
const COMPENSABLE = ['score', 'discipline', 'tiebreak_winner'];

const PAYLOADS = {
  match_init: { sport_id: t.id({ required: true }), home_team_id: t.id({ required: true }), away_team_id: t.id({ required: true }), league_id: t.id() },
  match_start: {},
  score: { team_id: t.id({ required: true }), event_type: t.string({ required: true, min: 1, max: 100 }) },
  discipline: { team_id: t.id({ required: true }), points: t.int({ required: true }) },
  tiebreak_winner: { team_id: t.id({ required: true }) },
  match_end: {},
  compensation: { compensates: t.id({ required: true }), reason: t.string({ required: true, min: 1, max: 500 }) },
};

const payloadShape = (type) => PAYLOADS[type];

const fail = (error, details = {}) => ({ ok: false, error, details });
const OK = { ok: true };

function checkSemantics(type, payload, { match, config }) {
  if (type === 'match_init') {
    return payload.home_team_id === payload.away_team_id ? fail(E.VALIDATION_ERROR, { fields: ['payload.away_team_id'] }) : OK;
  }
  if (['score', 'discipline', 'tiebreak_winner'].includes(type)) {
    if (payload.team_id !== match.home_team_id && payload.team_id !== match.away_team_id) {
      return fail(E.VALIDATION_ERROR, { fields: ['payload.team_id'] });
    }
  }
  if (type === 'score' && !Object.hasOwn(config.scoring_events, payload.event_type)) return fail(E.UNKNOWN_EVENT_TYPE);
  return OK;
}

function limitError(config, view, teamId) {
  if (config.scoring_model === 'innings') {
    const p = config.periods;
    const s = view._stats[teamId];
    const maxBalls = p.innings_per_team * p.overs_per_innings * p.balls_per_over;
    const maxWickets = p.innings_per_team * p.wickets_per_innings;
    if (s.balls >= maxBalls || s.wickets >= maxWickets) return E.INNINGS_COMPLETE;
  } else if (config.scoring_model === 'round') {
    const needed = (config.periods.best_of + 1) / 2;
    if (Object.values(view._stats).some((s) => s.score >= needed)) return E.SERIES_ALREADY_DECIDED;
  }
  return null;
}

// target: for compensation, {match_id, type} of the referenced event (already known to exist), else undefined.
function checkState(type, payload, { match, config, view, target }) {
  switch (type) {
    case 'match_start':
      return view.status === 'upcoming' ? OK : fail(E.ILLEGAL_TRANSITION, { from: view.status, to: 'in_progress' });
    case 'score': {
      if (view.status !== 'in_progress') return fail(E.MATCH_NOT_IN_PROGRESS);
      const limit = limitError(config, view, payload.team_id);
      return limit ? fail(limit) : OK;
    }
    case 'discipline':
    case 'tiebreak_winner':
      return view.status === 'in_progress' ? OK : fail(E.MATCH_NOT_IN_PROGRESS);
    case 'match_end': {
      if (view.status !== 'in_progress') return fail(E.ILLEGAL_TRANSITION, { from: view.status, to: 'completed' });
      const level = view.home.score === view.away.score;
      if (level && !config.draw_allowed && view.tiebreak_winner_team_id === null) return fail(E.TIE_NOT_ALLOWED);
      return OK;
    }
    case 'compensation': {
      if (!target || target.match_id !== match.match_id || !COMPENSABLE.includes(target.type)) return fail(E.INVALID_COMPENSATION);
      if (view._compensatedBy.has(payload.compensates)) return fail(E.INVALID_COMPENSATION);
      return OK;
    }
    default:
      return OK;
  }
}

module.exports = { EVENT_TYPES, payloadShape, checkSemantics, checkState };
