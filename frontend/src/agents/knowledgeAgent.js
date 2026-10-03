/* ============================================================
   وكيل المعرفة — Knowledge Agent (RAG)
   ------------------------------------------------------------
   The strongest agent. Fed the strategy corpus, answers the user's
   questions, cites which entry and which book it came from, checks
   the answer against the user's own virtual portfolio where
   relevant, and ends with a question rather than an instruction.

   Every reply passes through the compliance middleware on the way out.
   ============================================================ */

import { CORPUS, BY_ID } from '../content/knowledge.js';
import { search } from './retrieval.js';
import { complete } from './llm.js';
import { guard, COMPLIANCE_BRIEF } from './compliance.js';

const IDENTITY = `أنت «بصير»، المرشد المالي لمنصة محاكاة سوق الأسهم السعودي (تاسي).
تعمل بمبدأ التوعية لا التوجيه: تشرح المبدأ، تربطه بأرقام المستخدم، ثم تسأل سؤالاً توجيهياً.
أسلوبك: لهجة سعودية بيضاء مهنية، جادة ودودة، بدون مبالغة وبدون إيموجي.
تجيب بثلاثة إلى خمسة أسطر كحد أقصى، وتذكر دائماً اسم الكتاب أو المصدر الذي أخذت منه المبدأ.`;

const SYSTEM = `${IDENTITY}\n\n${COMPLIANCE_BRIEF}`;

/** Compose a deterministic answer straight from the retrieved entries. */
function compose(question, hits, ctx) {
  if (!hits.length) {
    return 'ما لقيت مبدأ واضح في قاعدتي بهذا الشكل. جرّب تسألني عن التنويع، أو حجم المركز، أو متى تبيع. وأنت في أي مرحلة الحين؟';
  }
  const top = hits[0].entry;
  const lines = [];

  lines.push(top.summary);

  // ground it in the player's own numbers when we have them
  if (ctx.portfolio && ctx.portfolio.count >= 1 && /تركيز|تنويع|مخاطرة|محفظة/.test(question)) {
    const p = ctx.portfolio;
    lines.push(`محفظتك الحين: ${p.count} سهم، أكبر سهم ${p.topWeight.toFixed(0)}% من قيمتك.`);
    if (top.pitfalls?.length) lines.push(`انتبه: ${top.pitfalls[0]}`);
  } else if (top.principles?.length) {
    lines.push(`القاعدة العملية: ${top.principles[0]}`);
  }

  // a second, related entry adds range without padding
  if (hits[1] && hits[1].entry.id !== top.id) {
    lines.push(`ويكمّل ${hits[1].entry.author}: ${hits[1].entry.summary.split('.')[0]}.`);
  }

  if (top.probe) lines.push(top.probe);
  return lines.filter(Boolean).join(' ');
}

/**
 * Ask the knowledge agent.
 * @param {string} question
 * @param {object} ctx  { level, portfolio, journal }
 */
export async function ask(question, ctx = {}) {
  const level = ctx.level || 'beginner';
  // bias retrieval toward the learner's level but never hide harder material
  const hits = search(question, { limit: 4 });

  const fallback = compose(question, hits, ctx);

  const grounding = hits
    .map((h, i) => `[${i + 1}] ${h.entry.title} — ${h.entry.author}, ${h.entry.source}: ${h.entry.summary}`)
    .join('\n');

  const ctxLine = ctx.portfolio
    ? `محفظته الافتراضية: نقد ${Math.round(ctx.portfolio.cash)} ريال، ${ctx.portfolio.count} سهم، تركيز أعلى سهم ${ctx.portfolio.topWeight.toFixed(0)}%.`
    : '';

  const { text, source } = await complete({
    system: SYSTEM,
    prompt: `سؤال المتعلم: ${question}\n\n${ctxLine}\n\nالمصادر المسترجعة من قاعدة المعرفة:\n${grounding}\n\nأجب باختصار، واذكر اسم الكتاب الذي استندت إليه.`,
    fallback,
    context: { level, hits: hits.map((h) => h.entry.id) },
    question,
  });

  const checked = guard(text, { agent: 'knowledge', context: { question, level } });

  return {
    agent: 'knowledge',
    text: checked.status === 'block' ? checked.message : text,
    blocked: checked.status === 'block',
    flagged: checked.status === 'caution',
    source,
    citations: hits.map((h) => ({ id: h.entry.id, title: h.entry.title, author: h.entry.author, source: h.entry.source, score: +h.score.toFixed(2) })),
  };
}

/** Browse the knowledge base — powers the "ماذا أتعلم" rail. */
export function browse(level) {
  return CORPUS.filter((c) => (level ? c.level === level : true));
}

/** One entry in full, for the reading sheet. */
export function read(id) {
  return BY_ID[id] || null;
}

/** Check a user-supplied strategy claim against the corpus.
 *  Returns whether the corpus supports it, and what it corrects. */
export function checkClaim(claim) {
  const hits = search(claim, { limit: 3 });
  if (!hits.length) {
    return { supported: false, confidence: 0, support: [], corrections: [], note: 'ما لقيت قاعدة في المكتبة تقارب هذا الكلام.' };
  }
  const score = hits[0].score;
  const supported = score >= 2.2;
  return {
    supported,
    confidence: Math.min(1, score / 5),
    support: hits.map((h) => ({ id: h.entry.id, title: h.entry.title, author: h.entry.author, source: h.entry.source, score: +h.score.toFixed(2) })),
    corrections: supported ? [] : hits[0].entry.pitfalls || [],
    note: supported
      ? `المكتبة تدعم كلامك تقريباً — انظر «${hits[0].entry.title}» (${hits[0].entry.author}).`
      : `ما أدعمه بالضبط. الأقرب عندنا «${hits[0].entry.title}»، راجعه قبل ما تبني قرار عليه.`,
  };
}
