/* ============================================================
   طبقة الأمان — Compliance Middleware
   ------------------------------------------------------------
   Every byte an agent emits passes through guard() before it reaches
   the player. Agents are TOLD what they may say; this module is what
   actually ENFORCES it. Defence in depth — a prompt alone is not a
   control you can rely on.

   Blocks : personalised buy/sell directives, price targets,
            guaranteed returns, pump language, illicit material.
   Allows : education, strategy mechanics, risk management,
            analysis of the player's OWN virtual portfolio,
            historical TASI data.
   ============================================================ */

export const SEVERITY = { BLOCK: 'block', CAUTION: 'caution', OK: 'ok' };

/* --- helpers ------------------------------------------------------- */

/** Normalise Arabic orthography so patterns actually match real text. */
export function normalize(s) {
  return String(s == null ? '' : s)
    .replace(/[\u064B-\u0652\u0640]/g, '')        // harakat + tatweel
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')   // آ أ إ ٱ -> ا
    .replace(/\u0649/g, '\u064A')                 // ى -> ي
    .replace(/\u0624/g, '\u0648')                 // ؤ -> و
    .replace(/\u0626/g, '\u064A')                 // ئ -> ي
    .replace(/\u0629/g, '\u0647')                 // ة -> ه  (loan endings)
    .replace(/[\u201c\u201d\u2018\u2019"']/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/* Company names + generic security nouns, used to pair with an action verb. */
const NAME_AR = '(?:راجحي|سابك|موبايلي|زين|شمس|ثمار|الأركان|الانماء|الكهرباء|الانعام)';
const NOUN_AR = '(?:سهم|اسهم|حصة|نصيبك)';
const ACT_BUY = '(?:اشتر|تشتر|شراء|شرا)';
const ACT_SELL = '(?:يباع|تباع|تبيع|تبييع|بيع)';
const ACT_OPEN = '(?:ب|ل)?(?:فتح|دخل|دخول|بدا|ابدا|ابحث|سجل)';
const ADVISE = '(?:ينصح|ننصح|انصح|اوصي|توصيتي|ينبغي|افضل|عليك)';
/* NB: \w is [A-Za-z0-9_] and does NOT match Arabic letters — any pattern that
   needs "the rest of the word" must use [^\s]* instead. */
const W = '[^\\s]*';

/* --- pattern families ---------------------------------------------- */

const RECOMMEND = [
  // "تشتري سهم الراجحي" / "شراء سهم" / "بِيع حصتك"
  new RegExp(`${ACT_BUY}${W}\\s+(?:${NAME_AR}|${NOUN_AR})`),
  new RegExp(`${ACT_SELL}\\s*${NOUN_AR}`),
  new RegExp(`${ACT_OPEN}\\s*(?:على\\s+)?(?:${NAME_AR}|${NOUN_AR})`),
  // "ينصحك تشتري" / "الأفضل تشتري" / "عليك تبيع"
  new RegExp(`${ADVISE}${W}\\s+(?:ان\\s+)?${W}\\s*(?:تشتري|تشري|تبيع|تشتريه|تملك|تفتح)`),
  /\byou\s+should\s+(?:buy|sell|exit|enter|get\s+out\s+of)\b/i,
  new RegExp(`\\b(?:buy|sell|exit|enter)\\s+(?:the\\s+)?(?:${NAME_AR}|stock|share)`, 'i'),
];

const TARGET = [
  // "راح يوصل 45 ريال" / "سيرتفع إلى 60"
  new RegExp(`(?:راح|سيرتفع|سينزل|يوصل|يطلع|ب.?سير)${W}\\s*(?:الى|ل)?\\s*\\d+(?:\\.\\d+)?\\s*ريال`),
  /(?:السعر\s*(?:المتوقع|المستهدف|الهدف)|هدف\s*السعر)/,
  /\b(?:price\s+target|target\s+price|will\s+reach|going\s+to\s+hit)\b/i,
];

const GUARANTEE = [
  /(?:مضمون|مضمونه|اضمن|نضمن|بلا\s*خساره|ما\s*تخسر|كي\s*ما\s*تخسر)/,
  /\b(?:guaranteed|guarantee|no\s+risk|risk[\s-]?free|sure\s+thing|can't\s+lose)\b/i,
];

const PUMP = [
  /(?:ارفع|ضاعف)\s*(?:السهم|السعر|الصفقه)/,
  /\b(?:moon|pump\s+it|to\s+the\s+moon|hundred\s*x)\b/i,
  /(?:الجميع\s*يشتري|كل\s*الناس\s*تشتري)/,
];

const ILLEGAL = [
  /(?:غسل\s*(?:اموال|الاموال)|تلاعب\s*بالسوق|inside\s*info|inside\s*trading|معلومات\s*داخليه)/i,
  /(?:اختراق|هاكر|برمجيات\s*خبيثه)/i,
];

/* The message shown in place of a blocked reply, in the house voice. */
export const REFUSALS = {
  recommend: 'هذي توصية، وما راح أعطيها لك. أنا هنا أعلّمك كيف تقرر بنفسك — خلنا نرجع للرقم: كم نسبة رأس المال اللي حاطّه في المخاطرة؟',
  target: 'ما أعطيك سعر مستهدف ولا توقّع. اللي أقدر أعلّمك إياه طريقة تقرأ ويفهم لحاله — جرّبها على بيانات ٢٠١٠–٢٠١٢.',
  guarantee: 'ما فيه استثمار مضمون، ولا فيه أحد يقدر يضمن لك. اللي يبيعك "ضمان" هو أول من يخطف فلوسك.',
  pump: 'هذي نفس اللغة اللي تجي مع إشاعات السوق. خلنا نبطئ ونقرأ الأرقام بدال الحماس.',
  illegal: 'هذا الموضوع برّا نطاق بصير. بصير للتعليم المالي فقط.',
  generic: 'ما أقدر أعيد صياغة هذا الطلب، بس أقدر أعلّمك المبدأ اللي وراه.',
};

const FAMILIES = [
  { id: 'illegal', severity: SEVERITY.BLOCK, patterns: ILLEGAL, note: 'محتوى غير قانوني' },
  { id: 'guarantee', severity: SEVERITY.BLOCK, patterns: GUARANTEE, note: 'وعد بعائد مضمون' },
  { id: 'recommend', severity: SEVERITY.BLOCK, patterns: RECOMMEND, note: 'توصية شراء أو بيع مباشرة' },
  { id: 'target', severity: SEVERITY.BLOCK, patterns: TARGET, note: 'سعر مستهدف أو توقّع' },
  { id: 'pump', severity: SEVERITY.CAUTION, patterns: PUMP, note: 'لغة تشجيع على الضخ' },
];

/**
 * Inspect one agent reply.
 * @returns {{status, hits, message}}
 *   'ok'      → pass through unchanged
 *   'caution' → pass through, but record it in the audit trail
 *   'block'   → caller MUST render `message` instead of the original text
 */
export function guard(reply, { agent = 'unknown', context = {} } = {}) {
  const text = normalize(reply);
  const hits = [];

  for (const fam of FAMILIES) {
    for (const re of fam.patterns) {
      const m = text.match(re);
      if (m) {
        hits.push({
          family: fam.id,
          severity: fam.severity,
          note: fam.note,
          match: String(m[0]).slice(0, 60),
        });
        break;
      }
    }
  }

  const blocked = hits.filter((h) => h.severity === SEVERITY.BLOCK);
  const caution = hits.filter((h) => h.severity === SEVERITY.CAUTION);

  if (blocked.length) {
    return {
      status: SEVERITY.BLOCK,
      agent,
      context,
      hits,
      message: REFUSALS[blocked[0].family] || REFUSALS.generic,
    };
  }
  return {
    status: caution.length ? SEVERITY.CAUTION : SEVERITY.OK,
    agent, context, hits,
    message: null,
  };
}

/** Convenience wrapper — returns text that is always safe to render. */
export function safe(reply, opts) {
  const v = guard(reply, opts);
  if (v.status === SEVERITY.BLOCK) return { text: v.message, blocked: true, report: v };
  return { text: reply, blocked: false, report: v };
}

/**
 * Prompt-level guard. Embedded into every agent system prompt so the model
 * knows the boundary BEFORE it writes — belt and braces with guard().
 */
export const COMPLIANCE_BRIEF = [
  'قواعد إلزامية لا تكسرها أبداً:',
  '1. لا توصي بالشراء أو البيع لأي سهم أو شركة، لا باسم ولا برمز.',
  '2. لا تعطي سعراً مستهدفاً ولا توقعاً لارتفاع أو انخفاض.',
  '3. لا تذكر أي عائد مضمون ولا "بدون مخاطرة" ولا "ما بتخسر".',
  '4. لا تشجع على الحماس ولا تكرر كلام الناس.',
  '5. اسأل المستخدم أسئلة تربوية بدل أن تقرر نيابة عنه.',
  '6. استخدم أرقام محفظته الافتراضية هو فقط، وركز على المبادئ.',
].join('\n');
