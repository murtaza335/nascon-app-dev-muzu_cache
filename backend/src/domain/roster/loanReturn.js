'use strict';
// Automatic loan return (BR-ROST-03). Pure. The return is due on loan_end_date + 1.
const { addDays } = require('../../lib/time');

// loans: [{player_id, squad_id (borrower), parent_squad_id (lender), loan_end_date, hasReturn}] → returns to materialize.
function dueReturns(loans, onDate) {
  return loans
    .filter((l) => l.parent_squad_id && l.loan_end_date && !l.hasReturn && addDays(l.loan_end_date, 1) <= onDate)
    .map((l) => ({
      player_id: l.player_id,
      from_squad_id: l.squad_id,
      to_squad_id: l.parent_squad_id,
      effective_date: addDays(l.loan_end_date, 1),
    }));
}

module.exports = { dueReturns };
