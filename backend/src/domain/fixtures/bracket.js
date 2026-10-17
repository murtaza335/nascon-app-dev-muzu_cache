'use strict';
// Shared bracket helpers (spec §5.7-C/D, exact). Pure.
const { E } = require('../../errors');

const nextPow2 = (n) => { let b = 1; while (b < n) b *= 2; return b; };
const log2 = (b) => Math.round(Math.log2(b));

// order(2) = [1,2]; order(2k) = for each s in order(k): [s, 2k+1-s]
function seedOrder(size) {
  let order = [1, 2];
  for (let k = 2; k < size; k *= 2) {
    const next = [];
    for (const s of order) next.push(s, 2 * k + 1 - s);
    order = next;
  }
  return order;
}

function newMatch(match_id, bracket, round, index) {
  return {
    match_id, bracket, round, index, home: null, away: null, home_seed: null, away_seed: null, bye: false,
    winner: null, loser: null, winner_to: null, loser_to: null,
  };
}

// Builds WR1 / R1 from the teams array (seed order) and returns the matches in bracket order.
function firstRound(teams, prefix, bracket) {
  const size = nextPow2(teams.length);
  const order = seedOrder(size);
  const matches = [];
  for (let i = 1; i <= size / 2; i++) {
    const s1 = order[2 * i - 2];
    const s2 = order[2 * i - 1];
    const [lo, hi] = s1 < s2 ? [s1, s2] : [s2, s1];
    const m = newMatch(`${prefix}1M${i}`, bracket, 1, i);
    m.home = teams[lo - 1];
    m.home_seed = lo;
    if (hi <= teams.length) { m.away = teams[hi - 1]; m.away_seed = hi; } else m.bye = true;
    matches.push(m);
  }
  return { size, matches };
}

const slotKey = (slot) => (slot === 'home' ? 'home' : 'away');

// Puts a team into a destination slot (and records its seed). dest = {match_id, slot}.
function place(byId, dest, team, seedOf) {
  const m = byId.get(dest.match_id);
  m[slotKey(dest.slot)] = team;
  m[`${slotKey(dest.slot)}_seed`] = seedOf.get(team) ?? null;
}

// Applies [{match_id, winner}] in dependency order. `advance(match, winner, loser)` pushes teams downstream.
// Returns null on success or the list of offending result indexes' field paths.
function applyResults(results, byId, advance, isAllowed = () => true) {
  const bad = [];
  const seen = new Set();
  const pending = [];
  results.forEach((r, i) => {
    const m = byId.get(r.match_id);
    if (!m || seen.has(r.match_id) || !isAllowed(m)) bad.push(`params.results[${i}].match_id`);
    else pending.push({ r, i });
    seen.add(r.match_id);
  });
  let progressed = true;
  while (pending.length && progressed) {
    progressed = false;
    for (let k = 0; k < pending.length; k++) {
      const { r, i } = pending[k];
      const m = byId.get(r.match_id);
      if (!m.home || !m.away || m.bye) continue; // participants not both known yet
      if (r.winner !== m.home && r.winner !== m.away) { bad.push(`params.results[${i}].winner`); pending.splice(k, 1); k--; progressed = true; continue; }
      m.winner = r.winner;
      m.loser = r.winner === m.home ? m.away : m.home;
      advance(m);
      pending.splice(k, 1);
      k--;
      progressed = true;
    }
  }
  for (const { i } of pending) bad.push(`params.results[${i}].match_id`);
  return bad.length ? [...new Set(bad)] : null;
}

const fail = (fields) => ({ ok: false, error: E.VALIDATION_ERROR, details: { fields } });

module.exports = { nextPow2, log2, seedOrder, newMatch, firstRound, place, applyResults, fail };
