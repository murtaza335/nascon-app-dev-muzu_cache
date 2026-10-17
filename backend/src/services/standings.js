'use strict';
// API-08: recomputed from the event logs on every call (never cached).
const { AppError, E } = require('../errors');
const leaguesRepo = require('../repos/leagues');
const eventsRepo = require('../repos/events');
const sportsRepo = require('../repos/sports');
const projection = require('../domain/scoring/projection');
const standings = require('../domain/standings');

const FALLBACK_CONFIG = { scoring_model: 'event', draw_allowed: true, periods: {} };

async function getStandings(leagueId) {
  const league = await leaguesRepo.getLeague(leagueId);
  if (!league) throw new AppError(E.LEAGUE_NOT_FOUND);
  const sport = league.sport_id ? await sportsRepo.getSport(league.sport_id) : null;
  const config = sport ? sport.config : FALLBACK_CONFIG;
  const matches = await leaguesRepo.matchesOfLeague(leagueId);
  const events = await eventsRepo.listByMatches(matches.map((m) => m.match_id));
  const views = matches.map((m) => ({
    home_team_id: m.home_team_id, away_team_id: m.away_team_id,
    view: projection.build({ match: m, config, events: events.get(m.match_id) || [] }),
  }));
  const { table, h2h } = standings.compute({
    league: {
      league_id: league.league_id, teams: league.teams, points: league.points, tie_break_order: league.tie_break_order,
      qualification_spots: league.qualification_spots ?? 1, lots_seed: league.lots_seed,
    },
    config, matches: views,
  });
  return { league_id: league.league_id, sport_id: league.sport_id, qualification_spots: league.qualification_spots, table, h2h };
}

module.exports = { getStandings };
