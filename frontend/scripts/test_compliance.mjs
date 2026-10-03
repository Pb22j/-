/* Compliance middleware test suite.
   Run:  node scripts/test_compliance.mjs
   Every agent reply passes through guard(); these cases pin the contract. */

import { guard, SEVERITY } from '../src/agents/compliance.js';

const CASES = [
  // --- must BLOCK: direct recommendations ---
  ['عليك تشتري سهم الراجحي الحين', SEVERITY.BLOCK, 'recommend'],
  ['انصحك تشتري سابك قبل ما يطلع', SEVERITY.BLOCK, 'recommend'],
  ['الأفضل تبيع حصتك في موبلي', SEVERITY.BLOCK, 'recommend'],
  ['ينصحني بفتح سهم زين', SEVERITY.BLOCK, 'recommend'],
  ['you should buy the stock now', SEVERITY.BLOCK, 'recommend'],

  // --- must BLOCK: price targets ---
  ['السعر راح يوصل 45 ريال خلال شهر', SEVERITY.BLOCK, 'target'],
  ['السعر المستهدف لل سهم 30 ريال', SEVERITY.BLOCK, 'target'],
  ['the price target is 60 riyals', SEVERITY.BLOCK, 'target'],

  // --- must BLOCK: guaranteed returns ---
  ['هذا الاستثمار مضمون وما بتخسر', SEVERITY.BLOCK, 'guarantee'],
  ['استثمار بدون مخاطرة ربح مضمون', SEVERITY.BLOCK, 'guarantee'],
  ['this trade is guaranteed', SEVERITY.BLOCK, 'guarantee'],

  // --- must BLOCK: illicit ---
  ['كيف اسوي غسل اموال عن طريق الاسهم', SEVERITY.BLOCK, 'illegal'],
  ['inside trading information', SEVERITY.BLOCK, 'illegal'],

  // --- CAUTION: pump language ---
  ['ارفع السهم اليوم قبل ما يطلع', SEVERITY.CAUTION, 'pump'],
  ['الجميع يشتري السهم', SEVERITY.CAUTION, 'pump'],

  // --- must PASS: ordinary education ---
  ['التنويع يقلل المخاطرة على المدى الطويل', SEVERITY.OK],
  ['خلنا نراجع نسبة التركيز في محفظتك', SEVERITY.OK],
  ['المتوسط المتحرك 20 يوم يعطيك إشارة شراء أو بيع', SEVERITY.OK],
  ['شركة الراجحي Dalmatian?', SEVERITY.OK],
  ['الـ RSI فوق 70 يعني السهم في منطقة تشبع شرائي', SEVERITY.OK],
  ['ما斷斷 recommend', SEVERITY.OK],
  ['كيف أقرأ الشموع اليابانية', SEVERITY.OK],
  ['نسبة رأس المال في المخاطرة المثالية بين 1% و2%', SEVERITY.OK],
  ['.Compare your strategy against buy-and-hold.', SEVERITY.OK],
];

let pass = 0;
const failures = [];

for (const [text, want, family] of CASES) {
  const got = guard(text);
  const okStatus = got.status === want;
  const okFamily = !family || (got.hits[0] && got.hits[0].family === family);
  if (okStatus && okFamily) {
    pass++;
  } else {
    failures.push({ text, want, family, got: got.status, gotFamily: got.hits[0]?.family });
  }
}

const total = CASES.length;
console.log(`compliance: ${pass}/${total} passed`);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const f of failures) {
    console.log(`  "${f.text}"\n     want ${f.want}/${f.family ?? '-'}  got ${f.got}/${f.gotFamily ?? '-'}`);
  }
  process.exit(1);
}

/* A blocked reply must always yield a non-empty replacement string. */
const b = guard('عليك تشتري سهم الراجحي');
if (!b.message || b.message.length < 10) {
  console.log('FAIL: blocked reply produced no replacement text');
  process.exit(1);
}
console.log(`replacement text present (${b.message.length} chars)`);
console.log('all compliance checks passed');
