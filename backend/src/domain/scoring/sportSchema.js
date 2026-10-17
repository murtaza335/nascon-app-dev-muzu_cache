'use strict';
// API-03 sport definition → validated, normalized config (FR-1.1-01). Pure.
// The same function validates the seeded sports (ARCHITECTURE: seed goes through the same code path).
const { E } = require('../../errors');
const { check, t } = require('../../lib/validate');

const MODELS = ['event', 'innings', 'round'];
const TIE_BREAKERS = ['h2h_points', 'h2h_diff', 'overall_diff', 'scored', 'fair_play', 'draw_lots'];
const OVERTIME_POLICIES = ['none', 'extra_time', 'shootout', 'golden_score', 'super_over'];

const PERIODS = {
  event: { count: t.int({ required: true, min: 1 }), duration_minutes: t.int({ required: true, min: 1 }) },
  innings: {
    innings_per_team: t.int({ required: true, min: 1 }), overs_per_innings: t.int({ required: true, min: 1 }),
    balls_per_over: t.int({ required: true, min: 1 }), wickets_per_innings: t.int({ required: true, min: 1 }),
  },
  round: { best_of: t.int({ required: true, min: 1, odd: true }) },
};

const EVENT_VALUE = {
  event: { points: t.int({ required: true, min: 1 }) },
  innings: { runs: t.int({ required: true, min: 0 }), legal_ball: t.bool({ required: true }), wicket: t.bool({ required: true }) },
  round: { rounds: t.int({ required: true, min: 1 }) },
};

function shapeFor(model) {
  const known = MODELS.includes(model);
  return {
    sport_id: t.string({ required: true, pattern: /^[a-z0-9_-]{2,40}$/ }),
    name: t.string({ required: true, min: 1, max: 80 }),
    scoring_model: t.enum(MODELS, { required: true }),
    periods: known ? t.object(PERIODS[model], { required: true }) : t.object({}, { required: true }),
    scoring_events: t.map(known ? t.object(EVENT_VALUE[model]) : t.any(), { required: true, minKeys: 1, keyPattern: /^[a-z0-9_]{1,40}$/ }),
    draw_allowed: t.bool({ required: true }),
    overtime: t.object({
      policy: t.enum(OVERTIME_POLICIES, { required: true }),
      duration_minutes: t.int({ min: 0 }),
    }, { required: true }),
    tie_break_order: t.array(t.enum(TIE_BREAKERS), { unique: true }),
    roster: t.object({
      min_squad_size: t.int({ required: true, min: 1 }),
      max_squad_size: t.int({ required: true, min: 1 }),
      required_positions: t.map(t.int({ min: 0 }), { required: true }),
    }, { required: true }),
  };
}

function validateSport(input) {
  const model = input && typeof input === 'object' ? input.scoring_model : undefined;
  const r = check(shapeFor(model), input);
  const fields = r.ok ? [] : [...r.fields];
  if (r.ok && r.value.roster.min_squad_size > r.value.roster.max_squad_size) fields.push('roster.min_squad_size');
  if (fields.length) return { ok: false, error: E.VALIDATION_ERROR, details: { fields } };
  const v = r.value;
  if (!v.tie_break_order) v.tie_break_order = [...TIE_BREAKERS];
  return { ok: true, value: { sport_id: v.sport_id, name: v.name, scoring_model: v.scoring_model, config: v } };
}

module.exports = { validateSport, TIE_BREAKERS, MODELS };
