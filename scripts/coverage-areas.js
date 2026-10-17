'use strict';
// lcov → COVERAGE.json: line coverage (%) per graded area (ARCHITECTURE §4.3). Usage: node scripts/coverage-areas.js reports/lcov.info
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const AREAS = {
  fixtures: ['backend/src/domain/fixtures/'],
  scoring: ['backend/src/domain/scoring/', 'backend/src/lib/canonical.js', 'backend/src/lib/signature.js'],
  standings: ['backend/src/domain/standings/', 'backend/src/lib/pyround.js'],
  store: ['backend/src/domain/store/'],
  roster: ['backend/src/domain/roster/'],
  rbac: ['backend/src/domain/rbac/', 'backend/src/lib/jwt.js'],
};

function parseLcov(text) {
  const files = new Map();
  let cur = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('SF:')) {
      const sf = line.slice(3);
      // node's lcov paths are relative to the directory the tests ran in (backend/)
      cur = path.relative(ROOT, path.isAbsolute(sf) ? sf : path.join(ROOT, 'backend', sf)).split(path.sep).join('/');
      files.set(cur, { found: 0, hit: 0 });
    } else if (line.startsWith('LF:') && cur) files.get(cur).found = Number(line.slice(3));
    else if (line.startsWith('LH:') && cur) files.get(cur).hit = Number(line.slice(3));
  }
  return files;
}

function measure(files, prefixes) {
  let found = 0;
  let hit = 0;
  const seen = [];
  for (const [f, v] of files) {
    if (prefixes.some((p) => f === p || f.startsWith(p))) { found += v.found; hit += v.hit; seen.push(f); }
  }
  // Source files that no test loaded are absent from lcov: count them as uncovered so the number is honest.
  for (const p of prefixes) {
    const abs = path.join(ROOT, p);
    const list = fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? fs.readdirSync(abs).filter((n) => n.endsWith('.js')).map((n) => `${p}${n}`) : [p];
    for (const f of list) if (!seen.includes(f) && fs.existsSync(path.join(ROOT, f))) found += fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter((l) => l.trim()).length;
  }
  return found === 0 ? 0 : Math.round((hit / found) * 1000) / 10;
}

const lcovPath = path.resolve(process.argv[2] || path.join(ROOT, 'reports/lcov.info'));
const files = parseLcov(fs.readFileSync(lcovPath, 'utf8'));
const out = {};
for (const [area, prefixes] of Object.entries(AREAS)) out[area] = measure(files, prefixes);
fs.writeFileSync(path.join(ROOT, 'COVERAGE.json'), `${JSON.stringify(out)}\n`);
console.log('COVERAGE.json', JSON.stringify(out));
