'use strict';
// RT-D2-02: Server-Sent Events mirror of the match WebSocket topic. Heartbeat comment every 15 s.
const { getScore } = require('./score');
const metrics = require('./metrics');

let hub = null;
let open = 0;
const setHub = (h) => { hub = h; metrics.register('sse', () => open); };

async function openStream(req, res, matchId) {
  const score = await getScore(matchId); // 404 MATCH_NOT_FOUND before any header is written
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`: connected ${score.status} ${score.home.score}-${score.away.score}\n\n`);
  open += 1;
  const unsub = hub ? hub.subscribe(`ws:match:${matchId}`, (text, msg) => {
    if (['score.updated', 'match.status_changed', 'overlay.updated'].includes(msg.type)) res.write(`event: ${msg.type}\ndata: ${text}\n\n`);
  }) : () => {};
  const beat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  req.on('close', () => { clearInterval(beat); unsub(); open -= 1; });
}

module.exports = { open: openStream, setHub };
