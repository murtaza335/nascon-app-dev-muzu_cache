'use strict';
// REQ-INF-02: pure unit tests of the validator (no DB, no network).
const test = require('node:test');
const assert = require('node:assert');
const { validate, idParam, paginationQuery } = require('../src/validate');
const { AppError } = require('../src/errors');

const schema = {
  name: { type: 'string', required: true, minLength: 1, maxLength: 5 },
  qty: { type: 'integer', min: 0, max: 10, default: 0 },
  kind: { type: 'string', enum: ['a', 'b'] },
  code: { type: 'string', pattern: /^[A-Z]{3}$/ },
};

function fails(fn, field, issueRe) {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof AppError, 'expected AppError');
    assert.strictEqual(err.status, 400);
    assert.strictEqual(err.errorCode, 'VALIDATION_ERROR');
    if (field) {
      const d = err.details.find((x) => x.field === field);
      assert.ok(d, `expected a detail for ${field}, got ${JSON.stringify(err.details)}`);
      if (issueRe) assert.match(d.issue, issueRe);
    }
    return err;
  }
  assert.fail('expected validate() to throw');
}

test('req_inf02_valid_input_with_defaults', () => {
  assert.deepStrictEqual(validate(schema, { name: ' ab ' }), { name: 'ab', qty: 0 });
});

test('req_inf02_missing_required', () => fails(() => validate(schema, {}), 'name', /required/));
test('req_inf02_null_required', () => fails(() => validate(schema, { name: null }), 'name', /empty/));
test('req_inf02_wrong_type', () => fails(() => validate(schema, { name: 123 }), 'name', /string/));
test('req_inf02_empty_after_trim', () => fails(() => validate(schema, { name: '   ' }), 'name', /empty/));
test('req_inf02_too_long', () => fails(() => validate(schema, { name: 'abcdef' }), 'name', /at most/));
test('req_inf02_out_of_range_low', () => fails(() => validate(schema, { name: 'a', qty: -1 }), 'qty', />=/));
test('req_inf02_out_of_range_high', () => fails(() => validate(schema, { name: 'a', qty: 11 }), 'qty', /<=/));
test('req_inf02_float_is_not_integer', () => fails(() => validate(schema, { name: 'a', qty: 1.5 }), 'qty', /integer/));
test('req_inf02_numeric_string_not_coerced_in_body', () => fails(() => validate(schema, { name: 'a', qty: '3' }), 'qty', /integer/));
test('req_inf02_bad_enum', () => fails(() => validate(schema, { name: 'a', kind: 'c' }), 'kind', /one of/));
test('req_inf02_bad_pattern', () => fails(() => validate(schema, { name: 'a', code: 'abc' }), 'code', /format/));

test('req_inf02_body_must_be_object', () => {
  for (const body of [[], 'x', null, undefined, 42]) {
    const err = fails(() => validate(schema, body, { source: 'body' }));
    assert.strictEqual(err.message, 'Body must be a JSON object');
  }
});

test('req_inf02_unknown_fields_stripped', () => {
  assert.deepStrictEqual(validate(schema, { name: 'a', extra: 1 }), { name: 'a', qty: 0 });
});

test('req_inf02_unknown_fields_rejected_in_strict_mode', () => {
  fails(() => validate(schema, { name: 'a', extra: 1 }, { strict: true }), 'extra', /not allowed/);
});

test('req_inf02_multiple_errors_together', () => {
  const err = fails(() => validate(schema, { qty: 'x', kind: 'z' }));
  assert.deepStrictEqual(err.details.map((d) => d.field).sort(), ['kind', 'name', 'qty']);
});

test('req_inf02_query_coercion_and_pagination_defaults', () => {
  assert.deepStrictEqual(validate(paginationQuery, {}, { source: 'query' }), { limit: 20, offset: 0 });
  assert.deepStrictEqual(validate(paginationQuery, { limit: '5', offset: '10' }, { source: 'query' }), { limit: 5, offset: 10 });
  fails(() => validate(paginationQuery, { limit: '0' }, { source: 'query' }), 'limit');
  fails(() => validate(paginationQuery, { limit: '101' }, { source: 'query' }), 'limit');
  fails(() => validate(paginationQuery, { offset: '-1' }, { source: 'query' }), 'offset');
});

test('req_inf02_id_bounds', () => {
  assert.deepStrictEqual(validate(idParam, { id: '42' }, { source: 'params' }), { id: 42 });
  assert.deepStrictEqual(validate(idParam, { id: '2147483647' }, { source: 'params' }), { id: 2147483647 });
  for (const bad of ['abc', '0', '-1', '1.5', '2147483648', '99999999999', '']) {
    fails(() => validate(idParam, { id: bad }, { source: 'params' }), 'id');
  }
});
