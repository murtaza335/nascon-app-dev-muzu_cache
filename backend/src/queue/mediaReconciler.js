'use strict';
// FR-3.2-03 safety net: every second, kick any ready live/* path whose key is not active (the API also kicks synchronously).
const { query } = require('../db');
const media = require('../services/media');

async function run() {
  const paths = (await media.listPaths()).filter((p) => p.ready && p.name.startsWith('live/'));
  if (!paths.length) return 0;
  const keys = paths.map((p) => p.name.slice('live/'.length));
  const { rows } = await query("SELECT stream_key FROM stream_keys WHERE stream_key = ANY($1) AND status = 'active'", [keys]);
  const active = new Set(rows.map((r) => r.stream_key));
  let kicked = 0;
  for (const k of keys) if (!active.has(k) && (await media.kickPath(`live/${k}`))) kicked += 1;
  return kicked;
}

module.exports = { run };
