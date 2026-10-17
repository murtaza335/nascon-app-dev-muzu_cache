'use strict';
// NFR-5 / AGENTS §3: parameterized SQL only. Finds template literals that look like SQL and checks every ${expr}
// against an allow-list of constants (column lists, join helpers, positional-parameter counters). Exit 1 on any other.
const fs = require('node:fs');
const path = require('node:path');

const ALLOWED = [
  /^(SQ|COLS|MATCH_COLS)$/, /^TABLES\.join\(', '\)$/, /^where\.join\(' AND '\)$/, /^sets\.join\(', '\)$/,
  /^where\.length \? `WHERE \$\{where\.join\(' AND '\)\}` : ''$/, /^params\.length$/, /^where\.length$/, /^sets\.length$/,
  /^where\.length\+1$/, /^\$\{.*\}$/,
];
const SQL = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE)\b/;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
}

let bad = 0;
for (const file of walk(path.join(__dirname, '..', 'backend', 'src'))) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/`([^`]*)`/gs)) {
    if (!SQL.test(m[1]) || !m[1].includes('${')) continue;
    for (const e of m[1].matchAll(/\$\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) {
      const expr = e[1].trim();
      if (!ALLOWED.some((a) => a.test(expr))) {
        const line = text.slice(0, m.index).split('\n').length;
        console.log(`FAIL  ${path.relative(process.cwd(), file)}:${line}  \${${expr}} in SQL text`);
        bad += 1;
      }
    }
  }
}
console.log(bad ? `${bad} unsafe interpolation(s)` : 'ok    SQL text only interpolates allow-listed constants');
process.exit(bad ? 1 : 0);
