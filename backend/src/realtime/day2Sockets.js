'use strict';
// Part II anonymous sockets: /ws/matches/{id} (RT-D2-01) and /ws/costream/{id} (RT-D2-03).
// Frames are published by services/hooks.js on topics `ws:match:{id}` / `ws:costream:{id}`.
const auth = require('../services/auth');
const { getScore } = require('../services/score');
const costreamRepo = require('../repos/costreams');
const costream = require('../services/costream');

const MATCH_RE = /^\/ws\/matches\/([^/]+)\/?$/;
const COSTREAM_RE = /^\/ws\/costream\/([^/]+)\/?$/;
const HOST_GRACE_MS = 1000;

const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const scoreText = (s) => `${s.home.score} - ${s.away.score}`;

const hostSockets = new Map(); // `${session}|${player}` → open socket count
const hostKey = (sid, pid) => `${sid}|${pid}`;

function track(ws, topic, hub) {
  ws.topics = new Set([topic]);
  hub._topics.set(topic, (hub._topics.get(topic) || new Set()).add(ws));
  ws.on('close', () => {
    const s = hub._topics.get(topic);
    if (s) { s.delete(ws); if (!s.size) hub._topics.delete(topic); }
  });
}

async function onMatch(ws, matchId, hub) {
  let score;
  try { score = await getScore(matchId); } catch { return ws.close(4404, 'match not found'); }
  track(ws, `ws:match:${matchId}`, hub);
  send(ws, { type: 'hello', match_id: matchId, score_text: scoreText(score), status: score.status, version: score.version });
}

async function onCostream(ws, sessionId, url, hub) {
  const row = await costreamRepo.get(sessionId);
  if (!row) return ws.close(4404, 'session not found');
  track(ws, `ws:costream:${sessionId}`, hub);
  send(ws, { type: 'hello', session: row.response });
  const claims = auth.verifyToken(url.searchParams.get('token') || '');
  const playerId = claims && claims.player_id;
  if (!playerId || row.active_host !== playerId) return;
  // A host connection: losing it without a reconnect inside the grace period is a host drop (FR-3.3-04).
  const key = hostKey(sessionId, playerId);
  hostSockets.set(key, (hostSockets.get(key) || 0) + 1);
  ws.on('close', () => {
    hostSockets.set(key, hostSockets.get(key) - 1);
    setTimeout(() => {
      if ((hostSockets.get(key) || 0) > 0) return;
      hostSockets.delete(key);
      costream.dropParticipant(sessionId, playerId).catch((err) => console.error('[costream] drop failed:', err.message));
    }, HOST_GRACE_MS).unref();
  });
}

function accept({ wss, req, socket, head, url, hub }) {
  const m = MATCH_RE.exec(url.pathname);
  const c = COSTREAM_RE.exec(url.pathname);
  if (!m && !c) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.isAlive = true;
    ws.lastPong = Date.now();
    ws.on('pong', () => { ws.isAlive = true; ws.lastPong = Date.now(); });
    ws.on('error', () => {});
    const run = m ? onMatch(ws, decodeURIComponent(m[1]), hub) : onCostream(ws, decodeURIComponent(c[1]), url, hub);
    run.catch((err) => { console.error('[ws] day2 handler error', err.message); ws.close(1011, 'internal'); });
  });
}

module.exports = { accept };
