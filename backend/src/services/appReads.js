'use strict';
// Cached read models for the mobile app (APP-10/11/13/16/30/50/51). Authorization happens BEFORE the cache is consulted,
// and cached values carry no per-user data, so every authorized caller can share an entry (ADR-004).
const { AppError, E } = require('../errors');
const cache = require('../cache');
const { must, page } = require('../http/guard');
const appRepo = require('../repos/app');
const leaguesRepo = require('../repos/leagues');
const eventsRepo = require('../repos/events');
const sportsRepo = require('../repos/sports');
const projection = require('../domain/scoring/projection');
const pricing = require('../domain/store/pricing');
const standingsService = require('./standings');
const { isoSeconds } = require('../lib/time');

const OVERRIDES = ['postponed', 'cancelled', 'abandoned'];
const effectiveStatus = (m, viewStatus) => (OVERRIDES.includes(m.status_cache) ? m.status_cache : viewStatus);
const tenantScope = (p) => (p.role === 'super_admin' ? null : p.tenant_id);

async function viewsFor(matches) {
  const events = await eventsRepo.listByMatches(matches.map((m) => m.match_id));
  const sports = new Map();
  for (const m of matches) if (!sports.has(m.sport_id)) sports.set(m.sport_id, (await sportsRepo.getSport(m.sport_id)).config);
  return matches.map((m) => projection.build({ match: m, config: sports.get(m.sport_id), events: events.get(m.match_id) || [] }));
}

// APP-10
async function listLeagues(principal, pg) {
  const scope = tenantScope(principal);
  const { value } = await cache.cached('leagues', { scope }, async () => (await appRepo.listLeagues(scope)).map((l) => ({
    league_id: l.league_id, name: l.name, sport_id: l.sport_id, tenant_id: l.tenant_id, season: null,
  })));
  return page(value, pg);
}

async function requireLeague(principal, leagueId, action = 'league.read') {
  const league = await leaguesRepo.getLeague(leagueId);
  if (!league) throw new AppError(E.LEAGUE_NOT_FOUND);
  must(principal, action, { id: league.league_id, tenant_id: league.tenant_id });
  return league;
}

// APP-11
async function leagueFixtures(principal, leagueId, status, pg) {
  await requireLeague(principal, leagueId);
  const { value } = await cache.cached(`league:${leagueId}`, { kind: 'fixtures' }, async () => {
    const matches = await appRepo.fixtures(leagueId);
    const views = await viewsFor(matches);
    return matches.map((m, i) => ({
      match_id: m.match_id, home_team_id: m.home_team_id, away_team_id: m.away_team_id, status: effectiveStatus(m, views[i].status),
      scheduled_at: m.scheduled_at, venue: m.venue_id ? { venue_id: m.venue_id } : null,
      score: { home: views[i].home.score, away: views[i].away.score }, version: m.version,
    }));
  });
  return page(status ? value.filter((f) => f.status === status) : value, pg);
}

// APP-16 (same computation as API-08)
async function leagueStandings(principal, leagueId) {
  await requireLeague(principal, leagueId);
  const { value } = await cache.cached(`league:${leagueId}`, { kind: 'standings' }, () => standingsService.getStandings(leagueId));
  return value;
}

async function requireMatch(principal, matchId, action = 'match.read') {
  const m = await appRepo.matchWithTenant(matchId);
  if (!m) throw new AppError(E.MATCH_NOT_FOUND);
  must(principal, action, { id: m.league_id || m.match_id, tenant_id: m.tenant_id });
  return m;
}

// APP-13
async function matchDetail(principal, matchId) {
  await requireMatch(principal, matchId);
  const { value } = await cache.cached(`match:${matchId}`, { kind: 'detail' }, async () => {
    const m = await appRepo.matchWithTenant(matchId);
    const [view] = await viewsFor([m]);
    const api = projection.toApi(view);
    let pinned = null;
    if (m.pinned_product_id) {
      const prod = await appRepo.getProduct(m.pinned_product_id);
      if (prod) pinned = { product_id: prod.product_id, name: prod.name, category: prod.category, image_url: prod.image_url };
    }
    return { ...api, status: effectiveStatus(m, api.status), pinned_product: pinned, venue: m.venue_id ? { venue_id: m.venue_id } : null, scheduled_at: m.scheduled_at };
  });
  return value;
}

// APP-30
async function clubProfile(principal, clubId) {
  const club = await appRepo.getClub(clubId);
  if (!club) throw new AppError(E.CLUB_NOT_FOUND);
  must(principal, 'club.read', { id: club.club_id, tenant_id: club.tenant_id });
  const { value } = await cache.cached('clubs', { clubId }, async () => {
    const roster = await appRepo.clubRoster(clubId);
    const squads = await appRepo.clubSquads(clubId);
    const stats = [];
    const seen = new Set();
    for (const { league_id: lid } of squads) {
      if (seen.has(lid)) continue;
      seen.add(lid);
      const st = await standingsService.getStandings(lid);
      const mine = squads.filter((s) => s.league_id === lid).map((s) => s.squad_id);
      const row = st.table.find((r) => r.team_id === clubId || mine.includes(r.team_id));
      if (row) stats.push({ season: lid, played: row.played, won: row.won, drawn: row.drawn, lost: row.lost });
    }
    return {
      club_id: club.club_id, tenant_id: club.tenant_id, name: club.name, home_venue: club.home_venue, socials: club.socials, staff: club.staff,
      stats_by_season: stats,
      roster: roster.map((r) => ({ player_id: r.player_id, name: r.name, position: r.position, squad_id: r.squad_id, role: r.role, on_loan: r.on_loan })),
    };
  });
  return value;
}

function productView(rows, schedules, nowIso) {
  const byProduct = new Map();
  for (const r of rows) {
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, { product_id: r.product_id, name: r.name, category: r.category, image_url: r.image_url, club_id: r.club_id, variants: [] });
    if (r.variant_id) {
      const own = schedules.filter((s) => s.variant_id === r.variant_id);
      byProduct.get(r.product_id).variants.push({
        variant_id: r.variant_id, size: r.size, color: r.color, price_minor: pricing.effectivePrice(r.price_minor, own, nowIso), stock: r.stock,
      });
    }
  }
  return [...byProduct.values()];
}

// APP-50
async function listProducts(principal, clubId, pg) {
  must(principal, 'store.read', { tenant_id: principal.role === 'super_admin' ? principal.tenant_id : principal.tenant_id });
  const scope = tenantScope(principal);
  const { value } = await cache.cached('catalogue', { scope, clubId: clubId || null }, async () => {
    const rows = await appRepo.productsOf(scope, clubId);
    const schedules = await appRepo.schedulesFor(rows.map((r) => r.variant_id).filter(Boolean));
    return productView(rows, schedules, isoSeconds(new Date()));
  });
  return page(value, pg);
}

// APP-51
async function getProduct(principal, productId) {
  const prod = await appRepo.getProduct(productId);
  if (!prod) throw new AppError(E.PRODUCT_NOT_FOUND);
  must(principal, 'store.read', { tenant_id: prod.tenant_id });
  const { value } = await cache.cached('catalogue', { productId }, async () => {
    const rows = await appRepo.productsOf(prod.tenant_id, null);
    const mine = rows.filter((r) => r.product_id === productId);
    const schedules = await appRepo.schedulesFor(mine.map((r) => r.variant_id).filter(Boolean));
    return productView(mine, schedules, isoSeconds(new Date()))[0];
  });
  return value;
}

module.exports = { listLeagues, leagueFixtures, leagueStandings, matchDetail, clubProfile, listProducts, getProduct, requireLeague, requireMatch, effectiveStatus };

async function context(principal, requestedTenant) {
  const scope = requestedTenant === undefined ? tenantScope(principal) : requestedTenant;
  must(principal, 'club.read', { tenant_id: scope });
  if (scope !== null && (typeof scope !== 'string' || !require('../lib/validate').ID_RE.test(scope))) {
    throw require('../errors').validationError(['tenant_id']);
  }
  if (scope !== null && !(await appRepo.getTenant(scope))) throw new AppError(E.TENANT_NOT_FOUND);
  return appRepo.context(scope);
}
module.exports.context = context;
