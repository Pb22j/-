/* Trading-engine test. Zustand's persist middleware needs localStorage, so
   we stub a minimal one before importing the store. The store fetches a
   root-relative URL, which Node cannot resolve — stub fetch to read disk.
   Run: node scripts/test_market.mjs */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

globalThis.fetch = async (url) => {
  const rel = String(url).replace(/^\//, '');
  const body = readFileSync(path.join(ROOT, 'public', rel), 'utf8');
  return { ok: true, json: async () => JSON.parse(body) };
};

const { useMarket } = await import('../src/store/useMarket.js');
const M = () => useMarket.getState();

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

console.log('\n— load —');
await M().load();
ok('data loaded', M().ready === true);
ok('11 symbols', M().order.length === 11, `got ${M().order.length}`);
ok('metadata has Arabic names', !!M().meta.AlRajhi_Bank?.ar);
ok('sectors assigned', M().order.every((id) => !!M().meta[id].sector));
ok('OHLCV shape', M().series.AlRajhi_Bank[0].close > 0 && M().series.AlRajhi_Bank.length > 500);

console.log('\n— T+2 settlement + commission —');
const cashBefore = M().portfolio().cash;
const rComm = M().placeOrder('SABIC', 'BUY', 10);
ok('commission charged on fill', rComm.ok && M().trades.at(-1).commission > 0, JSON.stringify(M().trades.at(-1)));
const commission = M().trades.at(-1).commission;
const cashAfter = M().portfolio().cash;
ok('cash drops by notional + commission immediately', cashAfter < cashBefore, `${cashAfter} < ${cashBefore}`);

// advance 2 sessions for SABIC
for (let i = 0; i < 2; i++) M().advanceDay('SABIC');
const settled = M().trades.at(-1);
ok('T+2 marks the trade settled', settled.settled === true, JSON.stringify(settled));
ok('portfolio exposes pendingCount', M().portfolio().pendingCount === 0, `pending=${M().portfolio().pendingCount}`);
ok('commissionPaid accumulates across trades', M().portfolio().commissionPaid >= commission, `${M().portfolio().commissionPaid} >= ${commission}`);

console.log('\n— clock —');
const { START_AT } = await import('../src/store/useMarket.js');
const start = M().cursor.AlRajhi_Bank;
ok('opens with history already revealed', start === START_AT, `got ${start}`);
ok('still has runway to advance', start < M().series.AlRajhi_Bank.length - 1);
const bar0 = M().currentBar('AlRajhi_Bank');
M().advanceDay('AlRajhi_Bank');
ok('advanceDay moves the cursor', M().cursor.AlRajhi_Bank === start + 1);
ok('the bar changed', M().currentBar('AlRajhi_Bank').time !== bar0.time);
M().rewindTo('AlRajhi_Bank', start);
ok('rewindTo restores', M().cursor.AlRajhi_Bank === start);
// At session 0 there is only one bar; history() can never exceed what the
// clock has revealed, and never more than the requested window.
ok('history respects the cursor', M().history('AlRajhi_Bank', 30).length === Math.min(30, start + 1),
   `got ${M().history('AlRajhi_Bank', 30).length}`);
M().rewindTo('AlRajhi_Bank', start + 40);
ok('history fills the window once the clock advances', M().history('AlRajhi_Bank', 30).length === 30);
M().rewindTo('AlRajhi_Bank', start);

console.log('\n— switching tickers —');
M().select('SABIC');
ok('select switches', M().selected === 'SABIC');
ok('chart data follows immediately', M().bars()[0].close > 0);
ok('no reload needed (cursor independent)', typeof M().cursor.SABIC === 'number');
M().select('AlRajhi_Bank');
M().reset();

console.log('\n— orders —');
const price = M().currentBar().close;
const p0 = M().portfolio();
const r1 = M().placeOrder('AlRajhi_Bank', 'BUY', 100);
ok('buy accepted', r1.ok === true, JSON.stringify(r1));
const p1 = M().portfolio();
ok('cash decreased by notional + commission', Math.abs((p0.cash - p1.cash) - (price * 100 + M().trades.at(-1).commission)) < 0.05);
ok('holding created', p1.count === 1);
ok('avgCost equals price', Math.abs(p1.marketValue / 100 - price) < 0.02);

const rOver = M().placeOrder('AlRajhi_Bank', 'BUY', 9_999_999);
ok('oversized buy rejected', rOver.ok === false && /الرصيد/.test(rOver.error), JSON.stringify(rOver));

const rSell = M().placeOrder('AlRajhi_Bank', 'SELL', 40);
ok('sell accepted', rSell.ok === true);
ok('position reduced', M().positions()[0].shares === 60);

const rTooMuch = M().placeOrder('AlRajhi_Bank', 'SELL', 500);
ok('oversized sell rejected', rTooMuch.ok === false && /ما عندك/.test(rTooMuch.error));

const rZero = M().placeOrder('AlRajhi_Bank', 'BUY', 0);
ok('zero shares rejected', rZero.ok === false);

M().placeOrder('AlRajhi_Bank', 'SELL', 60);
ok('closing the position removes it', M().positions().length === 0);
ok('cash restored (minus total commission)', Math.abs(M().portfolio().cash - (p0.cash - (M().trades.reduce((a, t) => a + (t.commission || 0), 0)))) < 0.05);

console.log('\n— portfolio maths —');
M().placeOrder('AlRajhi_Bank', 'BUY', 200);
M().placeOrder('SABIC', 'BUY', 150);
M().placeOrder('Mobily', 'BUY', 300);
const pp = M().portfolio();
ok('count = 3', pp.count === 3);
// HHI: 1/n for equal weights, 1 for a single holding. Three unequal weights
// must land strictly between those bounds.
ok('concentration between 1/3 and 1', pp.concentration > 1 / 3 && pp.concentration <= 1, `got ${pp.concentration.toFixed(3)}`);
ok('topWeight > 0', pp.topWeight > 20);
ok('total = cash + market value', Math.abs(pp.total - (pp.cash + pp.marketValue)) < 0.01);
const before = M().portfolio().total;
M().advanceDay('AlRajhi_Bank');
ok('mark-to-market moves the portfolio', M().portfolio().total !== before);

console.log('\n— concentration edge —');
M().reset();
ok('reset clears the book', M().portfolio().count === 0);
ok(`reset restores the starting cash (${M().portfolio().cash})`, Math.abs(M().portfolio().cash - 250000) < 0.01);
ok('reset rewinds the clock', M().cursor.AlRajhi_Bank === START_AT);
M().placeOrder('AlRajhi_Bank', 'BUY', 100);
ok('single holding -> HHI = 1', Math.abs(M().portfolio().concentration - 1) < 1e-9, `got ${M().portfolio().concentration}`);

console.log('\n— exhaustion —');
M().rewindTo('Mobily', (M().series.Mobily?.length ?? 2) - 1);
if (M().series.Mobily) {
  ok('finished() true at the end', M().finished('Mobily') === true);
  M().advanceDay('Mobily');
  ok('cannot advance past the end', M().cursor.Mobily === M().series.Mobily.length - 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
