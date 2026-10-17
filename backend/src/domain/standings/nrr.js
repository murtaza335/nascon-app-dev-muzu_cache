'use strict';
// Net run rate for the innings model (BR-STAND-02, OQ-14). Overs are tracked as balls and divided once.
const { pyround } = require('../../lib/pyround');

// Balls a side is credited with: its legal balls, or the full innings when it was bowled out.
function ballsCredited(side, periods) {
  const fullBalls = periods.innings_per_team * periods.overs_per_innings * periods.balls_per_over;
  return side.wickets >= periods.innings_per_team * periods.wickets_per_innings ? fullBalls : side.balls;
}

function nrr({ runsFor, ballsFor, runsAgainst, ballsAgainst }, ballsPerOver) {
  const oversFor = ballsFor / ballsPerOver;
  const oversAgainst = ballsAgainst / ballsPerOver;
  const a = oversFor > 0 ? runsFor / oversFor : 0;
  const b = oversAgainst > 0 ? runsAgainst / oversAgainst : 0;
  return pyround(a - b, 3);
}

module.exports = { ballsCredited, nrr };
