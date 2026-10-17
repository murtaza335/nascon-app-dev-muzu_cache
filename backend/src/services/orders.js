'use strict';
// APP-53/54/55: order reads and the order state machine (FR-2.3-04, BR-STORE-03).
const { withTx } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { must } = require('../http/guard');
const sm = require('../domain/store/orderStateMachine');
const orders = require('../repos/orders');
const outbox = require('../repos/outbox');
const appRepo = require('../repos/app');
const hooks = require('./hooks');
const { isoSeconds } = require('../lib/time');

// Owner, the club manager of the order's club, or the super admin (cross-tenant is always 403).
async function authorizeOrder(principal, order) {
  if (principal.role === 'super_admin' || order.customer_id === principal.user_id) return;
  if (principal.role === 'club_manager' && order.club_id) {
    const club = await appRepo.getClub(order.club_id);
    must(principal, 'order.transition', { tenant_id: club && club.tenant_id, club_id: order.club_id });
    return;
  }
  throw new AppError(E.FORBIDDEN);
}

function publicOrder(o) {
  const resp = JSON.parse(o.response);
  return {
    order_id: o.order_id, customer_id: o.customer_id, status: o.status, currency: 'PKR', items: resp.items,
    subtotal_minor: o.subtotal_minor, discount_minor: o.discount_minor, total_minor: o.total_minor, payment: resp.payment,
    receipt: { payload: resp.receipt.payload, signature: resp.receipt.signature }, created_at: o.created_at,
  };
}

async function listFor(principal) {
  let filter = { customer_id: principal.user_id };
  if (principal.role === 'super_admin') filter = {};
  else if (principal.role === 'club_manager' && principal.club_id) filter = { club_id: principal.club_id };
  const rows = await orders.listOrders(filter);
  return rows.map(publicOrder);
}

async function getFor(principal, orderId) {
  const o = await orders.getOrder(orderId);
  if (!o) throw new AppError(E.ORDER_NOT_FOUND);
  await authorizeOrder(principal, o);
  return publicOrder(o);
}

async function receiptPdf(principal, orderId) {
  const o = await orders.getOrder(orderId);
  if (!o) throw new AppError(E.ORDER_NOT_FOUND);
  await authorizeOrder(principal, o);
  return orders.getPdf(orderId);
}

const STATES = sm.STATES;

async function transition(principal, orderId, input) {
  const o0 = await orders.getOrder(orderId);
  if (!o0) throw new AppError(E.ORDER_NOT_FOUND);
  if (principal.role !== 'super_admin') {
    const club = o0.club_id ? await appRepo.getClub(o0.club_id) : null;
    must(principal, 'order.transition', { tenant_id: club && club.tenant_id, club_id: o0.club_id });
  }
  const to = input && typeof input === 'object' ? input.to : undefined;
  if (typeof to !== 'string' || !STATES.includes(to)) throw validationError(['to']);
  const out = await withTx(async (client) => {
    const o = await orders.lockOrder(client, orderId);
    if (!sm.canTransition(o.status, to)) throw new AppError(E.ILLEGAL_TRANSITION, { from: o.status, to });
    if (sm.restocks(o.status, to)) await orders.restock(client, o.items);
    await orders.setStatus(client, orderId, to);
    await outbox.insert(client, {
      topic: 'order', type: 'order.status_changed', aggregate_id: orderId,
      payload: { type: 'order.status_changed', order_id: orderId, from: o.status, to, at: isoSeconds(new Date()) },
    });
    return { from: o.status, to };
  });
  if (sm.restocks(out.from, out.to)) await hooks.catalogueChanged();
  return getFor(principal, orderId);
}

module.exports = { listFor, getFor, receiptPdf, transition, authorizeOrder };
