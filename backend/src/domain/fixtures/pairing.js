'use strict';
// Minimum-cost perfect pairing with forbidden pairs (Swiss rounds >= 2, FR-1.3-02). Pure.
// Exact search: always pair the first unmatched team, try partners cheapest-first, prune with an admissible
// lower bound (pair the remaining teams in score order), and remember sub-problems proven infeasible.
// The first solution that reaches the global lower bound stops the search.
//
// items: [{score}] sorted best-first; forbidden(i, j) → true when i and j have already met.
// Returns {pairs: [[i,j],...], cost} or null when no complete pairing exists.

function lowerBound(items, remaining) {
  let sum = 0;
  for (let k = 0; k + 1 < remaining.length; k += 2) sum += Math.abs(items[remaining[k]].score - items[remaining[k + 1]].score);
  return sum;
}

function bestPairing(items, forbidden) {
  const n = items.length;
  if (n % 2 === 1) return null;
  const all = Array.from({ length: n }, (_, i) => i);
  const rootBound = lowerBound(items, all);
  const EPS = 1e-9;
  let best = Infinity;
  let bestPairs = null;
  const dead = new Set();
  let done = false;

  // Returns {found, pruned} for the sub-problem `remaining` reached with cost `cost`.
  function dfs(remaining, cost, pairs) {
    if (remaining.length === 0) {
      if (cost < best - EPS) { best = cost; bestPairs = pairs.slice(); if (best <= rootBound + EPS) done = true; }
      return { found: true, pruned: false };
    }
    const key = remaining.join(',');
    if (dead.has(key)) return { found: false, pruned: false };
    const i = remaining[0];
    const options = [];
    for (let p = 1; p < remaining.length; p++) {
      const j = remaining[p];
      if (!forbidden(i, j)) options.push({ j, p, c: Math.abs(items[i].score - items[j].score) });
    }
    options.sort((a, b) => a.c - b.c || a.p - b.p);
    let found = false;
    let pruned = false;
    for (const o of options) {
      if (done) { pruned = true; break; }
      const rest = remaining.filter((_, idx) => idx !== 0 && idx !== o.p);
      if (cost + o.c + lowerBound(items, rest) >= best - EPS) { pruned = true; continue; }
      pairs.push([i, o.j]);
      const r = dfs(rest, cost + o.c, pairs);
      pairs.pop();
      if (r.found) found = true;
      if (r.pruned) pruned = true;
    }
    if (!found && !pruned) dead.add(key);
    return { found, pruned };
  }

  dfs(all, 0, []);
  return bestPairs ? { pairs: bestPairs, cost: best } : null;
}

module.exports = { bestPairing };
