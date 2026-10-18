'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const cs = require('../../../src/domain/costream/session');

const four = ['a', 'b', 'c', 'd'];
test('no drop keeps host and everyone', () => {
  assert.deepEqual(cs.handoff('a', four, false), { active_host: 'a', handoff_occurred: false, active_participants: four, status: 'active' });
});
test('host drop hands over to the first remaining participant in array order', () => {
  const r = cs.handoff('a', four, true);
  assert.equal(r.active_host, 'b'); assert.equal(r.handoff_occurred, true);
  assert.deepEqual(r.active_participants, ['b', 'c', 'd']);
});
test('host drop when host is not first still picks remaining[0]', () => assert.equal(cs.handoff('c', four, true).active_host, 'a'));
test('sole host dropping terminates the session', () => {
  assert.deepEqual(cs.handoff('a', ['a'], true), { active_host: null, handoff_occurred: false, active_participants: [], status: 'terminated' });
});
test('capacity: more than four is full', () => { assert.equal(cs.isFull([...four, 'e']), true); assert.equal(cs.isFull(four), false); });
test('layout capacity uses the effective count', () => {
  assert.equal(cs.layoutFits('solo', 1), true); assert.equal(cs.layoutFits('solo', 2), false);
  assert.equal(cs.layoutFits('grid_2', 2), true); assert.equal(cs.layoutFits('grid_2', 3), false);
  assert.equal(cs.layoutFits('grid_4', 4), true); assert.equal(cs.layoutFits('spotlight', 4), true);
});
test('removeParticipant: host leaves → next takes over; last leaves → terminated; non-host keeps host', () => {
  assert.deepEqual(cs.removeParticipant(four, four, 'a', 'a').active_host, 'b');
  assert.equal(cs.removeParticipant(four, four, 'a', 'a').handoff_occurred, true);
  assert.equal(cs.removeParticipant(four, four, 'a', 'c').active_host, 'a');
  const t = cs.removeParticipant(['a'], ['a'], 'a', 'a');
  assert.equal(t.status, 'terminated'); assert.equal(t.active_host, null); assert.equal(t.handoff_occurred, false);
});
test('signature payload keys', () => {
  const p = cs.sigPayload({ active_host: null, handoff_occurred: false, layout: 'grid_4', participant_count: 0, session_id: 's', status: 'terminated', extra: 1 });
  assert.deepEqual(Object.keys(p).sort(), ['active_host', 'handoff_occurred', 'layout', 'participant_count', 'session_id', 'status']);
});
