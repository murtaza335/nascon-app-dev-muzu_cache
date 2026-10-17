'use strict';
// scrypt password hashing. The demo hash is computed once per process and reused by every reset.
const crypto = require('node:crypto');

const DEMO_PASSWORD = 'Nascon@26';
let demoHash = null;

function hash(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

function verify(password, stored) {
  const [scheme, saltHex, keyHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function demoPasswordHash() {
  if (!demoHash) demoHash = hash(DEMO_PASSWORD);
  return demoHash;
}

module.exports = { hash, verify, demoPasswordHash, DEMO_PASSWORD };
