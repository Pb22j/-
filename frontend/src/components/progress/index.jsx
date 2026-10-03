import React from 'react';
import { Piece } from '../core/index.jsx';

/* Ported from "Baseer Design System/components/progress/*.jsx" */

const STAR = 'polygon(50% 1%,62% 35%,98.5% 36%,69% 58%,80% 95%,50% 73%,19.5% 94%,31% 57.5%,1.5% 35%,38.5% 34%)';

export function StarRating({ value = 0, max = 5, size = 56, gap, animate = false, delay = 0, step = 260, label }) {
  const stars = [];
  for (let i = 0; i < max; i++) {
    const fill = Math.max(0, Math.min(1, value - i));
    const piece = (bg, extra) => (
      <span style={{ position: 'absolute', top: 0, insetInlineStart: 0, width: size, height: size, backgroundColor: bg, backgroundImage: 'var(--grain)', clipPath: STAR, ...extra }} />
    );
    stars.push(
      <span key={i} style={{ position: 'relative', width: size, height: size, flex: 'none', transform: `rotate(${-4, 3, -2, 4, -3}[i % 5]}deg)` }}>
        {piece('rgba(26,26,26,.1)')}
        {fill > 0 && (
          <span style={{
            position: 'absolute', top: 0, insetInlineStart: 0, width: `${fill * 100}%`, height: size,
            overflow: 'hidden', filter: 'var(--lift)',
            animation: animate ? 'bs-pop .45s cubic-bezier(.3,1.5,.5,1) both' : 'none',
            animationDelay: `${delay + i * step}ms`,
          }}>
            {piece('var(--orange)')}
          </span>
        )}
      </span>
    );
  }
  return <div role="img" aria-label={label || `تقييمك ${value} من ${max}`} style={{ display: 'flex', gap: gap ?? Math.round(size * .18), alignItems: 'center' }}>{stars}</div>;
}

export function LevelPath({ levels = ['مدّخر', 'مبتدئ', 'مستثمر واعي', 'مخطط مالي'], current = 1, style }) {
  const out = [];
  levels.forEach((l, i) => {
    const done = i < current, on = i === current;
    out.push(
      <Piece as="li" key={'l' + i} color={done ? 'green' : on ? 'blue' : 'faint'} cut={[2, 3, 4, 1][i % 4]}
        lift={on} aria-current={on ? 'step' : undefined}
        style={{ padding: '14px 24px', font: `${on ? '700' : '500'} 16px/1.4 var(--f-sans)`, color: done ? 'var(--ink)' : on ? 'var(--cream)' : 'var(--ink-muted)', transform: on ? 'rotate(-2deg) scale(1.08)' : undefined }}>
        {l}
      </Piece>
    );
    if (i < levels.length - 1) out.push(<li key={'s' + i} aria-hidden="true" style={{ color: 'var(--ink-muted)', font: '500 20px/1 var(--f-sans)' }}>←</li>);
  });
  return <ol style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, listStyle: 'none', margin: 0, padding: 0, ...style }}>{out}</ol>;
}

export function FeatureCard({ icon, title, body, children, cut = 2, color = 'cream', centered = false, style }) {
  return (
    <Piece as="article" color={color} cut={cut} lift
      style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 12, alignItems: centered ? 'center' : 'flex-start', justifyContent: centered ? 'center' : undefined, textAlign: centered ? 'center' : undefined, minWidth: 0, ...style }}>
      {icon || null}
      {title && <h2 style={{ font: 'var(--type-title)', margin: 0 }}>{title}</h2>}
      {body && <p style={{ font: 'var(--type-body)', margin: 0, color: 'var(--ink-muted)' }}>{body}</p>}
      {children && <div style={{ marginTop: 8 }}>{children}</div>}
    </Piece>
  );
}
