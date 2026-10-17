'use strict';
// FR-1.2-02 / API-05: register a league and its fixtures as match streams (status upcoming, version 0 — OQ-07).
const { withTx } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { validateLeague } = require('../domain/leagues/leagueSchema');
const sportsRepo = require('../repos/sports');
const leaguesRepo = require('../repos/leagues');
const matchesRepo = require('../repos/matches');

async function registerLeague(input) {
  const r = validateLeague(input);
  if (!r.ok) throw validationError(r.details.fields);
  const v = r.value;
  return withTx(async (client) => {
    const sport = await sportsRepo.getSport(v.sport_id, client);
    if (!sport) throw new AppError(E.SPORT_NOT_FOUND);
    const seed = v.lots_seed !== undefined ? v.lots_seed : await leaguesRepo.lastResetSeed(client);
    const created = await leaguesRepo.insertLeague(client, {
      league_id: v.league_id, sport_id: v.sport_id, teams: v.teams, points: v.points,
      tie_break_order: v.tie_break_order || sport.config.tie_break_order,
      qualification_spots: v.qualification.spots, lots_seed: seed,
    });
    if (!created) throw new AppError(E.LEAGUE_EXISTS);
    const seen = new Set();
    for (const f of v.fixtures) {
      if (seen.has(f.match_id)) throw new AppError(E.MATCH_EXISTS);
      seen.add(f.match_id);
      const ok = await matchesRepo.insertMatch(client, {
        match_id: f.match_id, sport_id: v.sport_id, league_id: v.league_id, home_team_id: f.home, away_team_id: f.away,
      });
      if (!ok) throw new AppError(E.MATCH_EXISTS);
    }
    return { league_id: v.league_id, status: 'created', team_count: v.teams.length, fixture_count: v.fixtures.length };
  });
}

module.exports = { registerLeague };
