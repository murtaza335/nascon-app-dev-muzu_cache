'use strict';
const test = require('node:test');
const assert = require('node:assert');
const se = require('../../../src/domain/fixtures/singleElim');
const de = require('../../../src/domain/fixtures/doubleElim');
const { seedOrder } = require('../../../src/domain/fixtures/bracket');

const T = (n) => Array.from({ length: n }, (_, i) => `t${i + 1}`);
const flat = (rounds) => rounds.flatMap((r) => r.matches);

test('FR-1.3-03 seed order recursion: order(8)', () => {
  assert.deepStrictEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.deepStrictEqual(seedOrder(2), [1, 2]);
});

test('FR-1.3-03 n=6 example: byes, seeds, immediate propagation, MATCH fields', () => {
  const { value: v } = se.generate({ teams: T(6) });
  assert.strictEqual(v.bracket_size, 8);
  const r1 = v.rounds[0].matches;
  assert.deepStrictEqual(r1.map((m) => [m.match_id, m.home, m.away, m.bye, m.home_seed, m.away_seed]),
    [['R1M1', 't1', null, true, 1, null], ['R1M2', 't4', 't5', false, 4, 5], ['R1M3', 't2', null, true, 2, null], ['R1M4', 't3', 't6', false, 3, 6]]);
  assert.strictEqual(v.rounds[1].matches[0].home, 't1');
  assert.strictEqual(v.rounds[1].matches[1].home, 't2');
  assert.deepStrictEqual(Object.keys(r1[1]), ['match_id', 'bracket', 'round', 'index', 'home', 'away', 'home_seed', 'away_seed', 'bye', 'winner', 'loser', 'winner_to', 'loser_to']);
  assert.deepStrictEqual(r1[1].winner_to, { match_id: 'R2M1', slot: 'away' });
  assert.deepStrictEqual(r1[3].winner_to, { match_id: 'R2M2', slot: 'away' });
  assert.strictEqual(v.rounds[2].matches[0].winner_to, null);
  assert.deepStrictEqual(r1[0].winner, 't1');
});

test('FR-1.3-03 structure for n = 2..128: rounds, counts, advancement rule, exactly one feeder per slot', () => {
  for (let n = 2; n <= 128; n++) {
    const { value: v } = se.generate({ teams: T(n) });
    const B = 2 ** Math.ceil(Math.log2(n));
    assert.strictEqual(v.bracket_size, B);
    assert.strictEqual(v.rounds.length, Math.log2(B));
    v.rounds.forEach((r, i) => assert.strictEqual(r.matches.length, B / 2 ** (i + 1)));
    const feeders = new Map();
    for (const m of flat(v.rounds)) if (m.winner_to) { const k = `${m.winner_to.match_id}.${m.winner_to.slot}`; feeders.set(k, (feeders.get(k) || 0) + 1); }
    for (const m of flat(v.rounds).filter((x) => x.round > 1)) for (const s of ['home', 'away']) assert.strictEqual(feeders.get(`${m.match_id}.${s}`), 1);
    const teamsR1 = v.rounds[0].matches.flatMap((m) => [m.home, m.away]).filter(Boolean);
    assert.strictEqual(new Set(teamsR1).size, n);
  }
});

test('FR-1.3-03 results fill winner/loser and propagate; dependency order does not matter', () => {
  const results = [{ match_id: 'R2M1', winner: 't1' }, { match_id: 'R1M2', winner: 't4' }];
  const { value: v } = se.generate({ teams: T(6), results });
  const m = Object.fromEntries(flat(v.rounds).map((x) => [x.match_id, x]));
  assert.deepStrictEqual([m.R1M2.winner, m.R1M2.loser], ['t4', 't5']);
  assert.deepStrictEqual([m.R2M1.home, m.R2M1.away, m.R2M1.winner, m.R2M1.loser], ['t1', 't4', 't1', 't4']);
  assert.strictEqual(m.R3M1.home, 't1');
});

test('FR-1.3-03 third place match receives semifinal losers', () => {
  const teams = T(4);
  const first = se.generate({ teams, thirdPlace: true, results: [{ match_id: 'R1M1', winner: 't1' }, { match_id: 'R1M2', winner: 't3' }] }).value;
  const m = Object.fromEntries(flat(first.rounds).map((x) => [x.match_id, x]));
  assert.deepStrictEqual(m.R1M1.loser_to, { match_id: 'TP', slot: 'home' });
  assert.deepStrictEqual(m.R1M2.loser_to, { match_id: 'TP', slot: 'away' });
  assert.deepStrictEqual([m.TP.bracket, m.TP.home, m.TP.away, m.TP.winner_to, m.TP.loser_to], ['third_place', 't4', 't2', null, null]);
  assert.strictEqual(first.rounds[1].matches.at(-1).match_id, 'TP');
});

test('BR-FIX-04 invalid results: unknown id, non-participant, duplicate, undetermined participants, bye match', () => {
  const bad = (results) => se.generate({ teams: T(6), results });
  assert.deepStrictEqual(bad([{ match_id: 'R9M9', winner: 't1' }]).details.fields, ['params.results[0].match_id']);
  assert.deepStrictEqual(bad([{ match_id: 'R1M2', winner: 't1' }]).details.fields, ['params.results[0].winner']);
  assert.deepStrictEqual(bad([{ match_id: 'R1M2', winner: 't4' }, { match_id: 'R1M2', winner: 't5' }]).details.fields, ['params.results[1].match_id']);
  assert.deepStrictEqual(bad([{ match_id: 'R3M1', winner: 't1' }]).details.fields, ['params.results[0].match_id']);
  assert.deepStrictEqual(bad([{ match_id: 'R1M1', winner: 't1' }]).details.fields, ['params.results[0].match_id']);
  assert.strictEqual(se.generate({ teams: T(2), thirdPlace: true }).ok, false);
});

// ---- double elimination ----------------------------------------------------------------------------------------
function graphCheck(v, B) {
  const k = Math.log2(B);
  const all = [...flat(v.winners), ...flat(v.losers), ...v.grand_final];
  const by = new Map(all.map((m) => [m.match_id, m]));
  assert.strictEqual(flat(v.winners).length, B - 1);
  assert.strictEqual(flat(v.losers).length, B - 2);
  v.winners.forEach((r, i) => assert.strictEqual(r.matches.length, B / 2 ** (i + 1)));
  v.losers.forEach((r, i) => assert.strictEqual(r.matches.length, B / 2 ** (Math.ceil((i + 1) / 2) + 1)));
  assert.strictEqual(v.losers.length, 2 * (k - 1));
  const terminal = v.bracket_reset ? 'GF2' : 'GF1';
  const feeders = new Map();
  const feed = (to) => { assert.ok(by.has(to.match_id), `dangling ${to.match_id}`); const key = `${to.match_id}.${to.slot}`; feeders.set(key, (feeders.get(key) || 0) + 1); };
  for (const m of all) {
    if (m.match_id !== terminal) assert.ok(m.winner_to, `${m.match_id} needs winner_to`); else assert.strictEqual(m.winner_to, null);
    if (m.winner_to) feed(m.winner_to);
    if (m.bracket === 'winners') assert.ok(m.loser_to, `${m.match_id} needs loser_to`);
    if (m.bracket === 'losers') assert.strictEqual(m.loser_to, null);
    if (m.loser_to) feed(m.loser_to);
  }
  for (const m of all) {
    if (m.round === 1 && m.bracket === 'winners') continue;
    for (const s of ['home', 'away']) assert.strictEqual(feeders.get(`${m.match_id}.${s}`), 1, `${m.match_id}.${s} fed once`);
  }
  const wf = by.get(`WR${k}M1`);
  assert.deepStrictEqual(wf.winner_to, { match_id: 'GF1', slot: 'home' });
  const lf = by.get(`LR${2 * (k - 1)}M1`);
  assert.deepStrictEqual(wf.loser_to, { match_id: lf.match_id, slot: 'away' });
  assert.deepStrictEqual(lf.winner_to, { match_id: 'GF1', slot: 'away' });
}

test('FR-1.3-04 counts, ids and routing graph for B = 4..128 (with and without reset)', () => {
  for (const B of [4, 8, 16, 32, 64, 128]) for (const reset of [false, true]) {
    const r = de.generate({ teams: T(B), bracketReset: reset });
    assert.ok(r.ok);
    graphCheck(r.value, B);
    assert.deepStrictEqual(r.value.grand_final.map((m) => m.match_id), reset ? ['GF1', 'GF2'] : ['GF1']);
  }
});

test('FR-1.3-04 non-power-of-two fields keep exact counts (3..128)', () => {
  for (let n = 3; n <= 128; n++) {
    const B = 2 ** Math.ceil(Math.log2(n));
    const r = de.generate({ teams: T(n), bracketReset: n % 2 === 0 });
    graphCheck(r.value, B);
    const r1 = r.value.winners[0].matches;
    assert.strictEqual(r1.filter((m) => m.bye).length, B - n);
  }
});

test('FR-1.3-04 GF2 conditional/required semantics (edge case 3)', () => {
  const teams = T(4);
  const upTo = (extra) => {
    const results = [{ match_id: 'WR1M1', winner: 't1' }, { match_id: 'WR1M2', winner: 't2' }, { match_id: 'WR2M1', winner: 't1' },
      { match_id: 'LR1M1', winner: 't4' }, { match_id: 'LR2M1', winner: 't4' }, ...extra];
    return de.generate({ teams, bracketReset: true, results });
  };
  const pending = upTo([]).value.grand_final;
  assert.deepStrictEqual([pending[0].conditional, pending[0].required, pending[1].conditional, pending[1].required], [false, true, true, null]);
  assert.deepStrictEqual([pending[0].home, pending[0].away], ['t1', 't4']);
  assert.deepStrictEqual([pending[1].home, pending[1].away], [null, null]);
  const lbWins = upTo([{ match_id: 'GF1', winner: 't4' }]).value.grand_final;
  assert.deepStrictEqual([lbWins[1].required, lbWins[1].home, lbWins[1].away], [true, 't4', 't1']);
  const wbWins = upTo([{ match_id: 'GF1', winner: 't1' }]).value.grand_final;
  assert.deepStrictEqual([wbWins[1].required, wbWins[1].home], [false, null]);
  assert.strictEqual(upTo([{ match_id: 'GF1', winner: 't1' }, { match_id: 'GF2', winner: 't1' }]).ok, false);
  const done = upTo([{ match_id: 'GF1', winner: 't4' }, { match_id: 'GF2', winner: 't4' }]).value.grand_final;
  assert.strictEqual(done[1].winner, 't4');
});

test('FR-1.3-04 MATCH carries conditional/required; losers bracket drops WR losers', () => {
  const v = de.generate({ teams: T(8) }).value;
  assert.deepStrictEqual(Object.keys(v.winners[0].matches[0]).slice(-2), ['conditional', 'required']);
  const wr2 = v.winners[1].matches[0];
  assert.deepStrictEqual(wr2.loser_to, { match_id: 'LR2M1', slot: 'away' });
  assert.deepStrictEqual(v.winners[0].matches[0].loser_to, { match_id: 'LR1M1', slot: 'home' });
  assert.deepStrictEqual(v.winners[0].matches[1].loser_to, { match_id: 'LR1M1', slot: 'away' });
  assert.deepStrictEqual(v.grand_final[0].winner_to, null);
});

test('BR-FIX-06 a losers match fed by a WR1 bye resolves when its other team is known', () => {
  const v = de.generate({ teams: T(3), results: [{ match_id: 'WR1M2', winner: 't2' }] }).value;
  const lr1 = v.losers[0].matches[0];
  assert.strictEqual(lr1.bye, true);
  assert.deepStrictEqual([lr1.away, lr1.winner], ['t3', 't3']);
  assert.strictEqual(v.losers[1].matches[0].home, 't3');
});
