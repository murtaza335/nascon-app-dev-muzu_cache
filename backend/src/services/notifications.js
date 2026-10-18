'use strict';
// API-D2-47 / FR-5.2-01: publish on the user's realtime topic; failed delivery goes through bounded retry and the DLQ.
const crypto = require('node:crypto');
const { AppError, E, validationError } = require('../errors');
const { check, t } = require('../lib/validate');
const hooks = require('./hooks');
const dlq = require('./dlq');

async function sendTest(principal, input) {
  if (principal.role !== 'super_admin') throw new AppError(E.FORBIDDEN);
  const c = check({ topic: t.string({ required: true, min: 1, max: 100 }), target_user_id: t.string({ required: true, min: 1 }), simulate_dlq: t.bool({ default: false }) }, input);
  if (!c.ok) throw validationError(c.fields);
  const id = `notif-${crypto.randomBytes(6).toString('hex')}`;
  const payload = { type: c.value.topic, notification_id: id };
  if (c.value.simulate_dlq) await dlq.simulateFailures(1, c.value.topic, c.value.target_user_id);
  else hooks.publish(`user:${c.value.target_user_id}`, payload);
  return { notification_id: id };
}

module.exports = { sendTest };
