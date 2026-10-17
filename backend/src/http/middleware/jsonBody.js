'use strict';
// Body limit (413) + JSON parse for ANY content type (REQUIREMENTS §7, ARCHITECTURE §7.1).
// req.rawBody keeps the exact text so canonicalization can reproduce number lexemes later (ADR-007).
const { AppError, E, validationError } = require('../../errors');

const LIMIT = 1048576;
const PROBE_PREFIX = '/audit/v1/rbac/';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > LIMIT) return reject(new AppError(E.PAYLOAD_TOO_LARGE));
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > LIMIT) {
        chunks.length = 0;
        req.removeAllListeners('data');
        req.resume();
        return reject(new AppError(E.PAYLOAD_TOO_LARGE));
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function jsonBody(req, res, next) {
  try {
    const text = await readBody(req);
    req.rawBody = text;
    if (text.trim() === '') { req.body = undefined; return next(); }
    try {
      req.body = JSON.parse(text);
    } catch {
      // Probes never read the body: authorization comes first (BR-AUTH-01).
      if (req.path.startsWith(PROBE_PREFIX)) req.body = undefined;
      else throw validationError(['body']);
    }
    next();
  } catch (err) {
    if (err instanceof AppError && err.status === 413) res.set('Connection', 'close');
    next(err);
  }
}

module.exports = { jsonBody, LIMIT };
