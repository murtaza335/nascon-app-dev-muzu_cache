'use strict';
// Pure rules for POST /audit/v1/stream/key (BR-SK). No I/O; randomness is injected.
const ACTIONS = ['generate', 'rotate', 'revoke'];

const newKey = (randomHex16) => `sk_live_${randomHex16}`;

// Decide what to do given the player's keys (newest first). Returns {op:'issue'|'revoke'|'error', ...}.
function decide(action, keys) {
  if (action !== 'revoke') return { op: 'issue', status: action === 'generate' ? 201 : 200 };
  if (!keys.length) return { op: 'error', code: 'STREAM_NOT_FOUND' };
  if (keys[0].status === 'revoked') return { op: 'error', code: 'KEY_REVOKED', key: keys[0] };
  return { op: 'revoke', key: keys[0], status: 200 };
}

const sigPayload = (action, playerId, status, streamKey) => ({ action, player_id: playerId, status, stream_key: streamKey });

module.exports = { ACTIONS, newKey, decide, sigPayload };
