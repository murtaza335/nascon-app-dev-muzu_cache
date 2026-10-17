'use strict';
const { query } = require('../db');

async function getLeague(leagueId, db = { query }) {
  const { rows } = await db.query(
    `SELECT league_id, tenant_id, sport_id, name, teams, points, tie_break_order, qualification_spots, lots_seed,
            transfer_window_open, transfer_window_close, max_squad_size, required_positions
     FROM leagues WHERE league_id = $1`, [leagueId]);
  return rows[0] || null;
}

module.exports = { getLeague };
