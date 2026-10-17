const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise pure display adapters using the existing TypeScript dependency.
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, relative);
  if (cache.has(filename)) return cache.get(filename);
  const exports = {};
  cache.set(filename, exports);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  new Function('exports', 'require', outputText)(exports, name => name.startsWith('.')
    ? load(path.relative(__dirname, path.resolve(path.dirname(filename), `${name}.ts`))) : require(name));
  return exports;
}
const { screenRegistry, tabsForRole, canPreviewScreen } = load('../src/navigation/screenRegistry.ts');
const { getPreviewData } = load('../src/app/previewData.ts');
const { errorMessage } = load('../src/services/api/errorMessages.ts');
const roles = ['super_admin', 'league_organizer', 'club_manager', 'player', 'viewer'];

test('MOB-01..12: the design inventory contains exactly 31 unique screens', () => {
  assert.equal(screenRegistry.length, 31);
  assert.equal(new Set(screenRegistry.map(x => x.id)).size, 31);
  assert.equal(new Set(screenRegistry.map(x => x.title)).size, 31);
});
test('MOB-01/10: every role starts at Fixtures with at most five tabs', () => {
  for (const role of roles) {
    assert.equal(tabsForRole(role)[0], 'Fixtures');
    assert.ok(tabsForRole(role).length <= 5);
  }
  assert.ok(tabsForRole('club_manager').includes('Roster'));
  assert.ok(tabsForRole('league_organizer').includes('Scoring'));
});
test('MOB-07/08: management screens respect the role visibility matrix', () => {
  for (const role of roles) {
    for (const id of ['S16', 'S17', 'S18']) assert.equal(canPreviewScreen(id, role), ['club_manager', 'super_admin'].includes(role));
    for (const id of ['S19', 'S20']) assert.equal(canPreviewScreen(id, role), ['league_organizer', 'super_admin'].includes(role));
  }
  assert.equal(canPreviewScreen('missing', 'super_admin'), false);
});
test('MOB-01/10: preview account selection preserves all five documented roles', () => {
  for (const role of roles) assert.equal(getPreviewData(role).user.role, role);
});
test('MOB-02/04/05: admin tenant switching does not retain primary tenant content', () => {
  const primary = getPreviewData('super_admin');
  const other = primary.tenants.find(x => x.tenant_id !== primary.tenant.tenant_id);
  const secondary = getPreviewData('super_admin', other.tenant_id);
  assert.equal(secondary.tenant.tenant_id, other.tenant_id);
  for (const key of ['fixtures', 'clubs', 'players', 'products', 'orders', 'queue']) assert.equal(secondary[key].length, 0);
  assert.deepEqual(secondary.standings, {});
});
test('MOB-01: a tenant override cannot switch a non-admin account', () => {
  const data = getPreviewData('viewer');
  assert.equal(getPreviewData('viewer', 'unrelated').tenant.tenant_id, data.tenant.tenant_id);
});
test('MOB-03: match projections preserve version and compensation history', () => {
  const data = getPreviewData('viewer');
  assert.ok(data.fixtures.length > 0);
  for (const match of data.fixtures) {
    assert.equal(match.version, match.events.length);
    assert.ok(match.home_name && match.away_name);
  }
  assert.ok(data.fixtures.some(x => x.events.some(event => event.compensated)));
});
test('MOB-07/08/12: only the relevant account receives its offline queue', () => {
  for (const role of ['viewer', 'player', 'super_admin']) assert.equal(getPreviewData(role).queue.length, 0);
  for (const role of ['club_manager', 'league_organizer']) {
    assert.ok(getPreviewData(role).queue.length > 0);
    assert.ok(getPreviewData(role).queue.every(x => x.status === 'pending'));
  }
});
test('MOB-12: alternate manager sync outcomes remain separate scenarios', () => {
  for (const status of ['applied', 'rejected', 'duplicate']) {
    const data = getPreviewData('club_manager', undefined, status);
    assert.ok(data.queue.length > 0);
    assert.ok(data.queue.every(x => x.status === status));
    if (status === 'rejected') assert.ok(data.queue.every(x => x.reason));
  }
  assert.ok(getPreviewData('club_manager').queue.every(x => x.status === 'pending'));
});
test('MOB-06: seeded cart resolves real variants and integer paisa prices', () => {
  const data = getPreviewData('viewer');
  for (const line of data.initialCart) {
    assert.ok(data.products.some(x => x.product_id === line.productId && x.variants.some(v => v.variant_id === line.variant.variant_id)));
    assert.ok(Number.isInteger(line.variant.price_minor));
  }
});
test('MOB-01..12: adapters do not share mutable preview data', () => {
  const first = getPreviewData('viewer');
  first.products[0].name = 'Changed locally';
  assert.notEqual(getPreviewData('viewer').products[0].name, first.products[0].name);
});
test('MOB-11: unknown server errors have a plain-language fallback', () => {
  const text = errorMessage('UNRECOGNIZED_CODE');
  assert.ok(text.length > 20);
  assert.equal(text.includes('UNRECOGNIZED_CODE'), false);
});
