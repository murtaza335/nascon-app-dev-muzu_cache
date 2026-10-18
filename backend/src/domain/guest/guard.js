'use strict';
// BR-GUEST-01 (pure): a `Bearer guest_…` credential may never mutate state, except on the allow-list.
const GUEST_RE = /^Bearer\s+(guest_[^\s]*)$/i;
const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const ALLOW = [
  ['POST', /^\/api\/v1\/guest\/session\/?$/],
  ['POST', /^\/api\/v1\/guest\/cart\/items\/?$/],
  ['DELETE', /^\/api\/v1\/guest\/cart\/items(\/[^/]+)?\/?$/],
  ['POST', /^\/audit\/v1\/guest\/cart-merge\/?$/],
  // Progressive auth: a guest upgrading to a member may still carry the guest header.
  ['POST', /^\/api\/v1\/auth\/(login|register)\/?$/],
];

function guestTokenOf(authorization) {
  const m = GUEST_RE.exec(authorization || '');
  return m ? m[1] : null;
}

function isAllowListed(method, path) {
  return ALLOW.some(([m, re]) => m === method && re.test(path));
}

// → the guest token when the request must be rejected, else null.
function blockedGuestToken(method, path, authorization) {
  const token = guestTokenOf(authorization);
  if (!token || !WRITE.has(String(method).toUpperCase())) return null;
  return isAllowListed(String(method).toUpperCase(), path) ? null : token;
}

module.exports = { guestTokenOf, isAllowListed, blockedGuestToken };
