'use strict';
// API-09 /roster/setup request validation (FR-2.2-01). Pure.
const { E } = require('../../errors');
const { check, t } = require('../../lib/validate');

const ROLES = ['captain', 'vice_captain', 'starter', 'substitute'];

const SHAPE = {
  league: t.object({
    league_id: t.id({ required: true }),
    tenant_id: t.id({ required: true }),
    sport_id: t.string({ required: true, min: 1, max: 64 }),
    transfer_window: t.object({ open: t.date({ required: true }), close: t.date({ required: true }) }, { required: true }),
    max_squad_size: t.int({ min: 1 }),
    required_positions: t.map(t.int({ min: 0 })),
  }, { required: true }),
  squads: t.array(t.object({
    squad_id: t.id({ required: true }), club_id: t.id({ required: true }), tenant_id: t.id({ required: true }), name: t.string({ required: true, min: 1, max: 200 }),
  }), { required: true }),
  players: t.array(t.object({
    player_id: t.id({ required: true }), name: t.string({ required: true, min: 1, max: 200 }), position: t.string({ required: true, min: 1, max: 64 }),
    squad_id: t.id({ required: true }), role: t.enum(ROLES, { required: true }),
  }), { required: true }),
  matches_in_progress: t.array(t.object({
    match_id: t.id({ required: true }), home_squad_id: t.id({ required: true }), away_squad_id: t.id({ required: true }),
  })),
};

function validateSetup(input) {
  const r = check(SHAPE, input);
  if (!r.ok) return { ok: false, error: E.VALIDATION_ERROR, details: { fields: r.fields } };
  const v = r.value;
  if (!v.matches_in_progress) v.matches_in_progress = [];
  const fields = [];
  const squadIds = new Set();
  v.squads.forEach((s, i) => { if (squadIds.has(s.squad_id)) fields.push(`squads[${i}].squad_id`); squadIds.add(s.squad_id); });
  const playerIds = new Set();
  v.players.forEach((p, i) => {
    if (!squadIds.has(p.squad_id)) fields.push(`players[${i}].squad_id`);
    if (playerIds.has(p.player_id)) fields.push(`players[${i}].player_id`);
    playerIds.add(p.player_id);
  });
  v.matches_in_progress.forEach((m, i) => {
    if (!squadIds.has(m.home_squad_id)) fields.push(`matches_in_progress[${i}].home_squad_id`);
    if (!squadIds.has(m.away_squad_id)) fields.push(`matches_in_progress[${i}].away_squad_id`);
  });
  if (v.league.transfer_window.open > v.league.transfer_window.close) fields.push('league.transfer_window.close');
  if (fields.length) return { ok: false, error: E.VALIDATION_ERROR, details: { fields: [...new Set(fields)] } };
  return { ok: true, value: v };
}

module.exports = { validateSetup, ROLES };
