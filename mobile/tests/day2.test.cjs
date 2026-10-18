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

test('Day 2 screen deep links expose accessibility IDs and browser QA enforces timing and WCAG checks', () => {
  const screens = fs.readFileSync(path.resolve(__dirname, '../src/features/day2/Day2Screens.tsx'), 'utf8');
  assert.match(screens, /testID="match-live-screen" accessibilityLabel="match-live-screen"/);
  assert.match(screens, /testID="costream-screen" accessibilityLabel="costream-screen"/);

  const css = fs.readFileSync(path.join(web, 'assets/app.css'), 'utf8');
  assert.match(css, /\.brand\s*\{[^}]*min-height:\s*48px/s);

  const selenium = path.resolve(__dirname, '../../tests/selenium');
  const scoreTest = fs.readFileSync(path.join(selenium, 'test_guest_grid.py'), 'utf8');
  assert.match(scoreTest, /WebDriverWait\(driver,\s*0\.5/);
  assert.match(scoreTest, /time\.perf_counter\(\)\s*-\s*response_received_at\s*<\s*0\.5/);
  assert.ok(fs.existsSync(path.join(selenium, 'test_guest_accessibility.py')));
});
