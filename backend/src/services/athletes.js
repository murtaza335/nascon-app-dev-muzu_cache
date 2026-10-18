'use strict';
// FR-3.1: athlete profile (career derived from the event logs on read) and the follow graph (set semantics).
const { query } = require('../db');
const { AppError, E } = require('../errors');
const { hlsUrl } = require('../lib/urls');
const { getScore } = require('./score');

async function career(clubId, playerId) {
  const out = { matches: 0, wins: 0, draws: 0, losses: 0, score_events: 0 };
  if (!clubId) return out;
  const ms = (await query('SELECT match_id FROM matches WHERE home_team_id = $1 OR away_team_id = $1', [clubId])).rows;
  for (const m of ms) {
    const s = await getScore(m.match_id);
    out.score_events += s.events.filter((e) => e.type === 'score' && !e.compensated && e.payload.player_id === playerId).length;
    if (s.status !== 'completed') continue;
    out.matches += 1;
    if (s.outcome === 'draw') out.draws += 1;
    else if (s.winner_team_id === clubId) out.wins += 1;
    else out.losses += 1;
  }
  return out;
}

async function followerCount(playerId) {
  return (await query('SELECT count(*)::int AS n FROM follows WHERE athlete_id = $1', [playerId])).rows[0].n;
}

async function profile(playerId, viewerId) {
  const p = (await query('SELECT p.player_id, p.name, p.position, p.club_id, c.name AS club_name FROM players p LEFT JOIN clubs c ON c.club_id = p.club_id WHERE p.player_id = $1', [playerId])).rows[0];
  if (!p) throw new AppError(E.PLAYER_NOT_FOUND, { player_id: playerId });
  const fixtures = [];
  if (p.club_id) {
    const ms = (await query(`SELECT match_id, home_team_id, away_team_id, to_char(scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS scheduled_at FROM matches WHERE home_team_id = $1 OR away_team_id = $1 ORDER BY scheduled_at NULLS LAST, match_id`, [p.club_id])).rows;
    for (const m of ms) if ((await getScore(m.match_id)).status === 'upcoming') fixtures.push({ match_id: m.match_id, scheduled_at: m.scheduled_at, opponent: m.home_team_id === p.club_id ? m.away_team_id : m.home_team_id });
  }
  const vods = (await query(`SELECT vod_id, to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS recorded_at, duration_s FROM vods WHERE player_id = $1 ORDER BY recorded_at DESC`, [playerId])).rows
    .map((v) => ({ vod_id: v.vod_id, title: `Replay ${v.recorded_at}`, playback_url: `/web/vod/${v.vod_id}/index.m3u8`, recorded_at: v.recorded_at, duration_s: v.duration_s }));
  const key = (await query("SELECT stream_key FROM stream_keys WHERE player_id = $1 AND status = 'active' AND live", [playerId])).rows[0];
  const body = {
    player_id: p.player_id, name: p.name, position: p.position, club: p.club_id ? { club_id: p.club_id, name: p.club_name } : null,
    career: await career(p.club_id, playerId), upcoming_fixtures: fixtures, vods,
    live: key ? { stream_key_prefix: key.stream_key.slice(0, 12), hls_url: hlsUrl(key.stream_key) } : null,
    follower_count: await followerCount(playerId),
  };
  if (viewerId !== null) {
    body.is_following = (await query('SELECT 1 FROM follows WHERE follower_id = $1 AND athlete_id = $2', [viewerId, playerId])).rows.length === 1;
  }
  return body;
}

async function setFollow(followerId, playerId, on) {
  if (!(await query('SELECT 1 FROM players WHERE player_id = $1', [playerId])).rows.length) throw new AppError(E.PLAYER_NOT_FOUND, { player_id: playerId });
  if (on) await query('INSERT INTO follows (follower_id, athlete_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [followerId, playerId]);
  else await query('DELETE FROM follows WHERE follower_id = $1 AND athlete_id = $2', [followerId, playerId]);
  return { player_id: playerId, following: on, follower_count: await followerCount(playerId) };
}

module.exports = { profile, setFollow };
