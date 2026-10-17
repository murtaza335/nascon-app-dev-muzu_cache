'use strict';
// FR-2.2-01..04: roster setup, transfer/loan/release, audit history. All writes run in one transaction that locks the
// league row (serializes roster changes per league), so a rejected request leaves no trace (incl. lazy loan returns).
const crypto = require('node:crypto');
const { withTx, advisoryXactLock } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { canonical } = require('../lib/canonical');
const { isoSeconds, todayUtc } = require('../lib/time');
const { isDate } = require('../lib/validate');
const transferRules = require('../domain/roster/transferRules');
const { validateSetup } = require('../domain/roster/setupSchema');
const { dueReturns } = require('../domain/roster/loanReturn');
const { squadAsOf } = require('../domain/roster/registrationState');
const roster = require('../repos/roster');
const sportsRepo = require('../repos/sports');
const idem = require('../repos/idempotency');
const outbox = require('../repos/outbox');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function auditView(a) {
  return {
    audit_id: a.audit_id, action: a.action, player_id: a.player_id, league_id: a.league_id, from_squad_id: a.from_squad_id,
    to_squad_id: a.to_squad_id, effective_date: a.effective_date, state: a.state, who: a.who,
    when: isoSeconds(a.occurred_at instanceof Date ? a.occurred_at : new Date(a.occurred_at)), why: a.why,
  };
}

function registrationView(leagueId, playerId, r) {
  if (!r) return null;
  return {
    player_id: playerId, league_id: leagueId, squad_id: r.squad_id, parent_squad_id: r.parent_squad_id,
    registration_type: r.registration_type, start_date: r.start_date, loan_end_date: r.loan_end_date, role: r.role,
  };
}

// Lazily writes every loan_return that is due on `onDate` for the league (once per loan; BR-ROST-03).
async function materializeReturns(client, leagueId, onDate, now) {
  const regs = await roster.listRegistrations(client, leagueId);
  const due = dueReturns(regs.filter((r) => r.parent_squad_id).map((r) => ({
    player_id: r.player_id, squad_id: r.squad_id, parent_squad_id: r.parent_squad_id, loan_end_date: r.loan_end_date, hasReturn: false,
  })), onDate);
  for (const d of due) {
    const loan = regs.find((r) => r.player_id === d.player_id);
    const loanAudit = await roster.latestLoanAudit(client, leagueId, d.player_id, loan.loan_end_date);
    await roster.insertAudit(client, {
      action: 'loan_return', player_id: d.player_id, league_id: leagueId, from_squad_id: d.from_squad_id, to_squad_id: d.to_squad_id,
      effective_date: d.effective_date, state: 'active', who: 'system', when: now, why: 'loan period ended', loan_audit_id: loanAudit,
    });
    await roster.saveRegistration(client, leagueId, d.player_id, {
      squad_id: d.to_squad_id, parent_squad_id: null, registration_type: 'initial', start_date: d.effective_date, loan_end_date: null, role: 'substitute',
    });
  }
}

// ---- API-09 ---------------------------------------------------------------------------------------------------
async function setup(input) {
  const r = validateSetup(input);
  if (!r.ok) throw validationError(r.details.fields);
  const v = r.value;
  return withTx(async (client) => {
    const sport = await sportsRepo.getSport(v.league.sport_id, client);
    if (!sport) throw new AppError(E.SPORT_NOT_FOUND);
    const L = v.league;
    const maxSquad = L.max_squad_size !== undefined ? L.max_squad_size : sport.config.roster.max_squad_size;
    const required = L.required_positions !== undefined ? L.required_positions : sport.config.roster.required_positions;
    const tenants = new Set([L.tenant_id, ...v.squads.map((s) => s.tenant_id)]);
    for (const t of tenants) await client.query('INSERT INTO tenants (tenant_id, name) VALUES ($1,$1) ON CONFLICT DO NOTHING', [t]); // OQ-09
    for (const s of v.squads) await client.query('INSERT INTO clubs (club_id, tenant_id, name) VALUES ($1,$2,$1) ON CONFLICT DO NOTHING', [s.club_id, s.tenant_id]);
    await client.query(
      `INSERT INTO leagues (league_id, tenant_id, sport_id, name, tie_break_order, transfer_window_open, transfer_window_close, max_squad_size, required_positions)
       VALUES ($1,$2,$3,$1,$4,$5,$6,$7,$8)
       ON CONFLICT (league_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, transfer_window_open = EXCLUDED.transfer_window_open,
         transfer_window_close = EXCLUDED.transfer_window_close, max_squad_size = EXCLUDED.max_squad_size,
         required_positions = EXCLUDED.required_positions, sport_id = COALESCE(leagues.sport_id, EXCLUDED.sport_id)`,
      [L.league_id, L.tenant_id, L.sport_id, sport.config.tie_break_order, L.transfer_window.open, L.transfer_window.close, maxSquad, JSON.stringify(required)]);
    await roster.lockLeague(client, L.league_id);
    await roster.wipeLeagueRoster(client, L.league_id);
    for (const s of v.squads) {
      await client.query('INSERT INTO squads (league_id, squad_id, club_id, tenant_id, name) VALUES ($1,$2,$3,$4,$5)', [L.league_id, s.squad_id, s.club_id, s.tenant_id, s.name]);
    }
    const clubOf = new Map(v.squads.map((s) => [s.squad_id, s.club_id]));
    for (const p of v.players) {
      await client.query(
        `INSERT INTO players (player_id, name, position, club_id) VALUES ($1,$2,$3,$4)
         ON CONFLICT (player_id) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position, club_id = EXCLUDED.club_id`,
        [p.player_id, p.name, p.position, clubOf.get(p.squad_id)]);
      await roster.saveRegistration(client, L.league_id, p.player_id, {
        squad_id: p.squad_id, parent_squad_id: null, registration_type: 'initial', start_date: L.transfer_window.open, loan_end_date: null, role: p.role,
      });
    }
    let ordinal = 0;
    for (const m of v.matches_in_progress) {
      await client.query('INSERT INTO roster_matches_in_progress (league_id, match_id, home_squad_id, away_squad_id, ordinal) VALUES ($1,$2,$3,$4,$5)',
        [L.league_id, m.match_id, m.home_squad_id, m.away_squad_id, ordinal++]);
    }
    const counts = Object.fromEntries(v.squads.map((s) => [s.squad_id, 0]));
    for (const p of v.players) counts[p.squad_id] += 1;
    return { league_id: L.league_id, status: 'configured', squad_counts: counts };
  });
}

// ---- API-10 ---------------------------------------------------------------------------------------------------
// Runs inside an open transaction. opts.beforeRules(client, ctx) runs after the existence checks and before the rule
// checks (offline-sync uses it for the base_version comparison). Returns {status, body}.
async function transferInTx(client, req, opts = {}) {
  const hash = sha256(canonical(req));
  const scope = `roster:${req.league_id}`;
  await advisoryXactLock(client, `roster-request:${req.request_id}`);
  const prior = await idem.find(client, scope, req.request_id);
  if (prior) {
    if (prior.request_hash === hash) return { status: 200, body: prior.response };
    throw new AppError(E.DUPLICATE_REQUEST_ID);
  }
  const league = await roster.lockLeague(client, req.league_id);
  if (!league) throw new AppError(E.LEAGUE_NOT_FOUND);
  const player = await roster.getPlayer(client, req.player_id);
  if (!player) throw new AppError(E.PLAYER_NOT_FOUND);
  const squads = await roster.listSquads(client, req.league_id);
  const squadTenant = new Map(squads.map((s) => [s.squad_id, s.tenant_id]));
  for (const id of [req.from_squad_id, req.to_squad_id]) if (id && !squadTenant.has(id)) throw new AppError(E.SQUAD_NOT_FOUND);
  if (opts.beforeRules) await opts.beforeRules(client);

  const now = new Date();
  await materializeReturns(client, req.league_id, req.effective_date, now);
  const regs = await roster.listRegistrations(client, req.league_id);
  const reg = regs.find((x) => x.player_id === req.player_id) || null;
  const decision = transferRules.decide(req, {
    leagueTenant: league.tenant_id,
    window: league.open && league.close ? { open: league.open, close: league.close } : null,
    maxSquadSize: league.max_squad_size, requiredPositions: league.required_positions || {},
    squadTenant, regs, reg, position: player.position,
    matchesInProgress: await roster.listMatchesInProgress(client, req.league_id),
  });
  if (!decision.ok) throw new AppError(decision.error, decision.details);

  const { state, blocking_match_id: blocking, registration } = decision.effect;
  const audit = await roster.insertAudit(client, {
    action: req.type, player_id: req.player_id, league_id: req.league_id, from_squad_id: req.from_squad_id, to_squad_id: req.to_squad_id,
    effective_date: req.effective_date, state, who: req.requested_by, when: now, why: req.reason, loan_end_date: req.loan_end_date,
  });
  if (registration) {
    await roster.saveRegistration(client, req.league_id, req.player_id, { ...registration, state, blocking_match_id: blocking });
  } else {
    await roster.saveRegistration(client, req.league_id, req.player_id, {
      squad_id: null, parent_squad_id: null, registration_type: reg.registration_type, start_date: reg.start_date, loan_end_date: null, role: reg.role, state, blocking_match_id: blocking,
    });
  }
  const body = {
    request_id: req.request_id, status: 'accepted', state, blocking_match_id: blocking,
    registration: registrationView(req.league_id, req.player_id, registration),
    audit_entry: auditView({ ...audit, occurred_at: now }),
  };
  await outbox.insert(client, {
    topic: 'roster', type: 'roster.changed', aggregate_id: req.league_id,
    payload: { league_id: req.league_id, player_id: req.player_id, action: req.type, audit_id: audit.audit_id },
  });
  await idem.store(client, scope, req.request_id, hash, 201, body);
  return { status: 201, body };
}

async function transfer(input) {
  const r = transferRules.validateTransfer(input);
  if (!r.ok) throw validationError(r.details.fields);
  return withTx((client) => transferInTx(client, r.value));
}

// ---- API-11 ---------------------------------------------------------------------------------------------------
async function history(playerId, asOfParam) {
  if (asOfParam !== undefined && !isDate(asOfParam)) throw validationError(['as_of']);
  const asOf = asOfParam === undefined ? todayUtc() : asOfParam;
  return withTx(async (client) => {
    const player = await roster.getPlayer(client, playerId);
    if (!player) throw new AppError(E.PLAYER_NOT_FOUND);
    const leagueId = (await roster.latestAuditLeague(client, playerId)) || (await roster.latestRegistrationLeague(client, playerId));
    if (!leagueId) return { player_id: playerId, as_of: asOf, league_id: null, current_squad_id: null, parent_squad_id: null, history: [] };
    await roster.lockLeague(client, leagueId);
    await materializeReturns(client, leagueId, asOf, new Date());
    const regs = await roster.listRegistrations(client, leagueId);
    const reg = regs.find((x) => x.player_id === playerId);
    const entries = await roster.listAudit(client, leagueId, playerId);
    const cur = squadAsOf(entries, reg ? reg.squad_id : null, asOf);
    return {
      player_id: playerId, as_of: asOf, league_id: leagueId, current_squad_id: cur.squad_id, parent_squad_id: cur.parent_squad_id,
      history: entries.map(auditView),
    };
  });
}

// Version used by offline-sync for roster actions: number of audit entries of the player (all leagues).
async function auditVersion(db, playerId) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM roster_audit WHERE player_id = $1', [playerId]);
  return rows[0].n;
}

module.exports = { setup, transfer, transferInTx, history, auditVersion };
