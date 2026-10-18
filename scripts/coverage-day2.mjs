// lcov → COVERAGE_DAY2.json: line coverage (%) for the five Part II backend modules (spec §7.2, day2/QA-HARNESS §7).
// Usage: node scripts/coverage-day2.mjs reports/lcov.info   (never hand-edited; one decimal, numbers not strings)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AREAS = {
  streaming: ['backend/src/domain/streaming/'],
  costream: ['backend/src/domain/costream/'],
  qr_guest: ['backend/src/domain/qr/', 'backend/src/domain/guest/'],
  moderation_dlq: ['backend/src/domain/moderation/', 'backend/src/domain/notify/'],
  observability: ['backend/src/domain/observability/', 'backend/src/domain/privacy/'],
};

function parse(text) {
  const files = new Map();
  let cur = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('SF:')) {
      const sf = line.slice(3);
      cur = path.relative(ROOT, path.isAbsolute(sf) ? sf : path.join(ROOT, 'backend', sf)).split(path.sep).join('/');
      files.set(cur, { found: 0, hit: 0 });
    } else if (line.startsWith('LF:') && cur) files.get(cur).found = Number(line.slice(3));
    else if (line.startsWith('LH:') && cur) files.get(cur).hit = Number(line.slice(3));
  }
  return files;
}

function measure(files, prefixes) {
  let found = 0; let hit = 0; const seen = new Set();
  for (const [f, v] of files) if (prefixes.some((p) => f.startsWith(p))) { found += v.found; hit += v.hit; seen.add(f); }
  for (const p of prefixes) { // files no test loaded count as uncovered
    const dir = path.join(ROOT, p);
    if (!fs.existsSync(dir)) continue;
    for (const n of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      if (!seen.has(`${p}${n}`)) found += fs.readFileSync(path.join(dir, n), 'utf8').split('\n').filter((l) => l.trim()).length;
    }
  }
  return found === 0 ? 0 : Math.round((hit / found) * 1000) / 10;
}

const files = parse(fs.readFileSync(path.resolve(process.argv[2] || path.join(ROOT, 'reports/lcov.info')), 'utf8'));
const out = Object.fromEntries(Object.entries(AREAS).map(([k, v]) => [k, measure(files, v)]));
fs.writeFileSync(path.join(ROOT, 'COVERAGE_DAY2.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log('COVERAGE_DAY2.json', JSON.stringify(out));
