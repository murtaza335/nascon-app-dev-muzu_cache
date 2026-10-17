'use strict';
// HS256-only JWT (BR-AUTH-02, ADR-009). The algorithm is pinned: any other header is rejected,
// including alg:none. exp is required. Pure apart from the injected clock and secret.
const crypto = require('node:crypto');

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const B64U_RE = /^[A-Za-z0-9_-]+$/;

function deriveSecret(salt) {
  return crypto.createHmac('sha256', salt).update('nascon-jwt-v1').digest('hex');
}

function sign(claims, secret, { nowSec, ttlSeconds }) {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = {
    ...claims,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
    jti: crypto.randomUUID(),
  };
  const payload = b64u(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return { token: `${header}.${payload}.${sig}`, claims: body };
}

// Returns the claims, or null for ANY problem (malformed, wrong alg, bad signature, expired, no exp).
function verify(token, secret, nowSec) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts.every((p) => B64U_RE.test(p))) return null;
  const [h, p, s] = parts;
  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!header || header.alg !== 'HS256') return null;
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();
  const actual = Buffer.from(s, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  if (!claims || typeof claims !== 'object' || !Number.isInteger(claims.exp) || claims.exp <= nowSec) return null;
  return claims;
}

module.exports = { sign, verify, deriveSecret };
