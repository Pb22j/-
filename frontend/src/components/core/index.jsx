import React from 'react';

/* Ported verbatim from "Baseer Design System/components/core/*.jsx"
   Only createElement → JSX. Visual output is identical. */

const FILL = { cream: 'var(--cream)', blue: 'var(--blue)', orange: 'var(--orange)', green: 'var(--green)', red: 'var(--red)', ink: 'var(--ink)', faint: 'var(--ink-faint)' };
const TEXT = { blue: 'var(--cream)', red: 'var(--cream)', ink: 'var(--cream)' };

export function cutVar(cut) {
  return cut === 'circle' ? 'var(--circle)' : cut === 'torn' ? 'var(--torn)' : `var(--cut-${cut || 1})`;
}

/** A piece of coloured paper laid on the cream page. The core visual primitive. */
export function Piece({ as: As = 'div', color = 'cream', cut = 1, lift = false, tilt = 0, style, children, ...rest }) {
  const t = [];
  if (tilt) t.push(`rotate(${tilt}deg)`);
  if (style?.transform) t.push(style.transform);
  return (
    <As
      {...rest}
      style={{
        position: 'relative', isolation: 'isolate',
        color: TEXT[color] || 'var(--ink)',
        filter: lift ? 'var(--lift)' : undefined,
        ...style,
        transform: t.length ? t.join(' ') : undefined,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, zIndex: -1,
          backgroundColor: FILL[color] || color,
          backgroundImage: 'var(--grain)',
          clipPath: cutVar(cut), pointerEvents: 'none',
        }}
      />
      {children}
    </As>
  );
}

export function Button({ variant = 'primary', disabled = false, type = 'button', cut = 2, color, children, style, onClick, ...rest }) {
  const [h, setH] = React.useState(false);
  const base = {
    position: 'relative', isolation: 'isolate',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 60, padding: '0 44px', border: 0, background: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    font: 'var(--type-button)',
    color: variant === 'ghost' ? 'var(--ink)' : variant === 'quiet' ? 'var(--blue)' : color || 'var(--cream)',
    opacity: disabled ? .4 : 1, whiteSpace: 'nowrap',
  };
  let layer = null;
  if (variant === 'primary') {
    layer = (
      <span aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: -1,
        backgroundColor: color || 'var(--blue)', backgroundImage: 'var(--grain)',
        clipPath: `var(--cut-${cut})`, transition: 'transform .15s',
        transform: h && !disabled ? 'rotate(-1deg) scale(1.03)' : 'none',
      }} />
    );
  } else if (variant === 'ghost') {
    layer = (
      <span aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: -1,
        boxShadow: 'inset 0 0 0 2px var(--line-strong)', transition: 'transform .15s',
        transform: h && !disabled ? 'rotate(-1deg) scale(1.03)' : 'none',
      }} />
    );
  } else if (variant === 'quiet') {
    Object.assign(base, { color: 'var(--blue)', padding: '0 12px', minHeight: 44, textDecoration: 'underline', textUnderlineOffset: 6, textDecorationThickness: 2 });
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ ...base, ...style }} {...rest}>
      {layer}{children}
    </button>
  );
}

export function Badge({ color = 'orange', cut = 3, tilt = -2, children, style }) {
  return <Piece as="span" color={color} cut={cut} lift tilt={tilt} style={{ display: 'inline-flex', padding: '16px 34px', font: 'var(--type-button)', ...style }}>{children}</Piece>;
}

export function Wordmark({ onClick, size = 34, style }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} aria-label="بصير"
      style={{ font: `900 ${size}px/1 var(--f-display)`, background: 'none', border: 0, padding: 0, cursor: onClick ? 'pointer' : 'default', color: 'var(--ink)', ...style }}>
      بصير
    </Tag>
  );
}

export function Chip({ color = 'faint', children, tilt = 0, cut = 2, big = false, lift = false, style }) {
  return (
    <Piece as="span" color={color} cut={cut} tilt={tilt} lift={lift}
      style={{ display: 'inline-flex', padding: big ? '12px 26px' : '6px 14px', font: `${big ? '700 22px' : '700 15px'}/1.4 var(--f-sans)`, whiteSpace: 'nowrap', ...style }}>
      {children}
    </Piece>
  );
}
