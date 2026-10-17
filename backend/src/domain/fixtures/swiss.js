'use strict';
// Swiss pairing for one round (FR-1.3-02, spec §5.7-B). Pure.
const { E } = require('../../errors');
const { bestPairing } = require('./pairing');

function standingsFrom(teams, history) {
  const score = new Map(teams.map((t) => [t, 0]));
  const opponents = new Map(teams.map((t) => [t, []]));
  const hadBye = new Set();
  for (const h of history) {
    for (const m of h.matches) {
      if (m.result === 'home') score.set(m.home, score.get(m.home) + 1);
      else if (m.result === 'away') score.set(m.away, score.get(m.away) + 1);
      else { score.set(m.home, score.get(m.home) + 0.5); score.set(m.away, score.get(m.away) + 0.5); }
      opponents.get(m.home).push(m.away);
      opponents.get(m.away).push(m.home);
    }
    if (h.bye) { score.set(h.bye, score.get(h.bye) + 1); hadBye.add(h.bye); }
  }
  const buchholz = new Map(teams.map((t) => [t, opponents.get(t).reduce((s, o) => s + score.get(o), 0)]));
  const seed = new Map(teams.map((t, i) => [t, i]));
  const order = [...teams].sort((a, b) => score.get(b) - score.get(a) || buchholz.get(b) - buchholz.get(a) || seed.get(a) - seed.get(b));
  return { score, buchholz, opponents, hadBye, seed, order };
}

function generate({ teams, round = 1, totalRounds, history = [] }) {
  const n = teams.length;
  const st = standingsFrom(teams, history);
  const standings = st.order.map((t, i) => ({ rank: i + 1, team_id: t, score: st.score.get(t), buchholz: st.buchholz.get(t) }));
  const out = (pairings, bye) => ({ ok: true, value: { format: 'swiss', round, total_rounds: totalRounds, pairings, bye, standings } });
  const mk = (list) => list.map(([home, away], i) => ({ match_id: `SW-R${round}-M${i + 1}`, home, away }));

  if (round === 1) {
    const m = Math.floor(n / 2);
    const pairs = [];
    for (let i = 0; i < m; i++) pairs.push([teams[i], teams[i + m]]);
    return out(mk(pairs), n % 2 === 1 ? teams[n - 1] : null);
  }

  const met = (a, b) => st.opponents.get(a).includes(b);
  // Bye candidates: lowest score first, ties → lowest seed (largest index); only teams without a previous bye.
  let candidates = [null];
  if (n % 2 === 1) {
    candidates = [...teams].filter((t) => !st.hadBye.has(t))
      .sort((a, b) => st.score.get(a) - st.score.get(b) || st.seed.get(b) - st.seed.get(a));
  }
  for (const bye of candidates) {
    const field = st.order.filter((t) => t !== bye);
    const items = field.map((t) => ({ score: st.score.get(t) }));
    const sol = bestPairing(items, (i, j) => met(field[i], field[j]));
    if (!sol) continue;
    const pairs = sol.pairs
      .map(([i, j]) => (i < j ? [field[i], field[j]] : [field[j], field[i]]))
      .sort((a, b) => st.order.indexOf(a[0]) - st.order.indexOf(b[0]));
    return out(mk(pairs), bye);
  }
  return { ok: false, error: E.NO_VALID_PAIRING, details: { round } };
}

module.exports = { generate };
