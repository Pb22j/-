import React from 'react';
import { Piece, Button, Chip } from '../../components/core/index.jsx';
import { TIERS, FEATURES } from '../../store/usePlayer.js';
import { n } from '../../lib/format.js';

/* ============================================================
   الاشتراكات — Plans
   ------------------------------------------------------------
   Three tiers as cut-paper cards. Choosing one only flips a flag in
   the player store so the demo can show what each tier unlocks.
   There is no payment, no account and no card anywhere in this
   product, and the screen says so plainly under the cards.
   ============================================================ */

/* Feature keys come straight from the FEATURES map, so the strip below
   stays in step with whatever the platform gates. */
const FEATURE_LABEL = {
  stages: 'المراحل التعليمية',
  openWorld: 'محاكي السوق المفتوح',
  coach: 'المرشد الذكي',
  analysis: 'التحليل الفني',
  news: 'بوابة الأخبار',
  stageBuilder: 'بناء المراحل الخاصة',
  backtest: 'مقارنة الاستراتيجيات',
  signals: 'تنبيهات الإشارات',
  events: 'محاكي أحداث الشركات',
};

const TIER_ORDER = ['free', 'pro', 'elite'];

const rank = (t) => TIER_ORDER.indexOf(t);

/** A checkbox row inside a tier card. */
function FeatureRow({ text }) {
  return (
    <li style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
      <Piece as="span" color="green" cut={2} aria-hidden="true"
        style={{ flex: 'none', width: 26, height: 26, marginTop: 3, display: 'grid', placeItems: 'center', font: 'var(--type-caption)' }}>
        ✓
      </Piece>
      <span style={{ font: 'var(--type-body)' }}>{text}</span>
    </li>
  );
}

function TierCard({ tier, current, onSelect }) {
  return (
    <Piece as="article" color={tier.color} cut={tier.cut}
      lift={tier.featured || current} tilt={tier.featured ? -2 : 0}
      style={{
        padding: 'var(--space-7)', display: 'flex', flexDirection: 'column',
        gap: 'var(--space-5)', minWidth: 0,
        paddingTop: tier.featured ? 'var(--space-9)' : 'var(--space-7)',
      }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <h2 style={{ font: 'var(--type-title)', margin: 0 }}>{tier.ar}</h2>
        {current
          ? <Chip color="ink" cut={3} tilt={0}>خطتك الآن</Chip>
          : tier.featured
            ? <Chip color="orange" cut={3}>أنسب للتعلّم المنظّم</Chip>
            : null}
      </header>

      <div>
        <div className="num" style={{ font: 'var(--type-headline)', fontVariantNumeric: 'tabular-nums' }}>
          {tier.price > 0 ? `${n(tier.price)} ريال` : 'مجاناً'}
        </div>
        <div style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
          {tier.price > 0 ? 'شهرياً داخل العرض' : 'للأبد داخل العرض'}
        </div>
      </div>

      <p style={{ font: 'var(--type-lead)', margin: 0 }}>{tier.pitch}</p>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {tier.features.map((f) => <FeatureRow key={f} text={f} />)}
      </ul>

      <div style={{ marginTop: 'auto', paddingTop: 'var(--space-5)' }}>
        <Button variant={current ? 'ghost' : 'primary'} disabled={current} onClick={() => onSelect(tier.id)}>
          {current ? 'خطتك الحالية' : 'اختر هذا الاشتراك'}
        </Button>
      </div>
    </Piece>
  );
}

/** Feature × tier matrix, read straight off the FEATURES map. */
function Comparison({ current }) {
  const keys = Object.keys(FEATURES);
  const cell = (k, t) => (rank(t) >= rank(FEATURES[k]));
  const head = { font: 'var(--type-label)', color: 'var(--ink-muted)' };
  const label = { font: 'var(--type-label)', display: 'flex', alignItems: 'center' };

  return (
    <Piece color="cream" cut={3} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <h3 style={{ font: 'var(--type-title)', margin: 0 }}>وش ينفتح في كل اشتراك</h3>
      <div className="scroll" style={{ minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 2.2fr) repeat(3, minmax(52px, 1fr))', gap: 'var(--space-3)', alignItems: 'center', minWidth: 320 }}>
          <span style={head}>الميزة</span>
          {TIER_ORDER.map((t) => (
            <span key={t} style={{ ...head, textAlign: 'center' }}>
              {TIERS.find((x) => x.id === t)?.ar}
              {t === current ? <span style={{ font: 'var(--type-caption)' }}> · خطتك</span> : null}
            </span>
          ))}
          {keys.map((k) => (
            <React.Fragment key={k}>
              <span style={label}>{FEATURE_LABEL[k] || k}</span>
              {TIER_ORDER.map((t) => (
                <span key={t} style={{ display: 'grid', placeItems: 'center' }}>
                  {cell(k, t)
                    ? <Piece as="span" color="green" cut={2} aria-hidden="true" style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', font: 'var(--type-caption)' }}>✓</Piece>
                    : <Piece as="span" color="faint" cut={2} aria-hidden="true" style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>—</Piece>}
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </Piece>
  );
}

export function Plans({ go, player }) {
  const current = player.tier || 'free';
  const [picked, setPicked] = React.useState(null);

  const choose = (id) => {
    player.setTier(id);
    setPicked(id);
  };

  const pickedName = TIERS.find((t) => t.id === picked)?.ar;

  return (
    <div className="bs-screen scroll" style={{ gap: 'var(--space-7)', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Piece color="blue" cut={2} lift style={{ alignSelf: 'flex-start', padding: '8px 18px', color: 'var(--cream)', font: 'var(--type-label)', fontWeight: 700 }}>
          اشتراكات العرض
        </Piece>
        <h1 style={{ font: 'var(--type-headline)', margin: 0 }}>الباقات</h1>
        <p style={{ font: 'var(--type-lead)', margin: 0, color: 'var(--ink-muted)', maxWidth: 620 }}>
          ثلاث باقات عشان تشوف وش ينفتح في كل مستوى. اختيارك ينحفظ عندك على الجهاز فقط.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-6)', alignItems: 'stretch' }}>
        {TIERS.map((t) => (
          <TierCard key={t.id} tier={t} current={t.id === current} onSelect={choose} />
        ))}
      </div>

      {picked && (
        <Piece color="orange" cut={4} lift role="status" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', animation: 'bs-pop .4s cubic-bezier(.3,1.4,.5,1) both' }}>
          <strong style={{ font: 'var(--type-title)' }}>اخترت باقة {pickedName}</strong>
          <p style={{ font: 'var(--type-body)', margin: 0 }}>
            هذا اشتراك تجريبي داخل العرض فقط. ما فيه دفع، ولا بطاقة ائتمان، ولا فوترة، ولا عملية شراء من أي نوع.
          </p>
          <p style={{ font: 'var(--type-caption)', margin: 0, color: 'var(--ink-muted)' }}>
            كل اللي انحفظ هو اسم الباقة على جهازك، وبس. تقدر ترجع للمجاني متى ما تبي.
          </p>
        </Piece>
      )}

      <Comparison current={current} />

      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="quiet" onClick={() => go('journey')}>ارجع للرحلة</Button>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
          تقدر ترجع للمجاني متى ما تبي.
        </span>
      </div>

    </div>
  );
}
