'use strict';
// Qualification status from points only (BR-STAND-07). Clinched is checked first.
function qualificationStatus(team, rows, remaining, winPoints, spots) {
  const pts = (t) => rows.get(t).points;
  const max = (t) => pts(t) + winPoints * (remaining.get(t) || 0);
  const others = [...rows.keys()].filter((t) => t !== team);
  if (others.filter((x) => max(x) >= pts(team)).length < spots) return 'clinched';
  if (others.filter((x) => pts(x) > max(team)).length >= spots) return 'eliminated';
  return 'still_possible';
}

module.exports = { qualificationStatus };
