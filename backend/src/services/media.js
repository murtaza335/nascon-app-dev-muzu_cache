'use strict';
// Client for the media server control API (MediaMTX :9997). Every call is bounded and never throws:
// the media server being down must not break the API (only /health reports it).
const config = require('../config');

async function call(path, { method = 'GET', timeoutMs = 800 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${config.mediaApiUrl}${path}`, { method, signal: ctl.signal });
    if (!r.ok) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let healthMemo = { at: 0, ok: true };
// /health (spec §5.2): media API reachable, memoised 2 s so the probe stays cheap.
async function isHealthy() {
  if (!config.mediaCheckRequired) return true;
  const now = Date.now();
  if (now - healthMemo.at < 2000) return healthMemo.ok;
  const ok = (await call('/v3/paths/list', { timeoutMs: 500 })) !== null;
  healthMemo = { at: now, ok };
  return ok;
}

// Severs every session that publishes on live/{key} (FR-3.2-03). Best effort, bounded to ~1 s overall.
async function kickPath(name) {
  const info = await call(`/v3/paths/get/${encodeURIComponent(name)}`, { timeoutMs: 500 });
  if (!info || !info.source) return false;
  const kinds = { rtmpConn: 'rtmpconns', rtmpsConn: 'rtmpsconns', webRTCSession: 'webrtcsessions', rtspSession: 'rtspsessions', srtConn: 'srtconns' };
  const kind = kinds[info.source.type];
  if (!kind) return false;
  return (await call(`/v3/${kind}/kick/${info.source.id}`, { method: 'POST', timeoutMs: 500 })) !== null;
}

async function listPaths() {
  const r = await call('/v3/paths/list', { timeoutMs: 800 });
  return r && Array.isArray(r.items) ? r.items : [];
}

// Snapshot polled every 2 s (ARCHITECTURE §4); /metrics never waits on the media server.
const snapshot = { ready: 0, bitrateKbps: 0, perStream: new Map() };
let last = { at: 0, bytes: new Map() };
let timer = null;

async function poll() {
  const items = (await listPaths()).filter((p) => p.ready && p.name.startsWith('live/'));
  const now = Date.now();
  const bytes = new Map(items.map((p) => [p.name, p.inboundBytes ?? p.bytesReceived ?? 0]));
  const dt = (now - last.at) / 1000;
  let total = 0;
  const per = new Map();
  for (const [name, b] of bytes) {
    const prev = last.bytes.get(name);
    const kbps = prev !== undefined && dt > 0 ? Math.max(0, Math.round(((b - prev) * 8) / dt / 1000)) : 0;
    per.set(name, kbps);
    total += kbps;
  }
  last = { at: now, bytes };
  snapshot.ready = items.length; snapshot.bitrateKbps = total; snapshot.perStream = per;
}

function startPolling() {
  if (timer || !config.mediaCheckRequired) return;
  timer = setInterval(() => poll().catch(() => {}), 2000);
  timer.unref();
}

module.exports = { isHealthy, kickPath, listPaths, snapshot, startPolling, poll };
