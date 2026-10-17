'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { E, formatError, AppError } = require('../../src/errors');

test('error envelope always has code, message and object details', () => {
  assert.deepStrictEqual(formatError('X', 'm'), { error: { code: 'X', message: 'm', details: {} } });
  assert.deepStrictEqual(formatError('X', 'm', [1]).error.details, {});
});

test('Appendix B catalogue statuses', () => {
  assert.strictEqual(E.OUT_OF_STOCK.status, 409);
  assert.strictEqual(E.PAYMENT_DECLINED.status, 402);
  assert.strictEqual(E.PAYLOAD_TOO_LARGE.status, 413);
  assert.strictEqual(E.RATE_LIMITED.status, 429);
  const e = new AppError(E.VARIANT_NOT_FOUND, { variant_id: 'v' });
  assert.deepStrictEqual([e.status, e.code, e.details], [404, 'VARIANT_NOT_FOUND', { variant_id: 'v' }]);
});
