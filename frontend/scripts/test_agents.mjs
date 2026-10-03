/* End-to-end check of the agent layer with no backend and no API key.
   Run: node scripts/test_agents.mjs */

import { orchestrator, knowledge, builder } from '../src/agents/index.js';
import { guard } from '../src/agents/compliance.js';
import { search } from '../src/agents/retrieval.js';
import { CORPUS } from '../src/content/knowledge.js';
import * as news from '../src/agents/newsAgent.js';
import * as coach from '../src/agents/coachAgent.js';
import { sma, rsi, runLength, levels, maxDrawdown } from '../src/lib/indicators.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

console.log('\n— retrieval —');
for (const q of ['التنويع', 'متى أبيع', 'وقف الخسارة', 'مؤشر القوة النسبية', 'ما معنى السيولة']) {
  const hits = search(q, { limit: 3 });
  ok(`"${q}" -> ${hits.length} hits`, hits.length > 0);
}
ok('Arabic stemming matches', search('التنويع').some((h) => h.entry.id === 'diversification'));

console.log('\n— corpus integrity —');
ok(`${CORPUS.length} entries`, CORPUS.length >= 20);
ok('every entry has principles', CORPUS.every((c) => c.principles?.length > 0));
ok('every entry cites a book', CORPUS.every((c) => !!c.source && !!c.author));
ok('unique ids', new Set(CORPUS.map((c) => c.id)).size === CORPUS.length);

console.log('\n— knowledge agent (offline) —');
const a1 = await knowledge.ask('متىأسsell السهم؟', { level: 'beginner' });
ok('answers without a backend', !!a1.text && a1.text.length > 20);
ok('source is offline', a1.source === 'offline');
ok('cites a source', a1.citations.length > 0, JSON.stringify(a1.citations));
console.log(`       → "${a1.text.slice(0, 110)}…"`);
console.log(`       cites: ${a1.citations.map((c) => `${c.title} / ${c.author}`).join(', ')}`);

console.log('\n— compliance through the agent —');
const a2 = await knowledge.ask('Should I buy Al Rajhi stock now?', { level: 'beginner' });
ok('a recommendation attempt is neutralised', !/\byou should buy\b/i.test(a2.text));
const forced = guard('عليك تشتري سهم الراجحي', { agent: 'knowledge' });
ok('direct guard still blocks', forced.status === 'block');

console.log('\n— orchestrator routing —');
ok('build intent', orchestrator.route('نبني مرحلة عن وقف الخسارة').agent === 'stageBuilder');
ok('news intent', orchestrator.route('وش الأخبار اليوم؟').agent === 'news');
ok('verify intent', orchestrator.route('هل هذا صحيح').intent === 'verify');
ok('verify intent (question form)', orchestrator.route('هل التنويع يغني عن كل شيء؟').intent === 'verify');
ok('fallback to knowledge', orchestrator.route('ما معنى السيولة؟').agent === 'knowledge');

console.log('\n— stage builder —');
const st = await builder.build('ما فهمت فكرة وقف الخسارة، ابني لي مرحلة', { budget: 1000000, company: 'بنك الراجحي' });
ok('returns a playable stage', !!st && Array.isArray(st.options) && st.options.length >= 2);
ok('anchored to a corpus entry', !!st.concept && !!knowledge.read(st.concept));
ok('has win + lose resolutions', !!st.resolution?.win && !!st.resolution?.lose);
console.log(`       → "${st.title}" · ${st.options.length} options · from ${st.source}`);
const st2 = await builder.build('نبني مرحلة عن التنويع');
ok('second stage differs in id', st2.id !== st.id);
ok('remix produces a variant', !!builder.remix(st).retried);

console.log('\n— coach agent rules —');
const hist = [18, 19, 20, 21, 22, 23, 24, 25].map((c, i) => ({ time: `2011-01-0${i + 1}`, open: c, high: c, low: c, close: c, volume: 1e6 }));
const r2 = coach.judgeTrade({ side: 'BUY', shares: 100, price: 25, history: hist, portfolio: { total: 1e6, marketValue: 100000, cash: 900000, count: 1, topWeight: 10 }, meta: { ar: 'بنك الراجحي' } });
ok('R2 fires on a 3-session run', r2.some((w) => w.id === 'R2'), JSON.stringify(r2.map((x) => x.id)));
ok('every warning cites a book', r2.every((w) => w.book), JSON.stringify(r2.map((w) => w.book?.id)));
ok('every warning ends with a question', r2.every((w) => w.question?.includes('؟')));

const sellHist = [{ time: '1', open: 20, high: 20, low: 20, close: 20, volume: 1 }, { time: '2', open: 20, high: 20, low: 18, close: 18.5, volume: 1 }];
const r3 = coach.judgeTrade({ side: 'SELL', shares: 10, price: 18.5, history: sellHist, portfolio: { total: 1e6, marketValue: 500000, cash: 500000, count: 3, topWeight: 20 }, meta: { ar: 'سابك' } });
ok('R3 fires on panic sell', r3.some((w) => w.id === 'R3'));

const r1 = coach.judgeTrade({ side: 'BUY', shares: 3600, price: 25, history: hist, portfolio: { total: 100000, marketValue: 0, cash: 100000, count: 0, topWeight: 0, positions: [] }, meta: { ar: 'سابك', id: 'SABIC' } });
ok('R1 fires on >50% concentration', r1.some((w) => w.id === 'R1'), JSON.stringify(r1.map((x) => x.id)));
ok('R6 fires on an oversized order', r1.some((w) => w.id === 'R6'));

const r4 = coach.judgePortfolio({ count: 1, marketValue: 100, cash: 0, total: 100 });
ok('R4 fires on a one-stock portfolio', r4.some((w) => w.id === 'R4'));

const longHist = Array.from({ length: 30 }, (_, i) => ({ time: '2011-01-' + String(i + 1).padStart(2, '0'), open: 20 + i, high: 21 + i, low: 19 + i, close: 20 + i, volume: 1e6 }));
const brief = coach.brief({ history: longHist, meta: { ar: 'بنك الراجحي' } });
ok('brief mentions the ticker name', /بنك الراجحي/.test(brief));
ok('brief quotes a stop distance', /وقفك/.test(brief));

console.log('\n— news agent —');
const series = { A: [{ time: '2010-01-04', open: 10, high: 10, low: 10, close: 10, volume: 1 }, { time: '2010-01-05', open: 10, high: 12, low: 10, close: 11.5, volume: 2 }], B: [{ time: '2010-01-28', open: 11, high: 11.2, low: 11, close: 11, volume: 2 }, { time: '2010-02-01', open: 11, high: 11, low: 8, close: 9, volume: 3 }] };
const meta = { A: { ar: 'بنك الراجحي', sector: 'بنوك' }, B: { ar: 'سابك', sector: 'مواد' } };
const stories = news.generate(series, meta, { minMove: 3 });
ok('derives stories from real moves', stories.length === 2, `got ${stories.length}`);
ok('classifies direction', stories.find((s) => s.companyId === 'A')?.impact === 'bullish');
ok('classifies drops', stories.find((s) => s.companyId === 'B')?.impact === 'bearish');
ok('each story carries a real date', stories.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date)));
ok('filter by impact works', news.filter(stories, { impact: 'bearish' }).length === 1);
ok('sentiment aggregates', news.sentiment(stories).length === 2);

console.log('\n— indicators —');
const vals = Array.from({ length: 60 }, (_, i) => 10 + i * 0.5 + Math.sin(i) * 2);
ok('sma', Math.abs(sma(vals, 20).at(-1) - vals.slice(-20).reduce((a, b) => a + b, 0) / 20) < 1e-9);
ok('rsi in range', (() => { const v = rsi(vals, 14).at(-1); return v >= 0 && v <= 100; })());
const rising = Array.from({ length: 30 }, (_, i) => 10 + i);
ok('runLength detects up', runLength(rising).up === 29);
ok('levels returns a band', typeof levels(vals.map((v, i) => ({ time: i, close: v, high: v, low: v, open: v, volume: 1 }))).support === 'number');
ok('maxDrawdown >= 0', maxDrawdown(vals) >= 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
