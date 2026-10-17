'use strict';
// POST /audit/v1/fixtures input validation + format registry (API-04, BR-FIX-01…04). Pure.
const { E } = require('../../errors');
const { check, t } = require('../../lib/validate');
const roundRobin = require('./roundRobin');
const swiss = require('./swiss');
const singleElim = require('./singleElim');
const doubleElim = require('./doubleElim');

const FORMATS = ['round_robin', 'swiss', 'single_elim', 'double_elim'];
const LIMITS = { round_robin: [2, 40], swiss: [2, 64], single_elim: [2, 128], double_elim: [3, 128] };
const bad = (fields) => ({ ok: false, error: E.VALIDATION_ERROR, details: { fields: [...new Set(fields)] } });

const RESULTS = t.array(t.object({ match_id: t.id({ required: true }), winner: t.id({ required: true }) }));
const PARAMS = {
  round_robin: {
    legs: t.int({ min: 1, max: 2 }),
    withdrawals: t.array(t.object({ team_id: t.id({ required: true }), after_round: t.int({ required: true, min: 0 }) })),
    withdrawal_policy: t.enum(['void_all', 'forfeit_remaining']),
  },
  swiss: {
    total_rounds: t.int({ min: 1 }), round: t.int({ min: 1 }),
    history: t.array(t.object({
      round: t.int({ required: true, min: 1 }),
      matches: t.array(t.object({ home: t.id({ required: true }), away: t.id({ required: true }), result: t.enum(['home', 'away', 'draw'], { required: true }) }), { required: true }),
      bye: t.id({ nullable: true }),
    })),
  },
  single_elim: { third_place_match: t.bool(), results: RESULTS },
  double_elim: { bracket_reset: t.bool(), results: RESULTS },
};

function generate(input) {
  const head = check({
    format: t.enum(FORMATS, { required: true }),
    teams: t.array(t.id(), { required: true, unique: true }),
    params: t.any(),
  }, input);
  if (!head.ok) return bad(head.fields);
  const { format, teams } = head.value;
  const rawParams = input.params === undefined || input.params === null ? {} : input.params;
  const [lo, hi] = LIMITS[format];
  const fields = [];
  if (teams.length < lo || teams.length > hi) fields.push('teams');
  const pr = check(PARAMS[format], rawParams);
  if (!pr.ok) fields.push(...pr.fields.map((f) => `params.${f}`));
  if (fields.length) return bad(fields);
  const p = pr.value;
  const n = teams.length;
  const known = new Set(teams);

  if (format === 'round_robin') {
    const legs = p.legs || 1;
    const roundCount = (n % 2 === 0 ? n - 1 : n) * legs;
    const w = p.withdrawals || [];
    const f = [];
    const seen = new Set();
    w.forEach((x, i) => {
      if (!known.has(x.team_id) || seen.has(x.team_id)) f.push(`params.withdrawals[${i}].team_id`);
      seen.add(x.team_id);
      if (x.after_round > roundCount) f.push(`params.withdrawals[${i}].after_round`);
    });
    if (f.length) return bad(f);
    return { ok: true, value: roundRobin.generate({ teams, legs, withdrawals: w, policy: p.withdrawal_policy || 'forfeit_remaining' }) };
  }

  if (format === 'swiss') {
    const totalRounds = p.total_rounds === undefined ? Math.ceil(Math.log2(n)) : p.total_rounds;
    const round = p.round === undefined ? 1 : p.round;
    const f = [];
    if (totalRounds > n - 1) f.push('params.total_rounds');
    if (round > totalRounds) f.push('params.round');
    const history = p.history || [];
    const rounds = history.map((h) => h.round).sort((a, b) => a - b);
    if (rounds.length !== round - 1 || rounds.some((r, i) => r !== i + 1)) f.push('params.history');
    history.forEach((h, hi2) => {
      h.matches.forEach((m, mi) => {
        if (!known.has(m.home)) f.push(`params.history[${hi2}].matches[${mi}].home`);
        if (!known.has(m.away)) f.push(`params.history[${hi2}].matches[${mi}].away`);
        if (m.home === m.away) f.push(`params.history[${hi2}].matches[${mi}].away`);
      });
      if (h.bye && !known.has(h.bye)) f.push(`params.history[${hi2}].bye`);
    });
    if (f.length) return bad(f);
    return swiss.generate({ teams, round, totalRounds, history });
  }

  if (format === 'single_elim') return singleElim.generate({ teams, thirdPlace: p.third_place_match === true, results: p.results || [] });
  return doubleElim.generate({ teams, bracketReset: p.bracket_reset === true, results: p.results || [] });
}

module.exports = { generate, FORMATS };
