import React from 'react';
import { n2, n, pct } from '../../lib/format.js';
import { sma } from '../../lib/indicators.js';

/* Candlestick chart drawn as inline SVG.
   Visual rules follow the design system: flat cream ground, ink hairlines,
   radius 0, brand green/red only, grain-free (charts are data, not paper).
   Time always flows left→right, the way every Saudi brokerage terminal draws it. */

const GREEN = 'var(--green)';
const RED = 'var(--red)';
const INK = 'var(--ink)';
const LINE = 'rgba(26,26,26,.16)';
const MUTED = 'rgba(26,26,26,.6)';

export function CandleChart({
  bars = [],
  height = 360,
  window: win = 90,
  overlays = {},
  showVolume = true,
  markers = [],
  onHover,
  id = 'chart',
}) {
  const ref = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const [spanRaw, setSpanRaw] = React.useState(win);

  // never show more bars than the clock has actually revealed — asking for
  // 400 days on session 61 would otherwise leak the future
  const span = Math.max(2, Math.min(spanRaw, bars.length));
  React.useEffect(() => { if (spanRaw !== span) setSpanRaw(span); }, [span, spanRaw]);

  const view = React.useMemo(() => bars.slice(-span), [bars, span]);
  const PAD = { t: 12, r: 58, b: 22, l: 8 };
  const W = 1000;
  const volH = showVolume ? Math.round(height * 0.18) : 0;
  const H = height - volH - PAD.t - PAD.b;

  if (!view.length) {
    return <div style={{ height, display: 'grid', placeItems: 'center', font: 'var(--type-label)', color: 'var(--ink-muted)' }}>لا توجد بيانات</div>;
  }

  const hi = Math.max(...view.map((b) => b.high));
  const lo = Math.min(...view.map((b) => b.low));
  const pad = (hi - lo) * 0.06 || hi * 0.02;
  const top = hi + pad, bot = lo - pad;
  const vmax = Math.max(1, ...view.map((b) => b.volume || 0));

  const plotW = W - PAD.l - PAD.r;
  const step = plotW / view.length;
  const bw = Math.max(1.5, Math.min(11, step * 0.62));

  const X = (i) => PAD.l + i * step + step / 2;
  const Y = (p) => PAD.t + ((top - p) / (top - bot)) * H;

  // moving averages are computed over every revealed bar so they stay warm
  // even when the visible window is shorter than the average's period
  const maSeries = React.useMemo(() => {
    const all = bars.map((b) => b.close);
    return Object.entries(overlays)
      .filter(([, cfg]) => cfg && cfg.enabled !== false)
      .map(([key, cfg]) => ({
        key,
        period: cfg.period || 20,
        values: sma(all, cfg.period || 20).slice(-view.length),
        color: cfg.color,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, overlays, view.length]);

  const onMove = (e) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round((x - PAD.l - step / 2) / step);
    if (i >= 0 && i < view.length) {
      const b = view[i];
      setHover({ b, i });
      onHover?.(b, i);
    } else setHover(null);
  };

  const gridPrices = [top, top - (top - bot) / 2, bot];

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={ref} viewBox={`0 0 ${W} ${height}`} width="100%" height={height}
        style={{ display: 'block', direction: 'ltr', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => { setHover(null); onHover?.(null); }}
        role="img" aria-label="شارت شموع يابانية"
      >
        {/* horizontal grid + price axis */}
        {gridPrices.map((p, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(p)} y2={Y(p)} stroke={LINE} strokeWidth="1" />
            <text x={W - PAD.r + 6} y={Y(p) + 4} fontSize="12" fill={MUTED} fontFamily="var(--f-sans)">{n2(p)}</text>
          </g>
        ))}

        {/* moving averages */}
        {maSeries.map((s) => (
          <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2"
            points={s.values.map((v, i) => (v == null ? null : `${X(i)},${Y(v)}`)).filter(Boolean).join(' ')} />
        ))}

        {/* candles */}
        {view.map((b, i) => {
          const up = b.close >= b.open;
          const col = up ? GREEN : RED;
          return (
            <g key={i}>
              <line x1={X(i)} x2={X(i)} y1={Y(b.high)} y2={Y(b.low)} stroke={col} strokeWidth="1.4" />
              <rect x={X(i) - bw / 2} y={Math.min(Y(b.open), Y(b.close))} width={bw}
                height={Math.max(1.2, Math.abs(Y(b.open) - Y(b.close)))} fill={col} />
            </g>
          );
        })}

        {/* trade markers */}
        {markers.map((m, i) => {
          const idx = m.index ?? -1;
          if (idx < 0 || idx >= view.length) return null;
          const buy = m.side === 'BUY';
          const y = buy ? Y(view[idx].low) + 16 : Y(view[idx].high) - 16;
          return (
            <g key={'m' + i}>
              <circle cx={X(idx)} cy={y} r="9" fill={buy ? GREEN : RED} />
              <text x={X(idx)} y={y + 4} fontSize="11" fill="var(--cream)" textAnchor="middle" fontWeight="700" fontFamily="var(--f-sans)">
                {buy ? 'ش' : 'ب'}
              </text>
            </g>
          );
        })}

        {/* volume */}
        {showVolume && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={height - PAD.b} y2={height - PAD.b} stroke={LINE} />
            {view.map((b, i) => {
              const h = ((b.volume || 0) / vmax) * volH;
              return <rect key={'v' + i} x={X(i) - bw / 2} y={height - PAD.b - h} width={bw} height={Math.max(.5, h)}
                fill={b.close >= b.open ? GREEN : RED} opacity=".5" />;
            })}
          </g>
        )}

        {/* crosshair */}
        {hover && (
          <g pointerEvents="none">
            <line x1={X(hover.i)} x2={X(hover.i)} y1={PAD.t} y2={height - PAD.b} stroke={MUTED} strokeWidth="1" strokeDasharray="3 3" />
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(hover.b.close)} y2={Y(hover.b.close)} stroke={MUTED} strokeWidth="1" strokeDasharray="3 3" />
          </g>
        )}

        {/* time axis */}
        {[0, Math.floor(view.length / 2), view.length - 1].map((i) => (
          <text key={i} x={X(i)} y={height - 6} fontSize="11" fill={MUTED} textAnchor="middle" fontFamily="var(--f-sans)">
            {view[i].time.slice(0, 7)}
          </text>
        ))}
      </svg>

      {/* readout — replaces a hover tooltip so numbers stay in the brand's type */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'baseline', font: 'var(--type-caption)', color: 'var(--ink-muted)', minHeight: 24 }}>
        {hover ? (
          <>
            <strong style={{ color: 'var(--ink)' }}>{hover.b.time}</strong>
            <span>فتح {n2(hover.b.open)}</span>
            <span>أعلى {n2(hover.b.high)}</span>
            <span>أدنى {n2(hover.b.low)}</span>
            <span>إغلاق {n2(hover.b.close)}</span>
            <span>حجم {n(hover.b.volume)}</span>
          </>
        ) : (
          <span>مرّر المؤشر على الشارت لقراءة اليوم</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ font: 'var(--type-caption)', color: 'var(--ink-muted)' }}>
          المعروض {span} من {bars.length} جلسة
        </span>
        {[60, 90, 180, 400].map((w) => {
          const tooBig = bars.length < w;
          return (
            <button key={w} type="button" disabled={tooBig}
              onClick={() => setSpanRaw(w)}
              title={tooBig ? `تحتاج ${w} جلسة — كمّل الجلسات أولاً` : undefined}
              style={{
                border: '2px solid var(--line-strong)', background: span === w ? 'var(--ink)' : 'transparent',
                color: span === w ? 'var(--cream)' : 'var(--ink)',
                cursor: tooBig ? 'not-allowed' : 'pointer',
                opacity: tooBig ? .35 : 1,
                padding: '6px 12px', font: '700 13px/1 var(--f-sans)',
              }}>
              {w} يوم
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Compact line chart for the news portal / strategy comparison panels. */
export function Sparkline({ values = [], width = 200, height = 60, color = 'var(--blue)', fill = false }) {
  if (values.length < 2) return null;
  const hi = Math.max(...values), lo = Math.min(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - lo) / span) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block', direction: 'ltr' }} aria-hidden="true">
      {fill && <polygon points={`0,${height} ${pts.join(' ')} ${width},${height}`} fill={color} opacity=".12" />}
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export { GREEN, RED, INK };
