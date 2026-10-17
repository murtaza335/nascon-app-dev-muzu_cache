'use strict';
// Aggregates played matches into per-team rows. Used for the overall table and for h2h mini-leagues.
// Match record: {home, away, hs, as, hBalls, aBalls, hFair, aFair, outcome}  (played matches only).
const { nrr } = require('./nrr');

const blank = () => ({ played: 0, won: 0, drawn: 0, lost: 0, scored: 0, conceded: 0, fair_play: 0, ballsFor: 0, ballsAgainst: 0, points: 0 });

function aggregate(records, teams, ctx) {
  const rows = new Map(teams.map((t) => [t, blank()]));
  const { pointsCfg, model, periods } = ctx;
  for (const m of records) {
    const h = rows.get(m.home);
    const a = rows.get(m.away);
    if (!h || !a) continue;
    h.played += 1; a.played += 1;
    h.scored += m.hs; h.conceded += m.as;
    a.scored += m.as; a.conceded += m.hs;
    h.fair_play += m.hFair; a.fair_play += m.aFair;
    h.ballsFor += m.hBalls; h.ballsAgainst += m.aBalls;
    a.ballsFor += m.aBalls; a.ballsAgainst += m.hBalls;
    if (m.outcome === 'home_win') { h.won += 1; a.lost += 1; }
    else if (m.outcome === 'away_win') { a.won += 1; h.lost += 1; }
    else { h.drawn += 1; a.drawn += 1; }
  }
  for (const r of rows.values()) {
    r.points = r.won * pointsCfg.win + r.drawn * pointsCfg.draw + r.lost * pointsCfg.loss;
    r.diff = model === 'innings'
      ? nrr({ runsFor: r.scored, ballsFor: r.ballsFor, runsAgainst: r.conceded, ballsAgainst: r.ballsAgainst }, periods.balls_per_over)
      : r.scored - r.conceded;
  }
  return rows;
}

module.exports = { aggregate };
