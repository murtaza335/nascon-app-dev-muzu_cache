'use strict';
// API-05 request validation (FR-1.2-02). Pure: returns {ok, value} | {ok:false, error, details}.
const { E } = require('../../errors');
const { check, t } = require('../../lib/validate');
const { TIE_BREAKERS } = require('../scoring/sportSchema');

const SHAPE = {
  league_id: t.id({ required: true }),
  sport_id: t.string({ required: true, min: 1, max: 64 }),
  teams: t.array(t.id(), { required: true, min: 2, max: 40, unique: true }),
  fixtures: t.array(t.object({
    match_id: t.id({ required: true }), home: t.id({ required: true }), away: t.id({ required: true }),
  }), { required: true }),
  points: t.object({ win: t.int(), draw: t.int(), loss: t.int() }),
  tie_break_order: t.array(t.enum(TIE_BREAKERS), { unique: true }),
  qualification: t.object({ spots: t.int({ required: true, min: 1 }) }),
  lots_seed: t.int(),
};

function validateLeague(input) {
  const r = check(SHAPE, input);
  if (!r.ok) return { ok: false, error: E.VALIDATION_ERROR, details: { fields: r.fields } };
  const v = r.value;
  const fields = [];
  const teams = new Set(v.teams);
  if (v.qualification && v.qualification.spots > v.teams.length) fields.push('qualification.spots');
  v.fixtures.forEach((f, i) => {
    if (!teams.has(f.home)) fields.push(`fixtures[${i}].home`);
    if (!teams.has(f.away)) fields.push(`fixtures[${i}].away`);
    if (f.home === f.away) fields.push(`fixtures[${i}].away`);
  });
  if (fields.length) return { ok: false, error: E.VALIDATION_ERROR, details: { fields: [...new Set(fields)] } };
  if (!v.qualification) v.qualification = { spots: 1 }; // spec §5.8: optional; our default (CHANGELOG)
  v.points = { win: 3, draw: 1, loss: 0, ...(v.points || {}) }; // OQ-21: missing keys take defaults
  return { ok: true, value: v };
}

module.exports = { validateLeague };
