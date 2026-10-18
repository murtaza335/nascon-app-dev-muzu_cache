'use strict';
// NFR-6: gathers the snapshot from in-memory sources only, so /metrics never waits on the DB or the media server.
const { render } = require('../domain/observability/metrics');
const cache = require('./day2Cache');
const media = require('./media');

const sources = { ws: () => 0, sse: () => 0 };
const register = (name, fn) => { sources[name] = fn; };

function snapshot() {
  return {
    ws_connections: sources.ws(), sse_connections: sources.sse(), active_streams: media.snapshot.ready,
    bitrate_kbps: media.snapshot.bitrateKbps, dlq_depth: cache.dlq.depth, qr_scans: cache.state.qrScansTotal,
    per_stream: media.snapshot.perStream,
  };
}

const body = () => render(snapshot());

module.exports = { register, body };
