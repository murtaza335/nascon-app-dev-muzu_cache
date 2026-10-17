'use strict';
// Transfer / loan / release request validation and the ordered rule checks (FR-2.2-02, BR-ROST-01/02). Pure.
const { E } = require('../../errors');
const { check, t } = require('../../lib/validate');
const { squadCount, positionCount } = require('./registrationState');

const SHAPE = {
  request_id: t.id({ required: true }),
  league_id: t.id({ required: true }),
  player_id: t.id({ required: true }),
  type: t.enum(['transfer', 'loan', 'release'], { required: true }),
  from_squad_id: t.id({ required: true }),
  to_squad_id: t.id({ nullable: true }),
  effective_date: t.date({ required: true }),
  loan_end_date: t.date({ nullable: true }),
  reason: t.string({ required: true, min: 1, max: 500 }),
  requested_by: t.id({ required: true }),
};

// Step 1 (400). Normalizes: release has no destination; non-loans ignore loan_end_date.
function validateTransfer(input) {
  const r = check(SHAPE, input);
  if (!r.ok) return { ok: false, error: E.VALIDATION_ERROR, details: { fields: r.fields } };
  const v = r.value;
  const fields = [];
  if (v.type === 'release') v.to_squad_id = null;
  else if (v.to_squad_id === undefined || v.to_squad_id === null) fields.push('to_squad_id');
  else if (v.to_squad_id === v.from_squad_id) fields.push('to_squad_id');
  if (v.type === 'loan') {
    if (!v.loan_end_date) fields.push('loan_end_date');
    else if (v.loan_end_date <= v.effective_date) fields.push('loan_end_date');
  } else v.loan_end_date = null;
  if (v.to_squad_id === undefined) v.to_squad_id = null;
  if (fields.length) return { ok: false, error: E.VALIDATION_ERROR, details: { fields } };
  return { ok: true, value: v };
}

const reject = (error, details = {}) => ({ ok: false, error, details });

// ctx: {leagueTenant, window:{open,close}|null, maxSquadSize, requiredPositions, squadTenant: Map, regs: [...],
//       reg (the player's registration or null), position, matchesInProgress: [...]}
// Returns {ok:true, effect} or a rejection. Checks 3..8 in the exact BR-ROST-01 order.
function decide(req, ctx) {
  const squads = req.to_squad_id ? [req.from_squad_id, req.to_squad_id] : [req.from_squad_id];
  if (ctx.leagueTenant) {
    for (const s of squads) if (ctx.squadTenant.get(s) !== ctx.leagueTenant) return reject(E.CROSS_TENANT_TRANSFER);
  }
  if (!ctx.reg || ctx.reg.squad_id !== req.from_squad_id) return reject(E.NOT_IN_SQUAD);
  if (req.type !== 'release') {
    const w = ctx.window;
    if (!w || req.effective_date < w.open || req.effective_date > w.close) return reject(E.TRANSFER_WINDOW_CLOSED);
  }
  if (ctx.reg.parent_squad_id) return reject(E.PLAYER_ON_LOAN);
  if (req.type !== 'release' && ctx.maxSquadSize != null && squadCount(ctx.regs, req.to_squad_id) + 1 > ctx.maxSquadSize) return reject(E.SQUAD_FULL);
  const need = ctx.requiredPositions[ctx.position];
  if (need !== undefined && positionCount(ctx.regs, req.from_squad_id, ctx.position) - 1 < need) return reject(E.MIN_POSITION_VIOLATION);

  const blocking = ctx.matchesInProgress.find((m) => m.home_squad_id === req.from_squad_id || m.away_squad_id === req.from_squad_id);
  const state = blocking ? 'deferred_until_match_end' : 'active';
  let registration = null;
  if (req.type === 'transfer') {
    registration = { squad_id: req.to_squad_id, parent_squad_id: null, registration_type: 'transfer', start_date: req.effective_date, loan_end_date: null, role: 'substitute' };
  } else if (req.type === 'loan') {
    registration = { squad_id: req.to_squad_id, parent_squad_id: req.from_squad_id, registration_type: 'loan', start_date: req.effective_date, loan_end_date: req.loan_end_date, role: 'substitute' };
  }
  return { ok: true, effect: { state, blocking_match_id: blocking ? blocking.match_id : null, registration } };
}

module.exports = { validateTransfer, decide };
