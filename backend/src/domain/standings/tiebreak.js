'use strict';
// Ordering (BR-STAND-04): sort by points; resolve each tied group criterion by criterion; when a criterion
// splits a group, every subgroup of size > 1 restarts from the FIRST criterion using only its own members.
const { sha256Hex } = require('../../lib/hash');
const { aggregate } = require('./table');

function criteriaList(order) {
  return [...order.filter((c) => c !== 'draw_lots'), 'draw_lots']; // draw_lots always last (OQ-15)
}

function rank({ teams, records, overall, ctx, order, lotsSeed, leagueId }) {
  const criteria = criteriaList(order);
  const resolvedBy = new Map();
  const lotsKey = (t) => sha256Hex(`${lotsSeed}|${leagueId}|${t}`);

  // value + direction per criterion; returns a number/string where "better" sorts first by cmp().
  function valueOf(c, team, sub) {
    switch (c) {
      case 'h2h_points': return sub.get(team).points;
      case 'h2h_diff': return sub.get(team).diff;
      case 'overall_diff': return overall.get(team).diff;
      case 'scored': return overall.get(team).scored;
      case 'fair_play': return overall.get(team).fair_play;
      case 'draw_lots': return lotsKey(team);
      default: return 0;
    }
  }
  const better = (c, x, y) => (c === 'draw_lots' ? (x < y ? -1 : x > y ? 1 : 0) : (y - x)); // negative → x first

  function resolve(group) {
    if (group.length <= 1) return group;
    const inGroup = new Set(group);
    const sub = aggregate(records.filter((m) => inGroup.has(m.home) && inGroup.has(m.away)), group, ctx);
    for (const c of criteria) {
      const sorted = [...group].sort((x, y) => better(c, valueOf(c, x, sub), valueOf(c, y, sub)));
      const parts = [];
      for (const t of sorted) {
        const last = parts[parts.length - 1];
        if (last && better(c, valueOf(c, last[0], sub), valueOf(c, t, sub)) === 0) last.push(t);
        else parts.push([t]);
      }
      if (parts.length > 1) {
        const out = [];
        parts.forEach((part, i) => {
          const ordered = resolve(part);
          out.push(...ordered);
          if (i < parts.length - 1) resolvedBy.set(ordered[ordered.length - 1], c);
        });
        return out;
      }
    }
    return group;
  }

  const byPoints = [...teams].sort((x, y) => overall.get(y).points - overall.get(x).points);
  const ordered = [];
  for (let i = 0; i < byPoints.length;) {
    let j = i;
    while (j < byPoints.length && overall.get(byPoints[j]).points === overall.get(byPoints[i]).points) j++;
    ordered.push(...resolve(byPoints.slice(i, j)));
    i = j;
  }
  return { order: ordered, resolvedBy };
}

module.exports = { rank, criteriaList };
