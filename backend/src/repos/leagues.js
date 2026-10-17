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

async function insertLeague(client, l) {
  const { rowCount } = await client.query(
    `INSERT INTO leagues (league_id, tenant_id, sport_id, name, teams, points, tie_break_order, qualification_spots, lots_seed)
     VALUES ($1,NULL,$2,$1,$3,$4,$5,$6,$7) ON CONFLICT (league_id) DO NOTHING`,
    [l.league_id, l.sport_id, l.teams, JSON.stringify(l.points), l.tie_break_order, l.qualification_spots, l.lots_seed]);
  return rowCount === 1;
}

async function lastResetSeed(db = { query }) {
  const { rows } = await db.query("SELECT value FROM app_state WHERE key = 'last_reset_seed'");
  return rows.length ? Number.parseInt(rows[0].value, 10) : 42;
}

async function matchesOfLeague(leagueId, db = { query }) {
  const { rows } = await db.query(
    'SELECT match_id, sport_id, league_id, home_team_id, away_team_id FROM matches WHERE league_id = $1 ORDER BY match_id', [leagueId]);
  return rows;
}

module.exports.insertLeague = insertLeague;
module.exports.lastResetSeed = lastResetSeed;
module.exports.matchesOfLeague = matchesOfLeague;
