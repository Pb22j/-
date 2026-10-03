import React from 'react';
import { Wordmark } from '../core/index.jsx';

/* Ported from "Baseer Design System/components/navigation/*.jsx" */

export function TopBar({ onHome, children, onFullscreen, showFullscreen = false, light = false }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '28px var(--header-pad-x)', flex: 'none' }}>
      <Wordmark onClick={onHome} style={light ? { color: 'var(--cream)' } : undefined} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {children}
        {showFullscreen && (
          <button type="button" aria-label="ملء الشاشة" onClick={onFullscreen}
            style={{ background: 'none', border: '2px solid var(--line-strong)', width: 44, height: 44, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M2 7V2h5M13 2h5v5M18 13v5h-5M7 18H2v-5" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

export function StepIndicator({ count = 4, current = 1, label = 'خطوات البداية' }) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const bg = i < current - 1 ? 'var(--blue)' : i === current - 1 ? 'var(--ink)' : 'var(--line)';
    items.push(<li key={i} style={{ width: 28, height: 6, background: bg }} />);
  }
  return <ol aria-label={label} style={{ display: 'flex', gap: 8, alignItems: 'center', listStyle: 'none', margin: 0, padding: 0 }}>{items}</ol>;
}

export function NavTabs({ items = [], current, onChange }) {
  return (
    <nav aria-label="التنقل" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map((it) => {
        const on = it.id === current;
        return (
          <button key={it.id} type="button" aria-current={on ? 'page' : undefined}
            onClick={() => onChange?.(it.id)}
            style={{
              position: 'relative', isolation: 'isolate', background: 'none', border: 0,
              padding: '10px 16px', font: '700 16px/1 var(--f-sans)', cursor: 'pointer',
              color: on ? 'var(--cream)' : 'var(--ink-muted)',
            }}>
            {on && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'var(--blue)', clipPath: 'var(--cut-2)' }} />}
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}
