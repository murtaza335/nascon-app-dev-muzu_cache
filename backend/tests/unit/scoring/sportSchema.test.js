'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validateSport } = require('../../../src/domain/scoring/sportSchema');
const { SPORTS } = require('../../../src/seed/baseline');

const kabaddi = () => ({
  sport_id: 'kabaddi', name: 'Kabaddi', scoring_model: 'event', periods: { count: 2, duration_minutes: 20 },
  scoring_events: { raid_point: { points: 1 }, tackle_point: { points: 1 }, all_out: { points: 2 } },
  draw_allowed: false, overtime: { policy: 'golden_score', duration_minutes: 5 },
  tie_break_order: ['h2h_points', 'h2h_diff', 'overall_diff', 'scored', 'fair_play', 'draw_lots'],
  roster: { min_squad_size: 7, max_squad_size: 12, required_positions: {} },
});
const fieldsOf = (input) => { const r = validateSport(input); assert.strictEqual(r.ok, false); assert.strictEqual(r.error.status, 400); return r.details.fields.sort(); };

test('FR-1.1-01 kabaddi example validates and echoes the full config', () => {
  const r = validateSport(kabaddi());
  assert.ok(r.ok);
  assert.deepStrictEqual(r.value.config, kabaddi());
});

test('FR-1.1-01 tie_break_order defaults to the full list; unknown keys are dropped', () => {
  const k = kabaddi(); delete k.tie_break_order; k.periods.extra = 1; k.junk = 'x';
  const c = validateSport(k).value.config;
  assert.deepStrictEqual(c.tie_break_order, ['h2h_points', 'h2h_diff', 'overall_diff', 'scored', 'fair_play', 'draw_lots']);
  assert.ok(!('junk' in c) && !('extra' in c.periods));
});

test('FR-1.1-01 sport_id regex, including an SQL-injection id', () => {
  for (const id of ["x'; DROP TABLE sports;--", 'A', 'a', 'UPPER', 'a'.repeat(41), 'sp ace']) {
    const k = kabaddi(); k.sport_id = id;
    assert.deepStrictEqual(fieldsOf(k), ['sport_id']);
  }
});

test('FR-1.1-01 reports ALL offending fields at once', () => {
  const k = kabaddi();
  k.name = ''; k.draw_allowed = 'no'; k.periods.count = 0; k.scoring_events = {}; k.overtime.policy = 'x';
  assert.deepStrictEqual(fieldsOf(k), ['draw_allowed', 'name', 'overtime.policy', 'periods.count', 'scoring_events']);
});

test('FR-1.1-01 integers must be JSON integers (2.0 parsed as 2 passes; true and "2" fail)', () => {
  const k = kabaddi(); k.periods.count = true; k.periods.duration_minutes = '20';
  assert.deepStrictEqual(fieldsOf(k), ['periods.count', 'periods.duration_minutes']);
});

test('FR-1.1-01 event key regex and per-model values', () => {
  const k = kabaddi(); k.scoring_events = { 'Bad-Key': { points: 1 }, ok: { points: 0 } };
  assert.deepStrictEqual(fieldsOf(k), ['scoring_events.Bad-Key', 'scoring_events.ok.points']);
});

test('FR-1.1-03 innings model requires all four periods and typed events', () => {
  const r = validateSport({
    sport_id: 'tape-ball', name: 'Tape', scoring_model: 'innings',
    periods: { innings_per_team: 1, overs_per_innings: 5, balls_per_over: 6, wickets_per_innings: 3 },
    scoring_events: { super_six: { runs: 6, legal_ball: true, wicket: false }, out: { runs: 0, legal_ball: true, wicket: true } },
    draw_allowed: true, overtime: { policy: 'super_over' }, roster: { min_squad_size: 6, max_squad_size: 8, required_positions: {} },
  });
  assert.ok(r.ok);
  const bad = validateSport({ sport_id: 'tape-ball', name: 'T', scoring_model: 'innings', periods: { innings_per_team: 1 },
    scoring_events: { x: { runs: -1 } }, draw_allowed: true, overtime: { policy: 'none' }, roster: { min_squad_size: 1, max_squad_size: 2, required_positions: {} } });
  assert.deepStrictEqual(bad.details.fields.sort(), ['periods.balls_per_over', 'periods.overs_per_innings', 'periods.wickets_per_innings',
    'scoring_events.x.legal_ball', 'scoring_events.x.runs', 'scoring_events.x.wicket']);
});

test('FR-1.1-03 round model: best_of must be odd', () => {
  const base = { sport_id: 'duel', name: 'Duel', scoring_model: 'round', scoring_events: { win: { rounds: 1 } }, draw_allowed: false,
    overtime: { policy: 'none' }, roster: { min_squad_size: 1, max_squad_size: 1, required_positions: {} } };
  assert.ok(validateSport({ ...base, periods: { best_of: 5 } }).ok);
  assert.deepStrictEqual(fieldsOf({ ...base, periods: { best_of: 4 } }), ['periods.best_of']);
});

test('FR-1.1-01 roster min > max, duplicate tie breakers, unknown tie breaker, unknown model', () => {
  const k = kabaddi(); k.roster.min_squad_size = 13;
  assert.deepStrictEqual(fieldsOf(k), ['roster.min_squad_size']);
  const d = kabaddi(); d.tie_break_order = ['scored', 'scored'];
  assert.deepStrictEqual(fieldsOf(d), ['tie_break_order']);
  const u = kabaddi(); u.scoring_model = 'sets';
  assert.deepStrictEqual(fieldsOf(u), ['scoring_model']);
  assert.deepStrictEqual(fieldsOf(null), ['body']);
});

test('FR-1.1-02 every seeded sport passes the same validation', () => {
  for (const s of SPORTS) assert.ok(validateSport({ sport_id: s.sport_id, ...s.config }).ok, s.sport_id);
});
