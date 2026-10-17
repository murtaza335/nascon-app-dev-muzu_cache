'use strict';
const { AppError, E, validationError } = require('../errors');
const { authorize } = require('../domain/rbac/policy');

// 403 FORBIDDEN unless the policy allows (cross-tenant is always 403, never 404 — FR-5.1-01).
function must(principal, action, resource) {
  if (!authorize(principal, action, resource)) throw new AppError(E.FORBIDDEN);
}

// ?limit 1..100 (default 50), ?offset >= 0 (REQUIREMENTS §7). Returns {limit, offset} or throws 400.
function parsePage(query) {
  const bad = [];
  const num = (v, min, max, def, name) => {
    if (v === undefined) return def;
    if (typeof v !== 'string' || !/^\d{1,9}$/.test(v) || Number(v) < min || Number(v) > max) { bad.push(name); return def; }
    return Number(v);
  };
  const limit = num(query.limit, 1, 100, 50, 'limit');
  const offset = num(query.offset, 0, 1e9, 0, 'offset');
  if (bad.length) throw validationError(bad);
  return { limit, offset };
}

function page(rows, { limit, offset }) {
  return { data: rows.slice(offset, offset + limit), total: rows.length, limit, offset };
}

module.exports = { must, parsePage, page };
