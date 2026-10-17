'use strict';
// Order states (BR-STORE-03). Pure.
const TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['packed', 'cancelled', 'refunded'],
  packed: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

const STATES = Object.keys(TRANSITIONS);
const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);
// Cancelled/refunded before shipment puts the units back on the shelf (our rule, P2).
const restocks = (from, to) => ['cancelled', 'refunded'].includes(to) && ['pending', 'paid', 'packed'].includes(from);

module.exports = { STATES, TRANSITIONS, canTransition, restocks };
