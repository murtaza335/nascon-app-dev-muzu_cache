'use strict';
// After-commit side effects shared by /audit/v1 and /api/v1 writes (AGENTS §8: same services, no forked logic).
// Cache invalidation happens after commit and before the response is sent; Redis outages only delay it (see cache.js).
const cache = require('../cache');

const matchChanged = async (matchId, leagueId) => {
  await cache.invalidate(`match:${matchId}`);
  if (leagueId) await cache.invalidate(`league:${leagueId}`);
};
const leaguesChanged = () => cache.invalidate('leagues');
const clubsChanged = () => cache.invalidate('clubs');
const catalogueChanged = () => cache.invalidate('catalogue');
const everythingChanged = () => cache.invalidate('epoch');

module.exports = { matchChanged, leaguesChanged, clubsChanged, catalogueChanged, everythingChanged };
