'use strict';
// Lookups used by authorization: existence + the tenant/club attributes the policy needs.
const { query } = require('../db');

async function getLeague(id) {
  const { rows } = await query('SELECT league_id AS id, tenant_id FROM leagues WHERE league_id = $1', [id]);
  return rows[0] || null;
}

async function getClub(id) {
  const { rows } = await query('SELECT club_id AS id, tenant_id FROM clubs WHERE club_id = $1', [id]);
  return rows[0] || null;
}

// A player's tenant is its home club's tenant.
async function getPlayer(id) {
  const { rows } = await query(
    `SELECT p.player_id AS id, p.club_id, c.tenant_id FROM players p LEFT JOIN clubs c ON c.club_id = p.club_id
     WHERE p.player_id = $1`, [id]);
  return rows[0] || null;
}

module.exports = { getLeague, getClub, getPlayer };
