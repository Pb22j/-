"""
بصير — Backend API
==================
خادم FastAPI يقدم:
- /api/chat: محادثة نصية مع Gemini (مع سياق المحفظة)
- /api/stt: تحويل الصوت إلى نص (عبر MiniMax)
- /ws/chat: WebSocket للصوت الثنائي الاتجاه مع Gemini Live
- /api/analyze: تحليل المحفظة وإصدار تحذيرات ذكية (محلي، بدون AI)
- /api/quote: جلب السعر الحالي والمحفوظية
- /health: فحص الصحة
"""
import os
import sys
import json

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
import asyncio
import base64
import tempfile
import subprocess
from typing import Dict, Any, Optional, List

import httpx
import websockets
import ssl
from pydantic import BaseModel, Field
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from pathlib import Path

# طبقة الأمان — تُطبَّق على كل رد يخرج من هذا الخادم
from compliance import guard as compliance_guard, COMPLIANCE_BRIEF

# تحميل المتغيرات البيئية من .env (مع فرض التجاوز في حال وجود متغيرات قديمة في النظام)
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)

# ===== إعدادات =====
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")

# ===== تطبيق FastAPI =====
app = FastAPI(
    title="بصير API",
    description="محاكي السوق السعودي (تاسي) للتوعية المالية",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== System Prompt (شخصية بصير) =====
BASEER_SYSTEM_PROMPT = """أنت «بصير»، مستشار مالي سعودي خبير في سوق الأسهم السعودي (تاسي).
تعمل داخل منصة محاكاة افتراضية هدفها التوعية المالية.

قواعدك الصارمة:
1. لهجتك: بيضاء مهنية سعودية، جادة ولكن ودودة. تتحدث بـ 1-3 أسطر فقط.
2. تستخدم أرقام المستخدم الحقيقية الظاهرة في السياق (خسارته، نسبة التركيز، الرصيد النقدي).
3. تتدخل فوراً عند [SYSTEM EVENT] وتشرح الخطأ ثم تسأل سؤالاً توجيهياً.
4. تحافظ على طابع احترافي - أنت مرشد مالي مرخص وليست شخصية كرتونية.
5. لا تعطي توصيات مالية نهائية (بيع/شراء) - فقط توعية وتفسير.
6. تستخدم أمثلة واقعية من السوق السعودي عند الإمكان.
"""

GEMINI_WS_URL = (
    f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha"
    f".GenerativeService.BidiGenerateContent?key={GEMINI_API_KEY}"
)


def isValidApiKeyFormat(key: str | None) -> bool:
    """يتحقق إن المفتاح API key صحيح (يبدأ بـ AIzaSy) وليس OAuth token"""
    if not key:
        return False
    return key.startswith("AIza") and len(key) >= 30


# ===== نماذج Pydantic =====
class ChatRequest(BaseModel):
    message: str
    context: Dict[str, Any] = Field(default_factory=dict)


class TradeAnalysisRequest(BaseModel):
    holdings: Dict[str, Any] = Field(default_factory=dict)
    cash: float = 0
    current_price: Optional[float] = None
    selected_company: Optional[str] = None
    trade_type: Optional[str] = None  # BUY | SELL
    history: Optional[List[Dict[str, Any]]] = None  # OHLCV الأخيرة


class AnalyzeResponse(BaseModel):
    warnings: List[Dict[str, Any]] = Field(default_factory=list)
    insights: List[str] = Field(default_factory=list)
    portfolio_score: int = 100
    risk_level: str = "low"  # low | medium | high


# ===== محرك التحليل المحلي (يعمل بدون AI) =====
def analyze_portfolio_local(req: TradeAnalysisRequest) -> AnalyzeResponse:
    """
    يحلل محفظة المستخدم محلياً ويصدر تحذيرات بناءً على قواعد سلوكية.
    لا يحتاج اتصال AI — مناسب للحكام في وضع عدم الاتصال.
    """
    warnings = []
    insights = []
    risk_score = 100

    holdings = req.holdings or {}
    cash = req.cash or 0
    company = req.selected_company or "السهم المختار"
    trade_type = req.trade_type or ""

    # حساب القيمة الإجمالية
    total_market_value = 0
    company_values: Dict[str, float] = {}
    for comp, holding in holdings.items():
        if not isinstance(holding, dict):
            continue
        shares = holding.get("shares", 0)
        avg_cost = holding.get("avgCost", 0)
        # تقدير السعر الحالي (يفضل يأتي من السياق)
        current_price = req.current_price if comp == company else avg_cost
        value = shares * (current_price or avg_cost)
        company_values[comp] = value
        total_market_value += value

    portfolio_value = total_market_value + cash

    # ===== القاعدة R1: تركز المحفظة في سهم واحد =====
    if total_market_value > 0:
        for comp, value in company_values.items():
            concentration = (value / portfolio_value) * 100 if portfolio_value > 0 else 0
            if concentration > 50:
                warnings.append({
                    "id": "R1",
                    "severity": "high",
                    "title": "تركز مفرط في سهم واحد",
                    "message": (
                        f"السهم '{comp}' يمثل {concentration:.1f}% من محفظتك. "
                        "هذا التركز يعرضك لمخاطر عالية. "
                        "يُنصح بتنويع المحفظة على 3-5 أسهم على الأقل من قطاعات مختلفة."
                    ),
                })
                risk_score -= 30
                break
            elif concentration > 35:
                warnings.append({
                    "id": "R1-soft",
                    "severity": "medium",
                    "title": "تركز مرتفع نسبياً",
                    "message": (
                        f"السهم '{comp}' يمثل {concentration:.1f}% من محفظتك. "
                        "فكّر في تخفيضه إلى أقل من 30% لتقليل المخاطر."
                    ),
                })
                risk_score -= 15

    # ===== القاعدة R2: شراء بعد 3 أيام صعود متتالية (FOMO) =====
    if trade_type == "BUY" and req.history and len(req.history) >= 4:
        h = req.history
        d0, d1, d2, d3 = h[-1]["close"], h[-2]["close"], h[-3]["close"], h[-4]["close"]
        if d0 > d1 > d2 > d3:
            pct = ((d0 - d3) / d3) * 100
            warnings.append({
                "id": "R2",
                "severity": "high",
                "title": "شراء بعد صعود متتالٍ (FOMO)",
                "message": (
                    f"السهم ارتفع {pct:.1f}% خلال 3 أيام متتالية وأنت تشتري الآن. "
                    "هذا سلوك مطاردة السهم الأخضر (FOMO) — كثيراً ما يكون الشراء في القمة. "
                    "انتظر تصحيحاً صحياً قبل الدخول."
                ),
            })
            risk_score -= 20

    # ===== القاعدة R3: بيع بعد هبوط يوم واحد (Panic Sell) =====
    if trade_type == "SELL" and req.history and len(req.history) >= 2:
        h = req.history
        if h[-1]["close"] < h[-2]["close"]:
            drop_pct = ((h[-2]["close"] - h[-1]["close"]) / h[-2]["close"]) * 100
            warnings.append({
                "id": "R3",
                "severity": "medium",
                "title": "بيع بخوف (Panic Sell)",
                "message": (
                    f"السهم نزل {drop_pct:.1f}% اليوم وقمت بالبيع فوراً. "
                    "هل أنت متأكد من هذا الاستعجال؟ "
                    "الهبوط اليومي لا يعني بالضرورة اتجاه هبوطي طويل الأمد."
                ),
            })
            risk_score -= 10

    # ===== القاعدة R4: لا تنويع (سلة واحدة) =====
    if total_market_value > 0 and len(company_values) == 1:
        warnings.append({
            "id": "R4",
            "severity": "medium",
            "title": "محفظة من سهم واحد",
            "message": (
                "محفظتك مكونة من سهم واحد فقط. هذا يُضاعف المخاطر. "
                "حتى أكبر الشركات قد تنهار بنسبة 50%+ خلال أزمة."
            ),
        })
        risk_score -= 15

    # ===== القاعدة R5: سيولة نقدية منخفضة جداً =====
    if total_market_value > 0:
        cash_ratio = (cash / portfolio_value) * 100
        if cash_ratio < 5:
            warnings.append({
                "id": "R5",
                "severity": "low",
                "title": "سيولة نقدية منخفضة",
                "message": (
                    f"لديك {cash_ratio:.1f}% سيولة نقدية فقط. "
                    "يُفضل الاحتفاظ بـ 10-20% سيولة لاغتنام الفرص."
                ),
            })
            risk_score -= 5

    # ===== رؤى إيجابية =====
    if not warnings:
        insights.append("✅ محفظتك في حالة جيدة. استمر في التنويع والحذر.")
    if len(company_values) >= 3:
        insights.append(f"✅ تنويع جيد: محفظتك موزعة على {len(company_values)} أسهم.")
    if cash / max(portfolio_value, 1) > 0.15:
        insights.append("✅ سيولة نقدية كافية متاحة.")

    risk_level = "high" if risk_score < 50 else "medium" if risk_score < 80 else "low"

    return AnalyzeResponse(
        warnings=warnings,
        insights=insights,
        portfolio_score=max(0, risk_score),
        risk_level=risk_level,
    )


# ===== Endpoints =====
@app.get("/")
def root():
    return {
        "name": "بصير API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": [
            "/health",
            "/api/chat (POST)",
            "/api/analyze (POST)",
            "/api/compliance/guard (POST)",
            "/api/agent/ask (POST)",
            "/api/stt (POST)",
            "/ws/chat (WebSocket)",
        ],
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "بصير Backend is running",
        "gemini_configured": bool(GEMINI_API_KEY),
        "minimax_configured": bool(MINIMAX_API_KEY),
    }


# ===== Realtime Token (للاتصال المباشر من المتصفح بـ Gemini Live) =====
class RealtimeTokenRequest(BaseModel):
    custom_system_prompt: Optional[str] = None
    language: Optional[str] = "ar"


@app.post("/api/realtime-token")
async def get_realtime_token(req: RealtimeTokenRequest = None):
    """يُرجع بيانات الاتصال بـ Gemini Live API ليُستخدم مباشرة من المتصفح.

    لا نُمرّر الـ API key في الـ URL بشكل مكشوف — نُرجعه في JSON
    ثم الفرونت إند يبني الـ WebSocket connection محلياً.

    هذه النقطة تتطلب ثقة عالية — تُصدّر مفتاح Gemini للفرونت إند
    ليستخدمه المتصفح مباشرة. لذا نمرّرها على حارس الامتثال قبل
    إرجاعها: لو احتوى الـ custom prompt على نمط توصية/توقّع/ضمان،
    نرفض الـ prompt ونُرجع الـ token بدون system override.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY غير مُعد في backend/.env",
        )

    custom_prompt = (req.custom_system_prompt if req and req.custom_system_prompt else "") or ""
    language = (req.language if req and req.language else "ar")

    # الحارس: لو الـ prompt المُخصّص يحتوي على محظورات، اعرضها بدون override
    cleaned_prompt = custom_prompt
    if custom_prompt:
        check = compliance_guard(custom_prompt, agent="realtime-token-request")
        if check["status"] == "block":
            cleaned_prompt = ""

    default_instructions = """أنت «بصير»، مستشار مالي سعودي خبير في سوق الأسهم السعودي (تاسي).
تعمل داخل منصة محاكاة افتراضية هدفها التوعية المالية.

قواعدك الصارمة:
1. لهجتك: بيضاء مهنية سعودية، جادة ولكن ودودة. تتحدث بـ 1-3 أسطر فقط.
2. تستخدم أرقام المستخدم الحقيقية الظاهرة في السياق (خسارته، نسبة التركيز، الرصيد النقدي).
3. تتدخل فوراً عند [SYSTEM EVENT] وتشرح الخطأ ثم تسأل سؤالاً توجيهياً.
4. تحافظ على طابع احترافي - أنت مرشد مالي مرخص وليست شخصية كرتونية.
5. لا تعطي توصيات مالية نهائية (بيع/شراء) - فقط توعية وتفسير.
6. تستخدم أمثلة واقعية من السوق السعودي عند الإمكان.
7. لا تُكرر نفس التحية مرتين - رد بأسلوب طبيعي ومتنوع."""

    instructions = cleaned_prompt if cleaned_prompt else default_instructions

    return {
        "provider": "gemini",
        "api_key": GEMINI_API_KEY,
        "model": os.getenv("GEMINI_LIVE_MODEL", "gemini-3.8-live"),
        "instructions": instructions,
        "voice": "Charon",
        "language": language,
    }


def _guarded(reply: str, model: str) -> Dict[str, Any]:
    """يمرّر رد النموذج عبر طبقة الأمان قبل إعادته للعميل.

    هذا هو الحاجز الثاني: الواجهة تفحص أيضاً، لكن أي عميل آخر يتصل
    مباشرة بالباك-إند يمر من هنا فقط.
    """
    report = compliance_guard(reply, agent=model)
    if report["status"] == "block":
        print(f"[compliance] BLOCKED reply from {model}: {report['hits']}")
        return {
            "reply": report["message"],
            "model": model,
            "blocked": True,
            "compliance": report["hits"],
        }
    return {
        "reply": reply,
        "model": model,
        "blocked": False,
        "compliance": report["hits"],
    }


@app.post("/api/chat")
async def chat_with_llm(req: ChatRequest):
    """محادثة نصية — يستخدم MiniMax-M3 (الأساسي) أو Gemini (fallback)"""
    if not MINIMAX_API_KEY and not (GEMINI_API_KEY and isValidApiKeyFormat(GEMINI_API_KEY)):
        return {
            "reply": "⚠️ لا يوجد LLM مُعد. أضف MINIMAX_API_KEY في backend/.env"
        }

    cash = req.context.get("cash", 0)
    holdings = req.context.get("holdings", {})
    company = req.context.get("company", "غير محدد")
    price = req.context.get("price", 0)

    holdings_str = ", ".join(
        [f"{k}: {v.get('shares', 0)} سهم" for k, v in holdings.items()]
    ) if holdings else "لا يوجد أسهم"

    # System prompt قوي ومختصَر للاستثمار
    system_prompt = """أنت «بصير»، مستشار مالي سعودي متخصص في سوق الأسهم السعودي (تاسي).

شخصيتك:
- تتحدث بلهجة سعودية بيضاء مهنية، جادة ولكن ودودة
- ردودك مختصرة جداً (سطر إلى سطرين فقط، 30-80 كلمة كحد أقصى)
- لا تستخدم تحية إلا في أول رسالة
- لا تكرر نفسك أبداً
- تستخدم أرقام المستخدم الحقيقية في ردك (السيولة، الأسهم، السعر)

مهامك:
1. تحليل صفقات المستخدم وتنبيهه للأخطاء السلوكية
2. شرح المفاهيم المالية بلغة بسيطة
3. التحذير من: FOMO، Panic Sell، التركز في سهم واحد، استنزاف السيولة
4. التشجيع على: التنويع، التفكير طويل المدى، الصبر

قواعد صارمة:
- لا تعطي توصيات بيع/شراء نهائية
- لا تخترع أرقام أو أسعار
- إذا ما فهمت السؤال، اطلب توضيحاً بسطر واحد
""" + COMPLIANCE_BRIEF

    user_message = f"""[سياق المحفظة]
- السيولة: {cash:,.0f} ريال
- الأسهم: {holdings_str}
- السهم المختار: {company} بسعر {price:.2f} ريال

[سؤال المستخدم]
{req.message}

[تعليمات الرد]
جاوب بسطر أو سطرين فقط (30-80 كلمة). لا تحية إلا لو أول رسالة. أرقام المستخدم الحقيقية فقط."""

    # جرب MiniMax-M3 أولاً
    if MINIMAX_API_KEY:
        try:
            url = "https://api.minimax.io/v1/text/chatcompletion_v2"
            headers = {
                "Authorization": f"Bearer {MINIMAX_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": "MiniMax-M3",  # نموذج MiniMax-M3 للاستثمار
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "max_tokens": 500,
                "temperature": 0.6,
            }
            async with httpx.AsyncClient(verify=False, timeout=20.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    if "choices" in data and len(data["choices"]) > 0:
                        reply_text = data["choices"][0]["message"]["content"].strip()
                        return _guarded(reply_text, "MiniMax-M3")
                    if "reply" in data:
                        return _guarded(data["reply"].strip(), "MiniMax-M3")
                    if "base_resp" in data and data["base_resp"].get("status_code", 0) != 0:
                        print(f"MiniMax-M3 base_resp: {data['base_resp']}")
                else:
                    print(f"MiniMax-M3 Error: {response.status_code} - {response.text[:200]}")
        except Exception as e:
            print(f"MiniMax-M3 Exception: {e}")

    # Fallback إلى Gemini (إذا المفتاح صحيح)
    if GEMINI_API_KEY and isValidApiKeyFormat(GEMINI_API_KEY):
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
            async with httpx.AsyncClient(verify=False, timeout=20.0) as client:
                response = await client.post(
                    url,
                    headers={"Content-Type": "application/json"},
                    json={
                        "systemInstruction": {"parts": [{"text": system_prompt}]},
                        "contents": [{"parts": [{"text": user_message}]}],
                        "generationConfig": {
                            "maxOutputTokens": 200,
                            "temperature": 0.6,
                        },
                    },
                )
                data = response.json()
                if "candidates" in data and len(data["candidates"]) > 0:
                    reply_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return _guarded(reply_text.strip(), "gemini-2.0-flash")
        except Exception as e:
            print(f"Gemini fallback Error: {e}")

    return {"reply": "⚠️ تعذر الاتصال بأي نموذج. تأكد من إعدادات API keys في backend/.env"}


# ===== طبقة الأمان — نقاط النهاية =====
class ComplianceRequest(BaseModel):
    text: str
    agent: str = "external"
    context: Dict[str, Any] = Field(default_factory=dict)


@app.post("/api/compliance/guard")
async def compliance_guard_endpoint(req: ComplianceRequest):
    """يفحص نصاً مرسلاً من الواجهة قبل عرضه. يُرجع verdict كامل."""
    return compliance_guard(req.text, agent=req.agent, context=req.context)


class AgentRequest(BaseModel):
    message: str
    context: Dict[str, Any] = Field(default_factory=dict)
    level: Optional[str] = "beginner"
    agent: str = "knowledge"


@app.post("/api/agent/ask")
async def agent_ask(req: AgentRequest):
    """بوابة الوكلاء على الخادم.

    الواجهة تملك الوكلاء والاسترجاع، وهذه نقطة الخادم للمراقبة:
    تفحص السؤال نفسه قبل إرساله، وتفحص الرد قبل إعادته، وتسجّل
    حالة الامتثال في الاستجابة.
    """
    inbound = compliance_guard(req.message, agent="inbound")
    if inbound["status"] == "block":
        # سؤال المستخدم طلب توصية — نرد بالرفض مباشرة ولا نرسله للنموذج
        return {
            "reply": inbound["message"],
            "blocked": True,
            "stage": "inbound",
            "compliance": inbound["hits"],
        }

    if not MINIMAX_API_KEY and not (GEMINI_API_KEY and isValidApiKeyFormat(GEMINI_API_KEY)):
        return {
            "reply": "ما فيه نموذج مُعد حالياً. الواجهة تشتغل بدون اتصال بقاعدة المعرفة.",
            "blocked": False,
            "stage": "no-llm",
            "compliance": inbound["hits"],
        }

    system = (
        f"{BASEER_SYSTEM_PROMPT}\n\n{COMPLIANCE_BRIEF}\n\n"
        f"المستوى: {req.level}"
    )
    return await chat_with_llm(
        ChatRequest(message=req.message, context=req.context, system=system)
    )

@app.post("/api/analyze")
async def analyze(req: TradeAnalysisRequest):
    """تحليل المحفظة محلياً (بدون AI) — يعمل دائماً حتى بدون مفاتيح"""
    return analyze_portfolio_local(req)


# ===== MiniMax TTS (تحويل النص إلى صوت عربي) =====
class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = "male-qn-jingying"  # MiniMax male voice (closest available Arabic-friendly voice)
    model: Optional[str] = "speech-02-hd"  # أعلى جودة
    speed: Optional[float] = 1.0


@app.post("/api/tts")
async def tts_endpoint(req: TTSRequest):
    """تحويل النص إلى صوت عبر MiniMax TTS (يدعم العربية) — يستخدم speech-2.8-hd"""
    if not MINIMAX_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="MINIMAX_API_KEY غير مُعد في backend/.env",
        )

    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="النص فارغ")

    # افتراضي: speech-2.8-hd (الأحدث من MiniMax حسب الصورة المرفقة)
    model = req.model or "speech-2.8-hd"
    voice_id = req.voice_id or "male-qn-jingying"

    # تجربة endpoint TTS v2 الجديد
    endpoints_to_try = [
        "https://api.minimax.io/v1/t2a_v2",
        "https://api.minimax.io/v1/text_to_speech",
    ]

    last_error = None
    for url in endpoints_to_try:
        try:
            headers = {
                "Authorization": f"Bearer {MINIMAX_API_KEY}",
                "Content-Type": "application/json",
            }

            # MiniMax TTS v2 يحتاج بنية محددة (voice_setting + audio_setting)
            payload = {
                "model": model,
                "text": req.text,
                "stream": False,
                "voice_setting": {
                    "voice_id": voice_id,
                    "speed": req.speed,
                    "vol": 1.0,
                    "pitch": 0,
                },
                "audio_setting": {
                    "sample_rate": 32000,
                    "bitrate": 128000,
                    "format": "mp3",
                    "channel": 1,
                },
            }

            async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)

                if response.status_code == 200:
                    audio_bytes = response.content
                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    return {
                        "audio": audio_b64,
                        "format": "mp3",
                        "voice_id": voice_id,
                        "model": model,
                        "size_bytes": len(audio_bytes),
                    }
                else:
                    last_error = f"HTTP {response.status_code}: {response.text[:300]}"
                    print(f"TTS endpoint {url} failed: {last_error}")
                    continue
        except Exception as e:
            last_error = str(e)
            print(f"TTS endpoint {url} exception: {e}")
            continue

    raise HTTPException(status_code=502, detail=f"كل نقاط TTS فشلت: {last_error}")


# ===== TTS Fallback (Browser Speech Synthesis عبر Frontend) =====
# نُرجع إجابة بدون audio ليستخدم المتصفح TTS كـ fallback


# ===== Voice Pipeline (turn-based) =====
class VoicePipelineRequest(BaseModel):
    """Pipeline كامل: STT → LLM → TTS"""
    audio: str  # base64 webm
    voice_id: Optional[str] = "male-qn-jingying"
    context: Dict[str, Any] = Field(default_factory=dict)


@app.post("/api/voice-pipeline")
async def voice_pipeline(req: VoicePipelineRequest):
    """Pipeline كامل: STT (MiniMax) → LLM (MiniMax-M3) → TTS (speech-2.8-hd).

    يرجع نص الكلام + رد الـ LLM + الصوت.
    """
    if not MINIMAX_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="MINIMAX_API_KEY غير مُعد. وضع HD يحتاج MiniMax STT + TTS.",
        )

    if not req.audio:
        raise HTTPException(status_code=400, detail="الصوت فارغ")

    try:
        # 1) STT: تحويل الصوت إلى نص — تجربة endpoint v1 و v2
        webm_data = base64.b64decode(req.audio)
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(webm_data)
            temp_webm = f.name

        temp_wav = temp_webm + ".wav"
        # تحويل webm إلى wav mono 16kHz لـ MiniMax
        subprocess.run(
            ["ffmpeg", "-y", "-i", temp_webm, "-ar", "16000", "-ac", "1", "-f", "wav", temp_wav],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        user_text = ""
        stt_error_msg = ""
        if os.path.exists(temp_wav) and os.path.getsize(temp_wav) > 100:
            # محاولة endpoint v1
            for stt_url in [
                "https://api.minimax.io/v1/speech_to_text",
                "https://api.minimax.io/v1/asr",
            ]:
                try:
                    headers = {"Authorization": f"Bearer {MINIMAX_API_KEY}"}
                    with open(temp_wav, "rb") as audio_file:
                        files = {"file": ("audio.wav", audio_file, "audio/wav")}
                        data = {"model": "asr-1.0"}
                        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                            response = await client.post(
                                stt_url, headers=headers, files=files, data=data
                            )
                            if response.status_code == 200:
                                resp_data = response.json()
                                user_text = resp_data.get("text", "")
                                if not user_text and "data" in resp_data:
                                    if isinstance(resp_data["data"], dict):
                                        user_text = resp_data["data"].get("text", "")
                                    elif isinstance(resp_data["data"], str):
                                        user_text = resp_data["data"]
                                if user_text:
                                    print(f"STT success via {stt_url}: {user_text[:50]}")
                                    break
                            else:
                                stt_error_msg = f"HTTP {response.status_code}"
                                print(f"STT {stt_url} failed: {stt_error_msg}")
                except Exception as e:
                    stt_error_msg = str(e)
                    print(f"STT {stt_url} exception: {e}")
                    continue

        try:
            os.remove(temp_webm)
            if os.path.exists(temp_wav):
                os.remove(temp_wav)
        except Exception:
            pass

        if not user_text or not user_text.strip():
            raise HTTPException(
                status_code=400,
                detail=f"لم يتم التعرف على الكلام. تأكد من وضوح الصوت والميكروفون. ({stt_error_msg})",
            )

        # 2) LLM: MiniMax-M3 مع سياق المحفظة
        cash = req.context.get("cash", 0)
        holdings = req.context.get("holdings", {})
        company = req.context.get("company", "غير محدد")
        price = req.context.get("price", 0)

        holdings_str = ", ".join(
            [f"{k}: {v.get('shares', 0)} سهم" for k, v in holdings.items()]
        ) if holdings else "لا يوجد أسهم"

        system_prompt = """أنت «بصير»، مستشار مالي سعودي متخصص في سوق الأسهم السعودي (تاسي).

شخصيتك:
- تتحدث بلهجة سعودية بيضاء مهنية، جادة ولكن ودودة
- ردودك مختصرة جداً (سطر إلى سطرين فقط، 30-80 كلمة كحد أقصى)
- لا تستخدم تحية إلا في أول رسالة
- لا تكرر نفسك أبداً
- تستخدم أرقام المستخدم الحقيقية في ردك (السيولة، الأسهم، السعر)

مهامك:
1. تحليل صفقات المستخدم وتنبيهه للأخطاء السلوكية
2. شرح المفاهيم المالية بلغة بسيطة
3. التحذير من: FOMO، Panic Sell، التركز في سهم واحد، استنزاف السيولة
4. التشجيع على: التنويع، التفكير طويل المدى، الصبر

قواعد صارمة:
- لا تعطي توصيات بيع/شراء نهائية
- لا تخترع أرقام أو أسعار
- إذا ما فهمت السؤال، اطلب توضيحاً بسطر واحد
"""

        user_message = f"""[سياق المحفظة]
- السيولة: {cash:,.0f} ريال
- الأسهم: {holdings_str}
- السهم المختار: {company} بسعر {price:.2f} ريال

[سؤال المستخدم]
{user_text}

[تعليمات الرد]
جاوب بسطر أو سطرين فقط (30-80 كلمة). لا تحية. أرقام المستخدم الحقيقية فقط."""

        agent_text = ""
        used_model = ""
        # جرب MiniMax-M3
        try:
            url = "https://api.minimax.io/v1/text/chatcompletion_v2"
            headers = {
                "Authorization": f"Bearer {MINIMAX_API_KEY}",
                "Content-Type": "application/json",
            }
            llm_payload = {
                "model": "MiniMax-M3",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "max_tokens": 500,
                "temperature": 0.6,
            }
            async with httpx.AsyncClient(verify=False, timeout=20.0) as client:
                response = await client.post(url, headers=headers, json=llm_payload)
                if response.status_code == 200:
                    data = response.json()
                    if "choices" in data and len(data["choices"]) > 0:
                        agent_text = data["choices"][0]["message"]["content"].strip()
                        used_model = "MiniMax-M3"
                    elif "reply" in data:
                        agent_text = data["reply"].strip()
                        used_model = "MiniMax-M3"
                else:
                    print(f"MiniMax-M3 Error: {response.status_code} - {response.text[:200]}")
        except Exception as e:
            print(f"MiniMax-M3 Exception: {e}")

        # Fallback إلى Gemini لو MiniMax-M3 فشل والمفتاح صحيح
        if not agent_text and GEMINI_API_KEY and isValidApiKeyFormat(GEMINI_API_KEY):
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
                async with httpx.AsyncClient(verify=False, timeout=20.0) as client:
                    response = await client.post(
                        url,
                        headers={"Content-Type": "application/json"},
                        json={
                            "systemInstruction": {"parts": [{"text": system_prompt}]},
                            "contents": [{"parts": [{"text": user_message}]}],
                            "generationConfig": {"maxOutputTokens": 200, "temperature": 0.6},
                        },
                    )
                    data = response.json()
                    if "candidates" in data and len(data["candidates"]) > 0:
                        agent_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                        used_model = "gemini-2.0-flash"
            except Exception as e:
                print(f"Gemini fallback Error: {e}")

        if not agent_text:
            agent_text = "عذراً، تعذر تحليل طلبك. حاول مرة أخرى."

        # الحارس: لو رد الـ LLM يحتوي توصية/توقّع/ضمان، نعرض الرفض بدل النص
        guarded = _guarded(agent_text, model="voice-pipeline")
        agent_text = guarded.get("reply", agent_text)

        # 3) TTS: speech-2.8-hd (الأحدث)
        audio_b64 = ""
        try:
            url = "https://api.minimax.io/v1/t2a_v2"
            headers = {
                "Authorization": f"Bearer {MINIMAX_API_KEY}",
                "Content-Type": "application/json",
            }
            tts_payload = {
                "model": "speech-2.8-hd",
                "text": agent_text,
                "stream": False,
                "voice_setting": {
                    "voice_id": req.voice_id or "male-qn-jingying",
                    "speed": 1.0,
                    "vol": 1.0,
                    "pitch": 0,
                },
                "audio_setting": {
                    "sample_rate": 32000,
                    "bitrate": 128000,
                    "format": "mp3",
                    "channel": 1,
                },
            }
            async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                tts_response = await client.post(url, headers=headers, json=tts_payload)
                if tts_response.status_code == 200:
                    audio_b64 = base64.b64encode(tts_response.content).decode("utf-8")
                else:
                    # fallback endpoint
                    tts_response = await client.post(
                        "https://api.minimax.io/v1/text_to_speech",
                        headers=headers,
                        json=tts_payload,
                    )
                    if tts_response.status_code == 200:
                        audio_b64 = base64.b64encode(tts_response.content).decode("utf-8")
        except Exception as e:
            print(f"TTS in pipeline Error: {e}")

        return {
            "user_text": user_text,
            "agent_text": agent_text,
            "audio": audio_b64,
            "format": "mp3",
            "voice_id": req.voice_id or "male-qn-jingying",
            "model": used_model,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Voice pipeline error: {e}")
        raise HTTPException(status_code=500, detail=f"خطأ في الـ pipeline: {str(e)}")


@app.post("/api/stt")
async def stt_endpoint(req: dict):
    """تحويل الصوت (webm) إلى نص عبر MiniMax"""
    audio_b64 = req.get("audio", "")
    if not audio_b64:
        return {"text": ""}

    if not MINIMAX_API_KEY:
        return {"text": "", "error": "MINIMAX_API_KEY غير مُعد"}

    try:
        webm_data = base64.b64decode(audio_b64)
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(webm_data)
            temp_webm = f.name

        temp_wav = temp_webm + ".wav"
        subprocess.run(
            ["ffmpeg", "-y", "-i", temp_webm, "-ar", "16000", "-ac", "1", temp_wav],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        text = ""
        if os.path.exists(temp_wav):
            url = "https://api.minimax.io/v1/speech_to_text"
            headers = {"Authorization": f"Bearer {MINIMAX_API_KEY}"}

            with open(temp_wav, "rb") as audio_file:
                files = {"file": ("audio.wav", audio_file, "audio/wav")}
                data = {"model": "asr-1.0"}
                async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                    response = await client.post(
                        url, headers=headers, files=files, data=data
                    )
                    if response.status_code == 200:
                        resp_data = response.json()
                        text = resp_data.get("text", "")
                        if not text and "data" in resp_data and isinstance(resp_data["data"], dict):
                            text = resp_data["data"].get("text", "")
                    else:
                        print(f"MiniMax STT Error: {response.status_code} - {response.text}")

        try:
            os.remove(temp_webm)
            if os.path.exists(temp_wav):
                os.remove(temp_wav)
        except Exception:
            pass

        return {"text": text.strip()}
    except Exception as e:
        print(f"STT Error: {e}")
        return {"text": "", "error": str(e)}


@app.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket):
    """WebSocket للصوت الثنائي الاتجاه مع Gemini Live"""
    await websocket.accept()

    if not GEMINI_API_KEY:
        await websocket.send_json({"type": "error", "text": "GEMINI_API_KEY غير مُعد"})
        await websocket.close()
        return

    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    try:
        async with websockets.connect(GEMINI_WS_URL, ssl=ssl_context) as gemini_ws:
            live_model = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.8-live")
            setup_msg = {
                "setup": {
                    "model": f"models/{live_model}",
                    "systemInstruction": {"parts": [{"text": BASEER_SYSTEM_PROMPT}]},
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Charon"}}
                        },
                    },
                }
            }
            await gemini_ws.send(json.dumps(setup_msg))
            await gemini_ws.recv()

            async def receive_from_frontend():
                try:
                    while True:
                        data = await websocket.receive_text()
                        msg = json.loads(data)

                        if msg.get("type") in ("system_event", "user_text"):
                            text_payload = msg.get("text", "")
                            await gemini_ws.send(json.dumps({
                                "clientContent": {
                                    "turns": [{"role": "user", "parts": [{"text": text_payload}]}],
                                    "turnComplete": True,
                                }
                            }))
                        elif msg.get("type") == "realtime_audio":
                            audio_b64 = msg.get("data", "")
                            await gemini_ws.send(json.dumps({
                                "realtimeInput": {
                                    "mediaChunks": [{
                                        "mimeType": "audio/pcm;rate=16000",
                                        "data": audio_b64,
                                    }]
                                }
                            }))
                        elif msg.get("type") == "audio_turn_end":
                            # المستخدم خلاص تكلم — أرسل turnComplete لـ Gemini ليبدأ الرد
                            print("[Backend] User turn ended — signaling Gemini")
                            await gemini_ws.send(json.dumps({
                                "clientContent": {
                                    "turns": [],
                                    "turnComplete": True,
                                }
                            }))
                except WebSocketDisconnect:
                    pass
                except Exception as e:
                    print(f"Frontend WS Error: {e}")

            async def receive_from_gemini():
                try:
                    while True:
                        response = await gemini_ws.recv()
                        resp_data = json.loads(response)

                        if "serverContent" in resp_data:
                            server_content = resp_data["serverContent"]

                            if "outputTranscription" in server_content:
                                text = server_content["outputTranscription"].get("text", "")
                                if text:
                                    await websocket.send_json({"type": "text", "text": text})

                            model_turn = server_content.get("modelTurn", {})
                            for part in model_turn.get("parts", []):
                                if "text" in part:
                                    await websocket.send_json({"type": "text", "text": part["text"]})
                                elif "inlineData" in part:
                                    await websocket.send_json({
                                        "type": "audio",
                                        "data": part["inlineData"]["data"],
                                        "mimeType": part["inlineData"]["mimeType"],
                                    })

                            # إشعار اكتمال الرد (مهم لإعادة فتح الميكروفون تلقائياً)
                            if server_content.get("turnComplete"):
                                await websocket.send_json({"type": "turnComplete"})

                        # إشارة مقاطعة (لو المستخدم قطع كلام البوت)
                        if resp_data.get("serverContent", {}).get("interrupted"):
                            await websocket.send_json({"type": "interrupted"})

                        # بث الصوت العكسي (لو Gemini يرد بصوت بدون serverContent wrapper)
                        if "audio" in resp_data and isinstance(resp_data["audio"], dict):
                            await websocket.send_json({
                                "type": "audio",
                                "data": resp_data["audio"].get("data", ""),
                                "mimeType": resp_data["audio"].get("mimeType", "audio/pcm;rate=24000"),
                            })
                except Exception as e:
                    print(f"Gemini WS Error: {e}")

            await asyncio.gather(receive_from_frontend(), receive_from_gemini())

    except Exception as e:
        print(f"Gemini WebSocket connection error: {e}")
        try:
            await websocket.send_json({"type": "error", "text": f"فشل الاتصال بـ Gemini: {e}"})
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    try:
        print(f"🚀 Starting Baseer API on http://{host}:{port}")
        print(f"📚 Docs: http://{host}:{port}/docs")
    except Exception:
        print(f"Starting Baseer API on http://{host}:{port}")
        print(f"Docs: http://{host}:{port}/docs")
    uvicorn.run("main:app", host=host, port=port, reload=True)
