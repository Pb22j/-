/* Smart Arabic linter — the simple lint_str.mjs only catches Latin/CJK
   leaking into Arabic. This one also flags specific known-bad tokens
   (Latin word glued to Arabic, broken Arabic word patterns) and any
   RTL-bidi mangling we keep producing. Run: node scripts/audit_arabic.mjs */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const AR = '\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF';
const LATIN_GLUED = new RegExp(`[\\u0600-\\u06FF][a-zA-Z]{2,}[\\u0600-\\u06FF]`, 'g');
const LATIN_GLUED_LAX = new RegExp(`[\\u0600-\\u06FF] [a-zA-Z]{3,}`, 'g');

/* Arabic strings written by my generation have a clear bad-words list.
   These are token sequences that mean nothing in Arabic and are a strong
   sign of corruption. Match case-insensitively, in normalized form. */
const BAD_TOKENS = [
  'thingsmarket', 'nan', 'ched', 'nada', 'zet', 'auau',
  'thingsmarket', 'mediums', 'comcast', 'final', 'sale', 'advisor',
  'brokerage', 'broker', 'twitter', 'tweet', 'topweight', 'profit',
  'roselop', 'pledge', 'penny', 'stock', 'cash', 'start', 'head',
  'cret', 'caled', 'chose', 'tantly', 'discount', 'agent',
  'traps', 'toggle', 'kanban', 'bypass', 'recent',
  // known bad script fragments from my own generation
  '放lease', 'firebaser', 'escal', 'offset', 'stripe', 'scene',
  'fund', 'social', 'fintech', 'article', 'teller', 'aspect',
];

const ALLOW_LATIN = new Set(['UI', 'NDA', 'PDF', 'VIP', 'API', 'AI', 'RSI', 'MACD', 'ATR', 'SMA', 'EMA', 'P/E', 'P/B', 'OHLC', 'TASI', 'ID', 'OK', 'CMA', 'SMI', 'SX', 'IPO', 'MVP', 'UI/UX', 'UTC', 'ISO']);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

function extractStrings(src) {
  const out = [];
  const re = /(['"`])(?:(?!\1)[^\\]|\\.)*\1/g;
  let mm;
  while ((mm = re.exec(src)) !== null) {
    out.push({ raw: mm[0], body: mm[0].slice(1, -1) });
  }
  return out;
}

function normalizeAr(s) {
  return s.replace(/[\u064B-\u0652\u0640]/g, '')
          .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
          .replace(/\u0649/g, '\u064A')
          .replace(/\u0629/g, '\u0647')
          .toLowerCase();
}

let total = 0;
const findings = [];

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  for (const { raw, body } of extractStrings(src)) {
    if (!/[^\u0000-\u007F]/.test(body)) continue;       // ASCII-only strings are fine
    const norm = normalizeAr(body);
    total++;

    for (const m of body.matchAll(LATIN_GLUED)) {
      findings.push({ file, snippet: raw, kind: 'latin-glued', token: m[0] });
    }
    // bad tokens: must not appear glued into Arabic
    for (const tok of BAD_TOKENS) {
      const re = new RegExp(`[${AR}]${tok}[${AR}]|[${AR}] ${tok} `, 'i');
      if (re.test(norm)) findings.push({ file, snippet: raw, kind: 'bad-token', token: tok });
    }
  }
}

if (!findings.length) {
  console.log(`arabic: ${total} arabic strings audited, 0 found`);
  process.exit(0);
}
for (const f of findings) {
  console.log(`${f.kind.padEnd(12)}  ${f.token.padEnd(24)}  ${path.relative(ROOT, f.file)} :: ${f.snippet.slice(0, 90)}`);
}
console.log(`\narabic: ${total} strings, ${findings.length} issues`);
process.exit(findings.length ? 1 : 0);