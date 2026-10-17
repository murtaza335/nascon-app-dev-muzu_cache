'use strict';
// Mock payment gateway (FR-2.3-02, BR-STORE-05). Pure decision by token; ids come from per-reset counters.
const TOKENS = ['tok_success', 'tok_declined', 'tok_capture_fail'];

// → {ok:true, authorization_id, capture_id} | {ok:false, error:'PAYMENT_DECLINED'|'PAYMENT_CAPTURE_FAILED'}
function charge(token, nextN) {
  if (token === 'tok_declined') return { ok: false, error: 'PAYMENT_DECLINED' };
  if (token === 'tok_capture_fail') return { ok: false, error: 'PAYMENT_CAPTURE_FAILED' };
  return { ok: true, authorization_id: `auth_${nextN}`, capture_id: `cap_${nextN}` };
}

module.exports = { TOKENS, charge };
