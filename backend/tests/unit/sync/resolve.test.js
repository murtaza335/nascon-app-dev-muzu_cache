'use strict';
const test = require('node:test');
const assert = require('node:assert');
const r = require('../../../src/domain/sync/resolve');

const act = (id, at, extra = {}) => ({ action_id: id, type: 'score_event', queued_at: at, base_version: 0, payload: {}, ...extra });

test('FR-OFF-01 envelope: 1..100 actions, typed fields, device id; unknown fields ignored', () => {
  const ok = r.validateEnvelope({ device_id: 'd', actions: [act('a', '2026-10-17T11:00:00Z', { payload: { keep: { deep: 1 } } })], junk: 1 });
  assert.ok(ok.ok);
  assert.deepStrictEqual(ok.value.actions[0].payload, { keep: { deep: 1 } });
  const f = (input) => { const x = r.validateEnvelope(input); assert.strictEqual(x.ok, false); return x.details.fields.sort(); };
  assert.deepStrictEqual(f({}), ['actions', 'device_id']);
  assert.deepStrictEqual(f({ device_id: 'd', actions: [] }), ['actions']);
  assert.deepStrictEqual(f({ device_id: 'd', actions: Array.from({ length: 101 }, (_, i) => act(`a${i}`, '2026-10-17T11:00:00Z')) }), ['actions']);
  assert.ok(r.validateEnvelope({ device_id: 'd', actions: Array.from({ length: 100 }, (_, i) => act(`a${i}`, '2026-10-17T11:00:00Z')) }).ok);
  assert.deepStrictEqual(f({ device_id: 'd', actions: [act('a', '2026-10-17 11:00:00')] }), ['actions[0].queued_at']);
  assert.deepStrictEqual(f({ device_id: 'd', actions: [act('a', '2026-10-17T11:00:00Z', { type: 'nope', base_version: -1, payload: [] })] }), ['actions[0].base_version', 'actions[0].payload', 'actions[0].type']);
  assert.deepStrictEqual(f({ device_id: 'd', actions: [act('a', '2026-10-17T11:00:00Z', { base_version: 1.5 })] }), ['actions[0].base_version']);
});

test('BR-SYNC-02 processing order: queued_at ascending, ties keep array order', () => {
  const a = [act('c', '2026-10-17T11:02:00Z'), act('a', '2026-10-17T11:00:00Z'), act('b', '2026-10-17T11:00:00Z'), act('d', '2026-10-17T10:59:59Z')];
  assert.deepStrictEqual(r.processingOrder(a), [3, 1, 2, 0]);
});

test('BR-SYNC-01 applied resolution: equal → appended, stale → rebased_append, ahead → null', () => {
  assert.strictEqual(r.appliedResolution(3, 3), 'appended');
  assert.strictEqual(r.appliedResolution(1, 3), 'rebased_append');
  assert.strictEqual(r.appliedResolution(0, 0), 'appended');
  assert.strictEqual(r.appliedResolution(4, 3), null);
});

test('API-17 result shapes and summary', () => {
  const a = act('a1', '2026-10-17T11:00:00Z');
  const res = [r.applied(a, 1, 'appended', 5, 'sig'), r.rejected(a, 2, 'SQUAD_FULL', 1), r.duplicate(a, 3, 5)];
  assert.deepStrictEqual(Object.keys(res[0]), ['action_id', 'status', 'resolution', 'error_code', 'processed_order', 'server_version', 'signature']);
  assert.deepStrictEqual(res[0], { action_id: 'a1', status: 'applied', resolution: 'appended', error_code: null, processed_order: 1, server_version: 5, signature: 'sig' });
  assert.deepStrictEqual([res[1].status, res[1].resolution, res[1].error_code, res[1].signature], ['rejected', 'server_wins', 'SQUAD_FULL', null]);
  assert.deepStrictEqual([res[2].status, res[2].resolution, res[2].error_code], ['duplicate', 'skipped_duplicate', null]);
  assert.deepStrictEqual(r.summarize(res), { applied: 1, rejected: 1, duplicate: 1 });
});
