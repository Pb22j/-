import React from 'react';
import { Button, Piece, Chip } from '../../components/core/index.jsx';
import { CandleChart } from '../../components/charts/CandleChart.jsx';
import { TalkingOrb, EyeOrb, useTween } from '../../components/games/index.jsx';
import { rsi, macd, atr as atrOf, levels, volatility, sma } from '../../lib/indicators.js';
import { n, n2, sar, sar2, dir, pct } from '../../lib/format.js';
import { judgeTrade, brief, speak } from '../../agents/coachAgent.js';
import { CoachDock } from '../CoachDock.jsx';
import { usePlayer } from '../../store/usePlayer.js';
import { useUI } from '../../store/useUI.js';

/* ============================================================
   العالم المفتوح — Open World (خبير)
   ------------------------------------------------------------
   Dense broker-terminal layout, kept in the cream/paper palette.
   Same TASI 2010-2012 candles, same clock, same coach. What changes
   is density: the order desk, the momentum gauge, the session
   countdown, and the persistent News / Agent / Library toolbar.
   ============================================================ */

const WIN = 90;
const TECH_BARS = 60;
const WATCH_BARS = 30;

/* Hand-rolled range slider so radius stays 0 and tokens are honoured. */
const SLIDER_CSS = `
.ow-range{appearance:none;-webkit-appearance:none;width:100%;height:var(--hit-min);background:transparent;cursor:pointer}
.ow-range:focus{outline:none}
.ow-range::-webkit-slider-runnable-track{height:6px;background:var(--line);border:0;border-radius:0}
.ow-range::-moz-range-track{height:6px;background:var(--line);border:0;border-radius:0}
.ow-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:30px;margin-top:-12px;background:var(--blue);border:0;border-radius:0}
.ow-range::-moz-range-thumb{width:20px;height:30px;background:var(--blue);border:0;border-radius:0}
.ow-range:disabled::-webkit-slider-thumb{background:var(--line-strong)}
.ow-range:disabled::-moz-range-thumb{background:var(--line-strong)}
`;

const fmtVol = (v) => v >= 1e6 ? `${(v / 1e6).toFixed(2)} م` : v >= 1e3 ? `${(v / 1e3).toFixed(1)} ك` : `${Math.round(v)}`;
const oneLine = (s) => s.replace(/\s+/g, ' ').trim();

/* ————————————————————————————————————————————————————————————————
   PANELS
   ———————————————————————————————————————————————————————————————— */

function TopTape({ meta, selected, order, series, cursor, onChange }) {
  const bars = series[selected] || [];
  const i = cursor[selected] ?? bars.length - 1;
  const last = bars[i];
  const prev = bars[i - 1];
  if (!last) return null;
  const up = last.close >= (prev?.close ?? last.close);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      padding: '10px 18px',
      borderBottom: '2px solid var(--line)',
      background: 'var(--cream)',
    }}>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        style={{
          font: '700 18px/1 var(--f-sans)', padding: '10px 14px',
          background: 'var(--cream)', color: 'var(--ink)',
          border: '2px solid var(--line-strong)',
          outline: 'none', borderRadius: 0, cursor: 'pointer',
        }}
      >
        {order.map((id) => (
          <option key={id} value={id}>{meta[id]?.ar || id}</option>
        ))}
      </select>
      <span style={{ font: '700 14px/1 var(--f-sans)', color: 'var(--ink-muted)' }}>{meta[selected]?.sector}</span>
      <span style={{ font: '700 14px/1 var(--f-sans)', color: 'var(--ink-muted)' }}>رمز {meta[selected]?.symbol}</span>

      <div style={{ flex: 1, minWidth: 200 }} />

      <span style={{ font: '700 14px/1 var(--f-sans)', color: 'var(--ink-muted)' }}>إغلاق</span>
      <strong className="num" style={{ font: '900 28px/1 var(--f-display)', color: up ? 'var(--green)' : 'var(--red)', direction: 'ltr' }}>{n2(last.close)}</strong>
      <span style={{ font: '700 14px/1 var(--f-sans)', color: up ? 'var(--green)' : 'var(--red)' }}>{dir(((last.close - prev?.close) / prev?.close) * 100)}</span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingInlineStart: 14, borderInlineStart: '2px solid var(--line)' }}>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>افتتاح / أعلى / أدنى</span>
        <span className="num" style={{ font: '700 14px/1 var(--f-sans)' }}>{n2(last.open)} · {n2(last.high)} · {n2(last.low)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingInlineStart: 14, borderInlineStart: '2px solid var(--line)' }}>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>حجم التداول</span>
        <span className="num" style={{ font: '700 14px/1 var(--f-sans)' }}>{fmtVol(last.volume)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingInlineStart: 14, borderInlineStart: '2px solid var(--line)' }}>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>الجلسة</span>
        <span className="num" style={{ font: '700 14px/1 var(--f-sans)' }}>{last.time.slice(0, 10)}</span>
      </div>
    </div>
  );
}

function OrderDesk({ price, meta, positions, positions2, portfolio, market, onCommit, onReset }) {
  const [side, setSide] = React.useState('BUY');
  const [shares, setShares] = React.useState(0);
  const [confirm, setConfirm] = React.useState(null);
  const [error, setError] = React.useState(null);
  const notional = shares * price;
  const held = positions2?.find((p) => p.id === meta?.id)?.shares || 0;

  const submit = () => {
    const r = onCommit(side, Math.max(1, Math.floor(shares)));
    setConfirm(null);
    if (!r.ok) { setError(r.error); setTimeout(() => setError(null), 4500); }
    else setShares(0);
  };

  return (
    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14, borderBottom: '2px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <strong style={{ font: '700 16px/1 var(--f-sans)' }}>لوحة الأوامر</strong>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{meta?.ar}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ font: '700 14px/1 var(--f-sans)', color: 'var(--ink-muted)' }}>السعر الحالي</span>
        <strong className="num" style={{ font: '900 38px/1 var(--f-display)', direction: 'ltr' }}>{n2(price)}</strong>
        <span style={{ font: 'var(--type-label)' }}>ريال</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 12px', boxShadow: 'inset 0 0 0 2px var(--line-strong)' }}>
        <span style={{ font: 'var(--type-label)' }}>القيمة المتوقعة</span>
        <strong className="num" style={{ font: '900 22px/1 var(--f-display)', direction: 'ltr' }}>{n2(notional)}</strong>
        <span style={{ font: 'var(--type-caption)' }}>ريال · {Math.floor(shares)} سهم</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ font: '700 14px/1 var(--f-sans)' }}>كمية</span>
        <button type="button" onClick={() => setShares((s) => Math.max(0, s - 50))}
          style={qtyBtn}>−٥٠</button>
        <input type="number" inputMode="numeric" min="0" value={shares} onChange={(e) => setShares(Math.max(0, +e.target.value || 0))}
          style={qtyInput} />
        <button type="button" onClick={() => setShares((s) => s + 50)}
          style={qtyBtn}>+٥٠</button>
        <button type="button" onClick={() => setShares(Math.floor((portfolio.cash * 0.95) / Math.max(price, 0.01)))}
          style={qtyBtn}>الكل</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button type="button" onClick={() => { setSide('BUY'); setConfirm(null); }}
          style={{ ...sideBtn, background: side === 'BUY' ? 'var(--green)' : 'transparent', color: side === 'BUY' ? 'var(--cream)' : 'var(--ink)' }}>
          شراء
        </button>
        <button type="button" onClick={() => { setSide('SELL'); setConfirm(null); }}
          style={{ ...sideBtn, background: side === 'SELL' ? 'var(--red)' : 'transparent', color: side === 'SELL' ? 'var(--cream)' : 'var(--ink)' }}>
          بيع
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
        <span>تملك: <strong style={{ color: 'var(--ink)' }}>{held}</strong> سهم</span>
        <span>السيولة المتاحة: <strong style={{ color: 'var(--ink)' }} className="num">{n(portfolio.cash)}</strong> ريال</span>
      </div>

      <button type="button"
        disabled={shares <= 0}
        onClick={() => (confirm ? submit() : setConfirm({ side, shares }))}
        style={{
          minHeight: 52, padding: '0 18px', font: '700 18px/1 var(--f-sans)',
          border: 0, borderRadius: 0, cursor: shares <= 0 ? 'not-allowed' : 'pointer',
          background: confirm ? 'var(--ink)' : 'var(--blue)', color: 'var(--cream)',
          opacity: shares <= 0 ? 0.4 : 1,
        }}>
        {confirm ? `تأكيد ${confirm.side === 'BUY' ? 'الشراء' : 'البيع'} ${confirm.shares} سهم بسعر ${n2(price)}` : 'راجع الأمر'}
      </button>

      {error && (
        <div style={{ padding: '10px 14px', font: '700 15px/1.5 var(--f-sans)', color: 'var(--red)', boxShadow: 'inset 0 0 0 2px var(--red)' }}>
          {error}
        </div>
      )}
      {confirm && !error && (
        <button type="button" onClick={() => setConfirm(null)}
          style={{ background: 'transparent', border: 0, color: 'var(--ink-muted)', cursor: 'pointer', font: '700 15px/1 var(--f-sans)', textDecoration: 'underline' }}>
          إلغاء
        </button>
      )}
    </div>
  );
}

const qtyBtn = { background: 'transparent', border: '2px solid var(--line-strong)', padding: '8px 12px', font: '700 14px/1 var(--f-sans)', color: 'var(--ink)', cursor: 'pointer', minHeight: 40 };
const qtyInput = { all: 'unset', flex: 1, minWidth: 0, padding: '8px 12px', boxShadow: 'inset 0 0 0 2px var(--line-strong)', font: '700 18px/1 var(--f-display)', textAlign: 'center', fontVariantNumeric: 'tabular-nums' };
const sideBtn = { minHeight: 48, font: '700 18px/1 var(--f-sans)', border: '2px solid currentColor', padding: 0, cursor: 'pointer', borderRadius: 0 };

function AccountPanel({ portfolio, total }) {
  const acc = useTween(total);
  return (
    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '2px solid var(--line)' }}>
      <strong style={{ font: '700 16px/1 var(--f-sans)' }}>ملخص الحساب</strong>
      <Row label="قيمة المحفظة" value={`${n(acc)} ريال`} bold />
      <Row label="السيولة النقدية" value={`${n(portfolio.cash)} ريال`} />
      <Row label="رأس المال" value="250,000 ريال" tone="muted" />
      <Row label="ربح / خسارة" value={`${portfolio.pnl >= 0 ? '+' : ''}${n(portfolio.pnl)} ريال · ${dir(portfolio.pnlPct)}`} tone={portfolio.pnl >= 0 ? 'pos' : 'neg'} />
      <Row label="عدد الأسهم" value={`${portfolio.count} رمز`} />
      <Row label="أكبر مركز" value={portfolio.count ? `${portfolio.topWeight.toFixed(0)}% من القيمة` : '—'} tone={portfolio.topWeight > 35 ? 'neg' : 'ok'} />
      {portfolio.pendingCount > 0 && (
        <Row label="تسوية معلقة (T+2)" value={`${portfolio.pendingCount} أمر · ${n(portfolio.pendingCommission)} ريال`} tone="muted" />
      )}
      {portfolio.commissionPaid > 0 && (
        <Row label="عمولات مدفوعة" value={`${n(portfolio.commissionPaid)} ريال (15.5 نقطة أساس للجانب)`} tone="muted" />
      )}
    </div>
  );
}
function Row({ label, value, bold, tone = 'ink' }) {
  const c = tone === 'pos' ? 'var(--green)' : tone === 'neg' ? 'var(--red)' : tone === 'muted' ? 'var(--ink-muted)' : 'var(--ink)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', font: '700 14px/1.4 var(--f-sans)' }}>
      <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <span className="num" style={{ fontWeight: bold ? 900 : 700, color: c }}>{value}</span>
    </div>
  );
}

/* Radial momentum gauge, drawn by hand so radius stays 0 */
function MomentumGauge({ value = 0, label = 'الزخم' }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 50, c = 2 * Math.PI * r;
  const dash = (c * v) / 100;
  const colour = v < 30 ? 'var(--red)' : v < 70 ? 'var(--orange)' : 'var(--green)';
  return (
    <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '2px solid var(--line)' }}>
      <svg viewBox="0 0 120 120" width="84" height="84" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="8" transform="rotate(-90 60 60)" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={colour} strokeWidth="8" strokeDasharray={`${dash} ${c}`} transform="rotate(-90 60 60)" />
        <text x="60" y="62" textAnchor="middle" fontWeight="900" fontSize="28" fill="var(--ink)" fontFamily="var(--f-display)">{Math.round(v)}</text>
        <text x="60" y="84" textAnchor="middle" fontWeight="500" fontSize="11" fill="var(--ink-muted)" fontFamily="var(--f-sans)">من ١٠٠</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong style={{ font: '700 16px/1 var(--f-sans)' }}>{label}</strong>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
          {v < 30 ? 'ترند هابط · قلّل التعرض' : v < 70 ? 'ترند متذبذب · راقب الحجم' : 'ترند صاعد · التزم وقفك'}
        </span>
      </div>
    </div>
  );
}

function PositionsTable({ positions, onExit }) {
  if (!positions.length) {
    return (
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong style={{ font: '700 16px/1 var(--f-sans)' }}>الموجودات</strong>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>ما تملك أي سهم بعد.</span>
      </div>
    );
  }
  return (
    <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <strong style={{ font: '700 16px/1 var(--f-sans)' }}>الموجودات</strong>
      <table style={{ width: '100%', borderCollapse: 'collapse', font: '700 13px/1.4 var(--f-sans)' }}>
        <thead>
          <tr style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>
            <th style={th}>الرمز</th><th style={th}>الكمية</th><th style={th}>التكلفة</th>
            <th style={th}>السعر</th><th style={th}>القيمة</th><th style={th}>الربح/الخسارة</th><th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={td}>{p.id.replace('_', ' ')}</td>
              <td className="num" style={td}>{p.shares}</td>
              <td className="num" style={td}>{n2(p.avgCost)}</td>
              <td className="num" style={td}>{n2(p.price)}</td>
              <td className="num" style={td}>{n(p.value)}</td>
              <td className="num" style={{ ...td, color: p.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{p.pnl >= 0 ? '+' : ''}{n(p.pnl)} · {dir(p.pnlPct)}</td>
              <td style={td}>
                <button type="button" onClick={() => onExit(p.id)}
                  style={{ background: 'transparent', border: '2px solid var(--line-strong)', padding: '4px 10px', cursor: 'pointer', font: '700 13px/1 var(--f-sans)' }}>
                  خروج
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const th = { padding: '6px 8px', textAlign: 'right', fontWeight: 500 };
const td = { padding: '6px 8px', textAlign: 'right' };

function ClockBar({ cursor, len, idx, onNext, canAdvance, finished }) {
  const pct = ((idx + 1) / len) * 100;
  const left = len - (idx + 1);
  return (
    <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '2px solid var(--line)', flexWrap: 'wrap' }}>
      <strong style={{ font: '700 16px/1 var(--f-sans)' }}>الساعة</strong>
      <span className="num" style={{ font: '900 22px/1 var(--f-display)' }}>{idx + 1} / {len}</span>
      <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
        جلسة {cursor.endDate} · بقي {left} جلسة
      </span>

      {/* read-only progress: the clock only moves forward, like a real market */}
      <div style={{ flex: 1, minWidth: 220, height: 8, background: 'var(--line)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, insetInlineStart: 0, width: `${pct}%`, height: '100%', background: finished ? 'var(--ink)' : 'var(--blue)' }} />
      </div>

      <button type="button" onClick={onNext} disabled={!canAdvance}
        style={{ background: 'var(--blue)', color: 'var(--cream)', border: 0, padding: '12px 24px', font: '700 16px/1 var(--f-sans)', cursor: canAdvance ? 'pointer' : 'not-allowed', opacity: canAdvance ? 1 : .5 }}>
        {finished ? 'خلصت البيانات' : 'اليوم التالي →'}
      </button>
    </div>
  );
}

function TechPanel({ bars }) {
  if (!bars || bars.length < 20) return (
    <div style={{ padding: '14px 18px', font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>المؤشرات الفنية تتطلب ٢٠ جلسة على الأقل.</div>
  );
  const closes = bars.map((b) => b.close);
  const r = rsi(closes, 14).at(-1);
  const m = macd(closes, 12, 26, 9);
  const macdLine = m.line.at(-1);
  const macdSig = m.signal.at(-1);
  const macdHist = macdLine != null && macdSig != null ? macdLine - macdSig : null;
  const a = atrOf(bars, 14).at(-1);
  const vol = volatility(closes);
  const lv = levels(bars, 120);
  const trend = ma20v50(closes);
  return (
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <strong style={{ font: '700 16px/1 var(--f-sans)' }}>المؤشرات الفنية</strong>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <Reading label="RSI (١٤)" value={r != null ? r.toFixed(1) : '—'} tone={r != null && (r < 30 ? 'pos' : r > 70 ? 'neg' : 'ink')} />
        <Reading label="MACD هيستوغرام" value={macdHist != null ? (macdHist >= 0 ? '+' : '') + macdHist.toFixed(2) : '—'} tone={macdHist != null && macdHist >= 0 ? 'pos' : 'neg'} />
        <Reading label="ATR (١٤)" value={a != null ? n2(a) : '—'} />
        <Reading label="تقلب سنوي" value={vol ? `${vol.toFixed(1)}%` : '—'} />
        <Reading label="دعم" value={lv.support != null ? n2(lv.support) : '—'} />
        <Reading label="مقاومة" value={lv.resistance != null ? n2(lv.resistance) : '—'} />
      </div>
      <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
        {trend === 'up' ? 'الاتجاه: صاعد (٢٠ فوق ٥٠)' : trend === 'down' ? 'الاتجاه: هابط (٢٠ تحت ٥٠)' : 'الاتجاه: متذبذب'}
      </span>
    </div>
  );
}
function ma20v50(closes) {
  const s20 = sma(closes, 20).at(-1);
  const s50 = sma(closes, 50).at(-1);
  if (s20 == null || s50 == null) return 'side';
  return s20 > s50 ? 'up' : s20 < s50 ? 'down' : 'side';
}
function Reading({ label, value, tone = 'ink' }) {
  const c = tone === 'pos' ? 'var(--green)' : tone === 'neg' ? 'var(--red)' : 'var(--ink)';
  return (
    <div style={{ padding: '8px 12px', boxShadow: 'inset 0 0 0 2px var(--line-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>{label}</span>
      <span className="num" style={{ font: '700 16px/1 var(--f-display)', color: c }}>{value}</span>
    </div>
  );
}

function BriefPanel({ dailyBrief, tickerName }) {
  return (
    <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '2px solid var(--line)' }}>
      <strong style={{ font: '700 16px/1 var(--f-sans)' }}>موجز اليوم</strong>
      <p style={{ margin: 0, font: '500 14px/1.65 var(--f-text)' }}>{oneLine(dailyBrief || `تبدأ من جديد على ${tickerName}. راقب الحجم والسعر قبل ما تشتري.`)}</p>
    </div>
  );
}

function WatcherPanel({ warnings }) {
  if (!warnings || !warnings.length) {
    return (
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid var(--line)' }}>
        <EyeOrb />
        <div>
          <strong style={{ font: '700 14px/1.4 var(--f-sans)' }}>المراقب الصامت</strong>
          <p style={{ margin: '4px 0 0', font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>ما فيه تحذيرات على قرارك الأخير.</p>
        </div>
      </div>
    );
  }
  const top = warnings[0];
  return (
    <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '2px solid var(--line)', background: top.severity === 'high' ? 'rgba(198,59,45,.06)' : 'transparent' }}>
      <EyeOrb alert={top.severity === 'high'} />
      <div style={{ flex: 1 }}>
        <strong style={{ font: '700 14px/1.4 var(--f-sans)', color: top.severity === 'high' ? 'var(--red)' : 'var(--ink)' }}>المراقب الصامت · {top.rule}</strong>
        <p style={{ margin: '4px 0 0', font: '500 14px/1.6 var(--f-text)' }}>{oneLine(top.text)} <strong>{top.question}</strong></p>
      </div>
    </div>
  );
}

function ToolBar({ go, onAgent }) {
  const btn = (label, onClick, accent) => (
    <button type="button" onClick={onClick}
      style={{
        minHeight: 52, padding: '0 22px',
        background: accent ? 'var(--ink)' : 'transparent',
        color: accent ? 'var(--cream)' : 'var(--ink)',
        border: '2px solid var(--ink)',
        font: '700 16px/1 var(--f-sans)', cursor: 'pointer', borderRadius: 0,
        display: 'inline-flex', alignItems: 'center', gap: 10,
      }}>
      <span style={{ width: 10, height: 10, background: accent ? 'var(--orange)' : 'var(--blue)' }} />
      {label}
    </button>
  );
  return (
    <div style={{ padding: '14px 18px', display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '2px solid var(--line)', background: 'var(--cream)' }}>
      {btn('الأخبار', () => go('news'))}
      {btn('الوكيل', () => go('chat'), true)}
      {btn('المكتبة', () => go('library'))}
      {btn('الاشتراك', () => go('plans'))}
    </div>
  );
}

/* ————————————————————————————————————————————————————————————————
   ROOT
   ———————————————————————————————————————————————————————————————— */

export function OpenWorld({ go, player, market }) {
  const player0 = usePlayer();
  const player1 = player || player0;
  const ui = useUI();
  const openAgent = () => ui.toggleAgent();
  const doReset = () => { if (window.confirm('تبدأ من جديد؟ تنمسح كل الصفقات وترجع الساعة لأول يوم.')) market.reset(); };

  React.useEffect(() => {
    if (!market.ready) market.load();
  }, [market]);

  const id = market.selected;
  const bars = market.barsUpTo(id);
  const last = market.currentBar(id);
  const pos = market.positions();
  const portfolio = market.portfolio();
  const dailyBrief = last ? brief({ history: bars.slice(-WATCH_BARS), meta: market.metaOf(id) }) : '';

  const [warnings, setWarnings] = React.useState([]);
  const onCommit = (side, shares) => {
    const snap = { ...portfolio, positions: market.positions() };
    const r = market.placeOrder(id, side, shares);
    if (!r.ok) return r;
    const ws = judgeTrade({ side, shares, price: last.close, history: bars.slice(-WATCH_BARS), portfolio: snap, meta: market.metaOf(id) });
    setWarnings(ws);
    return r;
  };

  if (!market.ready || !last) {
    return (
      <div className="bs-center">
        <style>{SLIDER_CSS}</style>
        <Piece color="cream" cut={3} lift style={{ padding: 'var(--space-8) var(--space-9)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
          <span style={{ font: 'var(--type-title)' }}>نجهّز الطاولة</span>
          <span style={{ font: 'var(--type-body)', color: 'var(--ink-muted)' }}>نحمّل شموع سوق الأسهم السعودي من 2010 إلى 2012. لحظة وحدة.</span>
          <span aria-hidden="true" style={{ display: 'block', width: 28, height: 28, background: 'var(--blue)', animation: 'bs-spin 1.1s linear infinite' }} />
        </Piece>
      </div>
    );
  }

  const cursor = { startDate: market.startDate(id), endDate: market.endDate(id), idx: market.cursor[id] ?? bars.length - 1 };
  const canAdvance = !market.finished(id);

  return (
    <>
      <style>{SLIDER_CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <TopTape meta={market.meta} order={market.order} series={market.series} cursor={market.cursor} selected={id} onChange={(v) => { market.select(v); market.rewindTo(v, START_AT); setWarnings([]); }} />

        <ClockBar
          len={market.series[id]?.length || 0}
          idx={cursor.idx}
          cursor={cursor}
          canAdvance={canAdvance}
          finished={market.finished(id)}
          onNext={() => market.advanceDay(id)}
        />

        <div style={{
          flex: 1, minHeight: 0,
          display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr minmax(280px, 340px)',
          gap: 0, borderTop: 'solid',
        }}>
          {/* LEFT: order desk + watcher */}
          <aside className="scroll" style={{ borderInlineEnd: '2px solid var(--line)', background: 'var(--cream)' }}>
            <OrderDesk
              price={last.close}
              meta={market.metaOf(id)}
              positions={pos}
              positions2={pos}
              portfolio={portfolio}
              market={market}
              onCommit={onCommit}
            />
            <WatcherPanel warnings={warnings} />
          </aside>

          {/* CENTER: chart */}
          <main style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            <CandleChart
              bars={bars}
              height={400}
              window={WIN}
              overlays={{ ma20: { period: 20, color: 'var(--blue)' }, ma50: { period: 50, color: 'var(--orange)' } }}
              markers={market.trades
                .filter((t) => t.companyId === id && t.barIndex != null)
                .map((t) => ({
                  side: t.side,
                  index: t.barIndex - Math.max(0, bars.length - WIN),
                }))}
            />
            <BriefPanel dailyBrief={dailyBrief} tickerName={market.metaOf(id)?.ar} />
            {player1.hasFeature('analysis') && (
              <TechPanel bars={bars.slice(-TECH_BARS)} />
            )}
            <PositionsTable positions={pos} onExit={(pid) => market.placeOrder(pid, 'SELL', market.positions().find((p) => p.id === pid)?.shares || 0)} />
          </main>

          {/* RIGHT: account + clock tools */}
          <aside className="scroll" style={{ borderInlineStart: '2px solid var(--line)', background: 'var(--cream)' }}>
            <AccountPanel portfolio={portfolio} total={portfolio.total} />
            <MomentumGauge value={momentumValue(bars)} />
            <div style={{ padding: '12px 18px' }}>
              <button type="button" onClick={() => go('journey')}
                style={{ minHeight: 44, padding: '0 18px', border: '2px solid var(--line-strong)', background: 'transparent', color: 'var(--ink)', font: '700 14px/1 var(--f-sans)', cursor: 'pointer', width: '100%' }}>
                الرحلة
              </button>
              <button type="button" onClick={doReset}
                style={{ minHeight: 44, padding: '0 18px', border: '2px solid var(--line-strong)', background: 'transparent', color: 'var(--red)', font: '700 14px/1 var(--f-sans)', cursor: 'pointer', width: '100%', marginTop: 8 }}>
                ابدأ من جديد
              </button>
            </div>
          </aside>
        </div>

        <ToolBar go={go} onAgent={openAgent} />
      </div>
      <CoachDock player={player1} market={market} company={market.meta[id]?.ar} budget={player1.investable || 1000000} />
    </>
  );
}

function momentumValue(bars) {
  if (!bars?.length) return 0;
  const c = bars.map((b) => b.close);
  const r = c.length - 1;
  const gain = (c[r] - c[0]) / c[0];
  const vol = (Math.max(...c) - Math.min(...c)) / c[r];
  const raw = 50 + gain * 80 + (1 - Math.min(vol * 4, 1)) * 10;
  return Math.max(0, Math.min(100, raw));
}