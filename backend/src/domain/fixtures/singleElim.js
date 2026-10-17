'use strict';
// Single elimination (FR-1.3-03, spec §5.7-C, exact). Pure.
const { log2, newMatch, firstRound, place, applyResults, fail } = require('./bracket');

function generate({ teams, thirdPlace = false, results = [] }) {
  const { size, matches: r1 } = firstRound(teams, 'R', 'main');
  const k = log2(size);
  if (thirdPlace && k < 2) return fail(['params.third_place_match']);
  const seedOf = new Map(teams.map((t, i) => [t, i + 1]));
  const rounds = [{ round: 1, matches: r1 }];
  for (let r = 2; r <= k; r++) {
    const ms = [];
    for (let i = 1; i <= size / 2 ** r; i++) ms.push(newMatch(`R${r}M${i}`, 'main', r, i));
    rounds.push({ round: r, matches: ms });
  }
  const byId = new Map(rounds.flatMap((x) => x.matches).map((m) => [m.match_id, m]));
  for (const x of rounds) {
    for (const m of x.matches) {
      if (m.round < k) m.winner_to = { match_id: `R${m.round + 1}M${Math.ceil(m.index / 2)}`, slot: m.index % 2 === 1 ? 'home' : 'away' };
    }
  }
  if (thirdPlace) {
    const tp = newMatch('TP', 'third_place', k, 1);
    rounds[k - 1].matches.push(tp);
    byId.set('TP', tp);
    byId.get(`R${k - 1}M1`).loser_to = { match_id: 'TP', slot: 'home' };
    byId.get(`R${k - 1}M2`).loser_to = { match_id: 'TP', slot: 'away' };
  }

  const advance = (m) => {
    if (m.winner_to) place(byId, m.winner_to, m.winner, seedOf);
    if (m.loser_to && m.loser) place(byId, m.loser_to, m.loser, seedOf);
  };
  // Byes: the present team moves on immediately.
  for (const m of r1) if (m.bye) { m.winner = m.home; advance(m); }

  const bad = applyResults(results, byId, advance);
  if (bad) return fail(bad);
  return { ok: true, value: { format: 'single_elim', bracket_size: size, rounds } };
}

module.exports = { generate };
