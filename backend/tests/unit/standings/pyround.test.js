'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { pyround } = require('../../../src/lib/pyround');
const { sha256Hex } = require('../../../src/lib/hash');

test('BR-STAND-02 pyround matches Python round(x, 3)', () => {
  // Expected values generated with CPython: round(x, 3).
  const cases = [[0.0625, 0.062], [0.1875, 0.188], [0.3125, 0.312], [1.0005, 1.0], [2.0005, 2.001], [-0.0625, -0.062],
    [1.23456, 1.235], [1.2344, 1.234], [-1.5555, -1.556], [0.0005, 0.001], [0.0015, 0.002], [2 / 3, 0.667], [-2 / 3, -0.667],
    [5.0005, 5.0], [3.1415926, 3.142], [0.5625, 0.562], [1e-9, 0], [123456.0005, 123456.0], [0, 0], [10, 10]];
  for (const [x, want] of cases) assert.strictEqual(pyround(x, 3), want, `round(${x},3)`);
});

test('BR-STAND-04 App. A vector 2: draw_lots keys for seed 42 / lg-1', () => {
  const key = (t) => sha256Hex(`42|lg-1|${t}`);
  assert.ok(key('t1').startsWith('0613'));
  assert.ok(key('t3').startsWith('c8f2'));
  assert.ok(key('t2').startsWith('e3e3'));
  assert.deepStrictEqual(['t1', 't2', 't3'].sort((a, b) => (key(a) < key(b) ? -1 : 1)), ['t1', 't3', 't2']);
});
