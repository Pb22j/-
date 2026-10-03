import React from 'react';
import { Piece } from '../core/index.jsx';
import { Assistant, CoachBubble } from '../assistant/index.jsx';

/* Ported from "Baseer Design System/ui_kits/baseer-app/Games.jsx"
   Shared stage primitives used by beginner + intermediate modes. */

/** Tween a number toward a target — used for count-up reveals. */
export function useTween(target, ms = 900) {
  const [v, setV] = React.useState(target);
  const from = React.useRef(target);
  React.useEffect(() => {
    let raf, st;
    const a = from.current;
    const tick = (ts) => {
      if (!st) st = ts;
      const p = Math.min(1, (ts - st) / ms);
      const x = a + (target - a) * (1 - Math.pow(1 - p, 3));
      setV(x); from.current = x;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

/** Flip a boolean on after a delay — used to stage dramatic reveals. */
export function useLater(ms = 500) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setOn(true), ms); return () => clearTimeout(t); }, [ms]);
  return on;
}

export function Flip({ flipped, front, back, w = 220, h = 160, color = 'cream', backColor = 'blue', cut = 2, backCut = 3 }) {
  const face = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' };
  return (
    <div style={{ width: w, height: h, perspective: 1000, flex: 'none' }}>
      <div style={{
        position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d',
        transition: 'transform .8s cubic-bezier(.3,1.3,.5,1)', transform: flipped ? 'rotateY(180deg)' : 'none',
      }}>
        <div style={face}><Piece color={color} cut={cut} lift style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16 }}>{front}</Piece></div>
        <div style={{ ...face, transform: 'rotateY(180deg)' }}><Piece color={backColor} cut={backCut} lift style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16 }}>{back}</Piece></div>
      </div>
    </div>
  );
}

/** A sheet of paper torn in half — used for "the reveal". */
export function Torn({ color = 'red', w = 340, h = 150, children }) {
  const L = 'polygon(0 0,52% 0,47% 18%,54% 35%,46% 55%,53% 72%,48% 100%,0 100%)';
  const R = 'polygon(52% 0,100% 0,100% 100%,48% 100%,53% 72%,46% 55%,54% 35%,47% 18%)';
  const half = (cp, a) => (
    <div style={{ position: 'absolute', inset: 0, clipPath: cp, animation: `${a} .9s cubic-bezier(.3,1.2,.5,1) .6s both` }}>
      <Piece color={color} cut={2} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 16 }}>{children}</Piece>
    </div>
  );
  return <div style={{ position: 'relative', width: w, height: h, filter: 'var(--lift)' }}>{half(L, 'bs-tearL')}{half(R, 'bs-tearR')}</div>;
}

/** The coach orb + speech bubble, side by side. */
export function TalkingOrb({ text, big = false, hype = false, color = 'orange', speaker = 'بصير', size = 72 }) {
  return (
    <div style={{ display: 'flex', gap: big ? 44 : 20, alignItems: 'flex-end', direction: 'ltr', maxWidth: big ? 680 : 640 }}>
      <div style={{ flex: 'none', transform: big ? 'scale(1.5)' : 'none', transformOrigin: 'left bottom' }}>
        <div style={{ animation: hype ? 'bs-hype .45s ease-in-out infinite alternate' : 'none' }}>
          <Assistant state="speaking" size={size} />
        </div>
      </div>
      {text && (
        <div key={text} dir="rtl" style={{ textAlign: 'right', marginBottom: big ? 64 : 26, transformOrigin: 'left bottom', animation: 'bs-pop .45s cubic-bezier(.3,1.4,.5,1) .3s both' }}>
          <CoachBubble color={color} speaker={speaker}>{text}</CoachBubble>
        </div>
      )}
    </div>
  );
}

const LENS = 'polygon(0% 50%,8% 38%,18% 27%,30% 18%,42% 13%,50% 12%,58% 13%,70% 18%,82% 27%,92% 38%,100% 50%,92% 62%,82% 73%,70% 82%,58% 87%,50% 88%,42% 87%,30% 82%,18% 73%,8% 62%)';

/** The silent risk watcher (EyeOrb) — eyes that open wide on a bad decision. */
export function EyeOrb({ alert = false, size = 64 }) {
  const s = alert ? size * 1.9 : size;
  const c = alert ? 'var(--red)' : 'var(--blue)';
  const dot = (k, bg) => (
    <span style={{ position: 'absolute', left: '50%', top: '50%', width: s * k, height: s * k, marginLeft: -s * k / 2, marginTop: -s * k / 2, background: bg, backgroundImage: 'var(--grain)', clipPath: 'var(--circle)' }} />
  );
  return (
    <div role="img" aria-label={alert ? 'مراقب المخاطر ينبهك' : 'مراقب المخاطر'}
      style={{ position: 'relative', width: s * 1.6, height: s, flex: 'none', filter: 'var(--lift)', animation: alert ? 'bs-shake .5s ease-in-out 3' : 'none' }}>
      <span style={{ position: 'absolute', inset: 0, background: c, backgroundImage: 'var(--grain)', clipPath: LENS }} />
      <span style={{ position: 'absolute', inset: '15% 11%', background: 'var(--cream)', clipPath: LENS }} />
      {dot(.54, c)}{dot(.24, 'var(--ink)')}
    </div>
  );
}

export function GameTag({ n, name, color = 'faint' }) {
  return (
    <div style={{ alignSelf: 'flex-start' }}>
      <Piece color={color} cut={2} style={{ padding: '8px 18px', font: '700 15px/1.4 var(--f-sans)', display: 'inline-flex', gap: 8, whiteSpace: 'nowrap', flex: 'none' }}>
        <span>المرحلة {n}</span><span aria-hidden="true">·</span><span>{name}</span>
      </Piece>
    </div>
  );
}

export function ChoiceCard({ label, sub, on, onClick, cut = 2, tilt = 0, w = 200, h = 170, i = 0, disabled = false, children }) {
  const [hv, setHv] = React.useState(false);
  return (
    <div style={{ animation: 'bs-deal .5s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${i * 90}ms`, opacity: disabled ? .45 : 1 }}>
      <Piece as="button" type="button" aria-pressed={on ? 'true' : 'false'} onClick={onClick} disabled={disabled}
        onMouseEnter={() => setHv(true)} onMouseLeave={() => setHv(false)}
        color={on ? 'blue' : 'cream'} cut={cut} lift tilt={on ? -2 : tilt}
        style={{ border: 0, background: 'none', cursor: disabled ? 'not-allowed' : 'pointer', width: w, minHeight: h, padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', transition: 'transform .15s', transform: hv && !on && !disabled ? 'scale(1.04)' : undefined }}>
        {children}
        <span style={{ font: '700 19px/1.4 var(--f-sans)' }}>{label}</span>
        {sub && <span style={{ font: '500 14px/1.4 var(--f-sans)', opacity: .85 }}>{sub}</span>}
      </Piece>
    </div>
  );
}
