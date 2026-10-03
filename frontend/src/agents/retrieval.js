/* Lightweight lexical retrieval over the knowledge corpus.
   Arabic-aware: strips diacritics, folds alef/ya/ta-marbuta, and applies a
   short stemmer so "التنويع" and "تنويع" match. No dependencies, no network. */

import { CORPUS } from '../content/knowledge.js';

/** Arabic + English normalisation for matching. */
export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Crude stemmer: drop the definite article and common Arabic prefixes/suffixes. */
function stem(w) {
  let s = w;
  for (const p of ['وال', 'بال', 'كال', 'فال', 'ال', 'و', 'ف', 'ب', 'ك', 'ل']) {
    if (s.length > 4 && s.startsWith(p)) { s = s.slice(p.length); break; }
  }
  // Arabic verbal prefixes: ا/ت/ن/ي + stem  ("ابيع" -> "بيع")
  if (s.length >= 4 && 'اتني'.includes(s[0])) s = s.slice(1);
  for (const suf of ['هما', 'كما', 'ات', 'ون', 'ين', 'ان', 'ها', 'هم', 'هن', 'ية', 'يه', 'ه', 'ك', 'ي']) {
    if (s.length > 4 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break; }
  }
  return s;
}

const STOP = new Set([
  'من', 'في', 'على', 'عن', 'الى', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي',
  'ما', 'هو', 'هي', 'انا', 'انت', 'كان', 'يكون', 'قد', 'لا', 'ان', 'انا', 'كل',
  'the', 'a', 'an', 'of', 'to', 'is', 'are', 'and', 'or', 'in', 'on', 'for',
]);

const DOCS = CORPUS.map((entry) => {
  const body = [entry.title, entry.summary, entry.probe, ...(entry.principles || []), ...(entry.pitfalls || []), ...(entry.tags || [])].join(' ');
  const toks = tokenize(body).map(stem).filter((t) => !STOP.has(t));
  return {
    entry,
    toks,
    tf: toks.reduce((acc, t) => (acc[t] = (acc[t] || 0) + 1, acc), {}),
    len: toks.length,
  };
});

const N = DOCS.length;
const AVG_LEN = DOCS.reduce((a, d) => a + d.len, 0) / N;
const DF = DOCS.reduce((acc, d) => {
  for (const t of new Set(d.toks)) acc[t] = (acc[t] || 0) + 1;
  return acc;
}, {});

/**
 * BM25 ranking. Returns [{ entry, score }] best-first.
 * `filter` lets callers restrict by level or tag before ranking.
 */
export function search(query, { limit = 4, filter } = {}) {
  const q = tokenize(query).map(stem).filter((t) => !STOP.has(t) && t.length > 1);
  if (!q.length) return [];

  const K1 = 1.5, B = 0.75;
  const pool = filter ? DOCS.filter((d) => filter(d.entry)) : DOCS;

  const scored = pool.map((d) => {
    let score = 0;
    for (const t of q) {
      const f = d.tf[t] || 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - (DF[t] || 0) + 0.5) / ((DF[t] || 0) + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (d.len / AVG_LEN))));
    }
    // exact tag hit is a strong signal
    const entryTags = (d.entry.tags || []).map((x) => stem(tokenize(x)[0] || ''));
    if (q.some((t) => entryTags.includes(t))) score *= 1.6;
    return { entry: d.entry, score };
  });

  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Entries for a level, for the "what can I learn next" rail. */
export function byLevel(level) {
  return CORPUS.filter((c) => c.level === level);
}

/** A random-but-stable pick, used to vary the coach's opening line. */
export function pick(arr, seed = 0) {
  if (!arr?.length) return null;
  return arr[Math.abs(seed) % arr.length];
}
