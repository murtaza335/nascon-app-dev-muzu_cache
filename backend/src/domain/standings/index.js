'use strict';
// Standings computed from scratch from match projections (FR-1.4-01, API-08). Pure.
// matches: [{home_team_id, away_team_id, view}] where view comes from scoring/projection.build().
const { aggregate } = require('./table');
const { rank } = require('./tiebreak');
const { qualificationStatus } = require('./qualification');
const { ballsCredited } = require('./nrr');

function toRecord(m, config) {
  const { view } = m;
  const innings = config.scoring_model === 'innings';
  return {
    home: m.home_team_id, away: m.away_team_id,
    hs: view.home.score, as: view.away.score,
    hBalls: innings ? ballsCredited(view.home, config.periods) : 0,
    aBalls: innings ? ballsCredited(view.away, config.periods) : 0,
    hFair: view.home.fair_play, aFair: view.away.fair_play,
    outcome: view.outcome,
  };
}

function compute({ league, config, matches }) {
  const teams = league.teams;
  const pointsCfg = league.points;
  const ctx = { pointsCfg, model: config.scoring_model, periods: config.periods };
  const isPlayed = (m) => m.view.status === 'completed' && m.view.outcome !== 'undecided';
  const records = matches.filter(isPlayed).map((m) => toRecord(m, config));
  const remaining = new Map(teams.map((t) => [t, 0]));
  for (const m of matches) {
    if (isPlayed(m)) continue;
    for (const t of [m.home_team_id, m.away_team_id]) if (remaining.has(t)) remaining.set(t, remaining.get(t) + 1);
  }

  const overall = aggregate(records, teams, ctx);
  const { order, resolvedBy } = rank({
    teams, records, overall, ctx, order: league.tie_break_order, lotsSeed: league.lots_seed, leagueId: league.league_id,
  });

  const table = order.map((team, i) => {
    const r = overall.get(team);
    return {
      rank: i + 1, team_id: team, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
      scored: r.scored, conceded: r.conceded, diff: r.diff, points: r.points, fair_play: r.fair_play,
      status: qualificationStatus(team, overall, remaining, pointsCfg.win, league.qualification_spots),
      resolved_by: resolvedBy.get(team) ?? null,
    };
  });

  const h2h = {};
  for (const a of teams) {
    h2h[a] = {};
    for (const b of teams) {
      if (a === b) continue;
      const cell = { played: 0, points: 0, scored: 0, conceded: 0 };
      for (const m of records) {
        const mine = m.home === a && m.away === b ? [m.hs, m.as, 'home_win', 'away_win'] : m.home === b && m.away === a ? [m.as, m.hs, 'away_win', 'home_win'] : null;
        if (!mine) continue;
        cell.played += 1; cell.scored += mine[0]; cell.conceded += mine[1];
        cell.points += m.outcome === mine[2] ? pointsCfg.win : m.outcome === mine[3] ? pointsCfg.loss : pointsCfg.draw;
      }
      h2h[a][b] = cell;
    }
  }
  return { table, h2h };
}

module.exports = { compute };
