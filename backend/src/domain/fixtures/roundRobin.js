'use strict';
// Round-robin by the circle method (FR-1.3-01, spec §5.7-A). Pure.
// Odd n gets a dummy "bye" slot; the first team stays fixed while the rest rotate.

function circleRounds(teams) {
  const arr = [...teams];
  if (arr.length % 2 === 1) arr.push(null);
  const m = arr.length;
  const rounds = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs = [];
    let bye = null;
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i];
      const b = arr[m - 1 - i];
      if (a === null || b === null) { bye = a === null ? b : a; continue; }
      // Alternating only the fixed board keeps |home-away| <= 1 per team and leg (verified for n = 2..40).
      const flip = i === 0 && r % 2 === 1;
      pairs.push(flip ? [b, a] : [a, b]);
    }
    rounds.push({ pairs, bye });
    arr.splice(1, 0, arr.pop()); // rotate everything except arr[0]
  }
  return rounds;
}

function generate({ teams, legs = 1, withdrawals = [], policy = 'forfeit_remaining' }) {
  const base = circleRounds(teams);
  const perLeg = base.length;
  const after = new Map(withdrawals.map((w) => [w.team_id, w.after_round]));
  const rounds = [];
  const summary = { total: 0, scheduled: 0, forfeit: 0, voided: 0 };

  for (let leg = 1; leg <= legs; leg++) {
    base.forEach((br, ri) => {
      const round = (leg - 1) * perLeg + ri + 1;
      const matches = br.pairs.map(([h, a], mi) => {
        const [home, away] = leg === 2 ? [a, h] : [h, a];
        let status = 'scheduled';
        let awardedTo = null;
        const gone = (t) => after.has(t) && round > after.get(t);
        if (policy === 'void_all') {
          if (after.has(home) || after.has(away)) status = 'voided';
        } else if (gone(home) && gone(away)) status = 'voided';
        else if (gone(home)) { status = 'forfeit'; awardedTo = away; }
        else if (gone(away)) { status = 'forfeit'; awardedTo = home; }
        summary.total += 1;
        summary[status] += 1;
        return { match_id: `RR-L${leg}-R${round}-M${mi + 1}`, leg, home, away, status, awarded_to: awardedTo };
      });
      rounds.push({ round, matches, byes: br.bye === null ? [] : [br.bye] });
    });
  }
  return { format: 'round_robin', legs, team_count: teams.length, round_count: rounds.length, rounds, summary };
}

module.exports = { generate };
