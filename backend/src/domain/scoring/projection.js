'use strict';
// Score projection rebuilt from the event log on every read (FR-1.1-04, BR-SCORE-08). Pure.
// Input events: [{event_id, sequence, type, payload, signature}] in sequence order.
// Dispatch is on scoring_model only; event names come from the sport config, never from code.

const ZERO = () => ({ score: 0, wickets: 0, balls: 0, fair_play: 0 });

function build({ match, config, events }) {
  const model = config.scoring_model;
  const compensatedBy = new Map(); // target event_id → compensation event_id
  for (const e of events) {
    if (e.type === 'compensation' && e.payload && typeof e.payload.compensates === 'string') {
      if (!compensatedBy.has(e.payload.compensates)) compensatedBy.set(e.payload.compensates, e.event_id);
    }
  }
  const isActive = (e) => e.type !== 'compensation' && !compensatedBy.has(e.event_id);

  let status = 'upcoming';
  const stats = { [match.home_team_id]: ZERO(), [match.away_team_id]: ZERO() };
  let tiebreakTeam = null;

  for (const e of events) {
    if (e.type === 'match_start') status = 'in_progress';
    else if (e.type === 'match_end') status = 'completed';
    if (!isActive(e)) continue;
    const s = stats[e.payload && e.payload.team_id];
    if (!s) continue;
    if (e.type === 'score') {
      const def = config.scoring_events[e.payload.event_type];
      if (!def) continue;
      if (model === 'event') s.score += def.points;
      else if (model === 'innings') {
        s.score += def.runs;
        if (def.legal_ball) s.balls += 1;
        if (def.wicket) s.wickets += 1;
      } else if (model === 'round') s.score += def.rounds;
    } else if (e.type === 'discipline') s.fair_play += e.payload.points;
    else if (e.type === 'tiebreak_winner') tiebreakTeam = e.payload.team_id;
  }

  const h = stats[match.home_team_id];
  const a = stats[match.away_team_id];
  let winner = null;
  if (h.score > a.score) winner = match.home_team_id;
  else if (a.score > h.score) winner = match.away_team_id;
  else winner = tiebreakTeam;

  let outcome = 'pending';
  if (status === 'completed') {
    if (winner === match.home_team_id) outcome = 'home_win';
    else if (winner === match.away_team_id) outcome = 'away_win';
    else outcome = config.draw_allowed ? 'draw' : 'undecided';
  }

  const side = (teamId, s) => {
    const innings = model === 'innings';
    const bpo = innings ? config.periods.balls_per_over : null;
    return {
      team_id: teamId,
      score: s.score,
      wickets: innings ? s.wickets : null,
      balls: innings ? s.balls : null,
      overs: innings ? `${Math.floor(s.balls / bpo)}.${s.balls % bpo}` : null,
      fair_play: s.fair_play,
    };
  };

  return {
    match_id: match.match_id,
    sport_id: match.sport_id,
    league_id: match.league_id ?? null,
    status,
    outcome,
    winner_team_id: winner,
    tiebreak_winner_team_id: tiebreakTeam,
    home: side(match.home_team_id, h),
    away: side(match.away_team_id, a),
    version: events.length,
    events: events.map((e) => ({
      sequence: e.sequence,
      event_id: e.event_id,
      type: e.type,
      payload: e.payload,
      signature: e.signature,
      compensated: compensatedBy.has(e.event_id),
      compensated_by: compensatedBy.get(e.event_id) ?? null,
    })),
    // Internal (not part of API-07): used by event rules and standings.
    _stats: stats,
    _compensatedBy: compensatedBy,
  };
}

// API-07 field set and order.
function toApi(view) {
  const { _stats, _compensatedBy, ...api } = view;
  return api;
}

module.exports = { build, toApi };
