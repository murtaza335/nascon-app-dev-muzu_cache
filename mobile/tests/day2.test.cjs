const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const web = path.resolve(__dirname, '../day2/web');
const requiredIds = [
  'guest-video-player', 'live-score-banner', 'pinned-merch-card',
  'add-to-guest-cart-btn', 'guest-cart-count', 'chat-message-list',
  'chat-input-field', 'chat-send-btn', 'progressive-auth-modal',
];

for (const file of ['live.html', 'costream.html']) {
  test(`Day 2 ${file} includes all required initial Selenium selectors`, () => {
    const html = fs.readFileSync(path.join(web, file), 'utf8');
    for (const id of requiredIds) assert.match(html, new RegExp(`data-testid=["']${id}["']`), `${file} is missing ${id}`);
  });
}

test('Day 2 route templates remain frontend-owned and load the shared page client', () => {
  for (const file of ['preview.html', 'vod.html', 'notice.html', 'player.html', 'club.html', 'costream.html']) {
    const html = fs.readFileSync(path.join(web, file), 'utf8');
    assert.match(html, /assets\/page\.js/);
    assert.match(html, /id="boot"/);
  }
});

test('Android scheme is configured without editing generated native files', () => {
  const app = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../app.json'), 'utf8'));
  assert.equal(app.expo.scheme, 'nascon');
  assert.ok(app.expo.plugins.includes('./plugins/withNasconScheme.cjs'));
});
