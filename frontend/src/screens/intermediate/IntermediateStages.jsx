/* ============================================================
   فخاخ السوق — Intermediate Stages (متوسط)
   ------------------------------------------------------------
   The sim-real track. Six traps Saudi retail investors actually fall
   into, each built the same way:

     decision  ->  staged consequence  ->  one lesson from the corpus

   Nothing here recommends a real trade. The social post is invented and
   labelled as such, the financial sheet is simulated, and real TASI
   history (2010-2012) is used only as market texture behind the story.
   Numbers go through lib/format.js so the house rules hold: Western
   digits, «ريال» after the number, arrows instead of signs.
   ============================================================ */

import React from 'react';
import { Button, Piece, Chip } from '../../components/core/index.jsx';
import {
  useTween, useLater, Flip, Torn, TalkingOrb, EyeOrb, GameTag, ChoiceCard,
} from '../../components/games/index.jsx';
import { StarRating } from '../../components/progress/index.jsx';
import { Figure, OutcomeCard } from '../../components/finance/index.jsx';
import { CandleChart } from '../../components/charts/CandleChart.jsx';
import { BY_ID } from '../../content/knowledge.js';
import { STAGES } from '../../content/stages.js';
import { runLength, maxDrawdown } from '../../lib/indicators.js';
import { n, n2, sar, dir, pct } from '../../lib/format.js';

/* ============================================================
   أدوات مشتركة — shared helpers
   ============================================================ */

/** Flip true `ms` after `on` becomes true — the commit-then-reveal clock. */
function useAfter(on, ms = 900) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    if (!on) { setReady(false); return undefined; }
    const t = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return ready;
}

/** onComplete fires exactly once per attempt; reset re-arms it on retry. */
function useFinish(onComplete, stageId) {
  const fired = React.useRef(false);
  const finish = React.useCallback((stars, won, extra) => {
    if (fired.current) return;
    fired.current = true;
    onComplete?.(stageId, stars, won, extra);
  }, [onComplete, stageId]);
  const reset = React.useCallback(() => { fired.current = false; }, []);
  return [finish, reset];
}

const TRAP_STAGES = STAGES.intermediate || [];
const stepOf = (stage) => {
  const i = TRAP_STAGES.findIndex((s) => s.id === stage?.id);
  return i < 0 ? 1 : i + 1;
};

/** The corpus line that backs this stage, matched on the `concept` id. */
function lessonOf(concept, i = 0) {
  const book = BY_ID[concept];
  if (!book) return 'الدرس مو موجود في القاعدة — راجع المبدأ بنفسك.';
  return book.principles?.[i] || book.principles?.[0] || book.summary || '';
}
const bookOf = (concept) => BY_ID[concept] || null;

/** The learner's own virtual capital, so the numbers feel like theirs. */
function simCapital(player) {
  const v = Number(player?.investable);
  return Number.isFinite(v) && v >= 10000 ? Math.min(v, 500000) : 100000;
}

/** The selected company from the store, guarded — it may still be loading. */
function useCompany(market) {
  return React.useMemo(() => {
    const id = market?.selected;
    const series = market?.series || {};
    const bars = Array.isArray(series[id]) ? series[id] : [];
    const meta = (market?.meta || {})[id] || null;
    return { id, bars, meta, name: meta?.ar || 'السهم التجريبي', sector: meta?.sector || 'قطاع عام' };
  }, [market]);
}

/** Stand-in bars so a stage still works before market_data.json lands. */
function synthBars(count = 60, start = 24) {
  const out = [];
  let c = start;
  for (let i = 0; i < count; i++) {
    const o = c;
    c = Math.max(1, c * (1 + 0.004 + Math.sin(i / 5) * 0.012));
    out.push({
      time: `2011-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      open: +o.toFixed(2),
      high: +(Math.max(o, c) * 1.012).toFixed(2),
      low: +(Math.min(o, c) * 0.988).toFixed(2),
      close: +c.toFixed(2),
      volume: 1200000 + ((i * 7919) % 900000),
    });
  }
  return out;
}

/** Eight rising sessions on purpose — the fallback still shows the trap. */
function synthRunBars(up = 8, room = 12, before = 34, start = 18) {
  const bars = synthBars(before, start);
  let c = bars[bars.length - 1].close;
  const push = (o, cl, month, day) => bars.push({
    time: `2012-${month}-${String(day).padStart(2, '0')}`,
    open: +o.toFixed(2),
    high: +(Math.max(o, cl) * 1.008).toFixed(2),
    low: +(Math.min(o, cl) * 0.992).toFixed(2),
    close: +cl.toFixed(2),
    volume: 1500000 + day * 30000,
  });
  for (let i = 0; i < up; i++) {
    const o = c;
    c = +(c * 1.021).toFixed(2);
    push(o, c, '09', i + 1);
  }
  for (let i = 0; i < room; i++) {
    const o = c;
    c = +(c * (i % 2 ? 1.035 : 0.955)).toFixed(2);
    push(o, c, '10', i + 1);
  }
  return bars;
}

/** A real stretch of `up` consecutive higher closes, with room after it. */
function findRunWindow(bars, up = 8, room = 12) {
  const c = bars.map((b) => b.close);
  for (let i = c.length - room - 1; i >= up; i--) {
    let ok = true;
    for (let k = 0; k < up; k++) if (!(c[i - k] > c[i - k - 1])) { ok = false; break; }
    if (ok) return { to: i };
  }
  return null;
}

/** Company names grouped by sector, for the concentration lesson. */
function sectorMap(market) {
  const meta = market?.meta || {};
  const out = {};
  Object.keys(meta).forEach((id) => {
    const m = meta[id] || {};
    const key = m.sectorKey || m.sector || 'other';
    (out[key] = out[key] || []).push({ id, name: m.ar || id });
  });
  return out;
}

const DISCLAIMER = 'محاكاة تعليمية — منشورات وأرقام خيالية، ولا توصية شراء أو بيع لأي سهم.';

/* ============================================================
   هيكل الشاشة — screen chrome
   ============================================================ */

function Screen({ children }) {
  return (
    <div className="bs-screen scroll" style={{ gap: 'var(--space-6)', maxWidth: 980, margin: '0 auto', width: '100%' }}>
      {children}
    </div>
  );
}

function StageHead({ step, stage, intro }) {
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <GameTag n={step} name={stage?.title || 'فخ'} />
      <p style={{ font: 'var(--type-lead)', margin: 0, maxWidth: 720 }}>{intro || stage?.blurb || ''}</p>
    </header>
  );
}

function Choices({ options, pick, onPick, w = 214, h = 152 }) {
  return (
    <div className="bs-row" style={{ gap: 'var(--space-5)' }}>
      {options.map((o, i) => (
        <ChoiceCard key={o.id} label={o.label} sub={o.sub} w={w} h={h} i={i}
          on={pick === o.id} disabled={!!pick} onClick={() => onPick(o.id)}>
          <Piece color="faint" cut={i % 4 + 1} style={{ width: 46, height: 46, display: 'grid', placeItems: 'center' }}>
            <span style={{ font: '700 20px/1 var(--f-sans)' }}>{i + 1}</span>
          </Piece>
        </ChoiceCard>
      ))}
    </div>
  );
}

function Question({ text }) {
  return (
    <Piece color="orange" cut={2} lift style={{ alignSelf: 'flex-start', padding: 'var(--space-5) var(--space-7)' }}>
      <span style={{ font: 'var(--type-title)' }}>{text}</span>
    </Piece>
  );
}

function Verdict({ tone = 'red', headline, detail, stars }) {
  return (
    <Piece color={tone} cut={3} lift style={{ padding: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', animation: 'bs-in .45s ease both' }}>
      <span style={{ font: 'var(--type-headline)' }}>{headline}</span>
      {detail && <span style={{ font: 'var(--type-body)', opacity: .92 }}>{detail}</span>}
      {stars != null && <StarRating value={stars} max={5} size={34} animate label={`تقييمك ${stars} من 5`} />}
    </Piece>
  );
}

/** A money figure that counts up — the number arrives with the reveal. */
function Money({ label, value }) {
  const v = useTween(Number.isFinite(value) ? value : 0, 900);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'center' }}>
      <span style={{ font: 'var(--type-label)', color: 'var(--ink-muted)' }}>{label}</span>
      <span className="num" style={{ font: 'var(--type-title)' }}>{n(v)} ريال</span>
    </div>
  );
}

/** Social counters inside the fake post. The `faint` paper fill is too
    low-contrast for real numbers, so these carry the same 2px ink ring the
    design system uses for ghost buttons. */
function Stat({ label }) {
  return (
    <span style={{
      display: 'inline-flex', padding: '7px 16px',
      font: '700 15px/1.4 var(--f-sans)', whiteSpace: 'nowrap',
      background: 'var(--cream)', color: 'var(--ink)',
      boxShadow: 'inset 0 0 0 2px var(--line-strong)',
    }}>{label}</span>
  );
}

/** One row of the staged price path: day, price, move. */
function DayRow({ day, price, delta, show, tone = 'green' }) {
  if (!show) return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap', animation: 'bs-in .45s ease both' }}>
      <span style={{ font: 'var(--type-label)', minWidth: 96, color: 'var(--ink-muted)' }}>{day}</span>
      <span className="num" style={{ font: 'var(--type-title)' }}>{n2(price)} ريال</span>
      <Chip color={tone}>{dir(delta)}</Chip>
    </div>
  );
}

/** A fake social post — invented handle, marked as simulation. */
function FakePost({ handle, badge, text, stats, showStats = true }) {
  return (
    <Piece color="cream" cut={2} lift style={{ padding: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 560, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'center' }}>
        <Piece color="blue" cut="circle" style={{ width: 62, height: 62, flex: 'none', display: 'grid', placeItems: 'center' }}>
          <span style={{ font: 'var(--type-title)' }}>س</span>
        </Piece>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ font: '700 19px/1.4 var(--f-sans)' }}>{handle}</span>
          <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{badge}</span>
        </div>
      </div>
      <p style={{ font: 'var(--type-body)', margin: 0 }}>{text}</p>
      {showStats && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', animation: 'bs-in .45s ease both' }}>
          {/* faint fill alone is too low-contrast for real counters, so these
              carry the same 2px ink ring the design system uses for ghost buttons */}
          <Stat label={`إعجاب ${n(stats.likes)}`} />
          <Stat label={`إعادة نشر ${n(stats.reposts)}`} />
          <Stat label={`تعليق ${n(stats.replies)}`} />
        </div>
      )}
      <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>منشور وهمي داخل المحاكاة — ما له علاقة بسهم حقيقي</span>
    </Piece>
  );
}

/** Two cards, one event, two outcomes. The comparison is the lesson. */
function TwoWays({ left, right }) {
  return (
    <div className="bs-row" style={{ gap: 'var(--space-7)' }}>
      <OutcomeCard label={left.label} value={left.value} color={left.color} cut={2} tilt={-2} emphasis={left.emphasis} />
      <OutcomeCard label={right.label} value={right.value} color={right.color} cut={3} tilt={2} emphasis={right.emphasis} />
    </div>
  );
}

function Footer({ onContinue, onRetry }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
      <Button onClick={onContinue}>كمّل</Button>
      <Button variant="ghost" onClick={onRetry}>جرّب مرة ثانية</Button>
    </div>
  );
}

/** Chart frame + the honesty line about where the data came from. */
function ChartCard({ bars, title, note, height = 250, markers = [], window: win = 60 }) {
  return (
    <Piece color="faint" cut={2} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <span style={{ font: '700 18px/1.4 var(--f-sans)' }}>{title}</span>
      <CandleChart bars={bars} height={height} window={win} showVolume={false} markers={markers} id="trap" />
      <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{note}</span>
    </Piece>
  );
}

/* ============================================================
   1 · فخ التوصية — the recommendation trap
   ------------------------------------------------------------
   The key stage: a realistic fake post, two green days, then a 20%
   collapse. The mechanic the coach has to name is that the news was
   already inside the price before the post existed.
   ============================================================ */

function RecommendationTrap({ stage, step, market, player, go, onComplete }) {
  const co = useCompany(market);
  const real = co.bars.length >= 30;
  const bars = real ? co.bars.slice(0, 60) : synthBars(60, 24);
  const entry = bars[bars.length - 1].close;
  const capital = simCapital(player);
  const shares = Math.max(50, Math.round(capital / entry / 50) * 50);

  const [pick, setPick] = React.useState(null);
  const statsIn = useLater(700);
  const day1 = useAfter(pick, 900);
  const day2 = useAfter(day1, 1050);
  const day3 = useAfter(day2, 1150);

  /* the scripted aftermath: two green days, then the drop */
  const p1 = +(entry * 1.07).toFixed(2);
  const p2 = +(p1 * 1.09).toFixed(2);
  const p3 = +(p2 * 0.8).toFixed(2);
  const netPct = ((p3 / entry) - 1) * 100;
  const crashPct = ((p3 / p2) - 1) * 100;
  const saved = shares * (p2 - p3);

  const PLANS = {
    buy: {
      stars: 2, won: false, qty: shares,
      headline: 'دخلت، وصرت سيولة الخروج',
      detail: `الناشر اشترى قبل ما تشوفه أنت، وباع عليك غلطة. أنت اللي سوّلت صفقته بـ ${n(shares)} ريال.`,
    },
    half: {
      stars: 3, won: false, qty: shares / 2,
      headline: 'نص الكمية — وهذا نصف الدرس',
      detail: 'خسرت أقل وهذا صحيح، بس نصف الكمية ما يشيل الفخ: نفس المنشور ونفس السيولة.',
    },
    wait: {
      stars: 5, won: true, qty: 0,
      headline: 'انتظرت، وهذا أصعب قرار في السوق',
      detail: 'ما دخلت وما خسرت. الخبر كان مدمجاً في السعر قبل ما تشوفه، فكان دورك إنك تنتظر سيولة غيرك.',
    },
  };
  const plan = pick ? PLANS[pick] : null;
  const lesson = lessonOf(stage?.concept);
  const [finish, resetFinish] = useFinish(onComplete, stage?.id);
  const pl = Math.round((plan?.qty || 0) * (p3 - entry));

  React.useEffect(() => {
    if (day3 && plan) finish(plan.stars, plan.won, { headline: plan.headline, lesson });
  }, [day3, plan, finish, lesson]);

  const retry = () => { setPick(null); resetFinish(); };

  return (
    <Screen>
      <StageHead step={step} stage={stage} intro="منشور بلا مصدر، والقرار بيدك. كل الأرقام هنا وهمية داخل المحاكاة." />

      {!pick && (
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center', flexWrap: 'wrap' }}>
          <FakePost
            handle="@سوق_المشاهير"
            badge="حساب وهمي · يتكلم كل ساعة"
            text="شركة الأفق للتأمين: خبر مؤكد يصدر خلال يوم، والسهم ما زال عند سعره الأول. اللي ما يدخل الحين بيضيع عليه صعود هالأسبوع."
            stats={{ likes: 4120, reposts: 980, replies: 640 }}
            showStats={statsIn}
          />
          <div style={{ flex: '1 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <Piece color="blue" cut={3} lift style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={{ font: 'var(--type-label)', opacity: .9 }}>محاكاتك</span>
              <span className="num" style={{ font: 'var(--type-headline)' }}>{n(capital)} ريال</span>
              <span style={{ font: 'var(--type-caption)', opacity: .9 }}>فلوس وهمية · دخول المنشور عند {n2(entry)} ريال · {n(shares)} سهم</span>
            </Piece>
            <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>ما تقدر تشوف نهاية القصة قبل ما تقرر.</span>
          </div>
        </div>
      )}

      {!pick && (
        <>
          <Question text="وش تسوي الحين؟" />
          <Choices
            options={[
              { id: 'buy', label: 'أشتري الحين', sub: 'قبل لا يفوت' },
              { id: 'half', label: 'أشتري نص الحصة', sub: 'نص المخاطرة' },
              { id: 'wait', label: 'أنتظر وأراقب', sub: 'ما أدخل على منشور' },
            ]}
            pick={pick} onPick={setPick}
          />
          <ChartCard
            bars={bars}
            title="الأسبوع اللي قبل المنشور"
            note={real
              ? 'بيانات تاسي الحقيقية ٢٠١٠–٢٠١٢ — الحركة سبقت الخبر، وهذا بالضبط المقصود.'
              : 'بيانات محاكاة — جاري تحميل بيانات تاسي الحقيقية.'}
          />
        </>
      )}

      {pick && (
        <>
          <Piece color="faint" cut={1} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <span style={{ font: 'var(--type-label)' }}>مسار السعر بعد المنشور</span>
            <DayRow day="اليوم الأول" price={p1} delta={7} show={day1} />
            <DayRow day="اليوم الثاني" price={p2} delta={9} show={day2} />
            {day3 && (
              <Torn color="red" w={330} h={140}>
                <span style={{ font: 'var(--type-title)' }}>اليوم الثالث</span>
                <span className="num" style={{ font: 'var(--type-lead)' }}>{n2(p3)} ريال</span>
                <span style={{ font: 'var(--type-caption)' }}>نزول مفاجئ بعد خبر متأخر</span>
              </Torn>
            )}
          </Piece>

          {day3 && (
            <>
              <TwoWays
                left={{ label: 'لو دخلت مع المنشور', value: dir(netPct), color: 'red', emphasis: true }}
                right={{ label: 'لو دخلت وبعت قبل الانهيار', value: dir(crashPct), color: 'orange' }}
              />
              <div className="bs-row" style={{ gap: 'var(--space-8)' }}>
                <Money label={plan.won ? 'رصيدك ما تغيّر' : 'خسرت من رأس مالك الوهمي'} value={plan.won ? capital : Math.abs(pl)} />
                <Money label="اللي كنت تتجنبه لو دخلت" value={Math.round(saved)} />
              </div>
              <Verdict tone={plan.won ? 'green' : 'red'} stars={plan.stars} headline={plan.headline} detail={plan.detail} />
              <TalkingOrb
                color={plan.won ? 'green' : 'orange'}
                text={`«${lesson}» الخبر كان داخل السعر قبل ما تشوفه، فالمنشور ما يعطيك معلومة — يعطيك سيولة جاهزة.`}
              />
            </>
          )}
          <Footer onContinue={() => go('journey')} onRetry={retry} />
        </>
      )}
    </Screen>
  );
}

/* ============================================================
   2 · السلة الواحدة — one basket, one sector
   ------------------------------------------------------------
   Concentrate in banks, then let one sector-wide shock hit every
   position at the same moment. Diversified vs concentrated, side by
   side, measured on the learner's own virtual money.
   ============================================================ */

/* one shock, many casualties: banks get hit, the rest barely moves */
const SHOCK = { banks: -11, industry: 2, services: 1, energy: -4 };

const PLANS_BASKET = {
  banks: {
    stars: 2, won: false, label: 'تركيز كامل في بنوك',
    weights: { banks: 100, industry: 0, services: 0, energy: 0, cash: 0 },
    headline: 'محفظتك كلها كانت على حدث واحد',
    detail: 'كل بنك نزل في اليوم نفسه، لأن سبب نزول واحد جاء للجميع. هذا مش تنويع، هذا قطاع واحد بغلاف.',
  },
  spread: {
    stars: 5, won: true, label: 'توزيع على أربعة قطاعات',
    weights: { banks: 40, industry: 25, services: 20, energy: 15, cash: 0 },
    headline: 'خسرت أقل من ربع الخسارة',
    detail: 'البنوك نزلت وباقي القطاعات رفع متوسطه. التنويع ما يمنع الهبوط، يخففه، وهذا هو.',
  },
  halfCash: {
    stars: 3, won: false, label: 'نصها بنوك ونصفها كاش',
    weights: { banks: 50, industry: 0, services: 0, energy: 0, cash: 50 },
    headline: 'النقد خفف الصدمة، والتركيز بقي',
    detail: 'أحسن من التركيز الكامل، بس نصك الثاني ما يشتغل. التنويع يكون في أسهم لا في كاش.',
  },
};

const impactOf = (w) => Object.entries(w)
  .reduce((acc, [k, weight]) => acc + (k === 'cash' ? 0 : (weight / 100) * SHOCK[k]), 0);

function BasketTrap({ stage, step, market, player, go, onComplete }) {
  const co = useCompany(market);
  const groups = sectorMap(market);
  const capital = simCapital(player);
  const bars = co.bars.length >= 30 ? co.bars.slice(0, 60) : synthBars(60, 21);

  const [pick, setPick] = React.useState(null);
  const shocked = useAfter(pick, 900);
  const compared = useAfter(shocked, 1100);

  const plan = pick ? PLANS_BASKET[pick] : null;
  const lesson = lessonOf(stage?.concept);
  const [finish, resetFinish] = useFinish(onComplete, stage?.id);

  React.useEffect(() => {
    if (compared && plan) finish(plan.stars, plan.won, { headline: plan.headline, lesson });
  }, [compared, plan, finish, lesson]);

  const bankImpact = impactOf(PLANS_BASKET.banks.weights);
  const spreadImpact = impactOf(PLANS_BASKET.spread.weights);
  const myImpact = plan ? impactOf(plan.weights) : 0;
  const left = Math.round(capital + (capital * myImpact) / 100);
  const bankNames = (groups.banks || []).slice(0, 4).map((b) => b.name);

  return (
    <Screen>
      <StageHead step={step} stage={stage} intro="عندك مبلغ واحد، وقرار واحد عن طريقة توزيعه. بعد قرارك يصير حدث واحد على الكل." />

      <div className="bs-row" style={{ gap: 'var(--space-6)' }}>
        <Piece color="blue" cut={3} lift style={{ padding: 'var(--space-7)', minWidth: 240, flex: '1 1 250px' }}>
          <span style={{ font: 'var(--type-label)', opacity: .9 }}>محاكاتك</span>
          <div className="num" style={{ font: 'var(--type-headline)' }}>{n(capital)} ريال</div>
          <span style={{ font: 'var(--type-caption)', opacity: .9 }}>محاكاة افتراضية — ما فيه تداول حقيقي.</span>
        </Piece>
        <Piece color="cream" cut={2} lift style={{ padding: 'var(--space-7)', minWidth: 240, flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ font: 'var(--type-label)', color: 'var(--ink-muted)' }}>أسهم القطاع المتاح</span>
          <span style={{ font: 'var(--type-body)' }}>{bankNames.length ? bankNames.join(' · ') : 'بنك أول · بنك ثاني · بنك ثالث'}</span>
          <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>وقطاعات ثانية متاحة: صناعات · خدمات · طاقة</span>
        </Piece>
      </div>

      {!pick && (
        <>
          <Question text="كيف توزع المبلغ؟" />
          <Choices
            options={[
              { id: 'banks', label: 'كله بنوك', sub: 'قطاع واحد أعرفه' },
              { id: 'spread', label: 'أربعة قطاعات', sub: 'موزّع على الكل' },
              { id: 'halfCash', label: 'نص بنوك ونصف كاش', sub: 'أأمن من الكل' },
            ]}
            pick={pick} onPick={setPick}
          />
          <ChartCard
            bars={bars}
            title="قطاعك كما تراه قبل الصدمة"
            note={co.bars.length
              ? `بيانات تاسي الحقيقية — ${co.name}، قطاع ${co.sector}.`
              : 'بيانات محاكاة — جاري تحميل بيانات تاسي الحقيقية.'}
          />
        </>
      )}

      {pick && shocked && (
        <Piece color="red" cut={2} lift style={{ alignSelf: 'flex-start', padding: 'var(--space-6) var(--space-7)', display: 'flex', gap: 'var(--space-5)', alignItems: 'center', flexWrap: 'wrap', animation: 'bs-in .45s ease both' }}>
          <EyeOrb alert size={44} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ font: 'var(--type-title)' }}>خبر واحد على الاقتصاد</span>
            <span style={{ font: 'var(--type-body)' }}>بنوك المملكة كلها نزلت في الجلسة نفسها.</span>
          </div>
          <Chip color="red">{dir(SHOCK.banks)}</Chip>
        </Piece>
      )}

      {pick && compared && (
        <>
          <TwoWays
            left={{ label: PLANS_BASKET.spread.label, value: dir(spreadImpact), color: 'green', emphasis: true }}
            right={{ label: PLANS_BASKET.banks.label, value: dir(bankImpact), color: 'red' }}
          />
          <div className="bs-row" style={{ gap: 'var(--space-8)' }}>
            <Figure variant="points" label="رصيدك بعد الصدمة" value={n(left)} unit="ريال" />
            <Figure variant="points" label="ما تحملته الصدمة" value={n(capital - left)} unit="ريال" />
            <Figure variant="points" label="حصة قطاعك من المحفظة" value={pct(plan.weights.banks)} unit="" />
          </div>
          <Verdict tone={plan.won ? 'green' : 'red'} stars={plan.stars} headline={plan.headline} detail={plan.detail} />
          <TalkingOrb
            color={plan.won ? 'green' : 'orange'}
            text={`«${lesson}» عشرة بنوك = قطاع واحد. التنويع يخفف الخسارة ولا يمنعها، وهذا يكفي.`}
          />
        </>
      )}

      {pick && <Footer onContinue={() => go('journey')} onRetry={() => { setPick(null); resetFinish(); }} />}
    </Screen>
  );
}

/* ============================================================
   3 · مطاردة القمة — chasing the top
   ------------------------------------------------------------
   A real eight-session run out of the TASI history, then the real
   sessions that followed it. Rule R2 in the coach engine reads the
   same three-session test, so the stage and the watcher agree.
   ============================================================ */

const ROOM = 12;

function FomoTrap({ stage, step, market, player, go, onComplete }) {
  const co = useCompany(market);
  const win = findRunWindow(co.bars, 8, ROOM);
  const real = !!win;
  const bars = real ? co.bars : synthRunBars(8, ROOM, 34, 18);
  const to = real ? win.to : bars.length - ROOM - 1;
  const from = Math.max(0, to - 30);

  const [pick, setPick] = React.useState(null);
  const revealed = useAfter(pick, 1000);

  const before = bars.slice(from, to + 1);
  const after = bars.slice(from, Math.min(bars.length, to + ROOM + 1));

  const closes = before.map((b) => b.close);
  const up = runLength(closes);
  const top = closes[closes.length - 1];
  const gainPct = ((top - closes[0]) / closes[0]) * 100;

  const tail = after.slice(to - from);
  const restReturn = ((tail[tail.length - 1].close - top) / top) * 100;
  const dip = Math.min(...tail.map((b) => b.close));
  const dipPct = ((dip - top) / top) * 100;

  const capital = simCapital(player);
  const shares = Math.max(50, Math.round(capital / top / 50) * 50);
  const chaserPl = Math.round(shares * (tail[tail.length - 1].close - top));

  const PLANS = {
    buy: {
      stars: 2, won: false,
      headline: 'دخلت على القمة بالضبط',
      detail: `${up.up} جلسات صاعدة، ودخلت في لحظة ما صار الكلام عن السهم أكثر من الكلام عن أي شي ثاني.`,
    },
    small: {
      stars: 3, won: false,
      headline: 'دخول صغير، وتوقع صحيح',
      detail: 'الحجم الصغير خفف الضربة، بس الفكرة نفسها كانت هي الغلط: الشراء بعد الصعود.',
    },
    wait: {
      stars: 5, won: true,
      headline: 'ما دخلت، وارتحت من القرار',
      detail: 'السوق يعاقب المتعجل ويكافئ المنتظر. أنت اخترت تنتظر، وهذا أصعب من الشراء.',
    },
  };
  const plan = pick ? PLANS[pick] : null;
  const lesson = lessonOf(stage?.concept);
  const [finish, resetFinish] = useFinish(onComplete, stage?.id);

  React.useEffect(() => {
    if (revealed && plan) finish(plan.stars, plan.won, { headline: plan.headline, lesson });
  }, [revealed, plan, finish, lesson]);

  return (
    <Screen>
      <StageHead
        step={step}
        stage={stage}
        intro={`${co.bars.length ? co.name : 'السهم'} طالع ${up.up} جلسات متتالية. الكلام صار عن السهم أكثر من الكلام عن أي شي ثاني.`}
      />

      <div className="bs-row" style={{ gap: 'var(--space-4)' }}>
        <Chip color="orange" big>{up.up} جلسات صاعدة</Chip>
        <Chip color="faint">مطاردة الصاعد</Chip>
        <Chip color="faint">حسابك الترند كله شراء</Chip>
      </div>

      <ChartCard
        bars={before}
        title={`${co.bars.length ? co.name : 'السهم'} حتى القمة`}
        note={real
          ? 'بيانات تاسي الحقيقية ٢٠١٠–٢٠١٢. الجلسات اللي بعدها ما تظهر إلا بعد ما تقرر.'
          : 'بيانات محاكاة — جاري تحميل بيانات تاسي الحقيقية.'}
        markers={[{ index: before.length - 1, side: 'SELL' }]}
        height={240}
      />

      {!pick && (
        <>
          <Question text="تدخل الحين؟" />
          <Choices
            options={[
              { id: 'buy', label: 'أشتري كله', sub: 'الكل يحكي عن السهم' },
              { id: 'small', label: 'أشتري جزء صغير', sub: 'أخفف المخاطرة' },
              { id: 'wait', label: 'أنتظر تصحيح', sub: 'ما أدخل على قمة' },
            ]}
            pick={pick} onPick={setPick}
          />
        </>
      )}

      {pick && revealed && (
        <>
          <ChartCard
            bars={after}
            title="ما بعد القمة"
            note="الجلسات التالية بنفس البيانات. هذا بالضبط اللي كنت تسأله عنه قبل ما تدخل."
            markers={[{ index: to - from, side: 'BUY' }]}
            height={240}
          />
          <TwoWays
            left={{ label: 'لو دخلت على القمة', value: dir(restReturn), color: 'red', emphasis: true }}
            right={{ label: 'لو انتظرت وعُدت — وفّرت في الدخول', value: dir(Math.abs(dipPct)), color: 'green' }}
          />
          <Money label="لو كنت داخل بكل المحاكاة" value={Math.abs(chaserPl)} />
          <Verdict tone={plan.won ? 'green' : 'red'} stars={plan.stars} headline={plan.headline} detail={plan.detail} />
          <TalkingOrb
            color={plan.won ? 'green' : 'orange'}
            text={`«${lesson}» كل ما زاد الكلام عن السهم، اقتراب من القمة لا من البداية.`}
          />
        </>
      )}

      {pick && <Footer onContinue={() => go('journey')} onRetry={() => { setPick(null); resetFinish(); }} />}
    </Screen>
  );
}

/* ============================================================
   4 · اليوم الأسود — the black day
   ------------------------------------------------------------
   Down 14% in one session: sell now, sell half, or hold while the
   reason you bought still stands. Graham's arithmetic is the lesson —
   a 14% fall needs a 16.3% rise just to reach square one again.
   ============================================================ */

function PanicTrap({ stage, step, market, player, go, onComplete }) {
  const co = useCompany(market);
  const real = co.bars.length >= 30;
  const bars = real ? co.bars.slice(0, 60) : synthBars(60, 44);
  const before = bars[bars.length - 1].close;
  const crash = +(before * 0.86).toFixed(2);
  const recovered = +(before * 1.064).toFixed(2);

  const [pick, setPick] = React.useState(null);
  const down = useAfter(pick, 900);
  const recoveryIn = useAfter(down, 1200);

  const capital = simCapital(player);
  const shares = Math.max(50, Math.round(capital / before / 50) * 50);
  const needPct = (1 / 0.86 - 1) * 100;
  const sellPl = Math.abs(shares * (crash - before));
  const holdPl = shares * (recovered - before);

  const PLANS = {
    sell: {
      stars: 2, won: false,
      headline: 'بعت في أول هبوط',
      detail: 'السبب الوحيد لبيعك هو إن السعر نزل. هذا بيع بلا خطة، ويحوّل ورقة إلى خسارة مؤكدة.',
    },
    half: {
      stars: 3, won: false,
      headline: 'نص بيع، ولا تمسك',
      detail: 'الحين أنت ولا ماسك ولا مباع. أسوأ حالة هي أن تكون جاهزاً لكل حركة.',
    },
    hold: {
      stars: 5, won: true,
      headline: 'تمسكت، والسبب ما تغير',
      detail: 'الهبوط اليومي ليس دليل اتجاه. أنت تملك أصلاً، مو سعر.',
    },
  };
  const plan = pick ? PLANS[pick] : null;
  const lesson = lessonOf(stage?.concept);
  const [finish, resetFinish] = useFinish(onComplete, stage?.id);

  React.useEffect(() => {
    if (recoveryIn && plan) finish(plan.stars, plan.won, { headline: plan.headline, lesson });
  }, [recoveryIn, plan, finish, lesson]);

  return (
    <Screen>
      <StageHead step={step} stage={stage} intro="اليوم نزل 14% في جلسة واحدة. أنت داخل من شهر، والقرار بيدك الحين." />

      <ChartCard
        bars={bars}
        title={`${real ? co.name : 'السهم'} قبل اليوم الأسود`}
        note={real
          ? 'بيانات تاسي الحقيقية ٢٠١٠–٢٠١٢. الهايغ على اليوم الأسود محاكاة تعليمية.'
          : 'بيانات محاكاة — جاري تحميل بيانات تاسي الحقيقية.'}
      />

      {!pick && (
        <>
          <Piece color="red" cut={2} lift style={{ alignSelf: 'flex-start', padding: 'var(--space-6) var(--space-7)', display: 'flex', gap: 'var(--space-5)', alignItems: 'center', flexWrap: 'wrap' }}>
            <EyeOrb alert size={44} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ font: 'var(--type-title)' }}>إغلاق اليوم {n2(crash)} ريال</span>
              <span style={{ font: 'var(--type-body)' }}>موضعتك {n(shares)} سهم · دخولك {n2(before)} ريال</span>
              <Chip color="red">{dir(-14)}</Chip>
            </div>
          </Piece>
          <Question text="وش تسوي؟" />
          <Choices
            options={[
              { id: 'sell', label: 'أبيع كل شي', sub: 'أهرب قبل لا يزيد' },
              { id: 'half', label: 'أبيع نص', sub: 'أقلل الخسارة' },
              { id: 'hold', label: 'أتمسك', sub: 'أراجع السبب' },
            ]}
            pick={pick} onPick={setPick}
          />
        </>
      )}

      {pick && down && (
        <Piece color="orange" cut={3} lift style={{ alignSelf: 'flex-start', padding: 'var(--space-6) var(--space-7)', animation: 'bs-in .45s ease both' }}>
          <span style={{ font: 'var(--type-body)' }}>الشركة أعلنت نتائجها بنفس التوقع، وما في سبب جديد للبيع غير إن السعر نزل.</span>
        </Piece>
      )}

      {pick && recoveryIn && (
        <>
          <DayRow day="اليوم الأسود" price={crash} delta={-14} show tone="red" />
          <DayRow day="بعد إحدى عشرة جلسة" price={recovered} delta={6.4} show tone="green" />
          <TwoWays
            left={{ label: 'لو بعت في اليوم الأسود', value: dir(-14), color: 'red' }}
            right={{ label: 'لو تمسكت', value: dir(6.4), color: 'green', emphasis: true }}
          />
          <div className="bs-row" style={{ gap: 'var(--space-8)' }}>
            <Money label="لو بعت الحين خسرت" value={Math.round(sellPl)} />
            <Money label="لو تمسكت ربحت" value={Math.round(holdPl)} />
            <Figure variant="points" label="الصعود المطلوب عشان ترجع مكانك" value={pct(needPct)} unit="" />
          </div>
          <Verdict tone={plan.won ? 'green' : 'red'} stars={plan.stars} headline={plan.headline} detail={plan.detail} />
          <TalkingOrb
            color={plan.won ? 'green' : 'orange'}
            text={`«${lesson}» نزل 14%؟ تحتاج ${pct(needPct)} صعود عشان ترجع لمكانك. اسأل: هل السبب تغير، ولا السعر بس نزل؟`}
          />
        </>
      )}

      {pick && <Footer onContinue={() => go('journey')} onRetry={() => { setPick(null); resetFinish(); }} />}
    </Screen>
  );
}

/* ============================================================
   5 · وين الوقف — where is the stop
   ------------------------------------------------------------
   Same entry, same chart, same period. The only variable is the stop.
   This is the most important lesson of the track: the stop decides
   the size of the position, not the courage of the trader.
   ============================================================ */

function StopTrap({ stage, step, market, player, go, onComplete }) {
  const co = useCompany(market);
  const real = co.bars.length >= 80;
  const bars = (real ? co.bars : synthBars(90, 30)).slice(-90);
  const entry = bars[0].close;
  const end = bars[bars.length - 1].close;

  const [pick, setPick] = React.useState(null);
  const wideOut = useAfter(pick, 1000);
  const tightOut = useAfter(wideOut, 1100);
  const noStop = useAfter(tightOut, 1100);

  const stopWide = +(entry * 0.92).toFixed(2);
  const stopTight = +(entry * 0.98).toFixed(2);
  const hitWide = bars.findIndex((b, i) => i > 0 && b.low <= stopWide);
  const hitTight = bars.findIndex((b, i) => i > 0 && b.low <= stopTight);
  const exitWide = hitWide > 0 ? stopWide : end;
  const exitTight = hitTight > 0 ? stopTight : end;
  const rWide = ((exitWide - entry) / entry) * 100;
  const rTight = ((exitTight - entry) / entry) * 100;
  const rNone = ((end - entry) / entry) * 100;
  const dd = maxDrawdown(bars.map((b) => b.close));

  const capital = simCapital(player);
  const shares = Math.max(50, Math.round(capital / entry / 50) * 50);

  const PLANS = {
    wide: {
      stars: 5, won: true,
      headline: 'وقف بالمسافة الصحيحة',
      detail: 'مخاطرة محسوبة ومسافة واضحة، يعني حجم مركز أصغر وقرار أسهل. هذي هي المعادلة.',
    },
    tight: {
      stars: 3, won: false,
      headline: 'وقف ضيق يوقف الضجيج',
      detail: 'الضجيج ما يوقف الاتجاه. وقف 2% يخرجك من صفقة ثم مايدخلها من جديد.',
    },
    none: {
      stars: 1, won: false,
      headline: 'بلا وقف، والنتيجة للتاريخ',
      detail: 'نفس الدخول ونفس التحليل ونتيجة مختلفة تماماً. الفرق كله كان نقطة واحدة.',
    },
  };
  const plan = pick ? PLANS[pick] : null;
  const lesson = lessonOf(stage?.concept);
  const [finish, resetFinish] = useFinish(onComplete, stage?.id);

  React.useEffect(() => {
    if (noStop && plan) finish(plan.stars, plan.won, { headline: plan.headline, lesson });
  }, [noStop, plan, finish, lesson]);

  return (
    <Screen>
      <StageHead step={step} stage={stage} intro="نفس الدخول، ونفس التحليل، ونفس المدة. نغيّر شيئ واحد بس: نقطة الوقف." />

      <div className="bs-row" style={{ gap: 'var(--space-6)' }}>
        <Piece color="blue" cut={3} lift style={{ padding: 'var(--space-7)', minWidth: 220, flex: '1 1 240px' }}>
          <span style={{ font: 'var(--type-label)', opacity: .9 }}>الدخول</span>
          <div className="num" style={{ font: 'var(--type-headline)' }}>{n2(entry)} ريال</div>
          <span style={{ font: 'var(--type-caption)', opacity: .9 }}>{n(shares)} سهم · {n(capital)} ريال</span>
        </Piece>
        <Piece color="cream" cut={2} lift style={{ padding: 'var(--space-7)', minWidth: 220, flex: '1 1 240px' }}>
          <span style={{ font: 'var(--type-label)', color: 'var(--ink-muted)' }}>نهاية المدة</span>
          <div className="num" style={{ font: 'var(--type-headline)' }}>{n2(end)} ريال</div>
          <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
            {n(bars.length)} جلسة · {bars[0].time} — {bars[bars.length - 1].time}
          </span>
        </Piece>
      </div>

      <ChartCard
        bars={bars}
        title={`${real ? co.name : 'السهم'} — نفس البيانات للصفقتين`}
        note="الدائرة الخضراء هي الدخول، والحمراء هي خروج الوقف. بدونه ما للصفقة نهاية إلا نهاية المدة."
        markers={[{ index: 0, side: 'BUY' }, { index: Math.max(0, hitWide), side: 'SELL' }]}
        height={240}
      />

      {!pick && (
        <>
          <Question text="وين تحط الوقف؟" />
          <Choices
            options={[
              { id: 'wide', label: 'تحت الدعم بـ 8%', sub: 'المسافة مقابل الإشارة' },
              { id: 'tight', label: 'تحت السعر بـ 2%', sub: 'أوقف الخسارة بسرعة' },
              { id: 'none', label: 'ما أحط وقف', sub: 'أراقب وأتمسك' },
            ]}
            pick={pick} onPick={setPick}
          />
        </>
      )}

      {pick && (
        <>
          {wideOut && (
            <Piece color="green" cut={2} lift style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 6, animation: 'bs-in .45s ease both' }}>
              <span style={{ font: 'var(--type-title)' }}>الصفقة الأولى · وقف 8%</span>
              <span className="num" style={{ font: 'var(--type-lead)' }}>خرجت عند {n2(exitWide)} ريال · {dir(rWide)}</span>
              <span style={{ font: 'var(--type-body)' }}>
                {hitWide > 0 ? `الوقف ضرب في جلسة ${n(hitWide + 1)}، وما استنى أحد.` : 'الوقف ما انضرب، وسعر نهاية المدة فوق الدخول.'}
              </span>
            </Piece>
          )}
          {tightOut && (
            <Piece color="orange" cut={3} lift style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 6, animation: 'bs-in .45s ease both' }}>
              <span style={{ font: 'var(--type-title)' }}>الصفقة الثانية · وقف 2%</span>
              <span className="num" style={{ font: 'var(--type-lead)' }}>خرجت عند {n2(exitTight)} ريال · {dir(rTight)}</span>
              <span style={{ font: 'var(--type-body)' }}>
                {hitTight > 0 && hitTight < (hitWide > 0 ? hitWide : bars.length)
                  ? 'الضجيج وحده أخرجك، وبعدها السعر رجع وأنت بره.'
                  : 'الوقف الضيق ما حمك من الكسر هذا.'}
              </span>
            </Piece>
          )}
          {noStop && (
            <Piece color="red" cut={2} lift style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 6, animation: 'bs-in .45s ease both' }}>
              <span style={{ font: 'var(--type-title)' }}>الصفقة الثالثة · بلا وقف</span>
              <span className="num" style={{ font: 'var(--type-lead)' }}>لسوي عند {n2(end)} ريال · {dir(rNone)}</span>
              <span style={{ font: 'var(--type-body)' }}>
                وأسوأ نقطة في المدة كانت {pct(dd)} تحت القمة، وهي نقطة ما عندها تاريخ واضح.
              </span>
            </Piece>
          )}
          {noStop && (
            <>
              <div className="bs-row" style={{ gap: 'var(--space-8)' }}>
                <Money label="مع وقف 8%" value={Math.abs(Math.round(shares * (exitWide - entry)))} />
                <Money label="مع وقف 2%" value={Math.abs(Math.round(shares * (exitTight - entry)))} />
                <Money label="بلا وقف" value={Math.abs(Math.round(shares * (end - entry)))} />
              </div>
              <Verdict tone={plan.won ? 'green' : 'red'} stars={plan.stars} headline={plan.headline} detail={plan.detail} />
              <TalkingOrb
                color={plan.won ? 'green' : 'orange'}
                text={`«${lesson}» نفس الدخول ونفس التحليل، والفرق كله كان في نقطة وحدة حددتها قبل الدخول.`}
              />
            </>
          )}
          <Footer onContinue={() => go('journey')} onRetry={() => { setPick(null); resetFinish(); }} />
        </>
      )}
    </Screen>
  );
}

/* ============================================================
   6 · شوف القصة — read the statement
   ------------------------------------------------------------
   One page of a simulated company, then: which of the three numbers
   decides the next four quarters. Every card flips to show what that
   number actually meant afterwards.
   ============================================================ */

const SHEET = [
  {
    id: 'debt', value: '71%', label: 'نسبة الديون', tone: 'red', stars: 5, won: true,
    flip: 'الربح فوق الخط والدين تحت الأرض. الديون تعني مخاطرة مضاعفة أول ما الاقتصاد يلين.',
    headline: 'الرقم اللي فاتك كان تحته',
  },
  {
    id: 'profit', value: '38%', label: 'نمو صافي الربح', tone: 'green', stars: 3, won: false,
    flip: 'رقم صحيح، بس متبني على قروض. الربح اللي يسنده دين مو ربح، هو مؤجل.',
    headline: 'الرقم صحيح، بس جاء متأخر',
  },
  {
    id: 'volume', value: '12 مليون', label: 'حجم التداول', tone: 'blue', stars: 1, won: false,
    flip: 'السهولة مو قصة. أي سهم له سيولة، وهذا ما يقول لك وين راح.',
    headline: 'السيولة ما كانت القصة',
  },
];

function ReadTrap({ stage, step, market, go, onComplete }) {
  const co = useCompany(market);
  const bars = co.bars.length >= 40 ? co.bars.slice(-60) : synthBars(60, 31);

  const [pick, setPick] = React.useState(null);
  const flipped = useAfter(pick, 900);
  const outcome = useAfter(flipped, 1200);

  const row = pick ? SHEET.find((s) => s.id === pick) : null;
  const lesson = lessonOf(stage?.concept);
  const [finish, resetFinish] = useFinish(onComplete, stage?.id);

  React.useEffect(() => {
    if (outcome && row) finish(row.stars, row.won, { headline: row.headline, lesson });
  }, [outcome, row, finish, lesson]);

  const headline = row?.headline || 'اللي بعد القوائم';

  return (
    <Screen>
      <StageHead step={step} stage={stage} intro="صفحة واحدة عن شركة وهمية، وكل أرقامها للتوضيح. الرقم الذي يغيّر قرارك هو اللي تبحث عنه." />

      <Piece color="cream" cut={3} lift style={{ padding: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ font: 'var(--type-title)' }}>شركة النخيل للصناعات</span>
          <Chip color="faint">شركة وأرقام خيالية</Chip>
        </div>
        <div className="bs-row" style={{ gap: 'var(--space-8)', alignItems: 'flex-start' }}>
          <Figure variant="points" label="القطاع" value="الصناعات" unit="" />
          <Figure variant="points" label="آخر توزيعات" value={n2(2.4)} unit="ريال" />
          <Figure variant="points" label="تغطية التوزيعات" value={pct(34)} unit="" />
        </div>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
          آخر نتائج: نمو المبيعات 12% · صافي ربح 38% · ديون 71% من رأس المال
        </span>
      </Piece>

      {!pick && (
        <>
          <Question text="أي رقم يغيّر قرارك؟" />
          <div className="bs-row" style={{ gap: 'var(--space-6)' }}>
            {SHEET.map((s) => (
              <Flip key={s.id} flipped={false} w={244} h={160}
                front={<span style={{ font: 'var(--type-caption)', opacity: .8 }}>الرقم</span>}
                back={(
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center' }}>
                    <span style={{ font: 'var(--type-caption)', opacity: .85 }}>{s.label}</span>
                    <span style={{ font: 'var(--type-title)' }}>{s.value}</span>
                  </span>
                )} />
            ))}
          </div>
          <div className="bs-row" style={{ gap: 'var(--space-5)' }}>
            {SHEET.map((s, i) => (
              <ChoiceCard key={s.id} label={s.label} sub="رقم من الثلاثة" w={214} h={130} i={i}
                on={pick === s.id} disabled={!!pick} onClick={() => setPick(s.id)}>
                <Piece color={s.tone} cut={i % 4 + 1} style={{ width: 46, height: 46, display: 'grid', placeItems: 'center' }}>
                  <span style={{ font: '700 20px/1 var(--f-sans)' }}>{i + 1}</span>
                </Piece>
              </ChoiceCard>
            ))}
          </div>
        </>
      )}

      {pick && (
        <>
          <div className="bs-row" style={{ gap: 'var(--space-6)' }}>
            {SHEET.map((s) => (
              <Flip key={s.id} flipped={flipped && s.id === pick} w={244} h={160}
                front={(
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center' }}>
                    <span style={{ font: 'var(--type-caption)', opacity: .85 }}>{s.label}</span>
                    <span style={{ font: 'var(--type-title)' }}>{s.value}</span>
                  </span>
                )}
                back={<span style={{ font: 'var(--type-body)', textAlign: 'center' }}>{s.flip}</span>} />
            ))}
          </div>

          {flipped && (
            <Piece color={row?.tone || 'blue'} cut={2} lift style={{ alignSelf: 'flex-start', padding: 'var(--space-6) var(--space-7)', maxWidth: 680 }}>
              <span style={{ font: 'var(--type-body)' }}>{row?.flip}</span>
            </Piece>
          )}

          {outcome && (
            <>
              <ChartCard
                bars={bars}
                title="الأسابيع التي تلت القوائم"
                note={co.bars.length
                  ? 'بيانات تاسي الحقيقية كخلفية، وأرقامها محاكاة تعليمية.'
                  : 'بيانات محاكاة — جاري تحميل بيانات تاسي الحقيقية.'}
                height={220}
              />
              <TwoWays
                left={{ label: 'لو قرأت الديون', value: dir(-28), color: 'green', emphasis: true }}
                right={{ label: 'لو دخلت على نمو الربح', value: dir(-41), color: 'red' }}
              />
              <Verdict
                tone={row?.won ? 'green' : 'red'}
                stars={row?.stars}
                headline={headline}
                detail="الربح المعدل يبيع الحلم، والقوائم تبيع الأصل: الديون تتسعّر من جديد أول ما يلين الاقتصاد."
              />
              <TalkingOrb
                color={row?.won ? 'green' : 'orange'}
                text={`«${lesson}» كلمة واحدة في القوائم تغيّر القرار كله: هل الشركة تقدر تسدد؟`}
              />
            </>
          )}
          <Footer onContinue={() => go('journey')} onRetry={() => { setPick(null); resetFinish(); }} />
        </>
      )}
    </Screen>
  );
}

/* ============================================================
   المرحلة — the dispatcher the router imports
   ============================================================ */

const TRAPS = {
  recommendation: RecommendationTrap,
  sector: BasketTrap,
  chase: FomoTrap,
  panic: PanicTrap,
  stop: StopTrap,
  news: ReadTrap,
};

export function IntermediateStages({ stage, go, player, onComplete, market }) {
  if (!stage) {
    return (
      <Screen>
        <StageHead step={1} stage={{ title: 'فخاخ السوق' }} intro="ما فيه مرحلة محددة." />
        <Button onClick={() => go('journey')}>كمّل</Button>
      </Screen>
    );
  }
  const Trap = TRAPS[stage.trap] || RecommendationTrap;
  return <Trap stage={stage} step={stepOf(stage)} market={market} player={player} go={go} onComplete={onComplete} />;
}

/* ============================================================
   النتيجة — the result screen
   ------------------------------------------------------------
   The award already happened on the stage screen (onComplete fired
   once, when the last reveal landed), so this view only reports it.
   ============================================================ */

export function TrapResult({ stage, won, stars = 1, headline, lesson, go, player, onComplete }) {
  /* player + onComplete travel with the screen for the router; the award was
     already given on the stage screen when the last reveal landed, so this
     view reports it and does not award it twice. */
  void player;
  void onComplete;
  const value = Math.max(1, Math.min(5, Number(stars) || 0));
  const book = bookOf(stage?.concept);
  const shown = useLater(260);
  const text = headline || (won ? 'الدرس ثبت عندك' : 'وقعت في الفخ — وهذا أهم من الفلوس');

  return (
    <div className="bs-center scroll" style={{ gap: 'var(--space-7)', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', alignItems: 'center' }}>
        <GameTag n={stepOf(stage)} name={stage?.title || 'فخ'} />
        {shown && <StarRating value={value} max={5} size={54} animate delay={200} label={`تقييمك ${value} من 5`} />}
        <h1 style={{ font: 'var(--type-headline)', margin: 0, color: won ? 'var(--green)' : 'var(--red)', textAlign: 'center' }}>
          {text}
        </h1>

        <Piece color={won ? 'green' : 'red'} cut={2} lift
          style={{ padding: 'var(--space-7) var(--space-8)', maxWidth: 640, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <span style={{ font: 'var(--type-body)' }}>{lesson || lessonOf(stage?.concept)}</span>
          {book && (
            <span style={{ font: 'var(--type-caption)', opacity: .85 }}>{book.title} · {book.author} · {book.source}</span>
          )}
        </Piece>

        <div className="bs-row" style={{ gap: 'var(--space-5)' }}>
          <Button onClick={() => go('journey')}>كمّل</Button>
          <Button variant="ghost" onClick={() => go(`stage/${stage?.id}`)}>جرّب مرة ثانية</Button>
        </div>
      </div>
    </div>
  );
}
