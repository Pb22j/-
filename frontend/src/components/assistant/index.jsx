import React from 'react';
import { Piece } from '../core/index.jsx';

/* Ported from "Baseer Design System/components/assistant/*.jsx" */

export function Assistant({ state = 'idle', onClick, label, size = 72 }) {
  const labels = { idle: 'تكلّم مع بصير', listening: 'بصير يسمعك', speaking: 'بصير يتكلم' };
  const hs = [8, 18, 12, 22], delays = ['0s', '-.3s', '-.6s', '-.15s'];
  return (
    <button type="button" onClick={onClick} aria-label={label || labels[state]}
      style={{ position: 'relative', width: size, height: size, flex: 'none', border: 0, padding: 0, background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink)' }}>
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--orange)', backgroundImage: 'var(--grain)', clipPath: 'var(--circle)' }} />
      <span aria-hidden="true" style={{
        position: 'absolute', inset: -10, border: '2px dashed var(--ink)', borderRadius: '50%',
        opacity: state === 'listening' ? 1 : 0, animation: state === 'listening' ? 'bs-spin 6s linear infinite' : 'none',
      }} />
      <span aria-hidden="true" style={{ position: 'relative', display: 'flex', gap: 3, alignItems: 'center', height: 26 }}>
        {hs.map((h, i) => <i key={i} style={{
          display: 'block', width: 4, height: h, background: 'var(--ink)',
          animation: state === 'speaking' ? 'bs-bar .9s ease-in-out infinite alternate' : 'none',
          animationDelay: delays[i],
        }} />)}
      </span>
    </button>
  );
}

export function CoachBubble({ speaker = 'بصير', children, color = 'orange', cut = 4, style }) {
  return (
    <Piece color={color} cut={cut} lift aria-live="polite" style={{ padding: '24px 32px', font: 'var(--type-bubble)', ...style }}>
      <b style={{ display: 'block', font: '700 15px/1.5 var(--f-sans)', marginBottom: 4 }}>{speaker}</b>
      {children}
    </Piece>
  );
}

export function AssistantTip({ children }) {
  return <Piece as="span" color="faint" cut={2} style={{ padding: '12px 20px', font: '700 15px/1.4 var(--f-sans)' }}>{children}</Piece>;
}
