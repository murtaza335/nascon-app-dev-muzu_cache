'use strict';
const { query } = require('../db');

const COLS = 'user_id, email, password_hash, display_name, role, tenant_id, league_ids, club_id, player_id';

async function findByEmail(email) {
  const { rows } = await query(`SELECT ${COLS} FROM users WHERE lower(email) = lower($1)`, [email]);
  return rows[0] || null;
}

async function findDemoUsers() {
  const { rows } = await query(`SELECT ${COLS} FROM users WHERE email LIKE '%@nascon.test'`);
  return rows;
}

module.exports = { findByEmail, findDemoUsers };
