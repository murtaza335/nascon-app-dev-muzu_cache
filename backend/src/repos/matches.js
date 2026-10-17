'use strict';
const { query } = require('../db');

const COLS = 'match_id, sport_id, league_id, home_team_id, away_team_id, version, status_cache, scheduled_at, venue_id, pinned_product_id';

async function getMatch(matchId, db = { query }) {
  const { rows } = await db.query(`SELECT ${COLS} FROM matches WHERE match_id = $1`, [matchId]);
  return rows[0] || null;
}

// Row lock serializes appends per match (ARCHITECTURE §6.3).
async function lockMatch(client, matchId) {
  const { rows } = await client.query(`SELECT ${COLS} FROM matches WHERE match_id = $1 FOR UPDATE`, [matchId]);
  return rows[0] || null;
}

// Returns true when inserted, false when the match_id already exists.
async function insertMatch(client, m) {
  const { rowCount } = await client.query(
    `INSERT INTO matches (match_id, sport_id, league_id, home_team_id, away_team_id) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (match_id) DO NOTHING`,
    [m.match_id, m.sport_id, m.league_id ?? null, m.home_team_id, m.away_team_id]);
  return rowCount === 1;
}

async function setVersion(client, matchId, version, statusCache) {
  await client.query('UPDATE matches SET version = $2, status_cache = $3 WHERE match_id = $1', [matchId, version, statusCache]);
}

module.exports = { getMatch, lockMatch, insertMatch, setVersion };
