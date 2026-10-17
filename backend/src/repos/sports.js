'use strict';
const { query } = require('../db');

async function insertSport(client, { sport_id, name, scoring_model, config }, isSeed = false) {
  await client.query('INSERT INTO sports (sport_id, name, scoring_model, config, is_seed) VALUES ($1,$2,$3,$4,$5)',
    [sport_id, name, scoring_model, JSON.stringify(config), isSeed]);
}

async function getSport(sportId, db = { query }) {
  const { rows } = await db.query('SELECT sport_id, name, scoring_model, config FROM sports WHERE sport_id = $1', [sportId]);
  return rows[0] || null;
}

module.exports = { insertSport, getSport };
