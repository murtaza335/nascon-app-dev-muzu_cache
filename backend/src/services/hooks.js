'use strict';
// After-commit side effects shared by /audit/v1 and /api/v1 writes (AGENTS §8: same services, no forked logic).
// Cache invalidation happens after commit and before the response is sent; Redis outages only delay it (see cache.js).
// Realtime frames (RT-01) are published here too, through a publisher registered at boot (no-op until then).
const cache = require('../cache');
const day2Cache = require('./day2Cache');

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
const everythingChanged = () => { seenStatus.clear(); return cache.invalidate('epoch'); };

const STATUS_AFTER = { match_start: ['upcoming', 'in_progress'], match_end: ['in_progress', 'completed'] };

// An event was appended: invalidate caches, then broadcast it (and the status/standings consequences).
const seenStatus = new Map(); // match_id → last published status (for match.status_changed `from`)

// Part II frames (RT-D2-01), published before the write response so NFR-1 latency is minimal.
async function publishLive(matchId, event) {
  const { getScore } = require('./score');
  const s = await getScore(matchId);
  const topic = `ws:match:${matchId}`;
  const text = `${s.home.score} - ${s.away.score}`;
  const FROM_GUESS = { match_start: 'upcoming', match_end: 'in_progress', match_postponed: 'in_progress', match_cancelled: 'in_progress', match_abandoned: 'in_progress' };
  const prev = seenStatus.get(matchId) ?? FROM_GUESS[event.type] ?? s.status;
  seenStatus.set(matchId, s.status);
  const emitted_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (prev !== s.status) publish(topic, { type: 'match.status_changed', match_id: matchId, from: prev, to: s.status });
  publish(topic, {
    type: 'score.updated', match_id: matchId, home_score: s.home.score, away_score: s.away.score, score_text: text,
    status: s.status, version: s.version, event_id: event.event_id, emitted_at,
  });
}

async function eventAppended({ matchId, leagueId, version, event }) {
  day2Cache.matchStatus.delete(matchId); // QR target mutation (EC-2): next read recomputes from the log
  await matchChanged(matchId, leagueId);
  publish(`match:${matchId}`, { type: 'match.event_appended', match_id: matchId, version, event });
  await publishLive(matchId, event).catch((err) => console.error('[realtime] live publish failed:', err.message));
  const change = STATUS_AFTER[event.type];
  if (change) publish(`match:${matchId}`, { type: 'match.status_changed', match_id: matchId, from: change[0], to: change[1] });
  if (leagueId) publish(`league:${leagueId}`, { type: 'standings.changed', league_id: leagueId });
}

// Co-stream state changed (create / handoff / terminate): QR status and realtime subscribers.
function costreamChanged(sessionId, snapshot) {
  day2Cache.matchStatus.delete(sessionId);
  publish(`costream:${sessionId}`, { type: 'costream.state', session: snapshot });
}

const pinChanged = (matchId, product) => {
  publish(`match:${matchId}`, { type: 'match.pinned_product_changed', match_id: matchId, product });
  publish(`ws:match:${matchId}`, { type: 'overlay.updated', match_id: matchId, pinned_product: product || null, badges: { home: null, away: null } });
};
const inventoryChanged = (tenantId, rows) => {
  for (const r of rows) publish(`store:${tenantId}`, { type: 'inventory.changed', variant_id: r.variant_id, stock: r.stock });
};

module.exports = {
  setPublisher, publish, matchChanged, leaguesChanged, clubsChanged, catalogueChanged, everythingChanged, costreamChanged, eventAppended, pinChanged, inventoryChanged,
};
