'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { compute } = require('../../../src/domain/standings');

const FULL = ['h2h_points', 'h2h_diff', 'overall_diff', 'scored', 'fair_play', 'draw_lots'];
const EVENT = { scoring_model: 'event', draw_allowed: true, periods: { count: 2, duration_minutes: 45 } };
const league = (teams, over = {}) => ({
  league_id: 'lg-1', teams, points: { win: 3, draw: 1, loss: 0 }, tie_break_order: FULL, qualification_spots: 2, lots_seed: 42, ...over,
});
// completed match with scores; outcome derived (draw when level)
function fx(home, away, hs, as, extra = {}) {
  const outcome = extra.outcome || (hs > as ? 'home_win' : hs < as ? 'away_win' : 'draw');
  const side = (score, s = {}) => ({ score, balls: 0, wickets: 0, fair_play: 0, ...s });
  return { home_team_id: home, away_team_id: away, view: { status: extra.status || 'completed', outcome, home: side(hs, extra.h), away: side(as, extra.a) } };
}
const row = (res, t) => res.table.find((r) => r.team_id === t);
const order = (res) => res.table.map((r) => r.team_id);

test('FR-1.4-01 basic table: counts, points, diff, one row per team incl. 0 played', () => {
  const res = compute({ league: league(['a', 'b', 'c', 'z']), config: EVENT, matches: [fx('a', 'b', 2, 0), fx('b', 'c', 1, 1)] });
  assert.deepStrictEqual(order(res), ['a', 'b', 'c', 'z'].sort((x, y) => order(res).indexOf(x) - order(res).indexOf(y)));
  assert.deepStrictEqual(row(res, 'a'), { rank: 1, team_id: 'a', played: 1, won: 1, drawn: 0, lost: 0, scored: 2, conceded: 0, diff: 2, points: 3, fair_play: 0, status: row(res, 'a').status, resolved_by: null });
  assert.strictEqual(row(res, 'b').points, 1);
  assert.strictEqual(row(res, 'z').played, 0);
  assert.strictEqual(res.table.length, 4);
});

test('BR-STAND-01 undecided and unfinished matches are not played', () => {
  const res = compute({ league: league(['a', 'b']), config: EVENT, matches: [
    fx('a', 'b', 1, 1, { outcome: 'undecided' }), fx('a', 'b', 3, 0, { status: 'in_progress', outcome: 'pending' }) ] });
  assert.deepStrictEqual([row(res, 'a').played, row(res, 'a').points], [0, 0]);
});

// A>B, A>C, B>C, D>A, B>D, C>D, C>E → A,B,C all on 6 points
const TRIPLE = [fx('a', 'b', 1, 0), fx('a', 'c', 1, 0), fx('b', 'c', 1, 0), fx('d', 'a', 1, 0), fx('b', 'd', 1, 0), fx('c', 'd', 1, 0), fx('c', 'e', 1, 0)];

test('FR-1.4-01 edge case 4: three-way tie resolved by h2h_points among the tied teams only', () => {
  const res = compute({ league: league(['a', 'b', 'c', 'd', 'e']), config: EVENT, matches: TRIPLE });
  assert.deepStrictEqual([row(res, 'a').points, row(res, 'b').points, row(res, 'c').points], [6, 6, 6]);
  assert.deepStrictEqual(order(res).slice(0, 3), ['a', 'b', 'c']);
  assert.deepStrictEqual(['a', 'b', 'c'].map((t) => row(res, t).resolved_by), ['h2h_points', 'h2h_points', null]);
});

test('BR-STAND-04 falls through to overall_diff when h2h is a cycle', () => {
  // each of a,b,c beats one of the others 1-0; d beats all three (a 1-0, b 2-0, c 3-0)
  const matches = [fx('a', 'b', 1, 0), fx('b', 'c', 1, 0), fx('c', 'a', 1, 0), fx('d', 'a', 1, 0), fx('d', 'b', 2, 0), fx('d', 'c', 3, 0)];
  const res = compute({ league: league(['a', 'b', 'c', 'd']), config: EVENT, matches });
  assert.deepStrictEqual(order(res), ['d', 'a', 'b', 'c']);
  assert.deepStrictEqual(['a', 'b', 'c'].map((t) => row(res, t).resolved_by), ['overall_diff', 'overall_diff', null]);
});

test('BR-STAND-04 restart-on-split: a subgroup restarts from the first criterion with its own members', () => {
  // criteria scored → h2h_points. a: scored 5; b,c: scored 3 each → split {a},{b,c}; b,c then separated by their own h2h (c beat b)
  const matches = [fx('a', 'z', 5, 5, { outcome: 'draw' }), fx('b', 'z', 3, 3, { outcome: 'draw' }), fx('c', 'z', 3, 3, { outcome: 'draw' }), fx('c', 'b', 0, 0, { outcome: 'home_win' })];
  const res = compute({ league: league(['a', 'b', 'c', 'z'], { tie_break_order: ['scored', 'h2h_points'] }), config: EVENT, matches });
  assert.strictEqual(row(res, 'b').points, 1);
  // a:1, b:1, c:4, z:3 → c first by points; a and b tied on 1 point: scored a=5 > b=3
  assert.deepStrictEqual(order(res), ['c', 'z', 'a', 'b']);
  assert.strictEqual(row(res, 'a').resolved_by, 'scored');
});

test('FR-1.4-01 App. A vector 2: draw_lots order t1, t3, t2 (seed 42, lg-1)', () => {
  const res = compute({ league: league(['t1', 't2', 't3']), config: EVENT, matches: [] });
  assert.deepStrictEqual(order(res), ['t1', 't3', 't2']);
  assert.deepStrictEqual(res.table.map((r) => r.resolved_by), ['draw_lots', 'draw_lots', null]);
});

test('OQ-15 draw_lots listed early or omitted is still applied last', () => {
  const a = compute({ league: league(['t1', 't2', 't3'], { tie_break_order: ['draw_lots', 'scored'] }), config: EVENT, matches: [] });
  const b = compute({ league: league(['t1', 't2', 't3'], { tie_break_order: [] }), config: EVENT, matches: [] });
  assert.deepStrictEqual(order(a), ['t1', 't3', 't2']);
  assert.deepStrictEqual(order(b), ['t1', 't3', 't2']);
});

test('BR-STAND-06 h2h has every ordered pair with zeros when never met; sums are per side', () => {
  const res = compute({ league: league(['a', 'b', 'c']), config: EVENT, matches: [fx('a', 'b', 2, 1), fx('b', 'a', 0, 0)] });
  assert.deepStrictEqual(Object.keys(res.h2h.a).sort(), ['b', 'c']);
  assert.deepStrictEqual(res.h2h.a.b, { played: 2, points: 4, scored: 2, conceded: 1 });
  assert.deepStrictEqual(res.h2h.b.a, { played: 2, points: 1, scored: 1, conceded: 2 });
  assert.deepStrictEqual(res.h2h.a.c, { played: 0, points: 0, scored: 0, conceded: 0 });
});

test('BR-STAND-07 qualification: clinched / eliminated / still_possible (points only)', () => {
  // 4 teams, 1 spot. a has 6, others 0, one fixture left each between b,c,d pairs
  const matches = [fx('a', 'b', 1, 0), fx('a', 'c', 1, 0), fx('b', 'd', 0, 0, { status: 'upcoming', outcome: 'pending' })];
  const res = compute({ league: league(['a', 'b', 'c', 'd'], { qualification_spots: 1 }), config: EVENT, matches });
  assert.strictEqual(row(res, 'a').status, 'clinched'); // max of others: b 0+3, c 0, d 3 < 6
  assert.strictEqual(row(res, 'c').status, 'eliminated'); // a has 6 > c's max 0
  assert.strictEqual(row(res, 'b').status, 'eliminated'); // b max 3 < 6
});

test('BR-STAND-07 still_possible while others can still catch up', () => {
  const res = compute({ league: league(['a', 'b', 'c'], { qualification_spots: 1 }), config: EVENT, matches: [
    fx('a', 'b', 1, 0), fx('a', 'c', 0, 0, { status: 'upcoming', outcome: 'pending' }), fx('b', 'c', 0, 0, { status: 'upcoming', outcome: 'pending' })] });
  assert.strictEqual(row(res, 'a').status, 'still_possible'); // b max 0+3 = 3 >= 3
});

const CRICKET = { scoring_model: 'innings', draw_allowed: true, periods: { innings_per_team: 1, overs_per_innings: 20, balls_per_over: 6, wickets_per_innings: 10 } };

test('BR-STAND-02 innings NRR: runs per over for minus against, 3 decimals; bowled out counts as full overs', () => {
  // a: 120 runs off 120 balls (20 ov) ; b: 100 runs, all out in 90 balls → credited 20 overs
  const m = fx('a', 'b', 120, 100, { h: { balls: 120, wickets: 3 }, a: { balls: 90, wickets: 10 } });
  const res = compute({ league: league(['a', 'b']), config: CRICKET, matches: [m] });
  assert.strictEqual(row(res, 'a').diff, 1); // 120/20 - 100/20
  assert.strictEqual(row(res, 'b').diff, -1);
  assert.strictEqual(row(res, 'a').scored, 120);
  const m2 = fx('a', 'b', 50, 40, { h: { balls: 60, wickets: 2 }, a: { balls: 120, wickets: 5 } });
  const r2 = compute({ league: league(['a', 'b']), config: CRICKET, matches: [m2] });
  assert.strictEqual(row(r2, 'a').diff, 3.0); // 50/10 - 40/20 = 5 - 2
});

test('OQ-14 zero overs term counts as 0', () => {
  const m = fx('a', 'b', 0, 0, { outcome: 'draw' });
  const res = compute({ league: league(['a', 'b']), config: CRICKET, matches: [m] });
  assert.strictEqual(row(res, 'a').diff, 0);
});

test('BR-STAND-03 fair_play sums over played matches only', () => {
  const res = compute({ league: league(['a', 'b']), config: EVENT, matches: [fx('a', 'b', 1, 0, { a: { fair_play: -2 } }), fx('a', 'b', 0, 0, { status: 'in_progress', outcome: 'pending', a: { fair_play: -9 } })] });
  assert.strictEqual(row(res, 'b').fair_play, -2);
});
