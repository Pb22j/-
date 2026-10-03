/* ============================================================
   المنسّق — Orchestrator
   ------------------------------------------------------------
   One door the learner can knock on. Routes a free-text request to the
   right agent, in priority order, and guarantees every answer has been
   through the compliance middleware.

   Routing is deterministic and explainable — the learner can see which
   agent answered and why. No LLM needed to decide who answers.
   ============================================================ */

import * as knowledge from './knowledgeAgent.js';
import * as builder from './stageBuilderAgent.js';
import * as news from './newsAgent.js';
import { guard } from './compliance.js';

/* --- intent detection --------------------------------------------------- */

const INTENTS = [
  {
    id: 'buildStage',
    agent: 'stageBuilder',
    test: (q) =>
      /(نبني|بناء|سوي مرحلة|اصنع مرحلة|مرحلة عن|سؤال ما فهمته|ما فهمت|اشرح لي بطريق|قد لي مرحلة|تحدي|تمرين)/.test(q) ||
      /\b(build|make|create)\s+(me\s+)?(a\s+)?(stage|challenge|exercise|quiz)/i.test(q),
  },
  {
    id: 'news',
    agent: 'news',
    test: (q) => /(أخبار|الاخبار|خبر|إعلان|نتائج|الربع|توصية|منشور|تويتر|احداث|أحداث)/.test(q),
  },
  {
    id: 'verify',
    agent: 'knowledge',
    test: (q) => /(صح ولا غلط|صح؟|راجع لي|تأكد|ادعم|صحيح؟|هل .{0,26}(صحيح|أغني|يغني|يكفي|أشمل|يغطي|أفضل|كافٍ)|valid|correct\?)/.test(q),
  },
  {
    id: 'teach',
    agent: 'knowledge',
    test: () => true, // fallback
  },
];

export function route(question) {
  const q = String(question || '');
  for (const i of INTENTS) if (i.test(q)) return { intent: i.id, agent: i.agent };
  return { intent: 'teach', agent: 'knowledge' };
}

/**
 * Ask any agent. Always returns a renderable answer.
 * @param {string} question
 * @param {object} ctx  { level, portfolio, tier, company, budget, stories }
 */
export async function ask(question, ctx = {}) {
  // an explicit agent pick from the chat roster wins over intent routing
  const picked = ctx.agent && ctx.agent !== 'auto' ? ctx.agent : null;
  let intent, agent;
  if (picked) {
    agent = picked === 'verify' ? 'knowledge' : picked;
    intent = picked === 'verify' ? 'verify' : picked;
  } else {
    ({ intent, agent } = route(question));
  }

  try {
    if (agent === 'stageBuilder') {
      const covered = builder.alreadyCovered(question);
      if (ctx.tier === 'free') {
        return {
          agent: 'stageBuilder',
          blocked: true,
          gated: true,
          text: 'بناء المراحل الخاصة جزء من اشتراك المحترف. تقدر تكمّل المراحل الجاهزة وتقرأ المكتبة كلها بنفسك — وكلها مفتوحة لك الحين.',
          citations: covered ? [{ id: covered.id, title: covered.title, author: covered.author, source: covered.source }] : [],
        };
      }
      const stage = await builder.build(question, ctx);
      return { agent: 'stageBuilder', intent, stage, text: stage.opening, citations: [{ id: stage.concept, title: stage.title, author: stage.book, source: stage.source }] };
    }

    if (agent === 'news') {
      const stories = ctx.stories || [];
      const filtered = news.filter(stories, { companyId: ctx.companyId || ctx.company });
      const top = filtered[0];
      if (!top) {
        return { agent: 'news', intent, text: 'ما لقيت خبر مرتبط بهذا السهم في الفترة المختارة. جرّب تختار شركة ثانية أو توسّع المدى الزمني.', stories: [] };
      }
      return {
        agent: 'news',
        intent,
        text: `${top.headline}. ${top.body}`,
        story: top,
        stories: filtered.slice(0, 6),
        citations: [{ id: top.id, title: top.tag, author: top.company, source: top.date }],
      };
    }

    if (intent === 'verify') {
      const v = knowledge.checkClaim(question);
      const checked = guard(v.note, { agent: 'knowledge-verify' });
      return {
        agent: 'knowledge',
        intent,
        text: checked.status === 'block' ? checked.message : v.note,
        blocked: checked.status === 'block',
        verdict: v,
        citations: v.support,
      };
    }

    return await knowledge.ask(question, ctx);
  } catch (err) {
    // the orchestrator must never leave the learner without an answer
    return {
      agent: 'knowledge',
      intent,
      text: 'صار خلل بسيط عندي. جرّب سؤال ثاني، ولو تكرر أرسله لبصير مباشرة.',
      citations: [],
      error: String(err?.message || err),
    };
  }
}

export { knowledge, builder, news };
