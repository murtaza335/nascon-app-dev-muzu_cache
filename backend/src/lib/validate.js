'use strict';
// Declarative request validator (REQUIREMENTS §7, ARCHITECTURE §7.2).
// Collects ALL failing fields (dotted paths), ignores and drops unknown fields, keeps integers strict.
const { validationError } = require('../errors');

const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function realDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isDate(s) {
  const m = typeof s === 'string' && DATE_RE.exec(s);
  return !!m && realDate(+m[1], +m[2], +m[3]);
}

function isTimestamp(s) {
  const m = typeof s === 'string' && TS_RE.exec(s);
  return !!m && realDate(+m[1], +m[2], +m[3]) && +m[4] < 24 && +m[5] < 60 && +m[6] < 60;
}

// Returns true when the value matches the node's type and constraints.
function checkLeaf(node, v) {
  switch (node.type) {
    case 'id': return typeof v === 'string' && ID_RE.test(v);
    case 'string':
      return typeof v === 'string' && (node.min === undefined || v.length >= node.min)
        && (node.max === undefined || v.length <= node.max) && (!node.pattern || node.pattern.test(v));
    case 'int':
      return Number.isInteger(v) && (node.min === undefined || v >= node.min) && (node.max === undefined || v <= node.max)
        && (!node.odd || v % 2 === 1);
    case 'number':
      return typeof v === 'number' && Number.isFinite(v) && (node.min === undefined || v >= node.min)
        && (node.max === undefined || v <= node.max);
    case 'bool': return typeof v === 'boolean';
    case 'enum': return node.values.includes(v);
    case 'date': return isDate(v);
    case 'timestamp': return isTimestamp(v);
    case 'any': return true;
    default: return false;
  }
}

function walk(node, v, path, out, fields) {
  switch (node.type) {
    case 'object': {
      if (!isObj(v)) { fields.push(path); return undefined; }
      const res = {};
      for (const [k, child] of Object.entries(node.shape)) {
        const p = path ? `${path}.${k}` : k;
        const cv = v[k];
        if (cv === undefined) {
          if (child.default !== undefined) res[k] = typeof child.default === 'function' ? child.default() : child.default;
          else if (child.required) fields.push(p);
          continue;
        }
        if (cv === null) {
          if (child.nullable) res[k] = null;
          else fields.push(p);
          continue;
        }
        const r = walk(child, cv, p, out, fields);
        if (r !== undefined) res[k] = r;
      }
      return res;
    }
    case 'array': {
      if (!Array.isArray(v) || (node.min !== undefined && v.length < node.min) || (node.max !== undefined && v.length > node.max)) {
        fields.push(path); return undefined;
      }
      const res = [];
      const scalarItems = !['object', 'array', 'map'].includes(node.items.type);
      v.forEach((item, i) => {
        // Scalar items are reported as the array's own path; structured items as items[i].field.
        const p = scalarItems ? path : `${path}[${i}]`;
        if (item === null) { fields.push(p); return; }
        const r = walk(node.items, item, p, out, fields);
        if (r !== undefined) res.push(r);
      });
      if (node.unique && new Set(res.map((x) => (isObj(x) ? JSON.stringify(x) : x))).size !== res.length) fields.push(path);
      return res;
    }
    case 'map': {
      if (!isObj(v) || (node.minKeys !== undefined && Object.keys(v).length < node.minKeys)) { fields.push(path); return undefined; }
      const res = {};
      for (const [k, item] of Object.entries(v)) {
        const p = `${path}.${k}`;
        if (node.keyPattern && !node.keyPattern.test(k)) { fields.push(p); continue; }
        if (item === null) { fields.push(p); continue; }
        const r = walk(node.values, item, p, out, fields);
        if (r !== undefined) res[k] = r;
      }
      return res;
    }
    default:
      if (!checkLeaf(node, v)) { fields.push(path); return undefined; }
      return v;
  }
}

// Convenience builders so route schemas stay short.
const t = {
  id: (o = {}) => ({ type: 'id', ...o }),
  string: (o = {}) => ({ type: 'string', ...o }),
  int: (o = {}) => ({ type: 'int', ...o }),
  number: (o = {}) => ({ type: 'number', ...o }),
  bool: (o = {}) => ({ type: 'bool', ...o }),
  enum: (values, o = {}) => ({ type: 'enum', values, ...o }),
  date: (o = {}) => ({ type: 'date', ...o }),
  timestamp: (o = {}) => ({ type: 'timestamp', ...o }),
  any: (o = {}) => ({ type: 'any', ...o }),
  object: (shape, o = {}) => ({ type: 'object', shape, ...o }),
  array: (items, o = {}) => ({ type: 'array', items, ...o }),
  map: (values, o = {}) => ({ type: 'map', values, ...o }),
};

// Pure form: {ok:true, value} | {ok:false, fields}. Used by domain code, which never throws HTTP errors.
function check(shape, data) {
  if (!isObj(data)) return { ok: false, fields: ['body'] };
  const fields = [];
  const value = walk({ type: 'object', shape }, data, '', null, fields);
  return fields.length ? { ok: false, fields: [...new Set(fields)] } : { ok: true, value };
}

// Returns the cleaned value or throws 400 VALIDATION_ERROR with every offending field.
function validate(shape, data) {
  const r = check(shape, data);
  if (!r.ok) throw validationError(r.fields);
  return r.value;
}

// Optional body: undefined or null counts as {} (used by /reset, /rbac-matrix, probes).
function validateOptional(shape, data) {
  return validate(shape, data === undefined || data === null ? {} : data);
}

module.exports = { check, validate, validateOptional, t, isDate, isTimestamp, ID_RE };
