'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../../../src/domain/scoring/eventRules');

test('lifecycle aliases and status_change normalise to canonical types', () => {
  assert.equal(rules.normalizeType('match_postpone', {}), 'match_postponed');
  assert.equal(rules.normalizeType('match_cancel', {}), 'match_cancelled');
  assert.equal(rules.normalizeType('match_abandon', {}), 'match_abandoned');
  assert.equal(rules.normalizeType('status_change', { status: 'cancelled' }), 'match_cancelled');
  assert.equal(rules.normalizeType('status_change', { status: 'live' }), 'status_change');
  assert.equal(rules.normalizeType('score', {}), 'score');
});
test('lifecycle events are allowed from upcoming / in_progress only', () => {
  const ok = (status) => rules.checkState('match_postponed', {}, { view: { status } });
  assert.equal(ok('upcoming').ok, true); assert.equal(ok('in_progress').ok, true);
  assert.equal(ok('completed').error.code, 'ILLEGAL_TRANSITION'); assert.equal(ok('cancelled').error.code, 'ILLEGAL_TRANSITION');
});
