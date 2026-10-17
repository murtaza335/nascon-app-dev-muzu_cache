'use strict';
// SQL only. Roster state per league; roster_audit is append-only (deletes happen only in setup under the reset flag).
const { query } = require('../db');

const SQ = 'league_id, squad_id, club_id, tenant_id, name';

async function lockLeague(client, leagueId) {
  const { rows } = await client.query(
    `SELECT league_id, tenant_id, sport_id, transfer_window_open AS open, transfer_window_close AS close, max_squad_size, required_positions
     FROM leagues WHERE league_id = $1 FOR UPDATE`, [leagueId]);
  return rows[0] || null;
}

async function getPlayer(db, playerId) {
  const { rows } = await db.query('SELECT player_id, name, position, club_id FROM players WHERE player_id = $1', [playerId]);
  return rows[0] || null;
}

async function listSquads(db, leagueId) {
  const { rows } = await db.query(`SELECT ${SQ} FROM squads WHERE league_id = $1 ORDER BY squad_id`, [leagueId]);
  return rows;
}

async function listRegistrations(db, leagueId) {
  const { rows } = await db.query(
    `SELECT r.league_id, r.player_id, r.squad_id, r.parent_squad_id, r.registration_type, r.start_date, r.loan_end_date, r.role, r.state, r.blocking_match_id, p.position
     FROM registrations r JOIN players p ON p.player_id = r.player_id WHERE r.league_id = $1 ORDER BY r.player_id`, [leagueId]);
  return rows;
}

async function listMatchesInProgress(db, leagueId) {
  const { rows } = await db.query(
    'SELECT match_id, home_squad_id, away_squad_id FROM roster_matches_in_progress WHERE league_id = $1 ORDER BY ordinal', [leagueId]);
  return rows;
}

async function saveRegistration(client, leagueId, playerId, r) {
  await client.query(
    `INSERT INTO registrations (league_id, player_id, squad_id, parent_squad_id, registration_type, start_date, loan_end_date, role, state, blocking_match_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (league_id, player_id) DO UPDATE SET squad_id = EXCLUDED.squad_id, parent_squad_id = EXCLUDED.parent_squad_id,
       registration_type = EXCLUDED.registration_type, start_date = EXCLUDED.start_date, loan_end_date = EXCLUDED.loan_end_date,
       role = EXCLUDED.role, state = EXCLUDED.state, blocking_match_id = EXCLUDED.blocking_match_id`,
    [leagueId, playerId, r.squad_id, r.parent_squad_id, r.registration_type, r.start_date, r.loan_end_date, r.role, r.state || 'active', r.blocking_match_id || null]);
}

// audit_id = au-NNNN with N = max + 1 (gap-free, restarts after /reset). A global advisory lock serializes allocation.
async function insertAudit(client, e) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('roster-audit-seq', 0))");
  const { rows } = await client.query('SELECT COALESCE(MAX(audit_seq), 0) + 1 AS n FROM roster_audit');
  const n = rows[0].n;
  const auditId = `au-${String(n).padStart(4, '0')}`;
  await client.query(
    `INSERT INTO roster_audit (audit_seq, audit_id, action, player_id, league_id, from_squad_id, to_squad_id, effective_date, state, who, occurred_at, why, loan_end_date, loan_audit_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [n, auditId, e.action, e.player_id, e.league_id, e.from_squad_id, e.to_squad_id, e.effective_date, e.state, e.who, e.when, e.why, e.loan_end_date || null, e.loan_audit_id || null]);
  return { ...e, audit_id: auditId };
}

async function listAudit(db, leagueId, playerId) {
  const { rows } = await db.query(
    `SELECT audit_id, action, player_id, league_id, from_squad_id, to_squad_id, effective_date, state, who, occurred_at, why, loan_end_date
     FROM roster_audit WHERE league_id = $1 AND player_id = $2 ORDER BY audit_seq`, [leagueId, playerId]);
  return rows;
}

async function latestAuditLeague(db, playerId) {
  const { rows } = await db.query('SELECT league_id FROM roster_audit WHERE player_id = $1 ORDER BY audit_seq DESC LIMIT 1', [playerId]);
  return rows[0] ? rows[0].league_id : null;
}

async function latestRegistrationLeague(db, playerId) {
  const { rows } = await db.query('SELECT league_id FROM registrations WHERE player_id = $1 ORDER BY start_date DESC, league_id LIMIT 1', [playerId]);
  return rows[0] ? rows[0].league_id : null;
}

async function latestLoanAudit(client, leagueId, playerId, loanEnd) {
  const { rows } = await client.query(
    "SELECT audit_id FROM roster_audit WHERE league_id = $1 AND player_id = $2 AND action = 'loan' AND loan_end_date = $3 ORDER BY audit_seq DESC LIMIT 1",
    [leagueId, playerId, loanEnd]);
  return rows[0] ? rows[0].audit_id : null;
}

// Setup: replace one league's roster state (FR-2.2-01, OQ-10). Needs app.allow_mutation for the audit delete.
async function wipeLeagueRoster(client, leagueId) {
  await client.query("SET LOCAL app.allow_mutation = 'on'");
  await client.query('DELETE FROM registrations WHERE league_id = $1', [leagueId]);
  await client.query('DELETE FROM squads WHERE league_id = $1', [leagueId]);
  await client.query('DELETE FROM roster_matches_in_progress WHERE league_id = $1', [leagueId]);
  await client.query('DELETE FROM roster_audit WHERE league_id = $1', [leagueId]);
  await client.query('DELETE FROM idempotency WHERE scope = $1', [`roster:${leagueId}`]);
  await client.query("SET LOCAL app.allow_mutation = 'off'");
}

module.exports = {
  query, lockLeague, getPlayer, listSquads, listRegistrations, listMatchesInProgress, saveRegistration, insertAudit,
  listAudit, latestAuditLeague, latestRegistrationLeague, latestLoanAudit, wipeLeagueRoster,
};
