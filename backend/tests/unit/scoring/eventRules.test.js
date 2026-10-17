'use strict';
const test = require('node:test');
const assert = require('node:assert');
const rules = require('../../../src/domain/scoring/eventRules');
const { build } = require('../../../src/domain/scoring/projection');
const { SPORTS } = require('../../../src/seed/baseline');
const { validateSport } = require('../../../src/domain/scoring/sportSchema');
const { check } = require('../../../src/lib/validate');

const cfg = (id) => { const s = SPORTS.find((x) => x.sport_id === id); return validateSport({ sport_id: id, ...s.config }).value.config; };
const match = { match_id: 'm1', sport_id: 's', league_id: null, home_team_id: 'h', away_team_id: 'a' };
let n = 0;
const ev = (type, payload = {}) => { n += 1; return { event_id: `e${n}`, sequence: n, type, payload, signature: 's' }; };
const sc = (team, et) => ev('score', { team_id: team, event_type: et });
const run = (config, events, type, payload, target) => {
  const view = build({ match, config, events });
  return rules.checkState(type, payload, { match, config, view, target });
};
const code = (r) => (r.ok ? 'OK' : r.error.code);

test('BR-SCORE-01 status machine: start/end transitions and ILLEGAL_TRANSITION', () => {
  n = 0;
  const f = cfg('football');
  assert.strictEqual(code(run(f, [], 'match_start', {})), 'OK');
  assert.strictEqual(code(run(f, [ev('match_start')], 'match_start', {})), 'ILLEGAL_TRANSITION');
  assert.strictEqual(code(run(f, [], 'match_end', {})), 'ILLEGAL_TRANSITION');
  assert.strictEqual(code(run(f, [ev('match_start'), ev('match_end')], 'match_end', {})), 'ILLEGAL_TRANSITION');
  assert.strictEqual(code(run(f, [ev('match_start'), ev('match_end')], 'match_start', {})), 'ILLEGAL_TRANSITION');
});

test('BR-SCORE-01 score/discipline/tiebreak need in_progress', () => {
  n = 0;
  const f = cfg('football');
  for (const [type, p] of [['score', { team_id: 'h', event_type: 'goal' }], ['discipline', { team_id: 'h', points: -1 }], ['tiebreak_winner', { team_id: 'h' }]]) {
    assert.strictEqual(code(run(f, [], type, p)), 'MATCH_NOT_IN_PROGRESS');
    assert.strictEqual(code(run(f, [ev('match_start')], type, p)), 'OK');
    assert.strictEqual(code(run(f, [ev('match_start'), ev('match_end')], type, p)), 'MATCH_NOT_IN_PROGRESS');
  }
});

test('BR-SCORE-02 match_end on a tie: TIE_NOT_ALLOWED unless draw allowed or tiebreak winner active', () => {
  n = 0;
  const b = cfg('basketball');
  const level = [ev('match_start'), sc('h', 'two_pointer'), sc('a', 'two_pointer')];
  assert.strictEqual(code(run(b, level, 'match_end', {})), 'TIE_NOT_ALLOWED');
  assert.strictEqual(code(run(b, [...level, ev('tiebreak_winner', { team_id: 'h' })], 'match_end', {})), 'OK');
  assert.strictEqual(code(run(cfg('football'), level.map((e) => (e.type === 'score' ? { ...e, payload: { ...e.payload, event_type: 'goal' } } : e)), 'match_end', {})), 'OK');
});

test('BR-SCORE-04 innings limit: 120 legal balls → INNINGS_COMPLETE; compensated balls do not count', () => {
  n = 0;
  const c = cfg('cricket');
  const events = [ev('match_start')];
  for (let i = 0; i < 119; i++) events.push(sc('h', 'single'));
  assert.strictEqual(code(run(c, events, 'score', { team_id: 'h', event_type: 'single' })), 'OK');
  const last = sc('h', 'dot_ball');
  events.push(last);
  assert.strictEqual(code(run(c, events, 'score', { team_id: 'h', event_type: 'single' })), 'INNINGS_COMPLETE');
  assert.strictEqual(code(run(c, events, 'score', { team_id: 'h', event_type: 'wide' })), 'INNINGS_COMPLETE');
  assert.strictEqual(code(run(c, events, 'score', { team_id: 'a', event_type: 'single' })), 'OK');
  events.push(ev('compensation', { compensates: last.event_id, reason: 'r' }));
  assert.strictEqual(code(run(c, events, 'score', { team_id: 'h', event_type: 'single' })), 'OK');
});

test('BR-SCORE-04 innings limit: 10 wickets; wide does not use a ball', () => {
  n = 0;
  const c = cfg('cricket');
  const events = [ev('match_start')];
  for (let i = 0; i < 9; i++) events.push(sc('h', 'wicket'));
  for (let i = 0; i < 50; i++) events.push(sc('h', 'wide'));
  assert.strictEqual(code(run(c, events, 'score', { team_id: 'h', event_type: 'wicket' })), 'OK');
  const tenth = sc('h', 'wicket');
  events.push(tenth);
  assert.strictEqual(code(run(c, events, 'score', { team_id: 'h', event_type: 'single' })), 'INNINGS_COMPLETE');
  events.push(ev('compensation', { compensates: tenth.event_id, reason: 'r' }));
  assert.strictEqual(code(run(c, events, 'score', { team_id: 'h', event_type: 'single' })), 'OK');
});

test('BR-SCORE-04 round limit: best_of 3 decided at 2 rounds for either team', () => {
  n = 0;
  const e = cfg('esports');
  const events = [ev('match_start'), sc('h', 'round_win'), sc('a', 'round_win')];
  assert.strictEqual(code(run(e, events, 'score', { team_id: 'a', event_type: 'round_win' })), 'OK');
  const second = sc('h', 'round_win');
  events.push(second);
  assert.strictEqual(code(run(e, events, 'score', { team_id: 'a', event_type: 'round_win' })), 'SERIES_ALREADY_DECIDED');
  assert.strictEqual(code(run(e, events, 'score', { team_id: 'h', event_type: 'round_win' })), 'SERIES_ALREADY_DECIDED');
  events.push(ev('compensation', { compensates: second.event_id, reason: 'r' }));
  assert.strictEqual(code(run(e, events, 'score', { team_id: 'h', event_type: 'round_win' })), 'OK');
});

test('BR-SCORE-07 compensation validity: other match, other type, already compensated', () => {
  n = 0;
  const f = cfg('football');
  const goal = sc('h', 'goal');
  const events = [ev('match_start'), goal];
  const payload = { compensates: goal.event_id, reason: 'r' };
  assert.strictEqual(code(run(f, events, 'compensation', payload, { match_id: 'm1', type: 'score' })), 'OK');
  assert.strictEqual(code(run(f, events, 'compensation', payload, { match_id: 'other', type: 'score' })), 'INVALID_COMPENSATION');
  assert.strictEqual(code(run(f, events, 'compensation', payload, { match_id: 'm1', type: 'match_start' })), 'INVALID_COMPENSATION');
  assert.strictEqual(code(run(f, events, 'compensation', payload, { match_id: 'm1', type: 'compensation' })), 'INVALID_COMPENSATION');
  events.push(ev('compensation', payload));
  assert.strictEqual(code(run(f, events, 'compensation', payload, { match_id: 'm1', type: 'score' })), 'INVALID_COMPENSATION');
});

test('BR-SCORE-07 compensation is allowed after the match is completed', () => {
  n = 0;
  const f = cfg('football');
  const goal = sc('h', 'goal');
  const events = [ev('match_start'), goal, ev('match_end')];
  assert.strictEqual(code(run(f, events, 'compensation', { compensates: goal.event_id, reason: 'r' }, { match_id: 'm1', type: 'score' })), 'OK');
});

test('BR-SCORE-03 semantics: team must be home/away (400 payload.team_id); unknown event_type → UNKNOWN_EVENT_TYPE', () => {
  const f = cfg('football');
  const sem = (type, payload) => rules.checkSemantics(type, payload, { match, config: f });
  assert.deepStrictEqual(sem('score', { team_id: 'zzz', event_type: 'goal' }).details, { fields: ['payload.team_id'] });
  assert.strictEqual(code(sem('score', { team_id: 'h', event_type: 'six' })), 'UNKNOWN_EVENT_TYPE');
  assert.strictEqual(code(sem('score', { team_id: 'h', event_type: 'goal' })), 'OK');
  assert.deepStrictEqual(sem('discipline', { team_id: 'x', points: -1 }).details, { fields: ['payload.team_id'] });
  assert.deepStrictEqual(sem('match_init', { sport_id: 's', home_team_id: 'x', away_team_id: 'x' }).details, { fields: ['payload.away_team_id'] });
});

test('BR-SCORE payload shapes: required fields, strict ints, reason length', () => {
  const bad = (type, p) => check(rules.payloadShape(type), p).fields;
  assert.deepStrictEqual(bad('score', {}).sort(), ['event_type', 'team_id']);
  assert.deepStrictEqual(bad('discipline', { team_id: 't', points: 1.5 }), ['points']);
  assert.deepStrictEqual(bad('compensation', { compensates: 'e', reason: '' }), ['reason']);
  assert.deepStrictEqual(bad('compensation', { compensates: 'e', reason: 'x'.repeat(501) }), ['reason']);
  assert.deepStrictEqual(bad('match_init', { sport_id: 's', home_team_id: 'a' }), ['away_team_id']);
  assert.ok(check(rules.payloadShape('match_start'), { anything: 1 }).ok);
});
