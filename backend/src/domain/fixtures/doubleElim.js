'use strict';
// Double elimination (FR-1.3-04, spec §5.7-D). Pure.
// Winners WR{r}M{i}; losers LR{r}M{i} (WR1 losers meet in LR1; WRr losers drop into LR(2r-2)); GF1, optional GF2.
const { log2, newMatch, firstRound, place, applyResults, fail } = require('./bracket');

function generate({ teams, bracketReset = false, results = [] }) {
  const { size, matches: wr1 } = firstRound(teams, 'WR', 'winners');
  const k = log2(size);
  const seedOf = new Map(teams.map((t, i) => [t, i + 1]));

  const winners = [{ round: 1, matches: wr1 }];
  for (let r = 2; r <= k; r++) {
    const ms = [];
    for (let i = 1; i <= size / 2 ** r; i++) ms.push(newMatch(`WR${r}M${i}`, 'winners', r, i));
    winners.push({ round: r, matches: ms });
  }
  const losers = [];
  for (let r = 1; r <= 2 * (k - 1); r++) {
    const j = Math.ceil(r / 2);
    const ms = [];
    for (let i = 1; i <= size / 2 ** (j + 1); i++) ms.push(newMatch(`LR${r}M${i}`, 'losers', r, i));
    losers.push({ round: r, matches: ms });
  }
  const gf1 = newMatch('GF1', 'grand_final', 1, 1);
  const gf2 = newMatch('GF2', 'grand_final', 2, 1);
  Object.assign(gf1, { conditional: false, required: true });
  Object.assign(gf2, { conditional: true, required: null });
  const grandFinal = bracketReset ? [gf1, gf2] : [gf1];

  const all = [...winners.flatMap((x) => x.matches), ...losers.flatMap((x) => x.matches), ...grandFinal];
  for (const m of all) { if (m.conditional === undefined) Object.assign(m, { conditional: false, required: true }); }
  const byId = new Map(all.map((m) => [m.match_id, m]));
  const to = (id, slot) => ({ match_id: id, slot });

  // Routing.
  for (const m of all.filter((x) => x.bracket === 'winners')) {
    if (m.round < k) m.winner_to = to(`WR${m.round + 1}M${Math.ceil(m.index / 2)}`, m.index % 2 === 1 ? 'home' : 'away');
    else m.winner_to = to('GF1', 'home');
    m.loser_to = m.round === 1
      ? to(`LR1M${Math.ceil(m.index / 2)}`, m.index % 2 === 1 ? 'home' : 'away')
      : to(`LR${2 * m.round - 2}M${m.index}`, 'away');
  }
  const lastLosers = 2 * (k - 1);
  for (const m of all.filter((x) => x.bracket === 'losers')) {
    if (m.round === lastLosers) m.winner_to = to('GF1', 'away');
    else if (m.round % 2 === 1) m.winner_to = to(`LR${m.round + 1}M${m.index}`, 'home'); // odd → even round: survivor keeps home
    else m.winner_to = to(`LR${m.round + 1}M${Math.ceil(m.index / 2)}`, m.index % 2 === 1 ? 'home' : 'away');
  }
  if (bracketReset) { gf1.winner_to = to('GF2', 'home'); gf1.loser_to = to('GF2', 'away'); }

  // A losers match fed by a WR1 bye has a dead slot: it resolves as soon as its other team is known (BR-FIX-06).
  for (const m of wr1) if (m.bye) byId.get(m.loser_to.match_id).bye = true;

  const advance = (m) => {
    if (m.winner_to) place(byId, m.winner_to, m.winner, seedOf);
    if (m.loser_to && m.loser) place(byId, m.loser_to, m.loser, seedOf);
    settleLosersByes();
    if (m.match_id === 'GF1') settleGf2(m);
  };
  function settleLosersByes() {
    for (const lm of losers.flatMap((x) => x.matches)) {
      if (!lm.bye || lm.winner) continue;
      const present = lm.home || lm.away;
      if (present && !(lm.home && lm.away)) { lm.winner = present; if (lm.winner_to) place(byId, lm.winner_to, present, seedOf); settleLosersByes(); }
    }
  }
  function settleGf2(m) {
    if (!bracketReset) return;
    gf2.required = m.winner === gf1.away; // the losers-bracket champion won GF1
    if (!gf2.required) { gf2.home = null; gf2.away = null; gf2.home_seed = null; gf2.away_seed = null; }
  }

  for (const m of wr1) if (m.bye) { m.winner = m.home; advance(m); }
  settleLosersByes();

  // GF2 has no teams unless it is required, so a result on it waits and is reported as invalid if never unlocked.
  const bad = applyResults(results, byId, advance);
  if (bad) return fail(bad);
  return { ok: true, value: { format: 'double_elim', bracket_size: size, bracket_reset: bracketReset, winners, losers, grand_final: grandFinal } };
}

module.exports = { generate };
