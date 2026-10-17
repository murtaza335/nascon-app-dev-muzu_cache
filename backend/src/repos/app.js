'use strict';
// Read queries for the production API (APP-*). SQL only.
const { query } = require('../db');

async function listLeagues(tenantId, db = { query }) {
  const { rows } = tenantId
    ? await db.query('SELECT league_id, name, sport_id, tenant_id FROM leagues WHERE tenant_id = $1 ORDER BY league_id', [tenantId])
    : await db.query('SELECT league_id, name, sport_id, tenant_id FROM leagues ORDER BY league_id');
  return rows;
}

const MATCH_COLS = `m.match_id, m.sport_id, m.league_id, m.home_team_id, m.away_team_id, m.version, m.status_cache, m.pinned_product_id, m.venue_id,
  to_char(m.scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS scheduled_at`;

async function fixtures(leagueId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${MATCH_COLS} FROM matches m WHERE m.league_id = $1 ORDER BY m.scheduled_at ASC NULLS LAST, m.match_id`, [leagueId]);
  return rows;
}

// Match plus the tenant of its league (null for stand-alone matches).
async function matchWithTenant(matchId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${MATCH_COLS}, l.tenant_id FROM matches m LEFT JOIN leagues l ON l.league_id = m.league_id WHERE m.match_id = $1`, [matchId]);
  return rows[0] || null;
}

async function getClub(clubId, db = { query }) {
  const { rows } = await db.query('SELECT club_id, tenant_id, name, home_venue, socials, staff FROM clubs WHERE club_id = $1', [clubId]);
  return rows[0] || null;
}

async function clubRoster(clubId, db = { query }) {
  const { rows } = await db.query(
    `SELECT p.player_id, p.name, p.position, r.squad_id, r.role, (r.parent_squad_id IS NOT NULL) AS on_loan, r.league_id
     FROM registrations r JOIN squads s ON s.league_id = r.league_id AND s.squad_id = r.squad_id
     JOIN players p ON p.player_id = r.player_id WHERE s.club_id = $1 ORDER BY p.player_id, r.league_id`, [clubId]);
  return rows;
}

async function clubSquads(clubId, db = { query }) {
  const { rows } = await db.query('SELECT league_id, squad_id FROM squads WHERE club_id = $1', [clubId]);
  return rows;
}

async function productsOf(tenantId, clubId, db = { query }) {
  const where = [];
  const params = [];
  if (tenantId) { params.push(tenantId); where.push(`p.tenant_id = $${params.length}`); }
  if (clubId) { params.push(clubId); where.push(`p.club_id = $${params.length}`); }
  const { rows } = await db.query(
    `SELECT p.product_id, p.tenant_id, p.club_id, p.name, p.category, p.description, p.image_url,
            v.variant_id, v.size, v.color, v.price_minor, v.stock
     FROM products p LEFT JOIN variants v ON v.product_id = p.product_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.product_id, v.variant_id`, params);
  return rows;
}

async function getProduct(productId, db = { query }) {
  const { rows } = await db.query('SELECT product_id, tenant_id, club_id, name, category, image_url FROM products WHERE product_id = $1', [productId]);
  return rows[0] || null;
}

async function schedulesFor(variantIds, db = { query }) {
  if (!variantIds.length) return [];
  const { rows } = await db.query(
    `SELECT variant_id, to_char(effective_from AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS effective_from, price_minor
     FROM price_schedules WHERE variant_id = ANY($1)`, [variantIds]);
  return rows;
}

async function variantTenants(variantIds, db = { query }) {
  const { rows } = await db.query(
    'SELECT v.variant_id, p.tenant_id FROM variants v JOIN products p ON p.product_id = v.product_id WHERE v.variant_id = ANY($1)', [variantIds]);
  return rows;
}

async function setPinned(matchId, productId, db = { query }) {
  await db.query('UPDATE matches SET pinned_product_id = $2 WHERE match_id = $1', [matchId, productId]);
}

async function getPlayerWithTenant(playerId, db = { query }) {
  const { rows } = await db.query(
    `SELECT p.player_id, p.name, p.position, p.club_id, c.tenant_id FROM players p LEFT JOIN clubs c ON c.club_id = p.club_id WHERE p.player_id = $1`, [playerId]);
  return rows[0] || null;
}

module.exports = {
  listLeagues, fixtures, matchWithTenant, getClub, clubRoster, clubSquads, productsOf, getProduct, schedulesFor, variantTenants, setPinned, getPlayerWithTenant,
};

async function getTenant(tenantId, db = { query }) {
  const { rows } = await db.query('SELECT tenant_id, name, logo_url, colors FROM tenants WHERE tenant_id = $1', [tenantId]);
  return rows[0] || null;
}

async function getUserById(userId, db = { query }) {
  const { rows } = await db.query(
    'SELECT user_id, email, display_name, role, tenant_id, league_ids, club_id, player_id FROM users WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

async function squadWithClub(leagueId, squadId, db = { query }) {
  const { rows } = await db.query(
    'SELECT s.squad_id, s.club_id, s.tenant_id, c.tenant_id AS club_tenant FROM squads s JOIN clubs c ON c.club_id = s.club_id WHERE s.league_id = $1 AND s.squad_id = $2',
    [leagueId, squadId]);
  return rows[0] || null;
}

async function updatePlayer(playerId, fields, db = { query }) {
  const sets = [];
  const params = [playerId];
  for (const [k, v] of Object.entries(fields)) { params.push(v); sets.push(`${k} = $${params.length}`); }
  if (sets.length) await db.query(`UPDATE players SET ${sets.join(', ')} WHERE player_id = $1`, params);
  const { rows } = await db.query('SELECT player_id, name, position, club_id FROM players WHERE player_id = $1', [playerId]);
  return rows[0];
}

module.exports.getTenant = getTenant;
module.exports.getUserById = getUserById;
module.exports.squadWithClub = squadWithClub;
module.exports.updatePlayer = updatePlayer;

// APP-03: directory data is scoped before it leaves SQL; never exposes users.
async function context(tenantId, db = { query }) {
  const params = [tenantId];
  const tenants = await db.query('SELECT tenant_id, name, logo_url, colors FROM tenants WHERE ($1::text IS NULL OR tenant_id = $1) ORDER BY tenant_id', params);
  const clubs = await db.query('SELECT club_id, tenant_id, name FROM clubs WHERE ($1::text IS NULL OR tenant_id = $1) ORDER BY name, club_id', params);
  const squads = await db.query('SELECT league_id, squad_id, club_id, tenant_id, name FROM squads WHERE ($1::text IS NULL OR tenant_id = $1) ORDER BY league_id, squad_id', params);
  const sports = await db.query('SELECT sport_id, name, config FROM sports WHERE sport_id IN (SELECT sport_id FROM leagues WHERE ($1::text IS NULL OR tenant_id = $1)) ORDER BY sport_id', params);
  const players = await db.query('SELECT p.player_id, p.name, p.position, p.club_id FROM players p JOIN clubs c ON c.club_id = p.club_id WHERE ($1::text IS NULL OR c.tenant_id = $1) ORDER BY p.player_id', params);
  const registrations = await db.query('SELECT r.player_id, r.league_id, r.squad_id, r.role, (r.parent_squad_id IS NOT NULL) AS on_loan FROM registrations r JOIN leagues l ON l.league_id = r.league_id WHERE ($1::text IS NULL OR l.tenant_id = $1) ORDER BY r.player_id, r.league_id', params);
  return { tenants: tenants.rows, clubs: clubs.rows, squads: squads.rows, sports: sports.rows, players: players.rows, registrations: registrations.rows };
}
module.exports.context = context;
