import React from 'react';
import { Piece } from '../core/index.jsx';

/* Ported from "Baseer Design System/components/forms/*.jsx" */

export function AmountField({ value, onChange, unit = 'ريال', ariaLabel, id, placeholder }) {
  return (
    <label style={{ display: 'flex', alignItems: 'baseline', gap: 16, borderBottom: '3px solid var(--ink)', paddingBottom: 6 }}>
      <input id={id} inputMode="numeric" autoComplete="off" aria-label={ariaLabel} value={value} placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        style={{ all: 'unset', flex: 1, minWidth: 0, font: '900 clamp(56px,7vw,92px)/1.15 var(--f-display)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
      <span style={{ font: '500 22px/1 var(--f-sans)', color: 'var(--ink-muted)' }}>{unit}</span>
    </label>
  );
}

export function ObligationField({ label, value, onChange, cut = 2, tilt = 0, color = 'cream', placeholder = '0', width }) {
  return (
    <Piece as="label" color={color} cut={cut} lift tilt={tilt}
      style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '22px 30px', minWidth: 190, width, cursor: 'text' }}>
      <span style={{ font: 'var(--type-label)' }}>{label}</span>
      <input inputMode="numeric" autoComplete="off" value={value} placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        style={{ all: 'unset', font: '700 30px/1.3 var(--f-display)', width: '6ch', fontVariantNumeric: 'tabular-nums' }} />
    </Piece>
  );
}
