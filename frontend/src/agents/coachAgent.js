/* ============================================================
   وكيل المراقب — Coach Agent (the silent watcher)
   ------------------------------------------------------------
   Watches every order and every tick of the clock. Speaks only when
   the player does something the rule engine flags, and always in the
   player's own numbers — no lectures, one number and one question.

   Rules R1-R5 mirror backend/main.py::analyze_portfolio_local so the
   app behaves identically with or without the server.
   ============================================================ */

import { runLength, sma, atr as atrOf } from '../lib/indicators.js';
import { BY_ID } from '../content/knowledge.js';
import { search } from './retrieval.js';
import { guard, COMPLIANCE_BRIEF } from './compliance.js';
import { complete } from './llm.js';

const SYSTEM = `أنت «بصير» المراقب الصامت. تتكلم مرة واحدة فقط، وبجملة أو جملتين، بأرقام المستخدم الحقيقية. لا تفترض، لا تعظ، اختم بسؤال. ${COMPLIANCE_BRIEF}`;

/** Attach the book that backs a rule, so the lesson is traceable. */
function cite(ruleId) {
  const map = {
    R1: 'concentration', 'R1-soft': 'diversification',
    R2: 'fomo', R3: 'panic-sell',
    R4: 'diversification', R5: 'liquidity',
    R6: 'position-sizing', R7: 'support-resistance', R8: 'trend-following',
  };
  return BY_ID[map[ruleId]] || null;
}

/**
 * Evaluate one trade attempt.
 * @returns {Array} zero or more warnings, most severe first
 */
export function judgeTrade({ side, shares, price, history = [], portfolio, meta }) {
  const out = [];
  const name = meta?.ar || 'السهم';
  // value already held in this name, so buying more is scored correctly
  const heldHere = portfolio?.positions?.find((p) => p.id === meta?.id)?.value || 0;
  const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);

  /* R1 / R4 — concentration ------------------------------------------------ */
  const notional = shares * price;
  const total = portfolio.total || 1;
  if (side === 'BUY') {
    const newMv = portfolio.marketValue + notional;
    const newTotal = portfolio.cash - notional + newMv;
    const weight = newTotal > 0 ? ((heldHere + notional) / newTotal) * 100 : 0;
    const heldWeight = portfolio.topWeight || 0;

    if (weight > 50) {
      out.push({
        id: 'R1', severity: 'high', rule: 'تركيز مفرط',
        text: `وقف. ${name} بيصير ${weight.toFixed(0)}% من محفظتك بعد الصفقة. سهم واحد فوق 50% يحوّل محفظتك إلى رهان على شركة وحدة.`,
        question: 'لو هالسهم نزل 40% بكرة، كم يصير رصيدك؟',
      });
    } else if (weight > 35 || heldWeight > 35) {
      out.push({
        id: 'R1-soft', severity: 'medium', rule: 'تركيز مرتفع',
        text: `أعلى سهم في محفظتك ${Math.max(weight, heldWeight).toFixed(0)}%. فوق 35% تبدأ حركة السهم الواحد تنعكس على محفظتك كلها.`,
        question: 'وش خطتك لتوزيع الباقي على أسهم ثانية؟',
      });
    }
  }

  /* R2 — buying after a run (FOMO) ---------------------------------------- */
  const closes = history.map((b) => b.close);
  if (side === 'BUY' && closes.length >= 4) {
    const run = runLength(closes);
    if (run.up >= 3) {
      const gain = pct(closes[closes.length - 1], closes[closes.length - 4]);
      out.push({
        id: 'R2', severity: 'high', rule: 'مطاردة الصاعد',
        text: `${name} طالع ${gain.toFixed(0)}% في ثلاث جلسات، وأنت تدخل الحين. هذي مطاردة الصاعد، وأغلب الخسارة تصير هنا.`,
        question: 'لو قعدت يومين، وش يخسرونك؟',
      });
    }
  }

  /* R3 — panic sell -------------------------------------------------------- */
  if (side === 'SELL' && closes.length >= 2) {
    const drop = pct(closes[closes.length - 1], closes[closes.length - 2]);
    if (drop < 0 && Math.abs(drop) >= 1.5) {
      out.push({
        id: 'R3', severity: 'medium', rule: 'بيع من الخوف',
        text: `السهم نزل ${Math.abs(drop).toFixed(1)}% اليوم، وأنت تبيع فوراً. هبوط يوم واحد ما يثبت اتجاه.`,
        question: 'هل سبب بيعك سعر نزل، ولا سبب حقيقي تغيّر؟',
      });
    }
  }

  /* R5 — liquidity --------------------------------------------------------- */
  if (side === 'BUY' && portfolio.cash - notional < portfolio.total * 0.05) {
    out.push({
      id: 'R5', severity: 'low', rule: 'سيولة منخفضة',
      text: `بعد الصفقة يبقى عندك ${Math.max(0, portfolio.cash - notional).toFixed(0)} ريال نقد، أي أقل من 5%. بدون سيولة ما تقدر تستغل الانهيارات.`,
      question: 'لو نزل السوق 15% بكرة، بتقدر تشتري ولا لا؟',
    });
  }

  /* R6 — oversized single order ------------------------------------------- */
  if (side === 'BUY' && total > 0 && (heldHere + notional) / total > 0.25) {
    out.push({
      id: 'R6', severity: 'medium', rule: 'صفقة كبيرة',
      text: `وضعت ${(((heldHere + notional) / total) * 100).toFixed(0)}% من رأس المال في سهم واحد. القاعدة: المخاطرة في صفقة واحدة 1% إلى 2% فقط.`,
      question: 'وين نقطة الوقف؟ ومنشور ما عندك ووقف.',
    });
  }

  /* R7 — buying into strength at the high ---------------------------------- */
  const a = atrOf(history, 14);
  const lastAtr = a[a.length - 1];
  if (side === 'BUY' && lastAtr && closes.length >= 3) {
    const recentHigh = Math.max(...history.slice(-10).map((b) => b.high));
    const close = closes[closes.length - 1];
    if (close > recentHigh * 0.995) {
      out.push({
        id: 'R7', severity: 'low', rule: 'قمة المدى',
        text: `السهم على أعلى مستوياته في عشر جلسات. الشراء على القمة يحتاج توقفك محدد، وإلا أنت تشتري بأعلى سعر.`,
        question: 'وين أقرب مقاومة فوق السعر؟',
      });
    }
  }

  out.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity]));
  return out.map((w) => ({ ...w, book: cite(w.id) }));
}

/**
 * Evaluate the portfolio as a whole (called after every tick).
 */
export function judgePortfolio(portfolio) {
  const out = [];
  if (!portfolio || portfolio.count === 0) return out;

  if (portfolio.count === 1 && portfolio.marketValue > 0) {
    out.push({
      id: 'R4', severity: 'medium', rule: 'محفظة من سهم واحد',
      text: `محفظتك كلها على ${portfolio.count} سهم. حتى أكبر شركة ممكن تنزل 50% في أزمة، وحينها ما عندك شي يغطيك.`,
      question: 'لو نزل هذا السهم 30%، من وين تجيب السيولة؟',
      book: cite('R4'),
    });
  }
  const cashPct = portfolio.total > 0 ? (portfolio.cash / portfolio.total) * 100 : 0;
  if (portfolio.count >= 3 && cashPct > 60) {
    out.push({
      id: 'R9', severity: 'low', rule: 'نقد كثير',
      text: `${cashPct.toFixed(0)}% من مالك نقد. النقد الزائد ما يشتغل، وفي نفس الوقت تدفع كلفة الانتظار.`,
      question: 'وش خطتك لهذا النقد؟',
      book: cite('R5'),
    });
  }
  return out;
}

/** Turn a warning into بصير's spoken line, with or without an LLM. */
export async function speak(warning, ctx = {}) {
  const fallback = `${warning.text} ${warning.question}`;
  const { text } = await complete({
    system: SYSTEM,
    prompt: `ملاحظة المراقب: ${warning.text}\nحوّلها جملة واحدة قصيرة بأسلوب بصير، ثم السؤال.`,
    fallback,
    context: { rule: warning.id },
  });
  const checked = guard(text, { agent: 'coach', context: { rule: warning.id } });
  return checked.status === 'block' ? fallback : text;
}

/** Which book best explains this warning? */
export function explain(warning) {
  if (warning.book) return warning.book;
  const hits = search(`${warning.rule} ${warning.text}`, { limit: 1 });
  return hits[0]?.entry || null;
}

/** Daily technical read used by the expert-mode briefing. */
export function brief({ history, meta }) {
  if (!history?.length) return null;
  const closes = history.map((b) => b.close);
  const last = closes[closes.length - 1];
  const ma20 = sma(closes, 20).at(-1);
  const ma50 = sma(closes, 50).at(-1);
  const run = runLength(closes);
  const a = atrOf(history, 14).at(-1);

  const parts = [];
  parts.push(`${meta?.ar || 'السهم'} عند ${last.toFixed(2)} ريال.`);
  if (ma20) parts.push(`المتوسط 20 عند ${ma20.toFixed(2)}${ma50 ? ` والمتوسط 50 عند ${ma50.toFixed(2)}` : ''} — ${ma20 > (ma50 || ma20) ? 'الاتجاه صاعد' : 'الاتجاه هابط'}.`);
  if (run.up >= 2) parts.push(`صعد ${run.up} جلسات متتالية — لا تدخل الآن، انتظر تصحيحاً.`);
  if (run.down >= 2) parts.push(`نزل ${run.down} جلسات متتالية — لا تبيع من أول هبوط.`);
  if (a) parts.push(`التذبذب اليومي تقريباً ${a.toFixed(2)} ريال، فحط وقفك عند ${(a * 2).toFixed(2)} على الأقل.`);
  return parts.join(' ');
}
