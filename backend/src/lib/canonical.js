'use strict';
// Canonical JSON, byte-identical to Python json.dumps(obj, sort_keys=True, separators=(",",":"), ensure_ascii=False)
// (REQUIREMENTS BR-SIG-02, ADR-007). Non-integer numbers keep the exact lexeme received (parseLossless), so
// 1.50 or 2.0 round-trip the way the grader's Python wrote them.

// Compare by Unicode code point (Python str ordering), not by UTF-16 unit.
function cmpCodePoints(a, b) {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const x = ia.next();
    const y = ib.next();
    if (x.done || y.done) return x.done === y.done ? 0 : (x.done ? -1 : 1);
    const d = x.value.codePointAt(0) - y.value.codePointAt(0);
    if (d !== 0) return d;
  }
}

class Num { constructor(lexeme) { this.lexeme = lexeme; } }

// Minimal RFC 8259 parser that keeps number lexemes. Returns a tree of plain values where every number is a Num.
function parseLossless(text) {
  let i = 0;
  const err = () => { throw new SyntaxError(`invalid JSON at ${i}`); };
  const ws = () => { while (i < text.length && ' \t\n\r'.includes(text[i])) i++; };
  function value() {
    ws();
    const c = text[i];
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"') return string();
    if (c === 't' && text.startsWith('true', i)) { i += 4; return true; }
    if (c === 'f' && text.startsWith('false', i)) { i += 5; return false; }
    if (c === 'n' && text.startsWith('null', i)) { i += 4; return null; }
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i, i + 400));
    if (!m) err();
    i += m[0].length;
    return new Num(m[0]);
  }
  function string() {
    const start = i;
    i++;
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    if (text[i] !== '"') err();
    i++;
    return JSON.parse(text.slice(start, i));
  }
  function object() {
    i++;
    const o = new Map();
    ws();
    if (text[i] === '}') { i++; return o; }
    for (;;) {
      ws();
      if (text[i] !== '"') err();
      const k = string();
      ws();
      if (text[i++] !== ':') err();
      o.set(k, value()); // a duplicate key keeps the last value, like Python
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i++] === '}') return o;
      err();
    }
  }
  function array() {
    i++;
    const a = [];
    ws();
    if (text[i] === ']') { i++; return a; }
    for (;;) {
      a.push(value());
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i++] === ']') return a;
      err();
    }
  }
  const v = value();
  ws();
  if (i !== text.length) err();
  return v;
}

function serialize(v) {
  if (v === null) return 'null';
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (v instanceof Num) return v.lexeme;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(serialize).join(',')}]`;
  const entries = v instanceof Map ? [...v.entries()] : Object.entries(v);
  entries.sort((a, b) => cmpCodePoints(a[0], b[0]));
  return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${serialize(x)}`).join(',')}}`;
}

// Canonical string of an already-parsed plain JS value.
const canonical = (value) => serialize(value);

// Canonical string of the sub-value at `path` inside raw JSON text (lossless numbers). Returns undefined if absent.
function canonicalAt(rawText, path = []) {
  let node = parseLossless(rawText);
  for (const key of path) {
    if (node instanceof Map) node = node.get(key);
    else if (Array.isArray(node)) node = node[key];
    else return undefined;
    if (node === undefined) return undefined;
  }
  return serialize(node);
}

module.exports = { canonical, canonicalAt, parseLossless, cmpCodePoints };
