import React from 'react';
import { Piece, Chip } from '../../components/core/index.jsx';
import { CandleChart } from '../../components/charts/CandleChart.jsx';
import * as news from '../../agents/newsAgent.js';
import { useMarket } from '../../store/useMarket.js';
import { dir, n, n2 } from '../../lib/format.js';

/* ============================================================
   بوابة الأخبار — News Portal
   ------------------------------------------------------------
   Nothing here is invented on the fly. The news agent scans the real
   TASI OHLCV that ships with the project for genuine single-day
   moves and wraps each one in a corporate story, so every headline
   points at a day that actually happened between 2010 and 2012.
   That makes the feed a history, never a forecast.
   ============================================================ */

const IMPACT_CHIP = { bullish: 'green', bearish: 'red', neutral: 'faint' };
const IMPACT_AR = { bullish: 'صاعدة', bearish: 'هابطة', neutral: 'عرضية' };

const IMPACT_FILTERS = [
  { id: '', ar: 'الكل' },
  { id: 'bullish', ar: 'صاعدة' },
  { id: 'bearish', ar: 'هابطة' },
];

/** Per-company net move across the whole feed, as a green/red bar. */
function SentimentStrip({ rows }) {
  const peak = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  const tone = (v) => (v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--ink-muted)');

  return (
    <Piece color="cream" cut={2} style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <strong style={{ font: 'var(--type-label)', fontWeight: 700 }}>مزاج الشركات في هذه الجولة</strong>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>صافي الحركة التراكمية لكل شركة</span>
      </div>
      <div className="scroll" style={{ minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--space-4)' }}>
        {rows.map((r) => {
          const half = (Math.abs(r.net) / peak) * 48;
          return (
            <div key={r.companyId} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ font: 'var(--type-label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.company}</span>
                <span className="num" style={{ font: 'var(--type-label)', color: tone(r.net), whiteSpace: 'nowrap' }}>{dir(r.net, 1)}</span>
              </div>
              <div style={{ position: 'relative', height: 10, background: 'var(--ink-faint)' }}>
                <span aria-hidden="true" style={{ position: 'absolute', top: -3, bottom: -3, width: 2, background: 'var(--line-strong)' }} />
                <span aria-hidden="true" style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: r.net >= 0 ? '50%' : undefined,
                  right: r.net >= 0 ? undefined : '50%',
                  width: `${half}%`, background: tone(r.net),
                }} />
              </div>
              <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
                {n(r.up)} صاعدة · {n(r.down)} هابطة
              </span>
            </div>
          );
        })}
      </div>
    </Piece>
  );
}

function StoryCard({ s, lead = false }) {
  const market = useMarket();
  const tone = s.move > 0 ? 'var(--green)' : s.move < 0 ? 'var(--red)' : 'var(--ink-muted)';
  const [open, setOpen] = React.useState(false);
  const bars = s.companyId ? market.series[s.companyId] : [];
  /* find the index of the story date in the data, so the chart marker
     lands on the exact day this corporate event was priced in */
  const markerIdx = React.useMemo(() => {
    if (!open || !s.date) return false;
    const list = market.series[s.companyId] || [];
    for (let i = 0; i < list.length; i++) if (list[i].time === s.date) return i;
    return false;
  }, [open, s.date, s.companyId, market.series]);
  return (
    <Piece as="article" color={lead ? 'orange' : 'cream'} cut={lead ? 4 : 2} lift={lead}
      style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0, animation: 'bs-in .35s var(--ease-enter) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <Chip color={IMPACT_CHIP[s.impact] || 'faint'} cut={3}>{s.tag}</Chip>
        <Chip color="faint" cut={2}>{IMPACT_AR[s.impact]}</Chip>
        <span className="num" style={{ marginInlineStart: 'auto', font: 'var(--type-title)', color: tone, direction: 'ltr' }}>
          {dir(s.move, 2)}
        </span>
      </div>
      <h3 style={{ font: 'var(--type-title)', margin: 0 }}>{s.headline}</h3>
      <p style={{ font: 'var(--type-body)', margin: 0 }}>{s.body}</p>
      <footer style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-5)', flexWrap: 'wrap', font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
        <span style={{ fontWeight: 700 }}>{s.company}</span>
        {s.sector ? <span>{s.sector}</span> : null}
        <span className="num" dir="ltr">{s.date}</span>
        <span className="num">أغلق على {n2(s.price)} ريال</span>
        {bars.length > 0 && (
          <button type="button" onClick={() => setOpen((o) => !o)}
            style={{
              background: 'transparent', border: '2px solid var(--line-strong)',
              padding: '4px 12px', cursor: 'pointer',
              font: '700 13px/1 var(--f-sans)', color: 'var(--ink)',
            }}>
            {open ? 'إخفاء الشارت' : 'مشاهدة الشارت'}
          </button>
        )}
      </footer>
      {open && bars.length > 0 && (
        <div style={{ marginTop: 8, animation: 'bs-in .35s ease both' }}>
          <CandleChart
            bars={bars}
            height={220}
            window={60}
            markers={markerIdx !== false ? [{ index: markerIdx, side: s.move < 0 ? 'SELL' : 'BUY' }] : []}
          />
          <div style={{ marginTop: 6, font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
            البيانات التاريخية الكاملة من {bars[0]?.time} — اليوم الذي صوّرته القصة عليه.
          </div>
        </div>
      )}
    </Piece>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{label}</span>
      {children}
    </label>
  );
}

const INPUT = {
  background: 'transparent', border: '2px solid var(--line-strong)', borderRadius: 0,
  padding: '12px 16px', font: 'var(--type-body)', width: '100%', minWidth: 0,
};

export function NewsPortal({ go, player, market }) {
  const [impact, setImpact] = React.useState('');
  const [sector, setSector] = React.useState('');
  const [query, setQuery] = React.useState('');

  const stories = React.useMemo(
    () => news.generate(market.series, market.meta, { limit: 24, minMove: 3.2 }),
    [market.series, market.meta],
  );

  const sectors = React.useMemo(() => {
    const set = new Set();
    Object.values(market.meta || {}).forEach((m) => { if (m?.sector) set.add(m.sector); });
    return Array.from(set);
  }, [market.meta]);

  const span = React.useMemo(() => {
    let lo = null, hi = null;
    Object.values(market.series || {}).forEach((bars) => bars.forEach((b) => {
      if (!lo || b.time < lo) lo = b.time;
      if (!hi || b.time > hi) hi = b.time;
    }));
    return [lo, hi];
  }, [market.series]);

  if (!market.ready) {
    return (
      <div className="bs-center">
        <div className="bs-col" style={{ gap: 'var(--space-5)' }}>
          <Piece color="blue" cut={3} lift style={{ padding: 'var(--space-8) var(--space-10)', font: 'var(--type-headline)', color: 'var(--cream)' }}>
            نجهّز الأخبار من بيانات السوق المحفوظة عندنا
          </Piece>
          <p style={{ font: 'var(--type-lead)', margin: 0, color: 'var(--ink-muted)' }}>
            لحظة وحدة، نقرا الأسعار التاريخية ونركّب القصص عليها.
          </p>
        </div>
      </div>
    );
  }

  const shown = news.filter(stories, { impact, sector, query });
  const mood = news.sentiment(stories);
  const focus = news.headlineFor(stories, market.selected);
  const focusIsMine = !!focus && focus.companyId === market.selected;
  const watchName = market.meta?.[market.selected]?.ar || market.selected;

  return (
    <div className="bs-screen" style={{ gap: 'var(--space-5)' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <Chip color="ink" cut={3} tilt={0}>بوابة الأخبار</Chip>
          {span[0] ? <span className="num" style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)', direction: 'ltr' }}>{span[0]} — {span[1]}</span> : null}
        </div>
        <h1 style={{ font: 'var(--type-headline)', margin: 0 }}>وش صار في السوق يومها</h1>
        <p style={{ font: 'var(--type-caption)', margin: 0, color: 'var(--ink-muted)', maxWidth: 760 }}>
          كل خبر هنا مبني على حركة سعر حقيقية في بيانات تاسي من 2010 إلى 2012 المحفوظة في هذا المشروع، مو بيانات سوق حيّة.
          كل قصة تصف يوماً صار فعلاً، ومو توقع ولا توصية.
        </p>
      </header>

      {focus && (
        <Piece color="blue" cut={3} lift style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <span style={{ font: 'var(--type-label)', color: 'var(--cream)' }}>
            {focusIsMine ? `أهم خبر عن ${watchName} اللي تختاره` : 'أحدث خبر في البوابة'}
          </span>
          <strong style={{ font: 'var(--type-title)', color: 'var(--cream)' }}>{focus.headline}</strong>
          <span className="num" style={{ font: 'var(--type-caption)', color: 'var(--cream)' }}>
            {focus.company} · {focus.date} · {dir(focus.move, 2)} · أغلق على {n2(focus.price)} ريال
          </span>
        </Piece>
      )}

      {mood.length > 0 && <SentimentStrip rows={mood} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-5)', alignItems: 'end' }}>
        <Field label="اتجاه الخبر">
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {IMPACT_FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setImpact(f.id)} aria-pressed={impact === f.id ? 'true' : 'false'}
                style={{
                  border: 0, background: 'none', padding: 0, cursor: 'pointer',
                  font: 'var(--type-label)', fontWeight: impact === f.id ? 700 : 500,
                  color: impact === f.id ? 'var(--blue)' : 'var(--ink-muted)',
                  textDecoration: impact === f.id ? 'underline' : 'none', textUnderlineOffset: 6, textDecorationThickness: 2,
                }}>
                {f.ar}
              </button>
            ))}
          </div>
        </Field>

        <Field label="القطاع">
          <select value={sector} onChange={(e) => setSector(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
            <option value="">كل القطاعات</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="دوّر في الأخبار">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="اسم شركة أو كلمة من الخبر" style={INPUT} />
        </Field>
      </div>

      <div className="scroll grow" style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {shown.length === 0 ? (
          <Piece color="faint" cut={3} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <p style={{ font: 'var(--type-body)', margin: 0 }}>ما فيه خبر يطابق اختيارك. وسّع البحث أو رجّع الفلتر للكل.</p>
          </Piece>
        ) : (
          shown.map((s) => <StoryCard key={s.id} s={s} />)
        )}
        <p style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)', margin: 0 }}>
          عرض {n(shown.length)} خبر من أصل {n(stories.length)} في هذه الجولة.
        </p>
      </div>

    </div>
  );
}
