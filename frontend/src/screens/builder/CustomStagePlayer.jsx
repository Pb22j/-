import React from 'react';
import { Button, Piece, Chip } from '../../components/core/index.jsx';
import { StarRating } from '../../components/progress/index.jsx';
import { ChoiceCard, TalkingOrb, GameTag } from '../../components/games/index.jsx';
import { OutcomeCard } from '../../components/finance/index.jsx';
import { CandleChart } from '../../components/charts/CandleChart.jsx';
import { n } from '../../lib/format.js';
import { BY_ID } from '../../content/knowledge.js';
import { useMarket } from '../../store/useMarket.js';

/* ============================================================
   لاعب المرحلة المخصّصة — Custom Stage Player
   ------------------------------------------------------------
   Renders a stage produced by the stage-builder agent. The shape now
   carries a `chart` field pointing at a real ticker, a `feed` (fake post),
   and `beats` for a day-by-day reveal that advances the market clock
   together with the chart. The player also persists played stages to
   the market store so they re-appear on the Journey.
   ============================================================ */

const BASE = 100000;

export function CustomStage({ stage, go, player, onComplete }) {
  const market = useMarket();
  const [choice, setChoice] = React.useState(null);
  const [beatIdx, setBeatIdx] = React.useState(-1);
  const [stars, setStars] = React.useState(0);
  const [saved, setSaved] = React.useState(false);
  const reportedRef = React.useRef(false);

  React.useEffect(() => {
    setChoice(null);
    setBeatIdx(-1);
    setStars(0);
    setSaved(false);
    reportedRef.current = false;
  }, [stage?.id]);

  React.useEffect(() => {
    /* if the stage plays at a known day, move the clock there so the
       chart lines up with the beats below — one-shot, no rewind */
    if (!market.ready) market.load();
    if (!stage?.chart?.companyId) return;
    if (stage.chart.aroundDay == null) return;
    const id = stage.chart.companyId;
    if (!market.series[id]) return;
    market.select(id);
    const max = market.series[id]?.length || 0;
    /* cap at aroundDay - 1 so the learner still has to press forward
       to reach the decision point — never reveal past that */
    market.rewindTo(id, Math.max(0, Math.min(stage.chart.aroundDay - 1, max - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage?.id, market.ready]);

  if (!stage || !stage.options?.length) {
    return (
      <div className="bs-center">
        <Piece color="cream" cut={2} lift style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <span style={{ font: 'var(--type-lead)' }}>ما لقينا مرحلة بهذا الشكل. جرّب تبني وحدة ثانية.</span>
        </Piece>
        <Button onClick={() => go('builder')}>ارجع لمصمّم المراحل</Button>
      </div>
    );
  }

  const ranked = [...stage.options].sort((a, b) => (b.outcome?.valuePct ?? 0) - (a.outcome?.valuePct ?? 0));
  const bestKey = ranked[0]?.key;
  const picked = stage.options.find((o) => o.key === choice);

  const showChart = !!stage.chart && market.ready;

  /* sequence reveal: clicking play advances the market clock and
     reveals each beat in turn — autoPlay walks through them all once the
     learner commits, then they can step through manually */
  const [autoPlay, setAutoPlay] = React.useState(true);
  React.useEffect(() => {
    if (!autoPlay || choice == null) return;
    if (beatIdx >= (stage.beats?.length || 0) - 1) return;
    const t = setTimeout(() => {
      const id = stage.chart?.companyId;
      if (id) market.advanceDay(id);
      setBeatIdx((i) => i + 1);
    }, 1200);
    return () => clearTimeout(t);
  }, [autoPlay, choice, beatIdx, stage.beats?.length, market, stage.chart?.companyId]);

  const stepNext = () => {
    if (beatIdx >= (stage.beats?.length || 0)) return;
    setAutoPlay(false);
    const id = stage.chart?.companyId;
    if (id) market.advanceDay(id);
    setBeatIdx((i) => i + 1);
  };

  const commit = (o) => {
    setChoice(o.key);
    setBeatIdx(-1);
    const isBest = o.key === bestKey;
    const earnedStars = isBest ? 5 : ranked.findIndex((r) => r.key === o.key) === 1 ? 3 : 2;
    setStars(earnedStars);

    /* persist to the journey list so the user sees their own stages */
    if (!saved) {
      market.addCustomStage(stage);
      setSaved(true);
    }
    if (!reportedRef.current) {
      reportedRef.current = true;
      player.awardCustom(stage.id, earnedStars);
      onComplete?.(stage.id, earnedStars, isBest, {
        stage, headline: isBest ? 'قرار سليم' : 'قرار يحتاج مراجعة',
        lesson: o.lesson || (isBest ? stage.resolution?.win : stage.resolution?.lose),
      });
    }
  };

  const lesson = picked?.lesson || (picked?.key === bestKey ? stage.resolution?.win : stage.resolution?.lose) || '';
  const value = picked ? Math.round((BASE * (picked.outcome?.valuePct ?? 100)) / 100) : BASE;
  const won = picked?.key === bestKey;
  const entry = BY_ID[stage.concept];

  return (
    <div className="bs-screen scroll" style={{ alignItems: 'center', gap: 'var(--space-6)', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <GameTag n="مخصّصة" name={stage.title} />

      {stage.book && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Chip cut={2} color="faint">{stage.book}</Chip>
          {stage.source && <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{stage.source}</span>}
          {saved && <Chip color="green" cut={3}>انحفظت في رحلتك</Chip>}
        </div>
      )}

      <h1 style={{ font: 'var(--type-headline)', margin: 0, textAlign: 'center' }}>
        {stage.opening || stage.brief || stage.prompt}
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: showChart ? 'minmax(280px, 1fr) minmax(420px, 1.6fr)' : '1fr', gap: 18, width: '100%' }}>
        {/* LEFT: scenario + decisions + beats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {stage.feed && <FakePost feed={stage.feed} />}

          {stage.beats && choice == null && stage.beats.length > 0 && (
            <Piece color="cream" cut={2} style={{ padding: '14px 18px' }}>
              <span style={{ font: 'var(--type-label)', color: 'var(--ink-muted)' }}>وش تتوقع يصير بعد المنشور؟</span>
            </Piece>
          )}

          {stage.beats?.length > 0 && beatIdx >= 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stage.beats.slice(0, beatIdx + 1).map((b, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px',
                  boxShadow: 'inset 0 0 0 2px var(--line)', animation: 'bs-in .35s ease both',
                }}>
                  <span className="num" style={{ font: '700 14px/1 var(--f-sans)', color: 'var(--ink-muted)', minWidth: 60 }}>يوم {b.day}</span>
                  <strong className="num" style={{ font: '900 18px/1 var(--f-display)', color: b.delta >= 0 ? 'var(--green)' : 'var(--red)', minWidth: 60 }}>
                    {b.delta >= 0 ? '+' : ''}{b.delta.toFixed(1)}%
                  </strong>
                  <span style={{ font: '500 14px/1.5 var(--f-text)' }}>{b.note}</span>
                </div>
              ))}
              {beatIdx < (stage.beats.length - 1) && choice != null && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Button onClick={() => setAutoPlay((a) => !a)}
                    style={{ minHeight: 40, padding: '0 16px', font: '700 13px/1 var(--f-sans)', background: autoPlay ? 'var(--orange)' : 'var(--cream)', color: 'var(--ink)', boxShadow: 'inset 0 0 0 2px var(--line-strong)' }}>
                    {autoPlay ? 'إيقاف التشغيل' : 'تشغيل تلقائي'}
                  </Button>
                  <Button onClick={stepNext}
                    style={{ minHeight: 40, padding: '0 16px', font: '700 13px/1 var(--f-sans)', background: 'var(--blue)', color: 'var(--cream)' }}>
                    اليوم التالي
                  </Button>
                </div>
              )}
            </div>
          )}

          {!choice && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'var(--space-3)' }}>
              {stage.options.map((o, i) => (
                <ChoiceCard key={o.key} i={i} label={o.label} sub={o.sub}
                  cut={o.cut ?? ((i % 4) + 1)} tilt={o.tilt ?? 0} w={260} h={140}
                  onClick={() => commit(o)}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: real chart when the stage names one */}
        {showChart && (
          <Piece color="cream" cut={2} style={{ padding: '12px 14px', minWidth: 0, minHeight: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ font: '700 16px/1 var(--f-sans)' }}>{stage.chart.company}</span>
              <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>بيانات تاسي الفعلية</span>
            </div>
            <RealChart companyId={stage.chart.companyId} window={stage.chart.window || 30} />
          </Piece>
        )}
      </div>

      {picked && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)', animation: 'bs-in .5s ease both' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ font: 'var(--type-label)', color: 'var(--ink-muted)' }}>قيمة محفظتك</span>
              <span className="num" style={{ font: '900 64px/1 var(--f-display)', color: won ? 'var(--green)' : 'var(--red)' }}>{n(value)}</span>
              <span style={{ font: '700 20px/1 var(--f-sans)', color: won ? 'var(--green)' : 'var(--red)' }}>
                {picked.outcome?.valuePct >= 100 ? '—' : (picked.outcome?.valuePct > 100 ? '+' : '') + (picked.outcome?.valuePct - 100).toFixed(1) + '%'}
              </span>
            </div>
            <OutcomeCard label="رأس المال" value={`${n(BASE)} ريال`} color="blue" cut={2} />
          </div>

          <StarRating value={stars} max={5} size={44} animate label={`تقييمك ${stars} من 5`} />
          <TalkingOrb text={lesson} color={won ? 'green' : 'red'} />

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button onClick={() => go('journey')}>كمّل رحلتك</Button>
            <Button variant="ghost" onClick={() => { setChoice(null); setBeatIdx(-1); reportedRef.current = false; }}>
              جرّب مرة ثانية
            </Button>
            <Button variant="ghost" onClick={() => go('builder')}>ابنِ مرحلة ثانية</Button>
          </div>
        </div>
      )}

    </div>
  );
}

function FakePost({ feed }) {
  return (
    <Piece color="cream" cut={2} lift style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, flex: 'none', background: 'var(--blue)', color: 'var(--cream)', display: 'grid', placeItems: 'center', font: '700 22px/1 var(--f-display)' }}>ب</span>
        <div>
          <strong style={{ font: '700 15px/1.4 var(--f-sans)', display: 'block' }}>{feed.handle}</strong>
          <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>منشور وهمي داخل المحاكاة — ما له علاقة بسهم حقيقي</span>
        </div>
      </div>
      <p style={{ margin: 0, font: '500 18px/1.7 var(--f-text)' }}>{feed.text}</p>
      {feed.stats && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', font: '700 13px/1 var(--f-sans)', color: 'var(--ink-muted)' }}>
          <span>إعجاب {feed.stats.likes}</span>
          <span>إعادة نشر {feed.stats.reposts}</span>
          <span>تعليق {feed.stats.replies}</span>
        </div>
      )}
    </Piece>
  );
}

function RealChart({ companyId, window: win }) {
  const market = useMarket();
  const id = companyId;
  const bars = id && market.series[id] ? market.barsUpTo(id) : [];
  if (!id) return <div style={{ minHeight: 280, display: 'grid', placeItems: 'center', font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>جاري التحميل</div>;
  return (
    <CandleChart
      bars={bars}
      height={320}
      window={win}
      overlays={{ ma20: { period: 20, color: 'var(--blue)' } }}
    />
  );
}

export default CustomStage;