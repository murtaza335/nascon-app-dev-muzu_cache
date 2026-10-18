'use strict';
// FR-4.2 / FR-4.4: guest session, staged server cart, progressive registration.
const crypto = require('node:crypto');
const config = require('../config');
const { query } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { check, t } = require('../lib/validate');
const passwords = require('../seed/passwords');
const auth = require('./auth');
const cartRules = require('../domain/guest/cartMerge');
const repo = require('../repos/guest');
const carts = require('../repos/carts');
const cartService = require('./cart');

const SCOPES = ['stream:read', 'score:subscribe', 'guest_cart:stage'];

async function createSession() {
  const token = `guest_anon_tok_${crypto.randomBytes(8).toString('hex')}`;
  const expires_at = await repo.create(token, config.guestTokenTtlSeconds);
  return { guest_token: token, role: 'guest', scopes: SCOPES, expires_at };
}

// Used by guest routes: a valid, unexpired, unmerged token or 401.
async function requireGuest(token) {
  if (!(await repo.valid(token))) throw new AppError(E.UNAUTHENTICATED);
}

async function guestCart(token) {
  const rows = await carts.priceRows({ query }, await repo.items(token));
  const view = cartRules.cartView(token, rows);
  return { guest_token: token, items: view.items, total_items: view.total_items, subtotal_minor: view.subtotal_minor, currency: 'PKR' };
}

async function addItem(token, input) {
  const c = check({ variant_id: t.string({ required: true, min: 1 }), quantity: t.int({ required: true, min: 1, max: 10 }) }, input);
  if (!c.ok) throw validationError(c.fields);
  const [v] = await carts.variantsInfo({ query }, [c.value.variant_id]);
  if (!v) throw new AppError(E.VARIANT_NOT_FOUND, { variant_id: c.value.variant_id });
  const staged = (await repo.items(token)).find((r) => r.variant_id === c.value.variant_id);
  const requested = c.value.quantity + (staged ? staged.quantity : 0);
  if (requested > v.stock - v.reserved) throw new AppError(E.OUT_OF_STOCK, { variant_id: v.variant_id, requested, available: v.stock - v.reserved });
  await repo.addItem(token, v.variant_id, c.value.quantity);
  return guestCart(token);
}

async function removeItem(token, variantId) {
  await repo.removeItem(token, variantId);
  return guestCart(token);
}

// API-D2-54: the server reads the staged cart; a replay after merge returns the stored receipt.
async function mergeStaged(principal, input) {
  const c = check({ guest_token: t.string({ required: true, min: 1, pattern: /^guest_/ }), return_to: t.string({ max: 500 }) }, input);
  if (!c.ok) throw validationError(c.fields);
  const lines = await repo.items(c.value.guest_token);
  let out;
  if (lines.length) {
    out = await cartService.mergeCart({
      guest_token: c.value.guest_token, registered_user_id: principal.user_id, guest_cart: lines.slice(0, 10), test_write_block: true,
    });
  } else {
    const { rows } = await query('SELECT linked_user_id, merge_receipt FROM guest_tokens WHERE guest_token = $1', [c.value.guest_token]);
    if (rows[0] && rows[0].merge_receipt && rows[0].linked_user_id === principal.user_id) out = { status: 200, body: rows[0].merge_receipt };
    else throw validationError(['guest_token']);
  }
  return { status: out.status, body: c.value.return_to !== undefined ? { ...out.body, return_to: c.value.return_to } : out.body };
}

// API-D2-55
async function register(input) {
  const c = check({
    email: t.string({ required: true, min: 3, max: 254, pattern: /^[^@\s]+@[^@\s]+$/ }),
    password: t.string({ required: true, min: 8, max: 200 }),
    display_name: t.string({ required: true, min: 1, max: 100 }),
  }, input);
  if (!c.ok) throw validationError(c.fields);
  const { rows: taken } = await query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [c.value.email]);
  if (taken.length) throw validationError(['email']);
  const userId = `user-${crypto.randomBytes(6).toString('hex')}`;
  try {
    await query(
      `INSERT INTO users (user_id, email, password_hash, display_name, role, tenant_id, league_ids) VALUES ($1,$2,$3,$4,'viewer','tenant-alpha','{}')`,
      [userId, c.value.email, passwords.hash(c.value.password), c.value.display_name]);
  } catch (err) {
    if (err.code === '23505') throw validationError(['email']);
    throw err;
  }
  return auth.login({ email: c.value.email, password: c.value.password });
}

module.exports = { createSession, requireGuest, guestCart, addItem, removeItem, mergeStaged, register };
