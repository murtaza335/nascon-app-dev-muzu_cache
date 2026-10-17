'use strict';
// Squad membership counting and as-of reconstruction (BR-ROST-04, BR-ROST-06). Pure.
// reg: {player_id, squad_id, parent_squad_id, position}. A loaned-out player's squad_id is the borrower's,
// so borrowed players count for the borrower and not for the lender.

const squadCount = (regs, squadId) => regs.filter((r) => r.squad_id === squadId).length;
const positionCount = (regs, squadId, position) => regs.filter((r) => r.squad_id === squadId && r.position === position).length;

// Squad the player belongs to on `asOf` per the audit log. entries: oldest-first for ONE player and league.
// initialSquad: registration squad when there are no entries. Returns {squad_id, parent_squad_id}.
function squadAsOf(entries, initialSquad, asOf) {
  if (!entries.length) return { squad_id: initialSquad, parent_squad_id: null };
  let current = null;
  for (const e of entries) if (e.effective_date <= asOf) current = e;
  if (!current) return { squad_id: entries[0].from_squad_id, parent_squad_id: null };
  return { squad_id: current.to_squad_id, parent_squad_id: current.action === 'loan' ? current.from_squad_id : null };
}

module.exports = { squadCount, positionCount, squadAsOf };
