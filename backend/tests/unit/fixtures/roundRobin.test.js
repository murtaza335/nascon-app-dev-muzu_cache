'use strict';
const test = require('node:test');
const assert = require('node:assert');
const rr = require('../../../src/domain/fixtures/roundRobin');

const T = (n) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

test('FR-1.3-01 properties hold for n = 2..40, legs 1 and 2', () => {
  for (let n = 2; n <= 40; n++) {
    for (const legs of [1, 2]) {
      const teams = T(n);
      const r = rr.generate({ teams, legs });
      const perLeg = n % 2 === 0 ? n - 1 : n;
      assert.strictEqual(r.round_count, perLeg * legs, `rounds n=${n}`);
      assert.deepStrictEqual(r.rounds.map((x) => x.round), Array.from({ length: perLeg * legs }, (_, i) => i + 1));
      const pairCount = new Map();
      const ordered = new Set();
      const byes = new Map();
      for (const rd of r.rounds) {
        assert.strictEqual(rd.matches.length, Math.floor(n / 2));
        assert.strictEqual(rd.byes.length, n % 2);
        const seen = new Set(rd.byes);
        rd.matches.forEach((m, i) => {
          assert.strictEqual(m.match_id, `RR-L${m.leg}-R${rd.round}-M${i + 1}`);
          for (const x of [m.home, m.away]) { assert.ok(!seen.has(x), `team twice in round n=${n}`); seen.add(x); }
          const k = [m.home, m.away].sort().join('|');
          pairCount.set(k, (pairCount.get(k) || 0) + 1);
          ordered.add(`${m.home}>${m.away}`);
        });
        assert.strictEqual(seen.size, n);
        for (const b of rd.byes) byes.set(b, (byes.get(b) || 0) + 1);
      }
      assert.strictEqual(pairCount.size, (n * (n - 1)) / 2);
      for (const c of pairCount.values()) assert.strictEqual(c, legs);
      if (legs === 2) assert.strictEqual(ordered.size, n * (n - 1));
      if (n % 2 === 1) for (const t of teams) assert.strictEqual(byes.get(t), legs, `bye per leg n=${n}`);
      for (let leg = 1; leg <= legs; leg++) {
        const h = new Map(); const a = new Map();
        for (const m of r.rounds.flatMap((x) => x.matches).filter((x) => x.leg === leg)) {
          h.set(m.home, (h.get(m.home) || 0) + 1); a.set(m.away, (a.get(m.away) || 0) + 1);
        }
        for (const t of teams) assert.ok(Math.abs((h.get(t) || 0) - (a.get(t) || 0)) <= 1, `balance n=${n} leg=${leg} ${t}`);
      }
      assert.deepStrictEqual(r.summary, { total: r.rounds.reduce((s, x) => s + x.matches.length, 0), scheduled: r.summary.total, forfeit: 0, voided: 0 });
    }
  }
});

test('FR-1.3-01 spec example: 5 teams round 1 and summary with forfeit_remaining', () => {
  const r = rr.generate({ teams: T(5), legs: 1, withdrawals: [{ team_id: 't3', after_round: 2 }] });
  assert.deepStrictEqual(r.rounds[0].matches.map((m) => [m.home, m.away]), [['t2', 't5'], ['t3', 't4']]);
  assert.deepStrictEqual(r.rounds[0].byes, ['t1']);
  assert.deepStrictEqual(r.summary, { total: 10, scheduled: 8, forfeit: 2, voided: 0 });
  for (const rd of r.rounds) for (const m of rd.matches) {
    const involves = m.home === 't3' || m.away === 't3';
    if (involves && rd.round > 2) assert.deepStrictEqual([m.status, m.awarded_to], ['forfeit', m.home === 't3' ? m.away : m.home]);
    else assert.deepStrictEqual([m.status, m.awarded_to], ['scheduled', null]);
  }
});

test('FR-1.3-01 void_all voids every fixture of a withdrawn team, in any round', () => {
  const r = rr.generate({ teams: T(4), withdrawals: [{ team_id: 't2', after_round: 3 }], policy: 'void_all' });
  const all = r.rounds.flatMap((x) => x.matches);
  assert.ok(all.filter((m) => m.home === 't2' || m.away === 't2').every((m) => m.status === 'voided' && m.awarded_to === null));
  assert.deepStrictEqual(r.summary, { total: 6, scheduled: 3, forfeit: 0, voided: 3 });
});

test('FR-1.3-01 after_round 0 = never plays; both teams gone → voided; earlier fixtures stay', () => {
  const r = rr.generate({ teams: T(4), withdrawals: [{ team_id: 't1', after_round: 0 }, { team_id: 't2', after_round: 1 }] });
  const all = r.rounds.flatMap((x) => x.matches);
  const m12 = all.find((m) => [m.home, m.away].sort().join() === 't1,t2');
  assert.strictEqual(m12.status, 'voided');
  const t1 = all.filter((m) => (m.home === 't1' || m.away === 't1') && m.status === 'forfeit');
  assert.ok(t1.length >= 2);
  const t2r1 = all.find((m) => m.match_id.includes('-R1-') && (m.home === 't2' || m.away === 't2'));
  assert.ok(['scheduled', 'forfeit', 'voided'].includes(t2r1.status));
});

test('FR-1.3-01 leg 2 mirrors leg 1 with reversed home/away and continues round numbers', () => {
  const r = rr.generate({ teams: T(4), legs: 2 });
  assert.strictEqual(r.rounds[3].round, 4);
  assert.deepStrictEqual([r.rounds[3].matches[0].home, r.rounds[3].matches[0].away], [r.rounds[0].matches[0].away, r.rounds[0].matches[0].home]);
  assert.strictEqual(r.rounds[3].matches[0].match_id, 'RR-L2-R4-M1');
});
