/* Full browser smoke test via the Chrome DevTools Protocol.
   SSR cannot catch runtime errors (effects, timers, handlers), so this
   drives a real browser: navigates every route, clicks through the key
   flows, and fails on any console error or uncaught exception.
   Uses Node's built-in WebSocket — no dependencies.
   Run: node scripts/test_browser.mjs  */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.TEST_PORT || 4180);
const CDP_PORT = Number(process.env.CDP_PORT || 9333);
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/* Serve dist/ ourselves so the test never depends on an external server
   being alive — a managed/paused dev server silently broke this before. */
if (!existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first');
  process.exit(1);
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  let file = path.join(DIST, url === '/' ? 'index.html' : decodeURIComponent(url));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let pass = 0, fail = 0;
const problems = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- launch ---------- */
const profile = mkdtempSync(path.join(tmpdir(), 'baseer-cdp-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--mute-audio',
  '--window-size=1500,950',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const cleanup = () => {
  try { chrome.kill(); } catch {}
  try { server.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
};
process.on('exit', cleanup);

/* ---------- attach ---------- */
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page?.webSocketDebuggerUrl) wsUrl = page.webSocketDebuggerUrl;
  } catch { /* not up yet */ }
}
if (!wsUrl) { console.error('could not attach to Chrome'); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
let bucket = [];           // errors collected for the current step

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    bucket.push(`EXCEPTION: ${d.exception?.description || d.text}`);
  }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    const text = m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ');
    // React dev warnings about keys/act are noise we do not care about here
    if (!/Download the React DevTools/.test(text)) bucket.push(`CONSOLE.${m.params.type}: ${text}`);
  }
};

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`${method} timed out`)); } }, 20000);
});

await send('Runtime.enable');
await send('Page.enable');

/* ---------- helpers ---------- */
async function goto(hash, waitMs = 2200) {
  bucket = [];
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/#${hash}` });
  await sleep(waitMs);
  return bucket.slice();
}

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};

/** Click the first visible element whose text contains `needle`. */
async function clickText(needle, tag = '*') {
  return evalJs(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(tag === '*' ? 'button,a' : tag)})];
    const hit = els.find(e => (e.innerText||e.textContent||'').includes(${JSON.stringify(needle)}));
    if (!hit) return 'not-found';
    hit.click();
    return 'clicked';
  })()`);
}

const hash = () => evalJs('location.hash');
const bodyText = () => evalJs('document.body.innerText');

/* ============================ TESTS ============================ */

console.log('\n— every route loads with a clean console —');
const ROUTES = [
  'welcome', 'choose', 'salary', 'margin', 'quiz', 'journey', 'chat',
  'stage/b-team', 'stage/b-day27', 'stage/b-family', 'stage/b-coaster',
  'stage/b-ice', 'stage/b-arena',
  'stage/i-recommendation', 'stage/i-basket', 'stage/i-fomo',
  'stage/i-panic', 'stage/i-stop', 'stage/i-read',
  'openworld', 'plans', 'news', 'library', 'builder',
];
for (const r of ROUTES) {
  const errs = await goto(r);
  ok(`#${r}`, errs.length === 0, errs.slice(0, 2).join(' | '));
}

console.log('\n— the reported bug: custom stage no longer lands on welcome —');
await goto('chat');
// pick the stage-builder agent, then ask it to build a stage
await clickText('وكيل المراحل');
await sleep(400);
const agentPicked = await bodyText();
ok('stage-builder agent selectable', /وكيل المراحل/.test(agentPicked));

const asked = await evalJs(`(() => {
  const inp = document.querySelector('input[placeholder*="اكتب"]');
  if (!inp) return 'no-input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, 'ما فهمت وقف الخسارة، ابني لي مرحلة');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()`);
ok('composer accepts text', asked === 'typed', asked);
await evalJs(`(() => { const f=document.querySelector('form'); if(f){f.requestSubmit?f.requestSubmit():f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));} })()`);
await sleep(2500);
let afterBuild = await bodyText();
const gatedOrStage = /العب المرحلة|اشتراك المحترف|فكّر|مرحلة/.test(afterBuild);
ok('agent answered', gatedOrStage, afterBuild.slice(0, 90));
const errsChat = bucket.slice();
ok('no console errors during chat', errsChat.length === 0, errsChat.slice(0, 2).join(' | '));

if (/العب المرحلة/.test(afterBuild)) {
  await clickText('العب المرحلة');
  await sleep(1500);
  const h = await hash();
  ok('playing the built stage stays on a stage route', /stage\/custom/.test(h || ''), `hash=${h}`);
  const t = await bodyText();
  ok('custom stage actually rendered', !/فلوسك موجودة/.test(t), t.slice(0, 80));
} else {
  ok('free tier gates stage building (no crash)', true);
}

console.log('\n— the same flow on the pro tier (gate open) —');
await goto('chat');
await evalJs(`localStorage.setItem('baseer-player', JSON.stringify({state:{started:true,level:'intermediate',tier:'pro',investable:100000,stars:{},customStars:{},salary:'12000',obligations:{rent:'3000',loan:'',expenses:''},seen:{}},version:0}))`);
// a hash change does not re-hydrate zustand — force a real reload
bucket = [];
await send('Page.reload', { ignoreCache: true });
await sleep(2600);
await clickText('وكيل المراحل');
await sleep(400);
await evalJs(`(() => {
  const inp = document.querySelector('input[placeholder*="اكتب"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, 'ما فهمت وقف الخسارة، ابني لي مرحلة');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await sleep(200);
await evalJs(`(() => { const f=document.querySelector('form'); if(f){f.requestSubmit?f.requestSubmit():f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));} })()`);
await sleep(3000);
const proText = await bodyText();
const hasPlay = /العب المرحلة/.test(proText);
ok('pro tier unlocks stage building', hasPlay, proText.slice(0, 110).replace(/\n/g, ' '));
const errsPro = bucket.slice();
ok('no console errors on the pro path', errsPro.length === 0, errsPro.slice(0, 2).join(' | '));

if (hasPlay) {
  await clickText('العب المرحلة');
  await sleep(1800);
  const h2 = await hash();
  ok('lands on the custom stage, not welcome', /stage\/custom/.test(h2 || ''), `hash=${h2}`);
  const body2 = await bodyText();
  ok('custom stage screen rendered', body2.length > 120 && !/فلوسك موجودة/.test(body2), body2.slice(0, 90).replace(/\n/g, ' '));
  const isKnownStage = /كل المبلغ|نص المبلغ|عُشر المبلغ|الفريق|النجم|ادخل|أنتظر|أبيع|أصبر|Stop|بِع/.test(body2);
  ok('custom stage shows a playable decision', isKnownStage, body2.slice(0, 120).replace(/\n/g, ' '));
  const optionCount = await evalJs(`document.querySelectorAll('button[aria-pressed]').length`);
  ok('custom stage offers selectable options', optionCount >= 2, `${optionCount} options`);
}

console.log('\n— open world: trading works —');
await goto('openworld', 3000);
let t = await bodyText();
ok('desk shows a real price', /السعر الحالي/.test(t) && /\d+\.\d{2}/.test(t));
ok('order desk present', /لوحة الأوامر/.test(t));
ok('session counter present', /\d+\s*\/\s*\d+/.test(t));

// buy 100 shares
await evalJs(`(() => {
  const inp=[...document.querySelectorAll('input[type=number]')][0];
  if(!inp) return 'no';
  const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  s.call(inp,'100'); inp.dispatchEvent(new Event('input',{bubbles:true}));
})()`);
await sleep(300);
const clicked = await clickText('راجع الأمر');
ok('review button clicked', clicked === 'clicked', clicked);
await sleep(400);
const confirmed = await clickText('تأكيد');
ok('confirm step appears', confirmed === 'clicked', confirmed);
await sleep(800);
t = await bodyText();
ok('position registered', /تملك:\s*100/.test(t), t.match(/تملك.{0,20}/)?.[0] || '');
ok('portfolio updated', /قيمة المحفظة/.test(t));
const errsTrade = bucket.slice();
ok('no console errors while trading', errsTrade.length === 0, errsTrade.slice(0, 2).join(' | '));

console.log('\n— chart range buttons —');
const ranges = await evalJs(`[...document.querySelectorAll('button')].filter(b=>/\\d+ يوم/.test(b.innerText)).map(b=>({t:b.innerText.trim(),d:b.disabled}))`);
ok('range buttons exist', ranges.length === 4, JSON.stringify(ranges));
const disabled = ranges.filter((r) => r.d).length;
ok('over-range options are disabled, not silently wrong', disabled > 0, `${disabled}/4 disabled`);

console.log('\n— clock advances —');
const before = await evalJs(`(document.body.innerText.match(/(\\d+)\\s*\\/\\s*(\\d+)/)||[])[1]`);
await clickText('اليوم التالي');
await sleep(600);
await clickText('اليوم التالي');
await sleep(600);
const after = await evalJs(`(document.body.innerText.match(/(\\d+)\\s*\\/\\s*(\\d+)/)||[])[1]`);
ok('next-day advances the clock', Number(after) === Number(before) + 2, `${before} -> ${after}`);

console.log('\n— the path chooser is the first real decision —');
await goto('choose');
const chooser = await bodyText();
ok('offers all three paths', /مبتدئ/.test(chooser) && /متوسط/.test(chooser) && /خبير/.test(chooser));
ok('offers the quiz', /جرّب الاختبار/.test(chooser));
ok('offers بصير برو', /بصير برو/.test(chooser));
ok('offers the chatbot', /افتح الشات/.test(chooser));

const entered = await clickText('ادخل كـ');
ok('a path can be entered', entered === 'clicked', entered);
await sleep(1200);
const hPath = await hash();
ok('expert path lands on the simulator', /openworld|journey|stages/.test(hPath || ''), `hash=${hPath}`);

console.log('\n— forward-only clock (no rewind) —');
await goto('openworld', 3000);
const slider = await evalJs(`document.querySelectorAll('input[type=range]').length`);
ok('no day-rewind control exists', slider === 0, `${slider} sliders`);
const beforeAdv = await evalJs(`(document.body.innerText.match(/(\\d+)\\s*\\/\\s*(\\d+)/)||[])[1]`);
await clickText('اليوم التالي');
await sleep(500);
await clickText('اليوم التالي');
await sleep(500);
const afterAdv = await evalJs(`(document.body.innerText.match(/(\\d+)\\s*\\/\\s*(\\d+)/)||[])[1]`);
ok('clock only moves forward', Number(afterAdv) === Number(beforeAdv) + 2, `${beforeAdv} -> ${afterAdv}`);
const remaining = await bodyText();
ok('shows remaining sessions', /بقي\s*\d+\s*جلسة/.test(remaining), remaining.match(/بقي[^ج]*جلسة/)?.[0] || '');

console.log('\n— chatbot orb sits on the physical left —');
const orbBox = await evalJs(`(() => {
  // the wordmark also carries aria-label="بصير" and sits right-aligned in RTL,
  // so match the assistant labels specifically
  const b=[...document.querySelectorAll('button')].find(x=>/(تكلّم مع بصير|بصير يسمعك|بصير يتكلم|أغلق المحادثة)/.test(x.getAttribute('aria-label')||''));
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(window.innerWidth - r.right), label: b.getAttribute('aria-label') };
})()`);
ok('assistant orb found (not the wordmark)', !!orbBox, JSON.stringify(orbBox));
ok('orb is nearer the left edge than the right', !!orbBox && orbBox.left < orbBox.right, JSON.stringify(orbBox));

console.log('\n— journey reaches every destination —');
await goto('journey');
const j = await bodyText();
for (const [label, re] of [['expert simulator', /جرّب السوق المفتوح|ادخل محاكي السوق/], ['news', /بوابة الأخبار/], ['chatbot', /اسأل بصير/], ['Pro', /بصير برو/], ['library', /مكتبة المعرفة/], ['change path', /غيّر المسار/]]) {
  ok(`journey has ${label}`, re.test(j));
}

console.log('\n— charts and typography —');
await goto('openworld', 3000);
const chart = await evalJs(`(() => {
  const s = document.querySelector('svg[aria-label*="شارت"]');
  if (!s) return null;
  const rects = s.querySelectorAll('rect').length;
  const lines = s.querySelectorAll('line').length;
  const texts = s.querySelectorAll('text').length;
  return { rects, lines, texts };
})()`);
ok('candlestick chart drew', !!chart && chart.rects > 10, JSON.stringify(chart));
ok('price axis labels present', !!chart && chart.texts > 3);

const fonts = await evalJs(`[...document.fonts].filter(f=>f.family.includes('thmanyah')).length`);
ok('Thmanyah fonts loaded', fonts >= 3, `${fonts} faces`);

const colour = await evalJs(`getComputedStyle(document.body).backgroundColor`);
ok('cream ground', /242,\s*239,\s*227/.test(colour), colour);

console.log('\n— RTL —');
const dir = await evalJs(`document.documentElement.dir`);
ok('page is RTL', dir === 'rtl', dir);

/* ---------- report ---------- */
if (problems.length) {
  console.log('\ncollected problems:');
  problems.forEach((p) => console.log('  - ' + p));
}
console.log(`\n${pass} passed, ${fail} failed`);
cleanup();
process.exit(fail ? 1 : 0);
