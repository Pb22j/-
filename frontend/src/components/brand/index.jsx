import React from 'react';

/* Ported from "Baseer Design System/components/brand/CollageBand.jsx" */

const P = [
  ['#4f8f5e', 'M0 96 L170 86 L166 176 L86 182 L84 280 L0 280Z'],
  ['#1a1a1a', 'M250 70 L330 64 L333 204 L420 198 L418 280 L258 280Z'],
  ['#e8833a', 'M520 84 L560 60 L612 64 L648 98 L650 146 L620 184 L568 194 L526 172 L504 128Z'],
  ['#c63b2d', 'M736 34 C810 96 822 206 778 280 L736 280 C766 206 756 110 736 34Z'],
  ['#4f8f5e', 'M880 58 L1004 50 L1046 112 L1020 196 L908 204 L870 134Z'],
  ['#e8833a', 'M1100 190 C1150 200 1170 250 1156 280 L1118 280 C1134 250 1126 220 1100 190Z'],
  ['#f2efe3', 'M1190 112 L1384 100 L1392 280 L1196 280Z'],
];

export function CollageBand({ height = 'clamp(150px,26vh,270px)', style }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', insetInline: 0, bottom: 0, height, pointerEvents: 'none', ...style }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--blue)', backgroundImage: 'var(--grain)', clipPath: 'var(--torn)' }} />
      <svg viewBox="0 0 1440 280" preserveAspectRatio="xMidYMax slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {P.map((p, i) => <path key={i} fill={p[0]} d={p[1]} />)}
        <path d="M1230 150 l26 90 M1270 138 l22 104 M1310 132 l20 116 M1350 144 l16 96" stroke="#1a1a1a" strokeWidth="2" fill="none" opacity=".45" />
      </svg>
    </div>
  );
}
