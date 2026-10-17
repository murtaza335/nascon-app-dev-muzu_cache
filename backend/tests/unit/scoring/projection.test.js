'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { build } = require('../../../src/domain/scoring/projection');
const { SPORTS } = require('../../../src/seed/baseline');
const { validateSport } = require('../../../src/domain/scoring/sportSchema');

const cfg = (id) => { const s = SPORTS.find((x) => x.sport_id === id); return validateSport({ sport_id: id, ...s.config }).value.config; };
const match = { match_id: 'm1', sport_id: 's', league_id: null, home_team_id: 'h', away_team_id: 'a' };
let n = 0;
const ev = (type, payload = {}) => { n += 1; return { event_id: `e${n}`, sequence: n, type, payload, signature: 'sig' }; };
const reset = () => { n = 0; };
const score = (team, event_type) => ev('score', { team_id: team, event_type });

test('FR-1.1-03 event model: sums points, status, outcome, winner', () => {
  reset();
  const events = [ev('match_init'), ev('match_start'), score('h', 'goal'), score('h', 'goal'), score('a', 'goal'), ev('match_end')];
  const v = build({ match, config: cfg('football'), events });
  assert.deepStrictEqual([v.status, v.outcome, v.winner_team_id, v.home.score, v.away.score, v.version], ['completed', 'home_win', 'h', 2, 1, 6]);
  assert.deepStrictEqual([v.home.wickets, v.home.balls, v.home.overs], [null, null, null]);
});

test('FR-1.1-01 custom sport: kabaddi all_out adds 2 points (config-driven)', () => {
  reset();
  const kabaddi = validateSport({
    sport_id: 'kabaddi', name: 'K', scoring_model: 'event', periods: { count: 2, duration_minutes: 20 },
    scoring_events: { raid_point: { points: 1 }, all_out: { points: 2 } }, draw_allowed: false, overtime: { policy: 'golden_score' },
    roster: { min_squad_size: 7, max_squad_size: 12, required_positions: {} },
  }).value.config;
  const v = build({ match, config: kabaddi, events: [ev('match_start'), score('a', 'all_out'), score('a', 'raid_point')] });
  assert.strictEqual(v.away.score, 3);
  assert.strictEqual(v.status, 'in_progress');
  assert.strictEqual(v.outcome, 'pending');
});

test('FR-1.1-03 innings model: runs, wickets, legal balls, overs string', () => {
  reset();
  const events = [ev('match_start'), score('h', 'six'), score('h', 'wide'), score('h', 'dot_ball'), score('h', 'wicket'), score('h', 'single'), score('h', 'single'), score('h', 'single'), score('h', 'single')];
  const v = build({ match, config: cfg('cricket'), events });
  // legal: six, dot, wicket, 4x single = 7 ; wide not legal
  assert.deepStrictEqual([v.home.score, v.home.wickets, v.home.balls, v.home.overs], [6 + 1 + 0 + 0 + 4, 1, 7, '1.1']);
});

test('FR-1.1-03 round model: rounds won', () => {
  reset();
  const v = build({ match, config: cfg('esports'), events: [ev('match_start'), score('h', 'round_win'), score('a', 'round_win'), score('h', 'round_win')] });
  assert.deepStrictEqual([v.home.score, v.away.score], [2, 1]);
});

test('FR-1.1-04 compensation: target and compensation are neutral; flags set; original row kept', () => {
  reset();
  const events = [ev('match_start'), score('h', 'goal')];
  events.push(ev('compensation', { compensates: events[1].event_id, reason: 'offside' }));
  const v = build({ match, config: cfg('football'), events });
  assert.strictEqual(v.home.score, 0);
  assert.deepStrictEqual([v.events[1].compensated, v.events[1].compensated_by, v.events[2].compensated], [true, 'e3', false]);
  assert.strictEqual(v.events.length, 3);
});

test('BR-SCORE-05 discipline sums into fair_play; compensated discipline is neutral', () => {
  reset();
  const d1 = ev('discipline', { team_id: 'a', points: -2 });
  const d2 = ev('discipline', { team_id: 'a', points: -1 });
  const v = build({ match, config: cfg('football'), events: [ev('match_start'), d1, d2, ev('compensation', { compensates: d1.event_id, reason: 'x' })] });
  assert.strictEqual(v.away.fair_play, -1);
});

test('BR-SCORE-08 outcome: draw, undecided, tiebreak winner beats draw_allowed', () => {
  reset();
  const base = [ev('match_start'), score('h', 'goal'), score('a', 'goal')];
  const f = cfg('football');
  assert.strictEqual(build({ match, config: f, events: [...base, ev('match_end')] }).outcome, 'draw');
  const tb = ev('tiebreak_winner', { team_id: 'a' });
  const w = build({ match, config: f, events: [...base, tb, ev('match_end')] });
  assert.deepStrictEqual([w.outcome, w.winner_team_id, w.tiebreak_winner_team_id], ['away_win', 'a', 'a']);
  const b = cfg('basketball');
  const bb = [ev('match_start'), score('h', 'two_pointer'), score('a', 'two_pointer'), tb, ev('compensation', { compensates: tb.event_id, reason: 'x' }), ev('match_end')];
  assert.deepStrictEqual([build({ match, config: b, events: bb }).outcome, build({ match, config: b, events: bb }).winner_team_id], ['undecided', null]);
});

test('BR-SCORE-08 status: upcoming without start; pending outcome', () => {
  reset();
  const v = build({ match, config: cfg('football'), events: [ev('match_init')] });
  assert.deepStrictEqual([v.status, v.outcome, v.winner_team_id], ['upcoming', 'pending', null]);
});
