/* Flags non-Arabic junk that leaked into Arabic string literals across src/.
   Suspicious = any token in an Arabic-containing string literal that is
   (a) CJK, or (b) Latin and not on the small inline-term allow-list.
   Run: node scripts/lint_str.mjs */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

/* Terms that legitimately appear inline inside Arabic prose. Case-sensitive. */
const ALLOW = new Set([
  'RSI', 'MACD', 'EMA', 'SMA', 'ATR', 'Bollinger', 'TASI', 'OHLC', 'P/E', 'P/B',
  'OBV', 'ADX', 'SuperTrend', 'Stop', 'VIP', 'PDF', 'API', 'AI',
]);

const HAS_AR = /[\u0600-\u06FF]/;
const HAS_CJK = /[\u3000-\u9FFF]/;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return walk(p);
  return /\.(jsx?|mjs)$/.test(e.name) ? [p] : [];
});

const files = walk(ROOT);
const findings = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);

  // string + template literals (no cross-line strings in this codebase)
  const literals = src.match(/(['"`])(?:(?!\1)[^\\\n]|\\.)*\1/g) || [];

  for (const lit of literals) {
    // strip ${...} interpolations — variable names are not prose
    const body = lit.slice(1, -1).replace(/\$\{[^}]*\}/g, ' ¦ ');
    if (!HAS_AR.test(body)) continue;           // only Arabic-bearing strings

    // (a) CJK anywhere
    const cjk = body.match(/[\u3000-\u9FFF]+/g);
    for (const c of cjk || []) {
      findings.push({ rel, kind: 'CJK', token: c, ctx: body.slice(Math.max(0, body.indexOf(c) - 40), body.indexOf(c) + c.length + 40) });
    }

    // (b) Latin tokens not explicitly allowed
    for (const w of body.match(/[A-Za-z]{2,}/g) || []) {
      if (ALLOW.has(w)) continue;
      findings.push({ rel, kind: 'LATIN', token: w, ctx: body.slice(Math.max(0, body.indexOf(w) - 40), body.indexOf(w) + w.length + 40) });
    }
  }
}

for (const f of findings) {
  console.log(`${f.rel}  [${f.kind}] "${f.token}"\n    …${f.ctx}…`);
}
console.log(findings.length
  ? `\n${findings.length} suspect token(s) across ${files.length} files`
  : `clean: ${files.length} files checked`);

process.exit(findings.length ? 1 : 0);
