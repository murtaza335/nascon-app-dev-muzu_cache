'use strict';
// Offline-sync envelope + per-action resolution (FR-OFF-01, BR-SYNC-01/02). Pure.
const { E } = require('../../errors');
const { check, t } = require('../../lib/validate');

const ENVELOPE = {
  device_id: t.id({ required: true }),
  actions: t.array(t.object({
    action_id: t.id({ required: true }),
    type: t.enum(['score_event', 'roster_transfer'], { required: true }),
    queued_at: t.timestamp({ required: true }),
    base_version: t.int({ required: true, min: 0 }),
    payload: t.object({}, { required: true }),
  }), { required: true, min: 1, max: 100 }),
};

// Only a malformed envelope is a 400; everything else is reported per action.
function validateEnvelope(input) {
  const r = check(ENVELOPE, input);
  if (!r.ok) return { ok: false, error: E.VALIDATION_ERROR, details: { fields: r.fields } };
  // The envelope only checks that payload is an object; the payload itself is validated per action, so keep it whole.
  r.value.actions.forEach((a, i) => { a.payload = input.actions[i].payload; });
  return { ok: true, value: r.value };
}

// Indexes into `actions` in processing order: queued_at ascending, ties by array order.
function processingOrder(actions) {
  return actions.map((a, i) => i).sort((i, j) => (actions[i].queued_at < actions[j].queued_at ? -1 : actions[i].queued_at > actions[j].queued_at ? 1 : i - j));
}

// base_version vs current version → applied resolution, or null when base_version is ahead of the server.
function appliedResolution(baseVersion, currentVersion) {
  if (baseVersion > currentVersion) return null;
  return baseVersion === currentVersion ? 'appended' : 'rebased_append';
}

const result = (action, order, fields) => ({
  action_id: action.action_id, status: fields.status, resolution: fields.resolution, error_code: fields.error_code ?? null,
  processed_order: order, server_version: fields.server_version, signature: fields.signature ?? null,
});

const applied = (action, order, resolution, version, signature) => result(action, order, { status: 'applied', resolution, server_version: version, signature });
const rejected = (action, order, code, version) => result(action, order, { status: 'rejected', resolution: 'server_wins', error_code: code, server_version: version });
const duplicate = (action, order, version) => result(action, order, { status: 'duplicate', resolution: 'skipped_duplicate', server_version: version });

function summarize(results) {
  const s = { applied: 0, rejected: 0, duplicate: 0 };
  for (const r of results) s[r.status] += 1;
  return s;
}

module.exports = { validateEnvelope, processingOrder, appliedResolution, applied, rejected, duplicate, summarize };
