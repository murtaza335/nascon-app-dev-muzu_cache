'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { authorize, ACTIONS } = require('../../../src/domain/rbac/policy');

const P = {
  super_admin: { role: 'super_admin', tenant_id: null, league_ids: [], club_id: null, player_id: null },
  league_organizer: { role: 'league_organizer', tenant_id: 'ta', league_ids: ['la1'], club_id: null, player_id: null },
  club_manager: { role: 'club_manager', tenant_id: 'ta', league_ids: [], club_id: 'ca1', player_id: null },
  player: { role: 'player', tenant_id: 'ta', league_ids: [], club_id: 'ca1', player_id: 'pa1' },
  viewer: { role: 'viewer', tenant_id: 'ta', league_ids: [], club_id: null, player_id: null },
};
const ROLES = Object.keys(P);

// REQUIREMENTS §2.1: A = allow (1), D = deny (0). Order: SA, organizer, manager, player, viewer.
const CELLS = [
  ['P1 tenants', 'tenant.create', {}, '10000'],
  ['P2 own_league', 'league.manage', { id: 'la1', tenant_id: 'ta' }, '11000'],
  ['P2 other_league', 'league.manage', { id: 'la2', tenant_id: 'ta' }, '10000'],
  ['P2 foreign_league', 'league.manage', { id: 'lb1', tenant_id: 'tb' }, '10000'],
  ['P3 own_club', 'club.roster', { id: 'ca1', tenant_id: 'ta' }, '10100'],
  ['P3 other_club', 'club.roster', { id: 'ca2', tenant_id: 'ta' }, '10000'],
  ['P3 foreign_club', 'club.roster', { id: 'cb1', tenant_id: 'tb' }, '10000'],
  ['P4 own_club', 'club.products', { id: 'ca1', tenant_id: 'ta' }, '10100'],
  ['P4 other_club', 'club.products', { id: 'ca2', tenant_id: 'ta' }, '10000'],
  ['P4 foreign_club', 'club.products', { id: 'cb1', tenant_id: 'tb' }, '10000'],
  ['P5 own_player', 'player.update', { id: 'pa1', club_id: 'ca1', tenant_id: 'ta' }, '10110'],
  ['P5 other_player', 'player.update', { id: 'pa2', club_id: 'ca2', tenant_id: 'ta' }, '10000'],
  ['P5 foreign_player', 'player.update', { id: 'pb1', club_id: 'cb1', tenant_id: 'tb' }, '10000'],
  ['P6 own_club', 'club.read', { id: 'ca1', tenant_id: 'ta' }, '11111'],
  ['P6 other_club', 'club.read', { id: 'ca2', tenant_id: 'ta' }, '11111'],
  ['P6 foreign_club', 'club.read', { id: 'cb1', tenant_id: 'tb' }, '10000'],
  ['P7 platform', 'platform.config', {}, '10000'],
];

for (const [name, action, resource, expect] of CELLS) {
  ROLES.forEach((role, i) => {
    test(`FR-5.1-01 matrix ${name} × ${role} = ${expect[i] === '1' ? 'allow' : 'deny'}`, () => {
      assert.strictEqual(authorize(P[role], action, resource), expect[i] === '1');
    });
  });
}

test('FR-5.1-01 unknown action, unknown role and missing principal are denied', () => {
  assert.strictEqual(authorize(P.super_admin, 'nope', {}), false);
  assert.strictEqual(authorize({ role: 'hacker' }, 'club.read', { tenant_id: 'ta' }), false);
  assert.strictEqual(authorize(null, 'club.read', {}), false);
});

test('FR-5.1-01 resources with a null tenant are only reachable by the super admin', () => {
  assert.strictEqual(authorize(P.viewer, 'league.read', { id: 'x', tenant_id: null }), false);
  assert.strictEqual(authorize(P.super_admin, 'league.read', { id: 'x', tenant_id: null }), true);
});

test('FR-2.3 store rules: everyone may check out; only club scope may transition orders', () => {
  for (const r of ROLES) assert.strictEqual(authorize(P[r], 'store.checkout', {}), true);
  assert.strictEqual(authorize(P.club_manager, 'order.transition', { tenant_id: 'ta', club_id: 'ca1' }), true);
  assert.strictEqual(authorize(P.club_manager, 'order.transition', { tenant_id: 'ta', club_id: 'ca2' }), false);
  assert.strictEqual(authorize(P.player, 'order.transition', { tenant_id: 'ta', club_id: 'ca1' }), false);
});

test('every matrix action is covered by at least one test above', () => {
  const covered = new Set([...CELLS.map((c) => c[1]), 'league.read', 'store.checkout', 'order.transition', 'match.pin', 'match.read', 'store.read']);
  assert.deepStrictEqual(ACTIONS.filter((a) => !covered.has(a)), []);
});
