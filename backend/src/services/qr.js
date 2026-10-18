'use strict';
// FR-4.1 / API-D2-05..07. The inspect path does no DB round-trip once warm (day2Cache); target_route and signature are
// recomputed on every read from the live status (EC-2), short_url never changes.
const config = require('../config');
const { pool, withTx } = require('../db');
const { AppError, E } = require('../errors');
const { sign2 } = require('../lib/signature');
const { shortUrl, auditQr } = require('../lib/urls');
const rules = require('../domain/qr/route');
const encoder = require('../domain/qr/encoder');
const render = require('../domain/qr/render');
const repo = require('../repos/qr');
const cache = require('./day2Cache');
const { getScore } = require('./score');

const notFound = (id) => new AppError(E.QR_NOT_FOUND, { entity_id: id });

// Creates the mapping inside an open transaction (used by co-stream creation) and warms the cache after.
async function ensureCode(client, entityId, type) {
  await repo.insertIfAbsent(client, entityId, rules.shortCodeFor(config.day2Salt, entityId), type);
}

async function entry(entityId) {
  const hit = cache.qr.get(entityId);
  if (hit) return hit;
  const type = rules.entityType(entityId);
  if (!type) throw notFound(entityId);
  let row = await repo.byEntity(entityId);
  if (!row) {
    if (!(await repo.entityExists(type, entityId))) throw notFound(entityId);
    await ensureCode(pool, entityId, type);
    row = await repo.byEntity(entityId);
  }
  const e = { short_code: row.short_code, entity_type: row.entity_type, scan_count: row.scan_count };
  cache.qr.set(entityId, e);
  return e;
}

async function statusOf(entityId, type) {
  if (type === 'player' || type === 'club') return 'active';
  const hit = cache.matchStatus.get(entityId);
  if (hit) return hit;
  let status;
  if (type === 'match') status = (await getScore(entityId)).status;
  else status = (await repo.costreamStatus(entityId)) || 'terminated';
  cache.matchStatus.set(entityId, status);
  return status;
}

async function incrementScan(entityId, ua) {
  const n = await withTx((client) => repo.recordScan(client, entityId, rules.deviceFamily(ua)));
  const e = cache.qr.get(entityId);
  if (e) e.scan_count = Math.max(e.scan_count, n);
  cache.state.qrScansTotal += 1;
  return n;
}

function build(entityId, e, status, scanCount) {
  const url = shortUrl(e.short_code);
  const route = rules.targetRoute(e.entity_type, entityId, status);
  const base = auditQr(entityId);
  return {
    entity_id: entityId, entity_type: e.entity_type, entity_status: status, short_url: url, target_route: route,
    deep_link_uri: `nascon://entity/${entityId}`, scan_count: scanCount,
    export_formats: { svg: `${base}/export.svg`, png: `${base}/export.png`, pdf: `${base}/export.pdf` },
    signature: sign2(entityId, rules.sigPayload(entityId, url, route)),
  };
}

async function resolve(entityId, { inspect = false, ua = '' } = {}) {
  const e = await entry(entityId);
  const status = await statusOf(entityId, e.entity_type);
  const count = inspect ? e.scan_count : await incrementScan(entityId, ua);
  return build(entityId, e, status, count);
}

// GET /q/{code}: the target is evaluated at the moment of the scan.
async function followShortCode(code, ua) {
  let entityId = null;
  for (const [id, e] of cache.qr) if (e.short_code === code) { entityId = id; break; }
  if (!entityId) {
    const row = await repo.byCode(code);
    if (!row) throw new AppError(E.QR_NOT_FOUND, { short_code: code });
    entityId = row.entity_id;
  }
  const e = await entry(entityId);
  const status = await statusOf(entityId, e.entity_type);
  await incrementScan(entityId, ua);
  return rules.targetRoute(e.entity_type, entityId, status);
}

const matrices = new Map(); // short_url → QR matrix (pure function of the URL)
async function exportQr(entityId, fmt) {
  if (!['svg', 'png', 'pdf'].includes(fmt)) throw new AppError(E.ROUTE_NOT_FOUND);
  const e = await entry(entityId);
  const url = shortUrl(e.short_code);
  let qr = matrices.get(url);
  if (!qr) { qr = encoder.encodeText(url); matrices.set(url, qr); }
  if (fmt === 'svg') return { type: 'image/svg+xml', body: Buffer.from(render.svg(qr, url), 'utf8') };
  if (fmt === 'png') return { type: 'image/png', body: render.png(qr) };
  return { type: 'application/pdf', body: render.pdf(qr, { entityId, shortUrl: url }) };
}

// After-commit hook: a match/session status changed, so the next read recomputes the target (EC-2).
const statusChanged = (entityId) => cache.matchStatus.delete(entityId);

module.exports = { ensureCode, resolve, followShortCode, exportQr, statusChanged };
