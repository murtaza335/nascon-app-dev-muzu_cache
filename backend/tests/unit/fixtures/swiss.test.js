'use strict';
const test = require('node:test');
const assert = require('node:assert');
const swiss = require('../../../src/domain/fixtures/swiss');
const { bestPairing } = require('../../../src/domain/fixtures/pairing');
const fixtures = require('../../../src/domain/fixtures');

const T = (n) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

test('FR-1.3-02 round 1 is exact: seed i vs i+m, last seed gets the odd bye', () => {
  const even = swiss.generate({ teams: T(6), round: 1, totalRounds: 3 }).value;
  assert.deepStrictEqual(even.pairings.map((p) => [p.match_id, p.home, p.away]), [['SW-R1-M1', 't1', 't4'], ['SW-R1-M2', 't2', 't5'], ['SW-R1-M3', 't3', 't6']]);
  assert.strictEqual(even.bye, null);
  const odd = swiss.generate({ teams: T(5), round: 1, totalRounds: 3 }).value;
  assert.deepStrictEqual(odd.pairings.map((p) => [p.home, p.away]), [['t1', 't3'], ['t2', 't4']]);
  assert.strictEqual(odd.bye, 't5');
  assert.deepStrictEqual(odd.standings.map((s) => s.score), [0, 0, 0, 0, 0]);
});

test('FR-1.3-02 spec example round 2: pairings, bye, standings with buchholz', () => {
  const history = [{ round: 1, bye: 't5', matches: [{ home: 't1', away: 't3', result: 'home' }, { home: 't2', away: 't4', result: 'draw' }] }];
  const v = swiss.generate({ teams: T(5), round: 2, totalRounds: 3, history }).value;
  assert.deepStrictEqual(v.pairings.map((p) => [p.match_id, p.home, p.away]), [['SW-R2-M1', 't1', 't2'], ['SW-R2-M2', 't5', 't4']]);
  assert.strictEqual(v.bye, 't3');
  assert.deepStrictEqual(v.standings.slice(0, 3), [
    { rank: 1, team_id: 't1', score: 1, buchholz: 0 }, { rank: 2, team_id: 't5', score: 1, buchholz: 0 }, { rank: 3, team_id: 't2', score: 0.5, buchholz: 0.5 }]);
});

// Deterministic PRNG (mulberry32)
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function bruteMin(scores, banned) {
  const n = scores.length;
  let best = Infinity;
  const go = (used, cost) => {
    let i = used.indexOf(false);
    if (i === -1) { best = Math.min(best, cost); return; }
    used[i] = true;
    for (let j = i + 1; j < n; j++) {
      if (used[j] || banned.has(`${i},${j}`)) continue;
      used[j] = true;
      go(used, cost + Math.abs(scores[i] - scores[j]));
      used[j] = false;
    }
    used[i] = false;
  };
  go(Array(n).fill(false), 0);
  return best;
}

test('FR-1.3-02 optimal pairing cost equals brute force (n <= 10, random scores and rematch bans)', () => {
  const rand = rng(12345);
  let checked = 0;
  for (let trial = 0; trial < 600; trial++) {
    const n = 2 * (1 + Math.floor(rand() * 5)); // 2..10
    const scores = Array.from({ length: n }, () => Math.floor(rand() * 5) / 2).sort((a, b) => b - a);
    const banned = new Set();
    const bans = Math.floor(rand() * n * 2);
    for (let b = 0; b < bans; b++) {
      const i = Math.floor(rand() * n); const j = Math.floor(rand() * n);
      if (i !== j) banned.add(`${Math.min(i, j)},${Math.max(i, j)}`);
    }
    const want = bruteMin(scores, banned);
    const got = bestPairing(scores.map((s) => ({ score: s })), (i, j) => banned.has(`${Math.min(i, j)},${Math.max(i, j)}`));
    if (want === Infinity) assert.strictEqual(got, null);
    else {
      assert.ok(got, 'expected a solution');
      assert.ok(Math.abs(got.cost - want) < 1e-9, `cost ${got.cost} vs ${want}`);
      const used = got.pairs.flat();
      assert.strictEqual(new Set(used).size, n);
      for (const [i, j] of got.pairs) assert.ok(!banned.has(`${Math.min(i, j)},${Math.max(i, j)}`));
      checked++;
    }
  }
  assert.ok(checked > 300);
});

// Simulate whole tournaments and check the properties (a)-(c) of every round.
test('FR-1.3-02 simulated tournaments: no rematches, one pairing per team, bye rule, byes not repeated', () => {
  const rand = rng(99);
  for (const n of [4, 5, 6, 7, 8, 9, 10, 12, 16, 17, 33, 64]) {
    const teams = T(n);
    const total = Math.min(n - 1, 5);
    const history = [];
    const met = new Set();
    const byes = new Set();
    for (let round = 1; round <= total; round++) {
      const r = fixtures.generate({ format: 'swiss', teams, params: { total_rounds: total, round, history } });
      assert.ok(r.ok, `n=${n} round=${round}: ${JSON.stringify(r.details)}`);
      const seen = new Set();
      for (const p of r.value.pairings) {
        for (const x of [p.home, p.away]) { assert.ok(!seen.has(x)); seen.add(x); }
        const k = [p.home, p.away].sort().join('|');
        assert.ok(!met.has(k), `rematch ${k} n=${n} r=${round}`);
        met.add(k);
      }
      if (n % 2 === 1) { assert.ok(r.value.bye && !byes.has(r.value.bye)); byes.add(r.value.bye); seen.add(r.value.bye); } else assert.strictEqual(r.value.bye, null);
      assert.strictEqual(seen.size, n);
      history.push({ round, bye: r.value.bye, matches: r.value.pairings.map((p) => ({ home: p.home, away: p.away, result: ['home', 'away', 'draw'][Math.floor(rand() * 3)] })) });
    }
  }
});

test('FR-1.3-02 bye goes to the lowest-scoring team without a bye; falls back to the next candidate', () => {
  // t5 scored 0 and lost; with 5 teams the lowest scorer without a bye gets the bye.
  const history = [{ round: 1, bye: 't5', matches: [{ home: 't1', away: 't3', result: 'home' }, { home: 't2', away: 't4', result: 'home' }] }];
  const v = swiss.generate({ teams: T(5), round: 2, totalRounds: 3, history }).value;
  // scores: t1=1,t2=1,t5=1,t3=0,t4=0 → candidates (no bye yet) lowest first: t4 (largest index among 0s)
  assert.strictEqual(v.bye, 't4');
});

test('FR-1.3-02 NO_VALID_PAIRING when every rematch-free completion is impossible (edge case 2)', () => {
  // 4 teams where all pairs have already met after 3 rounds → round 4 impossible (n-1 = 3 rounds max)
  const hist = [
    { round: 1, bye: null, matches: [{ home: 't1', away: 't2', result: 'home' }, { home: 't3', away: 't4', result: 'home' }] },
    { round: 2, bye: null, matches: [{ home: 't1', away: 't3', result: 'home' }, { home: 't2', away: 't4', result: 'home' }] },
    { round: 3, bye: null, matches: [{ home: 't1', away: 't4', result: 'home' }, { home: 't2', away: 't3', result: 'home' }] },
  ];
  const r = swiss.generate({ teams: T(4), round: 4, totalRounds: 4, history: hist });
  assert.deepStrictEqual([r.ok, r.error.code, r.details], [false, 'NO_VALID_PAIRING', { round: 4 }]);
});

test('FR-1.3-02 request validation: history rounds, totals, unknown teams (BR-FIX-02/03)', () => {
  const call = (params, teams = T(5)) => fixtures.generate({ format: 'swiss', teams, params });
  assert.deepStrictEqual(call({ round: 2 }).details.fields, ['params.history']);
  assert.deepStrictEqual(call({ round: 1, history: [{ round: 1, matches: [] }] }).details.fields, ['params.history']);
  assert.deepStrictEqual(call({ total_rounds: 5 }).details.fields, ['params.total_rounds']);
  assert.deepStrictEqual(call({ total_rounds: 2, round: 3, history: [{ round: 1, matches: [] }, { round: 2, matches: [] }] }).details.fields, ['params.round']);
  assert.deepStrictEqual(call({ round: 2, history: [{ round: 1, bye: 'zz', matches: [{ home: 't1', away: 'q', result: 'home' }] }] }).details.fields.sort(),
    ['params.history[0].bye', 'params.history[0].matches[0].away']);
  assert.deepStrictEqual(call({ round: 2, history: [{ round: 1, matches: [{ home: 't1', away: 't2', result: 'won' }] }] }).details.fields, ['params.history[0].matches[0].result']);
  assert.ok(call({}).ok);
  assert.strictEqual(call({}).value.total_rounds, 3); // ceil(log2 5)
});

test('BR-FIX-01 team count limits per format', () => {
  const f = (format, n) => fixtures.generate({ format, teams: T(n), params: {} });
  assert.deepStrictEqual(f('round_robin', 41).details.fields, ['teams']);
  assert.ok(f('round_robin', 40).ok);
  assert.deepStrictEqual(f('swiss', 65).details.fields, ['teams']);
  assert.deepStrictEqual(f('double_elim', 2).details.fields, ['teams']);
  assert.ok(f('double_elim', 3).ok);
  assert.deepStrictEqual(f('single_elim', 129).details.fields, ['teams']);
  assert.deepStrictEqual(f('single_elim', 1).details.fields, ['teams']);
  assert.deepStrictEqual(fixtures.generate({ format: 'x', teams: ['a', 'a'] }).details.fields.sort(), ['format', 'teams']);
});

test('FR-1.3-01 round-robin request validation: withdrawals', () => {
  const call = (params) => fixtures.generate({ format: 'round_robin', teams: T(5), params });
  assert.deepStrictEqual(call({ withdrawals: [{ team_id: 'zz', after_round: 1 }] }).details.fields, ['params.withdrawals[0].team_id']);
  assert.deepStrictEqual(call({ withdrawals: [{ team_id: 't1', after_round: 6 }] }).details.fields, ['params.withdrawals[0].after_round']);
  assert.deepStrictEqual(call({ legs: 3 }).details.fields, ['params.legs']);
  assert.ok(call({ withdrawals: [{ team_id: 't1', after_round: 5 }] }).ok);
  assert.ok(fixtures.generate({ format: 'round_robin', teams: T(5), params: { legs: 2, withdrawals: [{ team_id: 't1', after_round: 10 }] } }).ok);
});
