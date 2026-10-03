"""
طبقة الأمان — Compliance Middleware (Python)
===========================================
نسخة مطابقة لطبقة الأمان في الواجهة (src/agents/compliance.js).

السبب: الواجهة تفحص كل رد قبل عرضه، لكن الاعتماد على فحص الواجهة وحده
ضعيف — أي عميل آخر يتصل بالباك-إند يتجاوزه. لذلك نفحص مرتين:
مرة عند التوليد (prompt) ومرة عند الخروج من الخادم.

يحظر:
  - توصيات شراء/بيع مباشرة
  - الأسعار المستهدفة والتوقعات
  - العوائد المضمونة
  - لغة الضخ والتشهير
يسمح:
  - التعليم، شرح الاستراتيجيات، إدارة المخاطر
  - تحليل محفظة المستخدم الافتراضية
  - بيانات تاسي التاريخية
"""
import re
from typing import Dict, List, Optional

BLOCK = "block"
CAUTION = "caution"
OK = "ok"

# أسماء الشركات والمصطلحات العامة
NAME_AR = r"(?:راجحي|سابك|موبايلي|زين|شمس|ثمار|الأركان|الانماء|الكهرباء|الانعام)"
NOUN_AR = r"(?:سهم|اسهم|حصة|نصيبك)"
ACT_BUY = r"(?:اشتر|تشتر|شراء|شرا)"
ACT_SELL = r"(?:يباع|تباع|تبيع|تبييع|بيع)"
ACT_OPEN = r"(?:ب|ل)?(?:فتح|دخل|دخول|بدا|ابدا|ابحث|سجل)"
ADVISE = r"(?:ينصح|ننصح|انصح|اوصي|توصيتي|ينبغي|افضل|عليك)"

# NB: \w in Python also excludes Arabic letters — use [^\s] where "rest of word" is meant.
_W = r"[^\s]*"

RECOMMEND: List[str] = [
    rf"{ACT_BUY}{_W}\s+(?:{NAME_AR}|{NOUN_AR})",
    rf"{ACT_SELL}\s*{NOUN_AR}",
    rf"{ACT_OPEN}\s*(?:على\s+)?(?:{NAME_AR}|{NOUN_AR})",
    rf"{ADVISE}{_W}\s+(?:ان\s+)?{_W}\s*(?:تشتري|تشري|تبيع|تشتريه|تملك|تفتح)",
    r"\byou\s+should\s+(?:buy|sell|exit|enter|get\s+out\s+of)\b",
    rf"\b(?:buy|sell|exit|enter)\s+(?:the\s+)?(?:{NAME_AR}|stock|share)",
]

TARGET: List[str] = [
    rf"(?:راح|سيرتفع|سينزل|يوصل|يطلع|ب.?سير){_W}\s*(?:الى|ل)?\s*\d+(?:\.\d+)?\s*ريال",
    r"(?:السعر\s*(?:المتوقع|المستهدف|الهدف)|هدف\s*السعر)",
    r"\b(?:price\s+target|target\s+price|will\s+reach|going\s+to\s+hit)\b",
]

GUARANTEE: List[str] = [
    r"(?:مضمون|مضمونه|اضمن|نضمن|بلا\s*خساره|ما\s*تخسر|كي\s*ما\s*تخسر)",
    r"\b(?:guaranteed|guarantee|no\s+risk|risk[\s-]?free|sure\s+thing|can't\s+lose)\b",
]

PUMP: List[str] = [
    r"(?:ارفع|ضاعف)\s*(?:السهم|السعر|الصفقه)",
    r"\b(?:moon|pump\s+it|to\s+the\s+moon|hundred\s*x)\b",
    r"(?:الجميع\s*يشتري|كل\s*الناس\s*تشتري)",
]

ILLEGAL: List[str] = [
    r"(?:غسل\s*(?:اموال|الاموال)|تلاعب\s*بالسوق|inside\s*info|inside\s*trading|معلومات\s*داخليه)",
    r"(?:اختراق|هاكر|برمجيات\s*خبيثه)",
]

REFUSALS = {
    "recommend": "هذي توصية، وما بجاي أعطيها لك. أنا هنا أعلّمك كيف تقرر بنفسك — خلنا نرجع للرقم: كم نسبة رأس المال اللي حاطه في المخاطرة؟",
    "target": "ما أعطيك سعر مستهدف ولا توقّع. اللي أقدر أعلّمك إياه طريقة تقرأ ويفهم لحاله — جرّبها على بيانات ٢٠١٠–٢٠١٢.",
    "guarantee": "ما فيه استثمار مضمون، ولا فيه أحد يقدر يضمن لك. اللي يبيعك «ضمان» هو أول من يخطف فلوسك.",
    "pump": "هذي نفس اللغة اللي تجي مع إشاعات السوق. خلنا نبطئ ونقرأ الأرقام بدال الحماس.",
    "illegal": "هذا الموضوع برّا نطاق بصير. بصير للتعليم المالي فقط.",
    "generic": "ما أقدر أعيد صياغة هذا الطلب، بس أقدر أعلّمك المبدأ اللي وراه.",
}

FAMILIES = [
    ("illegal", BLOCK, ILLEGAL, "محتوى غير قانوني"),
    ("guarantee", BLOCK, GUARANTEE, "وعد بعائد مضمون"),
    ("recommend", BLOCK, RECOMMEND, "توصية شراء أو بيع مباشرة"),
    ("target", BLOCK, TARGET, "سعر مستهدف أو توقّع"),
    ("pump", CAUTION, PUMP, "لغة تشجيع على الضخ"),
]

_COMPILED = [
    (fid, sev, [re.compile(p, re.IGNORECASE) for p in pats], note)
    for fid, sev, pats, note in FAMILIES
]


def normalize(text: str) -> str:
    """تطبيع الكتابة العربية حتى تطابق الأنماط النص الحقيقي."""
    if not text:
        return ""
    t = text
    t = re.sub(r"[\u064B-\u0652\u0640]", "", t)              # تشكيل + تطويل
    t = re.sub(r"[\u0622\u0623\u0625\u0671]", "\u0627", t)     # آ أ إ ٱ -> ا
    t = t.replace("\u0649", "\u064A")                         # ى -> ي
    t = t.replace("\u0624", "\u0648")                         # ؤ -> و
    t = t.replace("\u0626", "\u064A")                         # ئ -> ي
    t = t.replace("\u0629", "\u0647")                         # ة -> ه
    t = re.sub(r"[\u201c\u201d\u2018\u2019\"']", "", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip().lower()


def guard(reply: str, agent: str = "backend", context: Optional[Dict] = None) -> Dict:
    """يفحص رد الوكيل. يُرجع { status, message, hits }.

    status == "block"   → يجب عرض `message` بدل الرد الأصلي
    status == "caution" → يمرّ مع تسجيله في سجل التدقيق
    status == "ok"      → يمرّ كما هو
    """
    text = normalize(reply)
    hits: List[Dict] = []
    blocked_family: Optional[str] = None

    for fid, sev, regexes, note in _COMPILED:
        for rx in regexes:
            m = rx.search(text)
            if m:
                hits.append({
                    "family": fid, "severity": sev, "note": note, "match": m.group(0)[:60],
                })
                if sev == BLOCK and blocked_family is None:
                    blocked_family = fid
                break

    if blocked_family:
        return {
            "status": BLOCK,
            "agent": agent,
            "context": context or {},
            "hits": hits,
            "message": REFUSALS.get(blocked_family, REFUSALS["generic"]),
        }

    status = CAUTION if any(h["severity"] == CAUTION for h in hits) else OK
    return {"status": status, "agent": agent, "context": context or {}, "hits": hits, "message": None}


def safe(reply: str, agent: str = "backend", context: Optional[Dict] = None):
    """نسخة مختصرة: ترجع النص الآمن للعرض مباشرة."""
    report = guard(reply, agent, context)
    if report["status"] == BLOCK:
        return report["message"], True, report
    return reply, False, report


COMPLIANCE_BRIEF = "\n".join([
    "قواعد إلزامية لا تكسرها أبداً:",
    "1. لا توصي بالشراء أو البيع لأي سهم أو شركة، لا باسم ولا برمز.",
    "2. لا تعطي سعراً مستهدفاً ولا توقعاً لارتفاع أو انخفاض.",
    "3. لا تذكر أي عائد مضمون ولا بدون مخاطرة.",
    "4. لا تشجع على الحماس ولا تكرر كلام الناس.",
    "5. اسأل المستخدم أسئلة تربوية بدل أن تقرر نيابة عنه.",
])


if __name__ == "__main__":
    cases = [
        ("عليك تشتري سهم الراجحي الحين", BLOCK),
        ("انصحك تشتري سابك قبل ما يطلع", BLOCK),
        ("ينصحني بفتح سهم زين", BLOCK),
        ("السعر راح يوصل 45 ريال خلال شهر", BLOCK),
        ("هذا الاستثمار مضمون وما بتخسر", BLOCK),
        ("كيف اسوي غسل اموال عن طريق الاسهم", BLOCK),
        ("ارفع السهم اليوم قبل ما يطلع", CAUTION),
        ("التنويع يقلل المخاطرة على المدى الطويل", OK),
        ("خلنا نراجع نسبة التركيز في محفظتك", OK),
        ("The RSI above 70 means overbought conditions", OK),
    ]
    passed = 0
    for text, want in cases:
        got = guard(text)["status"]
        if got == want:
            passed += 1
        else:
            print(f"FAIL  {text!r} -> {got} (want {want})")
    print(f"compliance self-test: {passed}/{len(cases)}")
    raise SystemExit(0 if passed == len(cases) else 1)
