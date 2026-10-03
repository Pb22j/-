import React from 'react';
import { Piece } from '../core/index.jsx';

/* Ported from "Baseer Design System/components/finance/*.jsx" */

export function Figure({ value, unit = 'ريال', label, variant = 'hero' }) {
  if (variant === 'points') {
    return <div style={{ font: '900 46px/1.2 var(--f-display)' }}>{value} <span style={{ fontSize: 28, fontWeight: 700 }}>{unit}</span></div>;
  }
  return (
    <div>
      {label && <div style={{ font: 'var(--type-label)', color: 'var(--ink-muted)' }}>{label}</div>}
      <div>
        <span style={{ font: 'var(--type-figure)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <span style={{ font: '700 clamp(22px,2.4vw,30px)/1 var(--f-display)', marginInlineStart: 10 }}>{unit}</span>
      </div>
    </div>
  );
}

export function StockCard({ name, sector, amount = 0, color = 'blue', cut = 1, tilt = 0, onInc, onDec, incDisabled, decDisabled, dimEmpty = true, style, children }) {
  const btn = (label, aria, fn, dis) => (
    <button type="button" aria-label={aria} onClick={fn} disabled={dis}
      style={{ width: 44, height: 44, border: '2px solid currentColor', background: 'transparent', font: '700 20px/1 var(--f-sans)', cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? .35 : 1 }}>
      {label}
    </button>
  );
  return (
    <Piece color={color} cut={cut} lift tilt={tilt}
      style={{ width: 180, height: 210, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: dimEmpty && amount === 0 ? .45 : 1, transition: 'opacity .2s, transform .5s cubic-bezier(.2,.8,.2,1)', ...style }}>
      <span style={{ font: '700 18px/1.4 var(--f-sans)' }}>{name}</span>
      {sector && <span style={{ font: 'var(--type-caption)', marginTop: -8, opacity: .85 }}>{sector}</span>}
      <span style={{ font: '700 34px/1.2 var(--f-display)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(amount).toLocaleString('en-US')}</span>
      {children || <span style={{ display: 'flex', gap: 8, marginTop: 4 }}>{btn('+', `زد ${name}`, onInc, incDisabled)}{btn('−', `نقّص ${name}`, onDec, decDisabled)}</span>}
    </Piece>
  );
}

export function OutcomeCard({ label, value, color = 'green', cut = 2, tilt = 0, emphasis = false }) {
  return (
    <Piece color={color} cut={cut} lift tilt={tilt}
      style={{ width: 240, height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, transform: emphasis ? 'translateY(-12px) scale(1.06)' : undefined }}>
      <span style={{ font: 'var(--type-label)' }}>{label}</span>
      <span style={{ font: '900 60px/1 var(--f-display)', fontVariantNumeric: 'tabular-nums', direction: 'ltr' }}>{value}</span>
    </Piece>
  );
}
