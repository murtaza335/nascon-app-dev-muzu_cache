'use strict';
// NFR-6: Prometheus text exposition (version 0.0.4) from a plain snapshot. Pure.
const DEFS = [
  ['nascon_active_ws_connections', 'gauge', 'Open WebSocket connections.', 'ws_connections'],
  ['nascon_active_streams_total', 'gauge', 'Live media paths currently publishing.', 'active_streams'],
  ['nascon_stream_bitrate_kbps', 'gauge', 'Ingest bitrate across live streams (kbps).', 'bitrate_kbps'],
  ['nascon_dlq_depth', 'gauge', 'Notifications in the dead-letter queue.', 'dlq_depth'],
  ['nascon_qr_scans_total', 'counter', 'QR scans since reset.', 'qr_scans'],
];

const num = (v) => (Number.isFinite(v) ? Math.round(v) : 0);
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

// Stream keys are never printed in full: only the first 12 characters of the path name.
const safeStream = (name) => esc(name.slice(0, 'live/'.length + 12));

function render(s) {
  const lines = [];
  for (const [name, type, help, key] of DEFS) {
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`, `${name} ${num(s[key])}`);
  }
  if (s.sse_connections !== undefined) {
    lines.push('# HELP nascon_sse_connections Open SSE connections.', '# TYPE nascon_sse_connections gauge', `nascon_sse_connections ${num(s.sse_connections)}`);
  }
  for (const [stream, kbps] of s.per_stream || []) lines.push(`nascon_stream_bitrate_kbps{stream="${safeStream(stream)}"} ${num(kbps)}`);
  return `${lines.join('\n')}\n`;
}

module.exports = { render };
