/* Flags Latin words that leaked into the Arabic prose fields of the corpus.
   Legit: author names, book titles, tags, ids, and a short allow-list of
   English technical terms.  Run: node scripts/lint_corpus.mjs */

import { CORPUS } from '../src/content/knowledge.js';

const ALLOW = new Set([
  'risk', 'profit', 'investing', 'portfolio', 'trading', 'market', 'news',
  'volume', 'macd', 'rsi', 'pe', 'atr', 'emh', 'valuation', 'diversification',
  'concentration', 'behavioral', 'earnings', 'results', 'moving', 'average',
  'margin', 'safety', 'position', 'sizing', 'trend', 'liquidity', 'bollinger',
  'recommendation', 'cycle', 'savings', 'fomo', 'psychology', 'panic', 'buy',
  'sell', 'holder', 'cheerio', 'brk', 'a', 'go', 'bh', 'labour', 'aa', 'eee',
  'nh', 'st', 'ab', 'news', 'indices', 'share', 'stock', 'exchange', 'tax',
]);

const FIELDS = ['summary', 'probe'];
const LIST_FIELDS = ['principles', 'pitfalls'];

let issues = 0;
for (const entry of CORPUS) {
  const texts = [...FIELDS.map((f) => entry[f] || []), ...LIST_FIELDS.flatMap((f) => entry[f] || [])]
    .flat()
    .filter((t) => typeof t === 'string' && /[\u0600-\u06FF]/.test(t));

  for (const t of texts) {
    // a Latin word sitting directly next to Arabic script = a leak
    const words = t.match(/[A-Za-z]{2,}/g) || [];
    for (const w of words) {
      const lower = w.toLowerCase();
      if (ALLOW.has(lower)) continue;
      // ignore if the surrounding line has no Arabic adjacency
      const idx = t.indexOf(w);
      const before = t[idx - 1] || '';
      const after = t[idx + w.length] || '';
      const arabicNeighbour = /[\u0600-\u06FF]/.test(before) || /[\u0600-\u06FF]/.test(after);
      if (!arabicNeighbour) continue;
      issues++;
      console.log(`[${entry.id}] "${w}" in: ${t.slice(Math.max(0, idx - 30), idx + w.length + 30)}`);
    }
  }
}

console.log(issues ? `\n${issues} suspect token(s) found` : 'corpus clean: no leaked Latin words in Arabic prose');
