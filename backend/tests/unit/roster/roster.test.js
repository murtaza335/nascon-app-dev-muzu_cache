'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validateTransfer, decide } = require('../../../src/domain/roster/transferRules');
const { dueReturns } = require('../../../src/domain/roster/loanReturn');
const { squadAsOf } = require('../../../src/domain/roster/registrationState');
const { validateSetup } = require('../../../src/domain/roster/setupSchema');
const { addDays } = require('../../../src/lib/time');

const base = (over = {}) => ({
  request_id: 'r1', league_id: 'lg', player_id: 'p2', type: 'transfer', from_squad_id: 'sq-a', to_squad_id: 'sq-b',
  effective_date: '2026-09-30', loan_end_date: null, reason: 'why', requested_by: 'u1', ...over,
});
const fields = (input) => { const r = validateTransfer(input); assert.strictEqual(r.ok, false); assert.strictEqual(r.error.code, 'VALIDATION_ERROR'); return r.details.fields.sort(); };

// scenario: window 09-01..09-30, max 3, gk required 1; sq-a: p1(gk) p2(df) ; sq-b: empty
const ctx = (over = {}) => ({
  leagueTenant: 'ta', window: { open: '2026-09-01', close: '2026-09-30' }, maxSquadSize: 3, requiredPositions: { gk: 1 },
  squadTenant: new Map([['sq-a', 'ta'], ['sq-b', 'ta']]),
  regs: [{ player_id: 'p1', squad_id: 'sq-a', parent_squad_id: null, position: 'gk' }, { player_id: 'p2', squad_id: 'sq-a', parent_squad_id: null, position: 'df' }],
  reg: { player_id: 'p2', squad_id: 'sq-a', parent_squad_id: null, position: 'df', role: 'starter' }, position: 'df', matchesInProgress: [], ...over,
});
const code = (r) => (r.ok ? 'OK' : r.error.code);

test('BR-ROST-01 step 1: schema, loan_end_date > effective_date, destination rules', () => {
  assert.ok(validateTransfer(base()).ok);
  assert.deepStrictEqual(fields({}), ['effective_date', 'from_squad_id', 'league_id', 'player_id', 'reason', 'request_id', 'requested_by', 'type']);
  assert.deepStrictEqual(fields(base({ effective_date: '2026-02-30' })), ['effective_date']);
  assert.deepStrictEqual(fields(base({ to_squad_id: null })), ['to_squad_id']);
  assert.deepStrictEqual(fields(base({ to_squad_id: 'sq-a' })), ['to_squad_id']);
  assert.deepStrictEqual(fields(base({ type: 'loan' })), ['loan_end_date']);
  assert.deepStrictEqual(fields(base({ type: 'loan', loan_end_date: '2026-09-30' })), ['loan_end_date']);
  assert.deepStrictEqual(fields(base({ type: 'loan', loan_end_date: '2026-09-29' })), ['loan_end_date']);
  assert.deepStrictEqual(fields(base({ reason: '' })), ['reason']);
  assert.deepStrictEqual(fields(base({ reason: 'x'.repeat(501) })), ['reason']);
  assert.deepStrictEqual(fields(base({ type: 'swap' })), ['type']);
  const rel = validateTransfer(base({ type: 'release', to_squad_id: 'sq-b', loan_end_date: '2020-01-01' })).value;
  assert.deepStrictEqual([rel.to_squad_id, rel.loan_end_date], [null, null]);
  assert.strictEqual(validateTransfer(base({ type: 'transfer', loan_end_date: '1999-01-01' })).value.loan_end_date, null);
});

test('BR-ROST-01 step 3: CROSS_TENANT_TRANSFER for either squad; skipped when the league has no tenant', () => {
  const r = base();
  assert.strictEqual(code(decide(r, ctx({ squadTenant: new Map([['sq-a', 'ta'], ['sq-b', 'tb']]) }))), 'CROSS_TENANT_TRANSFER');
  assert.strictEqual(code(decide(r, ctx({ squadTenant: new Map([['sq-a', 'tb'], ['sq-b', 'ta']]) }))), 'CROSS_TENANT_TRANSFER');
  assert.strictEqual(code(decide(base({ type: 'release', to_squad_id: null }), ctx({ squadTenant: new Map([['sq-a', 'tb']]) }))), 'CROSS_TENANT_TRANSFER');
  assert.strictEqual(code(decide(r, ctx({ leagueTenant: null, squadTenant: new Map([['sq-a', 'x'], ['sq-b', 'y']]) }))), 'OK');
});

test('BR-ROST-01 step 4: NOT_IN_SQUAD (wrong squad, no registration, released)', () => {
  assert.strictEqual(code(decide(base({ from_squad_id: 'sq-b', to_squad_id: 'sq-a' }), ctx())), 'NOT_IN_SQUAD');
  assert.strictEqual(code(decide(base(), ctx({ reg: null }))), 'NOT_IN_SQUAD');
  assert.strictEqual(code(decide(base(), ctx({ reg: { squad_id: null, parent_squad_id: null } }))), 'NOT_IN_SQUAD');
});

test('BR-ROST-01 step 5: window inclusive on both ends; release ignores the window', () => {
  for (const d of ['2026-09-01', '2026-09-15', '2026-09-30']) assert.strictEqual(code(decide(base({ effective_date: d }), ctx())), 'OK', d);
  for (const d of ['2026-08-31', '2026-10-01']) assert.strictEqual(code(decide(base({ effective_date: d }), ctx())), 'TRANSFER_WINDOW_CLOSED', d);
  assert.strictEqual(code(decide(base({ type: 'loan', loan_end_date: '2026-12-01', effective_date: '2026-10-01' }), ctx())), 'TRANSFER_WINDOW_CLOSED');
  assert.strictEqual(code(decide(base({ type: 'release', to_squad_id: null, effective_date: '2030-01-01' }), ctx())), 'OK');
  assert.strictEqual(code(decide(base(), ctx({ window: null }))), 'TRANSFER_WINDOW_CLOSED');
});

test('BR-ROST-01 step 6: PLAYER_ON_LOAN for transfer, loan and release', () => {
  const onLoan = { player_id: 'p2', squad_id: 'sq-a', parent_squad_id: 'sq-z', position: 'df' };
  for (const type of ['transfer', 'loan', 'release']) {
    const r = base({ type, ...(type === 'loan' ? { loan_end_date: '2026-12-01' } : {}), ...(type === 'release' ? { to_squad_id: null } : {}) });
    assert.strictEqual(code(decide(r, ctx({ reg: onLoan }))), 'PLAYER_ON_LOAN', type);
  }
});

test('BR-ROST-01 step 7: SQUAD_FULL counts borrowed in, loaned out excluded; release never full', () => {
  const full = [{ squad_id: 'sq-b', position: 'x' }, { squad_id: 'sq-b', position: 'x' }, { squad_id: 'sq-b', position: 'x' }];
  const regs = [...ctx().regs, ...full];
  assert.strictEqual(code(decide(base(), ctx({ regs }))), 'SQUAD_FULL');
  assert.strictEqual(code(decide(base(), ctx({ regs: [...ctx().regs, ...full.slice(1)] }))), 'OK'); // 2 + 1 <= 3
  assert.strictEqual(code(decide(base({ type: 'release', to_squad_id: null }), ctx({ regs }))), 'OK');
});

test('BR-ROST-01 step 8: MIN_POSITION_VIOLATION for transfer, loan and release', () => {
  const gk = { player_id: 'p1', squad_id: 'sq-a', parent_squad_id: null, position: 'gk' };
  const c = ctx({ reg: gk, position: 'gk' });
  assert.strictEqual(code(decide(base({ player_id: 'p1' }), c)), 'MIN_POSITION_VIOLATION');
  assert.strictEqual(code(decide(base({ player_id: 'p1', type: 'loan', loan_end_date: '2026-12-01' }), c)), 'MIN_POSITION_VIOLATION');
  assert.strictEqual(code(decide(base({ player_id: 'p1', type: 'release', to_squad_id: null }), c)), 'MIN_POSITION_VIOLATION');
  const second = ctx({ reg: gk, position: 'gk', regs: [...ctx().regs, { player_id: 'p9', squad_id: 'sq-a', parent_squad_id: null, position: 'gk' }] });
  assert.strictEqual(code(decide(base({ player_id: 'p1' }), second)), 'OK');
  assert.strictEqual(code(decide(base(), ctx({ requiredPositions: {} }))), 'OK');
});

test('BR-ROST-01 precedence: the earlier failing check wins when two rules are violated', () => {
  const gk = { player_id: 'p1', squad_id: 'sq-a', parent_squad_id: null, position: 'gk' };
  const fullRegs = [...ctx().regs, ...Array(3).fill({ squad_id: 'sq-b', position: 'x' })];
  // window closed (5) + squad full (7) → window
  assert.strictEqual(code(decide(base({ effective_date: '2026-10-05' }), ctx({ regs: fullRegs }))), 'TRANSFER_WINDOW_CLOSED');
  // squad full (7) + min position (8) → full
  assert.strictEqual(code(decide(base({ player_id: 'p1' }), ctx({ regs: [...fullRegs], reg: gk, position: 'gk' }))), 'SQUAD_FULL');
  // on loan (6) + window closed (5) → window
  assert.strictEqual(code(decide(base({ effective_date: '2026-10-05' }), ctx({ reg: { squad_id: 'sq-a', parent_squad_id: 'sq-z' } }))), 'TRANSFER_WINDOW_CLOSED');
  // on loan (6) + full (7) → on loan
  assert.strictEqual(code(decide(base(), ctx({ regs: fullRegs, reg: { squad_id: 'sq-a', parent_squad_id: 'sq-z' } }))), 'PLAYER_ON_LOAN');
  // not in squad (4) + cross tenant (3) → cross tenant
  assert.strictEqual(code(decide(base(), ctx({ reg: null, squadTenant: new Map([['sq-a', 'ta'], ['sq-b', 'tb']]) }))), 'CROSS_TENANT_TRANSFER');
  // not in squad (4) + window (5) → not in squad
  assert.strictEqual(code(decide(base({ effective_date: '2026-10-05' }), ctx({ reg: null }))), 'NOT_IN_SQUAD');
});

test('BR-ROST-02 effects: transfer, loan, release registration shapes', () => {
  const t = decide(base(), ctx()).effect;
  assert.deepStrictEqual(t, { state: 'active', blocking_match_id: null, registration: { squad_id: 'sq-b', parent_squad_id: null, registration_type: 'transfer', start_date: '2026-09-30', loan_end_date: null, role: 'substitute' } });
  const l = decide(base({ type: 'loan', loan_end_date: '2026-10-20' }), ctx()).effect.registration;
  assert.deepStrictEqual([l.squad_id, l.parent_squad_id, l.registration_type, l.loan_end_date, l.role], ['sq-b', 'sq-a', 'loan', '2026-10-20', 'substitute']);
  assert.strictEqual(decide(base({ type: 'release', to_squad_id: null }), ctx()).effect.registration, null);
});

test('BR-ROST-02 edge case 6: in-progress match defers; first entry in list order wins; other squads unaffected', () => {
  const live = [{ match_id: 'm-1', home_squad_id: 'sq-x', away_squad_id: 'sq-a' }, { match_id: 'm-2', home_squad_id: 'sq-a', away_squad_id: 'sq-y' }];
  const e = decide(base({ effective_date: '2026-09-30' }), ctx({ matchesInProgress: live })).effect;
  assert.deepStrictEqual([e.state, e.blocking_match_id], ['deferred_until_match_end', 'm-1']);
  const none = decide(base(), ctx({ matchesInProgress: [{ match_id: 'm-3', home_squad_id: 'sq-q', away_squad_id: 'sq-r' }] })).effect;
  assert.deepStrictEqual([none.state, none.blocking_match_id], ['active', null]);
});

test('BR-ROST-03 loan return is due the day after loan_end_date and only once', () => {
  const loans = [{ player_id: 'p', squad_id: 'sq-b', parent_squad_id: 'sq-a', loan_end_date: '2026-09-20', hasReturn: false }];
  assert.deepStrictEqual(dueReturns(loans, '2026-09-20'), []);
  assert.deepStrictEqual(dueReturns(loans, '2026-09-21'), [{ player_id: 'p', from_squad_id: 'sq-b', to_squad_id: 'sq-a', effective_date: '2026-09-21' }]);
  assert.strictEqual(dueReturns([{ ...loans[0], hasReturn: true }], '2027-01-01').length, 0);
  assert.strictEqual(dueReturns([{ ...loans[0], parent_squad_id: null }], '2027-01-01').length, 0);
  assert.strictEqual(addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(addDays('2028-02-28', 1), '2028-02-29');
});

test('BR-ROST-06 squadAsOf reconstructs from the audit log', () => {
  const loan = { action: 'loan', from_squad_id: 'sq-a', to_squad_id: 'sq-b', effective_date: '2026-09-10' };
  const ret = { action: 'loan_return', from_squad_id: 'sq-b', to_squad_id: 'sq-a', effective_date: '2026-09-21' };
  const entries = [loan, ret];
  assert.deepStrictEqual(squadAsOf(entries, 'sq-a', '2026-09-05'), { squad_id: 'sq-a', parent_squad_id: null });
  assert.deepStrictEqual(squadAsOf(entries, 'sq-a', '2026-09-15'), { squad_id: 'sq-b', parent_squad_id: 'sq-a' });
  assert.deepStrictEqual(squadAsOf(entries, 'sq-a', '2026-09-21'), { squad_id: 'sq-a', parent_squad_id: null });
  assert.deepStrictEqual(squadAsOf([], 'sq-q', '2026-09-21'), { squad_id: 'sq-q', parent_squad_id: null });
  assert.deepStrictEqual(squadAsOf([{ action: 'release', from_squad_id: 'sq-a', to_squad_id: null, effective_date: '2026-09-02' }], 'sq-a', '2026-09-03'), { squad_id: null, parent_squad_id: null });
});

const setupBody = () => ({
  league: { league_id: 'lg', tenant_id: 'ta', sport_id: 'football', transfer_window: { open: '2026-09-01', close: '2026-09-30' } },
  squads: [{ squad_id: 'sq-a', club_id: 'ca', tenant_id: 'ta', name: 'A' }, { squad_id: 'sq-b', club_id: 'cb', tenant_id: 'ta', name: 'B' }],
  players: [{ player_id: 'p1', name: 'Ali', position: 'gk', squad_id: 'sq-a', role: 'captain' }],
});

test('API-09 setup validation: cross references, window order, roles, duplicates', () => {
  assert.ok(validateSetup(setupBody()).ok);
  assert.deepStrictEqual(validateSetup(setupBody()).value.matches_in_progress, []);
  const f = (mut) => { const b = setupBody(); mut(b); const r = validateSetup(b); assert.strictEqual(r.ok, false); return r.details.fields.sort(); };
  assert.deepStrictEqual(f((b) => { b.players[0].squad_id = 'nope'; }), ['players[0].squad_id']);
  assert.deepStrictEqual(f((b) => { b.matches_in_progress = [{ match_id: 'm', home_squad_id: 'sq-a', away_squad_id: 'zz' }]; }), ['matches_in_progress[0].away_squad_id']);
  assert.deepStrictEqual(f((b) => { b.league.transfer_window = { open: '2026-10-01', close: '2026-09-01' }; }), ['league.transfer_window.close']);
  assert.deepStrictEqual(f((b) => { b.players[0].role = 'boss'; }), ['players[0].role']);
  assert.deepStrictEqual(f((b) => { b.squads.push({ ...b.squads[0] }); }), ['squads[2].squad_id']);
  assert.deepStrictEqual(f((b) => { delete b.league; }), ['league']);
  assert.deepStrictEqual(f((b) => { b.league.max_squad_size = 0; }), ['league.max_squad_size']);
});
