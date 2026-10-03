/* Technical indicators — pure functions over the OHLCV arrays produced by
   scripts/process_data.py. No dependencies; all work offline.

   Every function takes `bars` = [{ time, open, high, low, close, volume }]. */

export const closes = (bars) => bars.map((b) => b.close);

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder-smoothed RSI. */
export function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + (d > 0 ? d : 0)) / period;
    loss = (loss * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(values, fast = 12, slow = 26, signal = 9) {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const line = values.map((_, i) => (ef[i] != null && es[i] != null ? ef[i] - es[i] : null));
  const compact = line.filter((v) => v != null);
  const sig = ema(compact, signal);
  const offset = line.length - compact.length;
  const signalLine = new Array(values.length).fill(null);
  sig.forEach((v, i) => { if (v != null) signalLine[offset + i] = v; });
  const hist = line.map((v, i) => (v != null && signalLine[i] != null ? v - signalLine[i] : null));
  return { line, signal: signalLine, hist };
}

export function bollinger(values, period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const win = values.slice(i - period + 1, i + 1);
    const mean = mid[i];
    const sd = Math.sqrt(win.reduce((a, v) => a + (v - mean) ** 2, 0) / period);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { mid, upper, lower };
}

/** Average True Range — the volatility gauge the coach quotes in numbers. */
export function atr(bars, period = 14) {
  const tr = bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const pc = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
  });
  return sma(tr, period);
}

/** Peak-to-trough decline, as a positive percentage. */
export function maxDrawdown(values) {
  let peak = -Infinity, worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) worst = Math.max(worst, ((peak - v) / peak) * 100);
  }
  return worst;
}

/** Annualised volatility from daily log returns, in percent. */
export function volatility(values, tradingDays = 252) {
  const rets = [];
  for (let i = 1; i < values.length; i++) if (values[i - 1] > 0) rets.push(Math.log(values[i] / values[i - 1]));
  if (rets.length < 2) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1));
  return sd * Math.sqrt(tradingDays) * 100;
}

export function sharpe(values, riskFree = 0.05) {
  if (values.length < 3) return 0;
  const rets = [];
  for (let i = 1; i < values.length; i++) rets.push((values[i] - values[i - 1]) / values[i - 1]);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1));
  return sd === 0 ? 0 : ((mean * 252) - riskFree) / (sd * Math.sqrt(252));
}

/** Support/resistance as clustered swing levels. */
export function levels(bars, lookback = 120, buckets = 6) {
  const slice = bars.slice(-lookback);
  if (!slice.length) return { support: null, resistance: null };
  const lo = Math.min(...slice.map((b) => b.low));
  const hi = Math.max(...slice.map((b) => b.high));
  if (hi === lo) return { support: lo, resistance: hi };
  const step = (hi - lo) / buckets;
  const hits = new Array(buckets).fill(0);
  slice.forEach((b) => {
    const i = Math.min(buckets - 1, Math.max(0, Math.floor((b.close - lo) / step)));
    hits[i]++;
  });
  const last = slice[slice.length - 1].close;
  let resIdx = -1, supIdx = -1;
  for (let i = 0; i < buckets; i++) {
    if (lo + (i + 1) * step <= last && (resIdx === -1 || i > resIdx)) resIdx = i;
    if (lo + i * step >= last && (supIdx === -1 || i < supIdx)) supIdx = i;
  }
  return {
    support: supIdx >= 0 ? +(lo + supIdx * step + step / 2).toFixed(2) : lo,
    resistance: resIdx >= 0 ? +(lo + (resIdx + 1) * step - step / 2).toFixed(2) : hi,
  };
}

/** Consecutive up/down closes at the end of the series — drives rule R2. */
export function runLength(values) {
  let up = 0, down = 0;
  for (let i = values.length - 1; i > 0; i--) {
    if (values[i] > values[i - 1]) { if (down) break; up++; }
    else if (values[i] < values[i - 1]) { if (up) break; down++; }
    else break;
  }
  return { up, down };
}
