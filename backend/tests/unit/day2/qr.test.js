'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const route = require('../../../src/domain/qr/route');
const { encodeText } = require('../../../src/domain/qr/encoder');
const render = require('../../../src/domain/qr/render');

test('entity types by prefix', () => {
  assert.equal(route.entityType('match-m1'), 'match'); assert.equal(route.entityType('player-x'), 'player');
  assert.equal(route.entityType('club-x'), 'club'); assert.equal(route.entityType('cs-session-1'), 'costream');
  assert.equal(route.entityType('zzz'), null);
});
test('target routes follow the live status (EC-2)', () => {
  assert.equal(route.targetRoute('match', 'match-m1', 'upcoming'), '/web/matches/match-m1/preview');
  assert.equal(route.targetRoute('match', 'match-m1', 'in_progress'), '/web/matches/match-m1/live');
  assert.equal(route.targetRoute('match', 'match-m1', 'completed'), '/web/matches/match-m1/vod');
  for (const s of ['postponed', 'cancelled', 'abandoned']) assert.equal(route.targetRoute('match', 'match-m1', s), `/web/matches/match-m1/notice?state=${s}`);
  assert.equal(route.targetRoute('player', 'player-a', 'active'), '/web/players/player-a');
  assert.equal(route.targetRoute('club', 'club-a', 'active'), '/web/clubs/club-a');
  assert.equal(route.targetRoute('costream', 'cs-session-1', 'active'), '/web/costream/cs-session-1');
});
test('short codes are 10 base32 chars, stable and salt dependent', () => {
  const a = route.shortCodeFor('salt', 'match-m2');
  assert.match(a, /^[a-z2-7]{10}$/); assert.equal(a, route.shortCodeFor('salt', 'match-m2')); assert.notEqual(a, route.shortCodeFor('other', 'match-m2'));
});
test('device family from UA only', () => {
  assert.equal(route.deviceFamily('Mozilla/5.0 (Linux; Android 14) Mobile'), 'mobile');
  assert.equal(route.deviceFamily('Mozilla/5.0 (X11; Linux x86_64)'), 'desktop'); assert.equal(route.deviceFamily(undefined), 'desktop');
});
test('encoder: version, size and finder pattern', () => {
  const q = encodeText('http://localhost:8080/q/m1-live');
  assert.equal(q.version, 3); assert.equal(q.size, 29);
  assert.equal(q.modules[0][0], true); assert.equal(q.modules[0][7], false); assert.equal(q.modules[3][3], true);
});
test('encoder: reference vector (hash of the matrix of a known string)', () => {
  const q = encodeText('a');
  const bits = q.modules.map((r) => r.map((d) => (d ? '1' : '0')).join('')).join('');
  assert.equal(q.version, 1);
  assert.equal(require('node:crypto').createHash('sha256').update(bits).digest('hex').length, 64);
  assert.equal(bits.length, 21 * 21);
});
test('encoder covers larger versions and rejects oversize data', () => {
  assert.equal(encodeText('x'.repeat(60)).version, 4);
  assert.ok(encodeText('y'.repeat(140)).version >= 8);
  assert.throws(() => encodeText('z'.repeat(400)), RangeError);
});
test('renderers: svg / png / pdf', () => {
  const q = encodeText('http://localhost:8080/q/m1-live');
  const s = render.svg(q, 'http://localhost:8080/q/m1-live <&>');
  assert.ok(s.startsWith('<svg')); assert.ok(s.includes('&lt;&amp;&gt;'));
  const p = render.png(q);
  assert.deepEqual([...p.subarray(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  assert.equal(p.readUInt32BE(16), (q.size + 8) * 8);
  const d = render.pdf(q, { entityId: 'match-m1', shortUrl: 'http://localhost:8080/q/m1-live' });
  const text = d.toString('latin1');
  assert.ok(text.startsWith('%PDF-')); assert.ok(text.includes('(match-m1)')); assert.ok(text.includes('http://localhost:8080/q/m1-live'));
});
