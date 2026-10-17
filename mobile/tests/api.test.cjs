const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const exports = {};
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  new Function('exports', 'require', outputText)(exports, name => name in overrides ? overrides[name] : name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), name + '.ts')), overrides) : require(name));
  return exports;
}
const { createClient, ApiError, normalizeServer } = load('services/api/client.ts');
const { matchView, orderView, loadData } = load('services/api/models.ts');
const { queuePayload } = load('services/api/commands.ts');
const { tabsForRole } = load('navigation/screenRegistry.ts');

test('APP-01: HTTP login carries credentials in JSON without authorization', async () => {
  const prior = global.fetch;
  try { global.fetch = async (url, options) => { assert.equal(url, 'http://localhost:8080/api/v1/auth/login'); assert.equal(options.headers.Authorization, undefined); assert.deepEqual(JSON.parse(options.body), { email: 'a@b.test', password: 'secret' }); return { ok: true, json: async () => ({ token: 'issued' }) }; };
    assert.deepEqual(await createClient('http://localhost:8080').request('/auth/login', 'POST', { email: 'a@b.test', password: 'secret' }), { token: 'issued' });
  } finally { global.fetch = prior; }
});
test('APP-02: protected 401 clears session once and preserves readable error', async () => {
  const prior = global.fetch; let expired = 0;
  try { global.fetch = async (_, options) => { assert.equal(options.headers.Authorization, 'Bearer issued'); return { ok: false, status: 401, json: async () => ({ error: { code: 'UNAUTHENTICATED' } }) }; };
    await assert.rejects(createClient('http://server', 'issued', async () => { expired++; }).request('/me'), error => error.status === 401 && error.message.includes('sign in')); assert.equal(expired, 1);
  } finally { global.fetch = prior; }
});
test('APP-10: pagination consumes every page and keeps existing query', async () => {
  const prior = global.fetch; const urls = [];
  try { global.fetch = async url => { urls.push(url); return { ok: true, json: async () => ({ data: urls.length === 1 ? Array.from({ length: 100 }, (_, i) => i) : [100], total: 101 }) }; };
    assert.equal((await createClient('http://server', 't').list('/leagues?filter=a')).length, 101); assert.ok(urls[1].endsWith('filter=a&limit=100&offset=100'));
  } finally { global.fetch = prior; }
});
test('NFR-4: network failures never become fabricated success responses', async () => {
  const prior = global.fetch;
  try { global.fetch = async () => { throw new TypeError('network'); }; await assert.rejects(createClient('http://server').request('/me'), e => e instanceof ApiError && e.status === 0); } finally { global.fetch = prior; }
});
test('MOB-10: server addresses reject credentials, fragments, and non-HTTP schemes', () => {
  for (const value of ['file:///a', 'https://user:pass@server', 'https://server/#token', 'https://server/?token=x']) assert.throws(() => normalizeServer(value));
  assert.equal(normalizeServer(' http://10.0.2.2:8080/ '), 'http://10.0.2.2:8080');
});
test('APP-13: score projection maps nested sides, venue and corrections without computing scores', () => {
  const events = [{ event_id: 'e', sequence: 1, type: 'score', payload: {}, compensated: true }];
  const value = matchView({ match_id: 'm', league_id: 'l', status: 'in_progress', version: 3, home: { team_id: 'a', score: 7 }, away: { team_id: 'b', score: 2 }, events, venue: { venue_id: 'court' }, scheduled_at: null, pinned_product: { product_id: 'p', name: 'Kit' } });
  assert.deepEqual(value.score, { home: 7, away: 2 }); assert.equal(value.venue, 'court'); assert.equal(value.events[0].compensated, true); assert.deepEqual(value.pinned_product.variants, []);
});
test('APP-53: receipt payment time comes from the server payload', () => { assert.equal(orderView({ receipt: { payload: { paid_at: '2026-10-17T01:00:00Z' } } }).paid_at, '2026-10-17T01:00:00Z'); });
test('APP-40: score and compensation payloads preserve idempotency IDs', () => {
  assert.deepEqual(queuePayload({ kind: 'score', matchId: 'm', eventType: 'score', teamId: 't', scoringEvent: 'configured_event' }, {}, 'e', 'u'), { event_id: 'e', match_id: 'm', type: 'score', payload: { team_id: 't', event_type: 'configured_event' } });
  assert.deepEqual(queuePayload({ kind: 'score', matchId: 'm', eventType: 'compensation', targetId: 'original', reason: 'Correction' }, {}, 'e2', 'u').payload, { compensates: 'original', reason: 'Correction' });
});
test('APP-32/40: release sends null destination and current authenticated identity', () => {
  const payload = queuePayload({ kind: 'roster', playerId: 'p', leagueId: 'l', action: 'release', toSquadId: 'ignored', effectiveDate: '2026-10-17', reason: 'Requested' }, { players: [{ player_id: 'p', squad_id: 'sq' }] }, 'request', 'signed-in-user');
  assert.equal(payload.to_squad_id, null); assert.equal(payload.requested_by, 'signed-in-user'); assert.equal(payload.from_squad_id, 'sq'); assert.equal(payload.league_id, 'l');
});
test('MOB-01: role tabs stay within five destinations', () => { for (const role of ['viewer', 'player', 'club_manager', 'league_organizer', 'super_admin']) { assert.equal(tabsForRole(role)[0], 'Fixtures'); assert.ok(tabsForRole(role).length <= 5); } });
test('NFR-5: persisted scope separates server, user and tenant; token stays in Keychain', async () => {
  let stored; const keychain = { setGenericPassword: async (_, value) => { stored = value; }, getGenericPassword: async () => stored ? { password: stored } : false, resetGenericPassword: async () => { stored = null; } };
  const { sessionStorage, sessionScope } = load('services/auth/session.ts', { 'react-native-keychain': keychain });
  const session = { serverUrl: 'http://one', userId: 'u', tenantId: 'a', token: 'private' };
  await sessionStorage.save(session); assert.deepEqual(await sessionStorage.read(), session);
  for (const change of [{ serverUrl: 'http://two' }, { userId: 'v' }, { tenantId: 'b' }]) assert.notEqual(sessionScope(session), sessionScope({ ...session, ...change }));
  await sessionStorage.clear(); assert.equal(await sessionStorage.read(), null);
});
test('APP-03/10/30/50: server context drives resource selection without local seed data', async () => {
  const calls = [];
  const request = async route => { calls.push(route); if (route === '/me') return { user: { user_id: 'u' }, tenant: null }; if (route === '/context?tenant_id=chosen') return { tenants: [{ tenant_id: 'chosen', name: 'Chosen' }], clubs: [], squads: [], sports: [], players: [] }; if (route.endsWith('/standings')) return { table: [] }; throw new Error(route); };
  const list = async route => route === '/leagues' ? [{ league_id: 'l', tenant_id: 'chosen' }, { league_id: 'foreign', tenant_id: 'other' }] : [];
  const data = await loadData({ request, list }, 'chosen'); assert.equal(data.leagues.length, 1); assert.equal(data.tenant.name, 'Chosen'); assert.deepEqual(data.products, []); assert.deepEqual(data.players, []); assert.ok(!calls.some(x => x.includes('foreign')));
});

test('MOB-11/12: SQLite snapshot survives reopening and isolates pending work by scope', async () => {
  const rows = new Map();
  const sqlite = { enablePromise() {}, openDatabase: async () => ({ executeSql: async (sql, params = []) => {
    if (sql.startsWith('INSERT')) rows.set(params[0], params[1]);
    const payload = rows.get(params[0]); return [{ rows: { length: payload ? 1 : 0, item: () => ({ payload }) } }];
  } }) };
  const first = load('services/storage/storage.ts', { 'react-native-sqlite-storage': sqlite });
  const workspace = first.emptyWorkspace(); workspace.pending.push({ action_id: 'durable', type: 'score_event', queued_at: '2026-10-17T01:00:00Z', base_version: 0, payload: { match_id: 'm' } });
  await first.storage.saveWorkspace('server/user/tenant', workspace);
  const reopened = load('services/storage/storage.ts', { 'react-native-sqlite-storage': sqlite });
  assert.equal((await reopened.storage.readWorkspace('server/user/tenant')).pending[0].action_id, 'durable');
  assert.equal(await reopened.storage.readWorkspace('server/other/tenant'), null);
  assert.equal(JSON.stringify([...rows.values()]).includes('token'), false);
});

test('APP-32: multi-league players use the selected league registration', () => {
  const data = { players: [{ player_id: 'p', squad_id: 'wrong' }], registrations: [{ player_id: 'p', league_id: 'first', squad_id: 'wrong' }, { player_id: 'p', league_id: 'chosen', squad_id: 'correct' }] };
  const payload = queuePayload({ kind: 'roster', playerId: 'p', leagueId: 'chosen', action: 'release', effectiveDate: '2026-10-17', reason: 'Requested' }, data, 'r', 'u');
  assert.equal(payload.from_squad_id, 'correct');
});

test('NFR-ACC-01: both theme palettes retain readable body and status text', () => {
  const { darkColors, lightColors } = load('theme/tokens.ts', { 'react-native': { Platform: { select: value => value.android } } });
  const luminance = hex => { const parts = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722; };
  for (const palette of [darkColors, lightColors]) {
    for (const [fg, bg] of [['text', 'background'], ['secondary', 'surface'], ['muted', 'olive'], ['onAccent', 'accent'], ['success', 'successBg'], ['warning', 'warningBg'], ['error', 'errorBg'], ['info', 'infoBg']]) {
      const a = luminance(palette[fg]), b = luminance(palette[bg]); assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `${fg} on ${bg}`);
    }
  }
});
