'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validate, validateOptional, t } = require('../../src/http/validate');
const { AppError } = require('../../src/errors');

function fields(fn) {
  try { fn(); } catch (err) {
    assert.ok(err instanceof AppError);
    assert.strictEqual(err.status, 400);
    assert.strictEqual(err.code, 'VALIDATION_ERROR');
    return err.details.fields;
  }
  assert.fail('expected throw');
}

test('FR-SYS validate: int is strict (no 2.0 string, no bool)', () => {
  const s = { n: t.int({ required: true }) };
  assert.deepStrictEqual(validate(s, { n: 2 }), { n: 2 });
  assert.deepStrictEqual(fields(() => validate(s, { n: '2' })), ['n']);
  assert.deepStrictEqual(fields(() => validate(s, { n: true })), ['n']);
  assert.deepStrictEqual(fields(() => validate(s, { n: 1.5 })), ['n']);
});

test('validate collects ALL offending fields with dotted paths', () => {
  const s = {
    a: t.id({ required: true }),
    periods: t.object({ count: t.int({ required: true, min: 1 }) }, { required: true }),
    items: t.array(t.object({ quantity: t.int({ min: 1, required: true }) }), { required: true, min: 1 }),
  };
  const f = fields(() => validate(s, { a: 'bad|id', periods: { count: 0 }, items: [{ quantity: 1 }, { quantity: 0 }] }));
  assert.deepStrictEqual(f.sort(), ['a', 'items[1].quantity', 'periods.count']);
});

test('unknown fields are ignored and dropped; defaults applied; null only if nullable', () => {
  const s = { x: t.string({ default: 'd' }), y: t.string({ nullable: true }) };
  assert.deepStrictEqual(validate(s, { x: undefined, y: null, extra: 1 }), { x: 'd', y: null });
  assert.deepStrictEqual(fields(() => validate({ z: t.string() }, { z: null })), ['z']);
});

test('date and timestamp must be real calendar values', () => {
  const s = { d: t.date({ required: true }), ts: t.timestamp({ required: true }) };
  validate(s, { d: '2026-02-28', ts: '2026-10-17T11:20:05Z' });
  assert.deepStrictEqual(fields(() => validate(s, { d: '2026-02-30', ts: '2026-10-17T11:20:05.000Z' })), ['d', 'ts']);
});

test('map values and key pattern; id regex rejects pipe and long ids', () => {
  const s = { stock: t.map(t.int({ min: 0 })), id: t.id() };
  assert.deepStrictEqual(fields(() => validate(s, { stock: { v1: -1 }, id: 'a'.repeat(65) })), ['stock.v1', 'id']);
});

test('non-object body fails on "body"; optional body accepts undefined', () => {
  assert.deepStrictEqual(fields(() => validate({}, [])), ['body']);
  assert.deepStrictEqual(validateOptional({ s: t.int() }, undefined), {});
});
