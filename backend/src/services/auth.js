'use strict';
// Token issuance (FR-5.1-02). Claims per BR-AUTH-02; the secret is derived from the salt unless JWT_SECRET is set.
const config = require('../config');
const jwt = require('../lib/jwt');
const users = require('../repos/users');
const appRepo = require('../repos/app');
const passwords = require('../seed/passwords');
const { AppError, E, validationError } = require('../errors');
const { isoSeconds } = require('../lib/time');

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

const userView = (u) => ({
  user_id: u.user_id, email: u.email, role: u.role, tenant_id: u.tenant_id, display_name: u.display_name,
  league_ids: u.league_ids, club_id: u.club_id, player_id: u.player_id,
});

async function tenantView(tenantId) {
  if (!tenantId) return null;
  const t = await appRepo.getTenant(tenantId);
  if (!t) return null;
  return { tenant_id: t.tenant_id, name: t.name, logo_url: t.logo_url, colors: { primary: t.colors.primary ?? null, secondary: t.colors.secondary ?? null } };
}

// APP-01. The same error for an unknown email and a wrong password; a dummy verify keeps the timing alike.
async function login(input) {
  const fields = [];
  if (!input || typeof input.email !== 'string' || input.email.length < 1 || input.email.length > 254) fields.push('email');
  if (!input || typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 200) fields.push('password');
  if (fields.length) throw validationError(fields);
  const user = await users.findByEmail(input.email.trim());
  const ok = passwords.verify(input.password, user ? user.password_hash : passwords.demoPasswordHash());
  if (!user || !ok) throw new AppError(E.INVALID_CREDENTIALS);
  const { token, claims } = issueToken(user);
  return { token, expires_at: isoSeconds(new Date(claims.exp * 1000)), user: userView(user), tenant: await tenantView(user.tenant_id) };
}

// APP-02
async function me(principal) {
  const user = await appRepo.getUserById(principal.user_id);
  if (!user) throw new AppError(E.UNAUTHENTICATED);
  return { user: userView(user), tenant: await tenantView(user.tenant_id) };
}

module.exports = { issueToken, verifyToken, principalFromClaims, rbacMatrix, login, me };
