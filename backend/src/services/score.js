'use strict';
// API-07: score and timeline derived from the event log on every read (never cached).
const { AppError, E } = require('../errors');
const matchesRepo = require('../repos/matches');
const eventsRepo = require('../repos/events');
const sportsRepo = require('../repos/sports');
const projection = require('../domain/scoring/projection');

async function getScore(matchId) {
  const match = await matchesRepo.getMatch(matchId);
  if (!match) throw new AppError(E.MATCH_NOT_FOUND);
  const [sport, events] = await Promise.all([sportsRepo.getSport(match.sport_id), eventsRepo.listByMatch(matchId)]);
  return projection.toApi(projection.build({ match, config: sport.config, events }));
}

module.exports = { getScore };
