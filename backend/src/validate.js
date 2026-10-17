'use strict';
// REQ-INF-02: strict, hand-written validator (ADR-004). Runs before any DB or cache call and
// reports every problem at once as 400 VALIDATION_ERROR with details[].
const { validationError } = require('./errors');

const INT_MAX = 2147483647;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function typeOk(type, v) {
  switch (type) {
    case 'string': return typeof v === 'string';
    case 'integer': return Number.isInteger(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    case 'array': return Array.isArray(v);
    case 'object': return isPlainObject(v);
    default: return false;
  }
}

function coerceValue(type, v) {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if ((type === 'integer' || type === 'number') && /^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (type === 'boolean' && (s === 'true' || s === 'false')) return s === 'true';
  return v;
}

function validate(schema, data, { source = 'body', coerce = source !== 'body', strict = false } = {}) {
  if (source === 'body' && !isPlainObject(data)) throw validationError([{ field: 'body', issue: 'must be a JSON object' }], 'Body must be a JSON object');
  const input = isPlainObject(data) ? data : {};
  const out = {};
  const details = [];
  const fail = (field, issue) => details.push({ field, issue });

  if (strict) for (const k of Object.keys(input)) if (!(k in schema)) fail(k, 'is not allowed');

  for (const [field, rule] of Object.entries(schema)) {
    let v = input[field];
    if (coerce) v = coerceValue(rule.type, v);
    if (typeof v === 'string' && rule.trim !== false) v = v.trim();
    if (source !== 'body' && v === '') v = undefined; // ?q= behaves like an absent param
    const empty = v === undefined || v === null || (v === '' && rule.type === 'string');
    if (empty) {
      if (v === null && rule.nullable) out[field] = null;
      else if (rule.required) fail(field, v === undefined ? 'is required' : 'must not be empty');
      else if (v === null || v === '') fail(field, 'must not be empty');
      else if (rule.default !== undefined) out[field] = rule.default;
      continue;
    }
    if (!typeOk(rule.type, v)) { fail(field, `must be of type ${rule.type}`); continue; }
    const len = typeof v === 'string' || Array.isArray(v) ? v.length : null;
    if (rule.minLength !== undefined && len !== null && len < rule.minLength) fail(field, `must be at least ${rule.minLength} characters`);
    else if (rule.maxLength !== undefined && len !== null && len > rule.maxLength) fail(field, `must be at most ${rule.maxLength} characters`);
    else if (rule.min !== undefined && typeof v === 'number' && v < rule.min) fail(field, `must be >= ${rule.min}`);
    else if (rule.max !== undefined && typeof v === 'number' && v > rule.max) fail(field, `must be <= ${rule.max}`);
    else if (rule.enum && !rule.enum.includes(v)) fail(field, `must be one of: ${rule.enum.join(', ')}`);
    else if (rule.pattern && typeof v === 'string' && !rule.pattern.test(v)) fail(field, 'has an invalid format');
    else out[field] = v;
  }

  if (details.length) throw validationError(details);
  return out;
}

// Ready-made schemas. Malformed id -> 400 here; well-formed but missing -> 404 in the route.
const idParam = { id: { type: 'integer', required: true, min: 1, max: INT_MAX } };
const paginationQuery = {
  limit: { type: 'integer', min: 1, max: 100, default: 20 },
  offset: { type: 'integer', min: 0, max: INT_MAX, default: 0 },
};

module.exports = { validate, idParam, paginationQuery, INT_MAX };
