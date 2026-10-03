/* Number & text formatting.
   House rules from the design system:
   - Western digits, en-US separators (8,000)
   - currency word «ريال» AFTER the number
   - arrow before the direction, never a plus/minus (↓15% / ↑8%)
   - no emoji anywhere */

const NF = new Intl.NumberFormat('en-US');

export const n = (v) => (Number.isFinite(v) ? NF.format(Math.round(v)) : '0');
export const n2 = (v) => (Number.isFinite(v) ? NF.format(Number(v.toFixed(2))) : '0.00');

export const sar = (v) => `${n(v)} ريال`;
export const sar2 = (v) => `${n2(v)} ريال`;

/** +12.3 → "↑12.3%" · -4.5 → "↓4.5%" · 0 → "—" */
export function dir(pct, digits = 1) {
  if (!Number.isFinite(pct) || pct === 0) return '—';
  const a = Math.abs(pct).toFixed(digits).replace(/\.0+$/, '');
  return `${pct > 0 ? '↑' : '↓'}${a}%`;
}

/** Absolute move for a SAR amount. */
export function sarDir(amount) {
  if (!Number.isFinite(amount) || amount === 0) return '—';
  return `${amount > 0 ? '↑' : '↓'}${n(Math.abs(amount))} ريال`;
}

export const pct = (v, d = 1) => (Number.isFinite(v) ? `${v.toFixed(d).replace(/\.0+$/, '')}%` : '—');

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Western digits inside Arabic text still read right-to-left; isolate them. */
export const ltr = (s) => `\u2066${s}\u2069`;
