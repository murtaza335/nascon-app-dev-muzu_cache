'use strict';
// Pure QR routing rules (BR-QR-01/02, spec §5.6).
const crypto = require('node:crypto');

const PREFIXES = [['match-', 'match'], ['player-', 'player'], ['club-', 'club'], ['cs-session-', 'costream']];
const TERMINAL_NOTICE = ['postponed', 'cancelled', 'abandoned'];

function entityType(entityId) {
  const hit = PREFIXES.find(([p]) => entityId.startsWith(p));
  return hit ? hit[1] : null;
}

function targetRoute(type, entityId, status) {
  if (type === 'match') {
    if (status === 'in_progress') return `/web/matches/${entityId}/live`;
    if (status === 'completed') return `/web/matches/${entityId}/vod`;
    if (TERMINAL_NOTICE.includes(status)) return `/web/matches/${entityId}/notice?state=${status}`;
    return `/web/matches/${entityId}/preview`;
  }
  if (type === 'player') return `/web/players/${entityId}`;
  if (type === 'club') return `/web/clubs/${entityId}`;
  return `/web/costream/${entityId}`;
}

// BR-QR-03: first 10 chars of lowercase base32(HMAC(salt, "qr|" + entity_id)) — stable and unguessable.
function shortCodeFor(salt, entityId) {
  const digest = crypto.createHmac('sha256', Buffer.from(salt, 'utf8')).update(`qr|${entityId}`, 'utf8').digest();
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0; let value = 0; let out = '';
  for (const b of digest) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5 && out.length < 10) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
    if (out.length >= 10) break;
  }
  return out;
}

const deviceFamily = (ua) => (/Mobi|Android|iPhone|iPad|iPod/i.test(ua || '') ? 'mobile' : 'desktop');

const sigPayload = (entityId, shortUrl, route) => ({ entity_id: entityId, short_url: shortUrl, target_route: route });

module.exports = { entityType, targetRoute, shortCodeFor, deviceFamily, sigPayload };
