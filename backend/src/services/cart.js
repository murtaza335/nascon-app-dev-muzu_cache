'use strict';
// FR-4.4 / API-D2-08 & API-D2-54: one function serves the audit probe and the product API (AGENTS §8).
const config = require('../config');
const { withTx, advisoryXactLock, query } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { check, t } = require('../lib/validate');
const { sign2 } = require('../lib/signature');
const rules = require('../domain/guest/cartMerge');
const guard = require('../domain/guest/guard');
const repo = require('../repos/carts');

const SCHEMA = {
  guest_token: t.string({ required: true, min: 1, pattern: /^guest_/ }),
  registered_user_id: t.string({ required: true, min: 1 }),
  guest_cart: t.array(t.object({ variant_id: t.string({ required: true, min: 1 }), quantity: t.int({ required: true, min: 1 }) }), { required: true, min: 1, max: 10 }),
  test_write_block: t.bool({ default: true }),
};

// BR-CART-06: run the real guard on a synthetic guest write; 403 means the boundary holds.
function probeWriteBlock(guestToken) {
  return guard.blockedGuestToken('POST', '/api/v1/chat', `Bearer ${guestToken}`) === guestToken ? 403 : null;
}

async function activeCart(db, userId) {
  const rows = await repo.priceRows(db, await repo.memberItems(db, userId));
  return rules.cartView(userId, rows);
}

function receipt(guestToken, probe, cart) {
  const body = {
    guest_token: guestToken, write_block_verified: probe.code === 403, write_rejection_code: probe.code, cart_merged: true, active_cart: cart,
  };
  return { ...body, signature: sign2(guestToken, rules.sigPayload(body)) };
}

// `lines`: [{variant_id, quantity}] already validated; `memberId`: registered user or player id.
async function mergeCart({ guest_token: token, registered_user_id: memberId, guest_cart: lines, test_write_block: probeOn }) {
  const sums = rules.sumLines(lines);
  const hash = rules.requestHash(memberId, sums);
  if (!(await repo.personExists(memberId))) throw new AppError(E.PLAYER_NOT_FOUND, { player_id: memberId });
  const known = new Set((await repo.variantsInfo({ query }, [...sums.keys()])).map((v) => v.variant_id));
  for (const id of sums.keys()) if (!known.has(id)) throw new AppError(E.VARIANT_NOT_FOUND, { variant_id: id });

  return withTx(async (client) => {
    await advisoryXactLock(client, `guest:${token}`);
    await repo.ensureToken(client, token, config.guestTokenTtlSeconds);
    const row = await repo.getToken(client, token);
    if (row.status === 'merged') {
      if (row.merged_request_hash === hash && row.linked_user_id === memberId) return { status: 200, body: row.merge_receipt };
      throw new AppError(E.GUEST_TOKEN_ALREADY_MERGED, { guest_token: token, merged_user_id: row.linked_user_id });
    }
    const locked = await repo.lockVariants(client, [...sums.keys()]);
    const available = new Map(locked.map((v) => [v.variant_id, v.stock - v.reserved]));
    const member = new Map((await repo.memberItems(client, memberId)).map((r) => [r.variant_id, r.quantity]));
    const short = rules.firstShort(sums, member, available);
    if (short) throw new AppError(E.OUT_OF_STOCK, short);
    const probe = { code: probeOn ? probeWriteBlock(token) : null };
    await repo.addMemberItems(client, memberId, sums);
    const body = receipt(token, probe, await activeCart(client, memberId));
    await repo.markMerged(client, token, memberId, hash, body);
    return { status: 200, body };
  });
}

function mergeFromAudit(input) {
  const c = check(SCHEMA, input);
  if (!c.ok) throw validationError(c.fields);
  return mergeCart(c.value);
}

// API-D2-56
const memberCart = (userId) => activeCart({ query }, userId);

module.exports = { mergeCart, mergeFromAudit, memberCart, activeCart, probeWriteBlock };
