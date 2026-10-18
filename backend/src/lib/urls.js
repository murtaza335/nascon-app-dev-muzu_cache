'use strict';
const config = require('../config');

const host = () => config.publicMediaHost;
const liveUrls = (key) => ({
  ingest_endpoints: { rtmp: `rtmp://${host()}:1935/live/${key}`, webrtc: `http://${host()}:8889/live/${key}/whip` },
  playback_url: `http://${host()}:8888/live/${key}/index.m3u8`,
});
const whepUrl = (key) => `http://${host()}:8889/live/${key}/whep`;
const hlsUrl = (key) => `http://${host()}:8888/live/${key}/index.m3u8`;
const compositeUrl = (sessionId) => `http://${host()}:8888/costream/${sessionId}/index.m3u8`;
const shortUrl = (code) => `${config.publicBaseUrl}/q/${code}`;
const auditQr = (entityId) => `${config.publicBaseUrl}/audit/v1/qr/${entityId}`;

module.exports = { liveUrls, whepUrl, hlsUrl, compositeUrl, shortUrl, auditQr };
