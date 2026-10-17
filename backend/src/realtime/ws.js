'use strict';
// RT-01: WebSocket hub on GET /api/v1/ws?token=<jwt>. In-process topic registry (single API instance, ADR-013).
// Client → server: {"type":"subscribe"|"unsubscribe","topic":"match:<id>"|"league:<id>"|"store:<tenant_id>"}.
// Server → client: event frames from services/hooks.js, plus {"type":"subscribed"|"unsubscribed"|"error",...}.
const { WebSocketServer } = require('ws');
const { E } = require('../errors');
const auth = require('../services/auth');
const { authorize } = require('../domain/rbac/policy');
const appRepo = require('../repos/app');
const leaguesRepo = require('../repos/leagues');

const TOPIC_RE = /^(match|league|store):([A-Za-z0-9_.:-]{1,64})$/;
const MAX_TOPICS = 50;
const PING_MS = 25000;

function createHub() {
  const topics = new Map(); // topic → Set<ws>
  let wss = null;
  let timer = null;

  const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };

  function publish(topic, message) {
    const subs = topics.get(topic);
    if (!subs) return;
    const text = JSON.stringify(message);
    for (const ws of subs) if (ws.readyState === 1) ws.send(text);
  }

  // → null when allowed, else an error code. Tenant isolation applies to every subscription.
  async function authorizeTopic(principal, kind, id) {
    if (kind === 'match') {
      const m = await appRepo.matchWithTenant(id);
      if (!m) return E.MATCH_NOT_FOUND.code;
      return authorize(principal, 'match.read', { tenant_id: m.tenant_id }) ? null : E.FORBIDDEN.code;
    }
    if (kind === 'league') {
      const l = await leaguesRepo.getLeague(id);
      if (!l) return E.LEAGUE_NOT_FOUND.code;
      return authorize(principal, 'league.read', { tenant_id: l.tenant_id }) ? null : E.FORBIDDEN.code;
    }
    return authorize(principal, 'store.read', { tenant_id: id }) ? null : E.FORBIDDEN.code;
  }

  async function onMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw.toString('utf8')); } catch { return send(ws, { type: 'error', code: E.VALIDATION_ERROR.code, message: 'Invalid JSON' }); }
    const m = msg && typeof msg.topic === 'string' ? TOPIC_RE.exec(msg.topic) : null;
    if (!msg || !['subscribe', 'unsubscribe'].includes(msg.type) || !m) {
      return send(ws, { type: 'error', code: E.VALIDATION_ERROR.code, message: 'Expected {"type":"subscribe|unsubscribe","topic":"match:<id>|league:<id>"}', topic: msg && msg.topic });
    }
    if (msg.type === 'unsubscribe') {
      ws.topics.delete(msg.topic);
      if (topics.has(msg.topic)) { topics.get(msg.topic).delete(ws); if (!topics.get(msg.topic).size) topics.delete(msg.topic); }
      return send(ws, { type: 'unsubscribed', topic: msg.topic });
    }
    if (ws.topics.size >= MAX_TOPICS && !ws.topics.has(msg.topic)) return send(ws, { type: 'error', code: E.RATE_LIMITED.code, message: 'Too many subscriptions', topic: msg.topic });
    const denied = await authorizeTopic(ws.principal, m[1], m[2]);
    if (denied) return send(ws, { type: 'error', code: denied, message: 'Cannot subscribe to that topic', topic: msg.topic });
    if (!topics.has(msg.topic)) topics.set(msg.topic, new Set());
    topics.get(msg.topic).add(ws);
    ws.topics.add(msg.topic);
    return send(ws, { type: 'subscribed', topic: msg.topic });
  }

  function attach(server) {
    wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
    server.on('upgrade', (req, socket, head) => {
      let url;
      try { url = new URL(req.url, 'http://x'); } catch { return socket.destroy(); }
      if (url.pathname !== '/api/v1/ws') return socket.destroy();
      wss.handleUpgrade(req, socket, head, (ws) => {
        const claims = auth.verifyToken(url.searchParams.get('token') || '');
        if (!claims) return ws.close(4401, 'unauthenticated'); // invalid token closes with 4401
        ws.principal = auth.principalFromClaims(claims);
        ws.topics = new Set();
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        ws.on('message', (raw) => { onMessage(ws, raw).catch((err) => { console.error('[ws] handler error', err.message); send(ws, { type: 'error', code: E.INTERNAL_ERROR.code, message: 'Internal error' }); }); });
        ws.on('close', () => {
          for (const t of ws.topics) { const s = topics.get(t); if (s) { s.delete(ws); if (!s.size) topics.delete(t); } }
        });
        ws.on('error', () => {});
        send(ws, { type: 'hello', user_id: ws.principal.user_id });
      });
    });
    timer = setInterval(() => {
      for (const ws of wss.clients) {
        if (ws.isAlive === false) { ws.terminate(); continue; }
        ws.isAlive = false;
        try { ws.ping(); } catch { /* socket closing */ }
      }
    }, PING_MS);
    timer.unref();
  }

  function close() {
    if (timer) clearInterval(timer);
    if (wss) for (const ws of wss.clients) ws.terminate();
  }

  return { attach, publish, close, _topics: topics };
}

module.exports = { createHub };
