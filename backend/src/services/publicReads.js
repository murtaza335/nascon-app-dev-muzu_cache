'use strict';
// API-D2-57..61, 33, 35: unauthenticated read models for the Guest Web Player and the clients.
const { query } = require('../db');
const { AppError, E } = require('../errors');
const { hlsUrl, whepUrl, compositeUrl } = require('../lib/urls');
const { getScore } = require('./score');
const costream = require('./costream');
const athletes = require('./athletes');

async function teamView(teamId, score) {
  const { rows } = await query('SELECT name FROM clubs WHERE club_id = $1', [teamId]);
  return { team_id: teamId, name: rows[0] ? rows[0].name : teamId, badge_url: null, score };
}

async function pinned(matchId) {
  const { rows } = await query(
    `SELECT p.product_id, p.name, v.variant_id, v.price_minor AS unit_price_minor, (v.stock - v.reserved) AS stock_available
     FROM matches m JOIN products p ON p.product_id = m.pinned_product_id JOIN variants v ON v.product_id = p.product_id
     WHERE m.match_id = $1 ORDER BY (v.stock - v.reserved > 0) DESC, v.variant_id LIMIT 1`, [matchId]);
  return rows[0] || null;
}

async function vodsForMatch(matchId) {
  const { rows } = await query(
    `SELECT vod_id, duration_s, to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS recorded_at FROM vods WHERE match_id = $1 ORDER BY recorded_at DESC`, [matchId]);
  return rows.map((r) => ({ vod_id: r.vod_id, playback_url: `/web/vod/${r.vod_id}/index.m3u8`, duration_s: r.duration_s }));
}

async function match(matchId) {
  const s = await getScore(matchId);
  const key = (await query('SELECT stream_key, live FROM stream_keys WHERE match_id = $1 AND status = \'active\' ORDER BY seq DESC LIMIT 1', [matchId])).rows[0];
  return {
    match_id: matchId, status: s.status, home: await teamView(s.home.team_id, s.home.score), away: await teamView(s.away.team_id, s.away.score),
    score_text: `${s.home.score} - ${s.away.score}`, pinned_product: await pinned(matchId),
    stream: key ? { status: key.live ? 'live' : 'offline', hls_url: hlsUrl(key.stream_key), whep_url: whepUrl(key.stream_key) } : null,
    vod: await vodsForMatch(matchId),
    chat_room_id: `chat-match-${matchId}`,
  };
}

async function club(clubId) {
  const c = (await query('SELECT club_id, name FROM clubs WHERE club_id = $1', [clubId])).rows[0];
  if (!c) throw new AppError(E.CLUB_NOT_FOUND);
  const players = (await query('SELECT player_id, name, position FROM players WHERE club_id = $1 ORDER BY player_id', [clubId])).rows;
  const ms = (await query('SELECT match_id, home_team_id, away_team_id FROM matches WHERE home_team_id = $1 OR away_team_id = $1 ORDER BY match_id', [clubId])).rows;
  const live = []; const upcoming = [];
  for (const m of ms) {
    const s = await getScore(m.match_id);
    const row = { match_id: m.match_id, home_team_id: m.home_team_id, away_team_id: m.away_team_id, status: s.status };
    if (s.status === 'in_progress') live.push(row); else if (s.status === 'upcoming') upcoming.push(row);
  }
  return { club_id: c.club_id, name: c.name, badge_url: null, players, upcoming, live_matches: live };
}

async function liveStreams() {
  const { rows } = await query("SELECT stream_key, player_id, match_id FROM stream_keys WHERE status = 'active' AND live ORDER BY seq");
  return rows.map((r) => ({ player_id: r.player_id, match_id: r.match_id, hls_url: hlsUrl(r.stream_key), whep_url: whepUrl(r.stream_key), started_at: null }));
}

async function vods(q) {
  const player = typeof q.player_id === 'string' ? q.player_id : null;
  const matchId = typeof q.match_id === 'string' ? q.match_id : null;
  const { rows } = await query(
    `SELECT vod_id, player_id, match_id, duration_s, to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS recorded_at
     FROM vods WHERE ($1::text IS NULL OR player_id = $1) AND ($2::text IS NULL OR match_id = $2) ORDER BY recorded_at DESC`, [player, matchId]);
  return rows.map((r) => ({ ...r, playback_url: `/web/vod/${r.vod_id}/index.m3u8` }));
}

module.exports = { match, club, liveStreams, vods, player: (id) => athletes.profile(id, null), costream: costream.publicView, compositeUrl };
