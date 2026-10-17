'use strict';
// After-commit side effects shared by /audit/v1 and /api/v1 writes (AGENTS §8: same services, no forked logic).
// Cache invalidation happens after commit and before the response is sent; Redis outages only delay it (see cache.js).
// Realtime frames (RT-01) are published here too, through a publisher registered at boot (no-op until then).
const cache = require('../cache');

let publisher = () => {};
const setPublisher = (fn) => { publisher = fn; };
const publish = (topic, message) => { try { publisher(topic, message); } catch (err) { console.error('[realtime] publish failed:', err.message); } };

const matchChanged = async (matchId, leagueId) => {
  await cache.invalidate(`match:${matchId}`);
  if (leagueId) await cache.invalidate(`league:${leagueId}`);
};
const leaguesChanged = () => cache.invalidate('leagues');
const clubsChanged = () => cache.invalidate('clubs');
const catalogueChanged = () => cache.invalidate('catalogue');
const everythingChanged = () => cache.invalidate('epoch');

const STATUS_AFTER = { match_start: ['upcoming', 'in_progress'], match_end: ['in_progress', 'completed'] };

// An event was appended: invalidate caches, then broadcast it (and the status/standings consequences).
async function eventAppended({ matchId, leagueId, version, event }) {
  await matchChanged(matchId, leagueId);
  publish(`match:${matchId}`, { type: 'match.event_appended', match_id: matchId, version, event });
  const change = STATUS_AFTER[event.type];
  if (change) publish(`match:${matchId}`, { type: 'match.status_changed', match_id: matchId, from: change[0], to: change[1] });
  if (leagueId) publish(`league:${leagueId}`, { type: 'standings.changed', league_id: leagueId });
}

const pinChanged = (matchId, product) => publish(`match:${matchId}`, { type: 'match.pinned_product_changed', match_id: matchId, product });
const inventoryChanged = (tenantId, rows) => {
  for (const r of rows) publish(`store:${tenantId}`, { type: 'inventory.changed', variant_id: r.variant_id, stock: r.stock });
};

module.exports = {
  setPublisher, publish, matchChanged, leaguesChanged, clubsChanged, catalogueChanged, everythingChanged, eventAppended, pinChanged, inventoryChanged,
};
