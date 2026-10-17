const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

// Use the existing dev dependency; the fixture itself has no runtime imports.
const source = readFileSync(`${__dirname}/fixtures/mockData.ts`, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const fixtureExports = {};
new Function('exports', compiled.outputText)(fixtureExports);
const { mockData, createMockData } = fixtureExports;

test('MOB-02/03: fixture IDs, scores, event sequences and compensations agree', () => {
  const matches = mockData.api.matches_by_id;
  for (const fixture of mockData.api.fixtures_by_league['league-alpha-1'].data) {
    const match = matches[fixture.match_id];
    assert.ok(match);
    assert.equal(fixture.version, match.events.length);
    assert.equal(match.version, match.events.length);
    assert.deepEqual(fixture.score, { home: match.home.score, away: match.away.score });
    for (const [index, event] of match.events.entries()) {
      assert.equal(event.sequence, index + 1);
      if (event.compensated) {
        const correction = match.events.find(item => item.event_id === event.compensated_by);
        assert.equal(correction.type, 'compensation');
        assert.equal(correction.payload.compensates, event.event_id);
      }
    }
    for (const team of [match.home, match.away]) {
      const points = match.events.filter(event => event.type === 'score' && !event.compensated && event.payload.team_id === team.team_id)
        .reduce((sum, event) => sum + mockData.prototype.sport_config.scoring_events[event.payload.event_type].points, 0);
      assert.equal(team.score, points);
    }
  }
});

test('MOB-04: standings reflect only completed matches and have all h2h pairs', () => {
  const standings = mockData.api.standings_by_league['league-alpha-1'];
  const completed = Object.values(mockData.api.matches_by_id).filter(match => match.status === 'completed');
  for (const row of standings.table) {
    const played = completed.filter(match => [match.home.team_id, match.away.team_id].includes(row.team_id));
    assert.equal(row.played, played.length);
    const scored = played.reduce((sum, match) => sum + (match.home.team_id === row.team_id ? match.home.score : match.away.score), 0);
    const conceded = played.reduce((sum, match) => sum + (match.home.team_id === row.team_id ? match.away.score : match.home.score), 0);
    assert.equal(row.scored, scored);
    assert.equal(row.conceded, conceded);
    assert.equal(row.diff, scored - conceded);
    assert.equal(row.points, row.won * 3 + row.drawn);
    for (const opponent of standings.table.filter(other => other.team_id !== row.team_id)) {
      assert.ok(standings.h2h[row.team_id][opponent.team_id]);
    }
  }
});

test('MOB-06: cart, checkout, receipt and product prices use consistent integer paisa', () => {
  const payload = mockData.prototype.receipt.payload;
  const subtotal = payload.items.reduce((sum, item) => {
    const variant = mockData.api.products.data.flatMap(product => product.variants).find(variant => variant.variant_id === item.variant_id);
    assert.equal(item.unit_price_minor, variant.price_minor);
    assert.ok(Number.isInteger(item.unit_price_minor));
    return sum + item.unit_price_minor * item.quantity;
  }, 0);
  assert.equal(payload.subtotal_minor, subtotal);
  assert.equal(payload.discount_minor, Math.floor(subtotal * 10 / 100));
  assert.equal(payload.total_minor, subtotal - payload.discount_minor);
  assert.equal(payload.order_id, mockData.requests.checkout.order_id);
  assert.equal(mockData.prototype.receipt.pdf_base64, null);
});

test('MOB-07/12: manager queue is scoped and transfer references known squads/player', () => {
  const session = mockData.prototype.offline_sessions.manager;
  assert.equal(session.scope.user_id, mockData.api.me_by_role.club_manager.user.user_id);
  for (const action of session.request.actions) {
    assert.equal(action.type, 'roster_transfer');
    assert.equal(action.payload.requested_by, session.scope.user_id);
    assert.ok(Object.values(mockData.api.clubs_by_id).flatMap(club => club.roster).some(player => player.player_id === action.payload.player_id));
    for (const squadId of [action.payload.from_squad_id, action.payload.to_squad_id]) {
      assert.ok(mockData.prototype.squads.some(squad => squad.squad_id === squadId && squad.tenant_id === session.scope.tenant_id));
    }
  }
});

test('MOB-08/12: organizer actions and sync versions/results agree', () => {
  const session = mockData.prototype.offline_sessions.organizer;
  const outcome = mockData.outcomes.organizer_sync;
  assert.equal(outcome.device_id, session.request.device_id);
  let version = mockData.api.matches_by_id['demo-live'].version;
  for (const [index, action] of session.request.actions.entries()) {
    assert.equal(action.type, 'score_event');
    assert.equal(action.payload.match_id, 'demo-live');
    const result = outcome.results[index];
    assert.equal(result.action_id, action.action_id);
    assert.equal(result.resolution, action.base_version === version ? 'appended' : 'rebased_append');
    assert.equal(result.server_version, ++version);
  }
  for (const result of Object.values(mockData.outcomes).filter(value => 'summary' in value)) {
    for (const status of ['applied', 'rejected', 'duplicate']) {
      assert.equal(result.summary[status], result.results.filter(item => item.status === status).length);
    }
  }
});

test('MOB-01..12: timestamps, pagination and independent preview state', () => {
  function visit(value, key = '') {
    if (typeof value === 'string' && /(_at|^when)$/.test(key) && value) {
      assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      assert.ok(Number.isFinite(Date.parse(value)));
    }
    if (!value || typeof value !== 'object') return;
    if ('data' in value && 'total' in value) assert.equal(value.total, value.data.length);
    for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
  }
  visit(mockData);
  const first = createMockData();
  const second = createMockData();
  first.api.products.data[0].variants[0].stock = 999;
  assert.equal(second.api.products.data[0].variants[0].stock, 1);
  assert.equal(mockData.api.products.data[0].variants[0].stock, 1);
});
