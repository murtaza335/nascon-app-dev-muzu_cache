'use strict';
// authorize(principal, action, resource) → boolean. Pure: no I/O. The resource is loaded by the service:
// {id?, tenant_id, club_id?}. Cross-tenant access is always false for non-super-admins.
const { MATRIX } = require('./matrix');

const sameTenant = (p, r) => r.tenant_id != null && r.tenant_id === p.tenant_id;

const PREDICATES = {
  any: () => true,
  same_tenant: (p, r) => sameTenant(p, r),
  own_league: (p, r) => sameTenant(p, r) && Array.isArray(p.league_ids) && p.league_ids.includes(r.id),
  own_club: (p, r) => sameTenant(p, r) && p.club_id != null && p.club_id === r.id,
  club_players: (p, r) => sameTenant(p, r) && p.club_id != null && p.club_id === r.club_id,
  club_scope: (p, r) => sameTenant(p, r) && p.club_id != null && p.club_id === r.club_id,
  self: (p, r) => sameTenant(p, r) && p.player_id != null && p.player_id === r.id,
};

function authorize(principal, action, resource = {}) {
  if (!principal || typeof principal.role !== 'string') return false;
  const rule = MATRIX[action] && Object.hasOwn(MATRIX[action], principal.role) ? MATRIX[action][principal.role] : null;
  if (!rule) return false;
  return PREDICATES[rule](principal, resource);
}

module.exports = { authorize, ACTIONS: Object.keys(MATRIX) };
