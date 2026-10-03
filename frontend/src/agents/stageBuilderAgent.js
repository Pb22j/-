/* ============================================================
   وكيل بناء المراحل — Stage Builder Agent
   ------------------------------------------------------------
   Builds a playable, sim-real stage from the learner's natural-language
   request. The agent picks the corpus entry, picks a scenario shape,
   and the shape carries the data the CustomStagePlayer needs to render
   the real ticker chart and a day-by-day reveal.
   ============================================================ */

import { BY_ID, CORPUS } from '../content/knowledge.js';
import { search, pick } from './retrieval.js';
import { guard, COMPLIANCE_BRIEF } from './compliance.js';
import { complete } from './llm.js';

const IDENTITY = 'أنت «بصير» مصمم مراحل تعليمية. تبني سيناريو محاكاة قصيرة يشرح مبدأً مالياً واحداً، وتكتب بصيغة الراوي لا الوصايا.';
const SYSTEM = `${IDENTITY}\n\n${COMPLIANCE_BRIEF}`;

/* ----- scenario shapes --------------------------------------------------- */

const TEMPLATES = {
  /* choice-splitter — used for diversification / concentration */
  'choice-splitter': (e, { company, companyId, budget }) => ({
    kind: 'split',
    prompt: `عندك ${budget.toLocaleString('en-US')} ريال. تنوّع ولا تركّز؟`,
    chart: { company, companyId, window: 60 },
    options: [
      { key: 'all-in', label: 'سهم واحد', cut: 1, tilt: -1,
        sub: `${budget.toLocaleString('en-US')} ريال على ${company}`,
        outcome: { valuePct: 62 },
        lesson: `ركّزت كل رصيدك في ${company}. أي حركة عليه تربحك أو تحطمك كلها.` },
      { key: 'spread', label: 'متنوّع', cut: 3, tilt: 1,
        sub: `خمسة أسهم × ${Math.round(budget / 5).toLocaleString('en-US')} ريال`,
        outcome: { valuePct: 86 },
        lesson: e.principles?.[0] || 'وزّعت رصيدك على قطاعات مختلفة، فخسارة سهم واحد تخفّفها الأرباح في الباقي.' },
    ],
  }),

  /* hype-trap — the user's exact example: a fake tweet, the stock rises 2
     days, the learner buys, then it crashes on day 3. The beats are
     derived from a real OHLCV window around the ticker so what the chart
     shows and what the beats claim actually match. */
  'hype-trap': (e, { company, companyId }) => {
    /* pick the strongest two-session rise in the first 90 sessions */
    let around = 2, beats = null;
    if (companyId && ctx.series?.[companyId]) {
      const series = ctx.series[companyId];
      const max = Math.min(90, series.length - 4);
      let best = { gain: -Infinity, idx: 0 };
      for (let i = 1; i < max; i++) {
        const c0 = series[i - 1].close;
        const c2 = series[i + 1].close;
        if (c0 > 0) {
          const two = (c2 - c0) / c0 * 100;
          if (two > best.gain) best = { gain: two, idx: i };
        }
      }
      around = best.idx;
      const c0 = series[around - 1].close;
      const c1 = series[around].close;
      const c2 = series[around + 1].close;
      const c3 = series[around + 2].close;
      beats = [
        { day: 1, delta: +(c1 - c0) / c0 * 100, note: 'السهم طلع بعد المنشور.' },
        { day: 2, delta: +(c2 - c1) / c1 * 100, note: 'كمّل صعوده، الكل صار يشتري.' },
        { day: 3, delta: +(c3 - c2) / c2 * 100, note: 'نزول حاد — المشهور خرج، وأنت باقٍ.' },
      ];
    }
    return {
      kind: 'sequence',
      prompt: `منشور من حساب مشهور يوصي بـ ${company}. تشوف السهم يطلع يومين. تشتري؟`,
      chart: { company, companyId, window: 30, aroundDay: around },
      feed: {
        handle: '@سوق_المشاهير',
        text: `${company} بيطير اليوم!! انتهز الفرصة قبل ما تفوتك.`,
        stats: { likes: 4200, reposts: 480, replies: 128 },
      },
      beats: beats || [
        { day: 1, delta: +8,  note: 'السهم طلع بعد المنشور.' },
        { day: 2, delta: +12, note: 'كمّل صعوده، الكل صار يشتري.' },
        { day: 3, delta: -28, note: 'نزول حاد قبل ما يبيع كثير.' },
      ],
      options: [
        { key: 'chase', label: 'أدخل', outcome: { valuePct: 72 },
          lesson: 'اشتريت بعد ما الخبر انتشر — أنت السيولة اللي خرج بها المشهور.' },
        { key: 'watch', label: 'أنتظر', outcome: { valuePct: 100 },
          lesson: 'ما تحرّكت، وما خسرت. الفخ ما يصير على كل متابع.' },
      ],
    };
  },

  /* panic-day — pick a real -10%+ day for the right ticker, then
     show the next two sessions as recovery. Beats derived from data. */
  'panic-day': (e, { company, companyId }) => {
    let around = 0, beats = null;
    if (companyId && ctx.series?.[companyId]) {
      const series = ctx.series[companyId];
      const max = Math.min(series.length - 4, 200);
      let best = { drop: 0, idx: 0 };
      for (let i = 1; i < max; i++) {
        const prev = series[i - 1].close;
        if (prev <= 0) continue;
        const drop = (series[i].close - prev) / prev * 100;
        if (drop < best.drop) best = { drop, idx: i };
      }
      around = best.idx;
      const c0 = series[around - 1]?.close || series[around].close;
      const c1 = series[around].close;
      const c2 = series[around + 1]?.close;
      const c3 = series[around + 2]?.close;
      beats = [
        { day: 1, delta: c0 > 0 ? (c1 - c0) / c0 * 100 : -10, note: 'نزول حاد اليوم.' },
        { day: 2, delta: c2 && c1 ? (c2 - c1) / c1 * 100 : +4, note: 'ارتداد طفيف.' },
        { day: 3, delta: c3 && c2 ? (c3 - c2) / c2 * 100 : +8, note: 'استرجع نصف ما خسرته.' },
      ];
    }
    return {
      kind: 'sequence',
      prompt: `السهم نزل ${beats?.[0]?.delta?.toFixed(1) ?? 14}% اليوم. أنت داخل بخسارة. وش تسوي؟`,
      chart: { company, companyId, window: 25, aroundDay: around },
      beats: beats || [
        { day: 1, delta: -14, note: 'نزول حاد اليوم.' },
        { day: 2, delta: +4,  note: 'ارتداد طفيف.' },
        { day: 3, delta: +8,  note: 'استرجع نصف ما خسرته.' },
      ],
      options: [
        { key: 'sell', label: 'أبيع الحين', outcome: { valuePct: 86 },
          lesson: 'بعت في القاع. بيع الخوف يحوّل ورقة إلى خسارة.' },
        { key: 'half', label: 'أبيع نص', outcome: { valuePct: 93 },
          lesson: 'خفّفت التعرّض، بس قرار البيع كان على السعر لا على السبب.' },
        { key: 'hold', label: 'أصبر', outcome: { valuePct: 100 },
          lesson: e.principles?.[0] || 'لو سبب الشراء ما زال موجوداً، البيع بدون سبب لا.' },
      ],
    };
  },

  /* position sizing — three sizes side by side, same trade */
  'size-decision': (e, { company, companyId, budget }) => ({
    kind: 'split',
    prompt: `أنت واثق من التحليل. كم تدخل من ${budget.toLocaleString('en-US')} ريال؟`,
    chart: { company, companyId, window: 30 },
    options: [
      { key: 'all',   label: 'كل المبلغ', cut: 1, tilt: -1, sub: 'مخاطرة كاملة',
        outcome: { valuePct: 58 },
        lesson: 'كل رأس المال في صفقة واحدة. أي خطأ يخصك بالكامل.' },
      { key: 'half',  label: 'نص المبلغ', cut: 2, tilt: 0,  sub: 'مخاطرة متوازنة',
        outcome: { valuePct: 79 },
        lesson: e.principles?.[0] || 'وزّعت المخاطرة على فرصتين بدل واحدة.' },
      { key: 'small', label: 'عُشر المبلغ', cut: 3, tilt: 1, sub: 'مخاطرة 1%',
        outcome: { valuePct: 94 },
        lesson: e.principles?.[2] || e.principles?.[0] || 'حجم صغير، خسارة محتملة أقل، عقلانية أطول.' },
    ],
  }),

  /* stop-decision — same trade, three stop-losses. The decisive lesson:
     not the entry, the exit. Same ticker, same chart, three exits. */
  'stop-decision': (e, { company, companyId }) => ({
    kind: 'split',
    prompt: `دخلت ${company}. نقطة وقفك كام؟`,
    chart: { company, companyId, window: 60 },
    options: [
      { key: 'no-stop', label: 'بدون وقف', cut: 1, tilt: -1, sub: 'ما عندك نقطة خروج',
        outcome: { valuePct: 56 },
        lesson: 'السوق ما يعطيك إشارة قبل السقوط، وأكبر خسارة تحصل بدون وقف.' },
      { key: 'wide',    label: 'وقف 8%',   cut: 3, tilt: 0,  sub: 'مساحة أوسع',
        outcome: { valuePct: 88 },
        lesson: 'وقف أوسع يسمح للصفقة تتنفّس، لكن الخسارة إذا أخطأت أكبر.' },
      { key: 'tight',   label: 'وقف 2%',   cut: 2, tilt: 1,  sub: 'حماية صارمة',
        outcome: { valuePct: 96 },
        lesson: e.principles?.[0] || 'وقف ضيق يحمي رأس المال، لكنه قد يفعّلك من حركة طبيعية.' },
    ],
  }),
};

const TEMPLATE_FOR = {
  diversification: 'choice-splitter', concentration: 'choice-splitter',
  fomo: 'hype-trap', 'news-trap': 'hype-trap',
  'panic-sell': 'panic-day', 'loss-aversion': 'panic-day',
  'position-sizing': 'size-decision',
  liquidity: 'size-decision', compounding: 'size-decision',
  stop: 'stop-decision', 'stop-loss': 'stop-decision',
  'risk-management': 'stop-decision',
  default: 'size-decision',
};

let counter = 0;

/**
 * Build a playable stage.
 * @param {string} request  what the user asked for, in their own words
 * @param {object} ctx      { company, budget, level }
 */
export async function build(request, ctx = {}) {
  const company = ctx.company || 'بنك الراجحي';
  const companyId = ctx.companyId || null;
  const budget = ctx.budget || 1000000;
  const level = ctx.level || 'beginner';
  const series = ctx.series || null;

  // match the request to a concept
  const hits = search(request, { limit: 3 });
  let entry = hits[0]?.entry;

  // no match → try keyword routing against the template map
  if (!entry) {
    const norm = request.replace(/\s+/g, ' ').trim();
    const want = Object.keys(TEMPLATE_FOR).find((k) => norm.includes(k) || norm.includes(k.replace(/-/g, ' ')));
    entry = want && BY_ID[want];
  }
  if (!entry) entry = pick(CORPUS.filter((c) => c.level === level), 3);

  const tplName = TEMPLATE_FOR[entry.id] || TEMPLATE_FOR.default;
  const shape = TEMPLATES[tplName](entry, { company, companyId, budget, series });

  counter += 1;
  const id = `custom-${Date.now().toString(36)}-${counter}`;

  const stage = {
    id,
    custom: true,
    title: entry.title,
    concept: entry.id,
    book: entry.author,
    source: entry.source,
    level: entry.level,
    difficulty: level === 'expert' ? 3 : level === 'intermediate' ? 2 : 1,
    template: tplName,
    brief: shape.prompt,
    ...shape,
    resolution: {
      win: entry.principles?.[0] || entry.summary,
      lose: entry.pitfalls?.[0] || entry.summary,
    },
    request,
    createdAt: new Date().toISOString(),
  };

  /* The LLM may rewrite the opening line. The compliance guard blocks
     advice patterns; never override the numbers or option set. */
  const { text } = await complete({
    system: SYSTEM,
    prompt: `المبدأ: ${entry.title} — ${entry.summary}\nالسيناريو: ${shape.prompt}\nاكتب جملة افتتاحية قصيرة (سطر واحد) بأسلوب بصير، بدون ذكر الحل ولا التوصيات.`,
    fallback: shape.prompt,
    context: { stage: id, concept: entry.id },
    question: request,
  });

  const checked = guard(text, { agent: 'stage-builder', context: { stage: id } });
  if (checked.status !== 'block' && text && text.length < 200) stage.opening = text;
  else stage.opening = shape.prompt;

  return stage;
}

/** Does the platform already teach this? */
export function alreadyCovered(request) {
  const hits = search(request, { limit: 1 });
  return hits.length && hits[0].score >= 3 ? hits[0].entry : null;
}

/** Different shape, same concept. */
export function remix(stage) {
  const entry = BY_ID[stage.concept];
  if (!entry) return stage;

  const forConcept = Object.entries(TEMPLATE_FOR)
    .filter(([id]) => id === stage.concept)
    .map(([, t]) => t)
    .filter((t) => t !== stage.template);

  const anyOther = Object.keys(TEMPLATES).filter((t) => t !== stage.template);

  const pickTpl = forConcept[0] || anyOther[Math.floor(Math.random() * anyOther.length)] || TEMPLATE_FOR.default;
  const shape = TEMPLATES[pickTpl](entry, { company: 'بنك الراجحي', budget: 1000000 });

  return {
    ...stage,
    ...shape,
    kind: shape.kind,
    template: pickTpl,
    id: `${stage.id}-r${Date.now().toString(36)}`,
    retried: true,
  };
}

/** Stage building is a Pro-tier feature. */
export const REQUIRES_TIER = 'pro';