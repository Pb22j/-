/* Regression tests for the three bugs seen in the chat screenshots:
     1. an echoing upstream model must be discarded, not shown as the answer
     2. markdown emphasis must not leak as literal ** in Arabic prose
     3. picking an agent must actually route to that agent
   Run: node scripts/test_chat.mjs */

import { stripMarkdown, isEcho } from '../src/agents/llm.js';
import { orchestrator } from '../src/agents/index.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

console.log('\n— markdown must not leak —');
ok('strips **bold**', stripMarkdown('هذا **مهم جداً** في السوق') === 'هذا مهم جداً في السوق', stripMarkdown('هذا **مهم جداً** في السوق'));
ok('strips __bold__', stripMarkdown('هذا __مهم__ هنا') === 'هذا مهم هنا');
ok('strips headings and collapses to one line', stripMarkdown('## العنوان\nنص') === 'العنوان نص', stripMarkdown('## العنوان\nنص'));
ok('leaves plain Arabic alone', stripMarkdown('التنويع يقلل المخاطرة') === 'التنويع يقلل المخاطرة');
ok('handles a real leaked reply', !stripMarkdown('**هذا الاستثمار من كتاب مثل**The Intelligent Investor**').includes('**'));

console.log('\n— echo detection —');
ok('detects a verbatim echo', isEcho('صالح بستدي جذب سؤال ثاني، ولو تكررت أسئلته يكرر', 'صالح بستدي جذب سؤال ثاني، ولو تكررت أسئلته يكرر'));
ok('detects an echo with small edits', isEcho('صالح بستدي جذب سؤال ثاني، ولو تكررت أسئلته يمرر ميا بشة', 'صالح بستدي جذب سؤال ثاني، ولو تكررت أسئلته يكرر'));
ok('a real answer is not an echo', !isEcho('التنويع ليس جمع أسهم أكثر، بل جمع أسهم لا تتحرك معاً.', 'ما معنى التنويع؟'));
ok('short reply is not an echo', !isEcho('نعم.', 'ما معنى التنويع؟'));

console.log('\n— agent routing is honoured —');
const base = { level: 'intermediate', tier: 'pro', companyId: 'AlRajhi_Bank', company: 'بنك الراجحي' };

let r = await orchestrator.ask('ابي مرحلة عن وقف الخسارة', { ...base, agent: 'stageBuilder' });
ok('stageBuilder pick → stageBuilder', r.agent === 'stageBuilder', r.agent);
ok('stageBuilder returns a stage', !!r.stage, JSON.stringify(r).slice(0, 80));
ok('stage has playable options', (r.stage?.options?.length ?? 0) >= 2);
ok('stage is anchored to a book', !!r.stage?.book);

r = await orchestrator.ask('وش صار في قطاع الاتصالات؟', { ...base, agent: 'news' });
ok('news pick → news', r.agent === 'news', r.agent);

r = await orchestrator.ask('ما معنى التنويع؟', { ...base, agent: 'knowledge' });
ok('knowledge pick → knowledge', r.agent === 'knowledge', r.agent);
ok('knowledge cites a source', (r.citations?.length ?? 0) > 0);

r = await orchestrator.ask('هل التنويع يغني عن كل شي؟', { ...base, agent: 'verify' });
ok('verify pick → verify intent', r.intent === 'verify', r.intent);

r = await orchestrator.ask('ما معنى التنويع؟', { ...base, agent: 'auto' });
ok('auto still routes', r.agent === 'knowledge', r.agent);

console.log('\n— the free tier gates building without crashing —');
r = await orchestrator.ask('ابي مرحلة عن وقف الخسارة', { ...base, tier: 'free', agent: 'stageBuilder' });
ok('gated on free tier', r.gated === true && r.agent === 'stageBuilder', JSON.stringify(r).slice(0, 90));

console.log('\n— no markdown in any offline answer —');
for (const q of ['ما معنى التنويع؟', 'متى أبيع؟', 'ما هو وقف الخسارة؟']) {
  const a = await orchestrator.ask(q, { ...base, agent: 'auto' });
  ok(`clean: "${q}"`, !/\*\*|__/.test(a.text), a.text?.slice(0, 70));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
