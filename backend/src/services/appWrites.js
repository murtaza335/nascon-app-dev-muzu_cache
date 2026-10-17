'use strict';
// Authorized write paths for the mobile app. Each one authorizes, then calls the SAME service as /audit/v1.
// Order (REQUIREMENTS §2): 401 (middleware) → 404 → 403 → 400 → 409.
const crypto = require('node:crypto');
const { withTx } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { must } = require('../http/guard');
const { authorize } = require('../domain/rbac/policy');
const { check, t } = require('../lib/validate');
const appRepo = require('../repos/app');
const leaguesRepo = require('../repos/leagues');
const rosterRepo = require('../repos/roster');
const matchesRepo = require('../repos/matches');
const eventsService = require('./events');
const rosterService = require('./roster');
const storeService = require('./store');
const appReads = require('./appReads');
const hooks = require('./hooks');

const isObj = (b) => b !== null && typeof b === 'object' && !Array.isArray(b);

// APP-14
async function pinProduct(principal, matchId, body) {
  const m = await appReads.requireMatch(principal, matchId, 'match.pin');
  if (!isObj(body) || !(body.product_id === null || typeof body.product_id === 'string')) throw validationError(['product_id']);
  if (body.product_id !== null) {
    const prod = await appRepo.getProduct(body.product_id);
    if (!prod) throw new AppError(E.PRODUCT_NOT_FOUND);
    if (prod.tenant_id !== m.tenant_id && principal.role !== 'super_admin') throw new AppError(E.FORBIDDEN);
  }
  await appRepo.setPinned(matchId, body.product_id);
  await hooks.matchChanged(matchId, m.league_id);
  let product = null;
  if (body.product_id !== null) {
    const prod = await appRepo.getProduct(body.product_id);
    product = { product_id: prod.product_id, name: prod.name, category: prod.category, image_url: prod.image_url };
  }
  hooks.pinChanged(matchId, product);
  return { match_id: matchId, pinned_product_id: body.product_id };
}

// APP-15: the body is the API-06 body; match_id must equal the path.
async function appendMatchEvent(principal, matchId, body, rawBody) {
  await appReads.requireMatch(principal, matchId, 'league.manage');
  if (!isObj(body) || body.match_id !== matchId) throw validationError(['match_id']);
  return eventsService.appendEvent(body, rawBody);
}

// APP-31
async function addPlayer(principal, clubId, body) {
  const club = await appRepo.getClub(clubId);
  if (!club) throw new AppError(E.CLUB_NOT_FOUND);
  must(principal, 'club.roster', { id: club.club_id, tenant_id: club.tenant_id });
  const r = check({
    player_id: t.id(), name: t.string({ required: true, min: 1, max: 200 }), position: t.string({ required: true, min: 1, max: 64 }),
    league_id: t.id({ required: true }), squad_id: t.id({ required: true }), role: t.enum(['captain', 'vice_captain', 'starter', 'substitute'], { required: true }),
  }, body);
  if (!r.ok) throw validationError(r.fields);
  const v = r.value;
  const league = await leaguesRepo.getLeague(v.league_id);
  if (!league) throw new AppError(E.LEAGUE_NOT_FOUND);
  const squad = await appRepo.squadWithClub(v.league_id, v.squad_id);
  if (!squad || squad.club_id !== clubId) throw new AppError(E.SQUAD_NOT_FOUND);
  const playerId = v.player_id || `player-${crypto.randomUUID().slice(0, 8)}`;
  const out = await withTx(async (client) => {
    await rosterRepo.lockLeague(client, v.league_id);
    const regs = await rosterRepo.listRegistrations(client, v.league_id);
    if (league.max_squad_size != null && regs.filter((x) => x.squad_id === v.squad_id).length + 1 > league.max_squad_size) throw new AppError(E.SQUAD_FULL);
    if (await rosterRepo.getPlayer(client, playerId)) throw new AppError(E.VALIDATION_ERROR, { fields: ['player_id'] }, 'Player id already exists');
    await client.query('INSERT INTO players (player_id, name, position, club_id) VALUES ($1,$2,$3,$4)', [playerId, v.name, v.position, clubId]);
    const reg = { squad_id: v.squad_id, parent_squad_id: null, registration_type: 'initial', start_date: new Date().toISOString().slice(0, 10), loan_end_date: null, role: v.role };
    await rosterRepo.saveRegistration(client, v.league_id, playerId, reg);
    return {
      player: { player_id: playerId, name: v.name, position: v.position, club_id: clubId },
      registration: { player_id: playerId, league_id: v.league_id, squad_id: v.squad_id, parent_squad_id: null, registration_type: 'initial', start_date: reg.start_date, loan_end_date: null, role: v.role },
    };
  });
  await hooks.clubsChanged();
  return out;
}

// Club ids on both ends of a transfer-like request (404 for unknown league/squad).
async function transferClubs(body) {
  const b = isObj(body) ? body : {};
  const leagueId = typeof b.league_id === 'string' ? b.league_id : null;
  const league = leagueId ? await leaguesRepo.getLeague(leagueId) : null;
  if (!league) throw new AppError(E.LEAGUE_NOT_FOUND);
  const clubs = [];
  for (const id of [b.from_squad_id, b.to_squad_id]) {
    if (typeof id !== 'string') continue;
    const sq = await appRepo.squadWithClub(league.league_id, id);
    if (!sq) throw new AppError(E.SQUAD_NOT_FOUND);
    clubs.push({ club_id: sq.club_id, tenant_id: sq.club_tenant });
  }
  return clubs;
}

// APP-32: a manager may act when either end of the move is their own club.
async function transfer(principal, body) {
  const clubs = await transferClubs(body);
  const allowed = clubs.some((c) => authorize(principal, 'club.roster', { id: c.club_id, tenant_id: c.tenant_id }));
  if (!allowed) throw new AppError(E.FORBIDDEN);
  return rosterService.transfer({ ...body, requested_by: principal.user_id });
}

// APP-34
async function patchPlayer(principal, playerId, body) {
  const p = await appRepo.getPlayerWithTenant(playerId);
  if (!p) throw new AppError(E.PLAYER_NOT_FOUND);
  must(principal, 'player.update', { id: p.player_id, club_id: p.club_id, tenant_id: p.tenant_id });
  const r = check({ name: t.string({ min: 1, max: 200 }), position: t.string({ min: 1, max: 64 }) }, body);
  if (!r.ok) throw validationError(r.fields);
  const updated = await appRepo.updatePlayer(playerId, r.value);
  await hooks.clubsChanged();
  return updated;
}

// APP-33: any role in the same tenant may read a player's history.
async function playerHistory(principal, playerId, asOf) {
  const p = await appRepo.getPlayerWithTenant(playerId);
  if (!p) throw new AppError(E.PLAYER_NOT_FOUND);
  must(principal, 'club.read', { tenant_id: p.tenant_id });
  return rosterService.history(playerId, asOf);
}

// APP-52: customer_id is the caller; items may only reference variants of the caller's tenant.
async function checkout(principal, body) {
  must(principal, 'store.checkout', {});
  const b = isObj(body) ? { ...body, customer_id: principal.user_id } : body;
  if (isObj(b) && Array.isArray(b.items)) {
    const ids = b.items.map((i) => (isObj(i) ? i.variant_id : null)).filter((x) => typeof x === 'string');
    const known = await appRepo.variantTenants(ids);
    if (principal.role !== 'super_admin' && known.some((k) => k.tenant_id !== principal.tenant_id)) throw new AppError(E.FORBIDDEN);
  }
  return storeService.checkout(b);
}

// APP-40 authorization of one queued action (online equivalent). Returns 'FORBIDDEN' or null. A missing resource is
// left to the service (it reports the *_NOT_FOUND), unless the role could never perform the action at all.
async function authorizeSyncAction(principal, action) {
  const p = isObj(action.payload) ? action.payload : {};
  if (action.type === 'score_event') {
    const m = typeof p.match_id === 'string' ? await appRepo.matchWithTenant(p.match_id) : null;
    if (!m) return ['super_admin', 'league_organizer'].includes(principal.role) ? null : 'FORBIDDEN';
    return authorize(principal, 'league.manage', { id: m.league_id, tenant_id: m.tenant_id }) ? null : 'FORBIDDEN';
  }
  try {
    const clubs = await transferClubs(p);
    return clubs.some((c) => authorize(principal, 'club.roster', { id: c.club_id, tenant_id: c.tenant_id })) ? null : 'FORBIDDEN';
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return ['super_admin', 'club_manager'].includes(principal.role) ? null : 'FORBIDDEN';
  }
}

module.exports = { pinProduct, appendMatchEvent, addPlayer, transfer, patchPlayer, playerHistory, checkout, authorizeSyncAction };
