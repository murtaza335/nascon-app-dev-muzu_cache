'use strict';
// Policy-as-data (FR-5.1-01). action → role → scope predicate name (see policy.js).
// A missing role entry means deny. Probe mapping (REQUIREMENTS §2.1):
// P1 tenant.create, P2 league.manage, P3 club.roster, P4 club.products, P5 player.update, P6 club.read, P7 platform.config.
const READ_ALL_SAME_TENANT = {
  super_admin: 'any', league_organizer: 'same_tenant', club_manager: 'same_tenant', player: 'same_tenant', viewer: 'same_tenant',
};

const MATRIX = Object.freeze({
  'tenant.create': { super_admin: 'any' },
  'platform.config': { super_admin: 'any' },
  'league.manage': { super_admin: 'any', league_organizer: 'own_league' },
  'match.pin': { super_admin: 'any', league_organizer: 'own_league' },
  'club.roster': { super_admin: 'any', club_manager: 'own_club' },
  'club.products': { super_admin: 'any', club_manager: 'own_club' },
  'player.update': { super_admin: 'any', club_manager: 'club_players', player: 'self' },
  'club.read': READ_ALL_SAME_TENANT,
  'league.read': READ_ALL_SAME_TENANT,
  'match.read': READ_ALL_SAME_TENANT,
  'store.read': READ_ALL_SAME_TENANT,
  'store.checkout': { super_admin: 'any', league_organizer: 'any', club_manager: 'any', player: 'any', viewer: 'any' },
  'order.transition': { super_admin: 'any', club_manager: 'club_scope' },
});

module.exports = { MATRIX };
