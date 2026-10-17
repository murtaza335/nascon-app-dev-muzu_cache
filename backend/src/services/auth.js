'use strict';
// Token issuance (FR-5.1-02). Claims per BR-AUTH-02; the secret is derived from the salt unless JWT_SECRET is set.
const config = require('../config');
const jwt = require('../lib/jwt');
const users = require('../repos/users');

const secret = () => config.jwtSecret || jwt.deriveSecret(config.day1Salt);
const nowSec = () => Math.floor(Date.now() / 1000);

function issueToken(user) {
  return jwt.sign({
    sub: user.user_id,
    role: user.role,
    tenant_id: user.tenant_id,
    league_ids: user.league_ids,
    club_id: user.club_id,
    player_id: user.player_id,
  }, secret(), { nowSec: nowSec(), ttlSeconds: config.jwtTtlSeconds });
}

function verifyToken(token) {
  return jwt.verify(token, secret(), nowSec());
}

function principalFromClaims(c) {
  return {
    user_id: c.sub,
    role: c.role,
    tenant_id: c.tenant_id ?? null,
    league_ids: Array.isArray(c.league_ids) ? c.league_ids : [],
    club_id: c.club_id ?? null,
    player_id: c.player_id ?? null,
  };
}

const CONTEXT = {
  tenant_id: 'tenant-alpha', foreign_tenant_id: 'tenant-beta',
  own_league_id: 'league-alpha-1', other_league_id: 'league-alpha-2', foreign_league_id: 'league-beta-1',
  own_club_id: 'club-alpha-1', other_club_id: 'club-alpha-2', foreign_club_id: 'club-beta-1',
  own_player_id: 'player-alpha-1', other_player_id: 'player-alpha-2', foreign_player_id: 'player-beta-1',
};

// API-14: one token per role, issued for the seeded demo users, plus the scenario ids.
async function rbacMatrix() {
  const rows = await users.findDemoUsers();
  const tokens = {};
  for (const u of rows) tokens[u.role] = issueToken(u).token;
  return { tokens, context: CONTEXT };
}

module.exports = { issueToken, verifyToken, principalFromClaims, rbacMatrix };
