/* Renders every route of the app server-side against the real market data,
   so a broken screen fails the build instead of shipping.
   Run: node scripts/test_render.mjs  */

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/* ---- environment shims the browser would normally provide ---- */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
let hash = '';
globalThis.location = { get hash() { return hash; }, set hash(v) { hash = v; } };
globalThis.history = { replaceState: () => {} };
globalThis.scrollTo = () => {};
const listeners = {};
globalThis.addEventListener = (t, f) => { (listeners[t] ||= []).push(f); };
globalThis.removeEventListener = () => {};
globalThis.window = {
  dispatchEvent: (e) => { (listeners[e.type] || []).forEach((f) => f(e)); return true; },
  addEventListener: globalThis.addEventListener,
};
globalThis.fetch = async () => {
  const fs = await import('node:fs');
  const body = fs.readFileSync(path.join(ROOT, 'public', 'data', 'market_data.json'), 'utf8');
  return { ok: true, json: async () => JSON.parse(body) };
};

/* ---- bundle the app for SSR ---- */
const dir = mkdtempSync(path.join(tmpdir(), 'baseer-render-'));
const entry = path.join(dir, 'entry.jsx');
writeFileSync(entry, `
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from ${JSON.stringify(path.join(ROOT, 'src', 'App.jsx'))};
export const render = () => renderToString(React.createElement(App));
`);

const out = path.join(dir, 'bundle.cjs');
const result = await build({
  entryPoints: [entry],
  bundle: true, format: 'cjs', platform: 'node', write: false,
  outfile: out, jsx: 'automatic', loader: { '.css': 'empty' },
  // the entry lives in a temp dir, so bare imports need the project's modules
  absWorkingDir: ROOT,
  nodePaths: [path.join(ROOT, 'node_modules')],
  logLevel: 'error',
});
writeFileSync(out, result.outputFiles[0].text, 'utf8');
const { createRequire } = await import('node:module');
const { render } = createRequire(import.meta.url)(out);

/* ---- drive the router and assert ---- */
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const setRoute = async (h) => { hash = '#' + h; };

const ROUTES = [
  'welcome', 'choose', 'salary', 'margin', 'quiz', 'journey',
  'stage/b-team', 'stage/b-day27', 'stage/b-family', 'stage/b-coaster', 'stage/b-ice', 'stage/b-arena',
  'stage/i-recommendation', 'stage/i-basket', 'stage/i-fomo', 'stage/i-panic', 'stage/i-stop', 'stage/i-read',
  'stage/e-openworld', 'openworld', 'plans', 'news', 'library', 'builder', 'chat',
];

console.log('\n— every route renders —');
for (const r of ROUTES) {
  await setRoute(r);
  let html = '';
  let err = null;
  try {
    html = await render();
  } catch (e) {
    err = e;
  }
  const clean = !err && html.length > 200 && !/NaN|undefined|\[object Object\]|Infinity/.test(html);
  ok(`#${r}`, clean, err ? `threw: ${err.message}` : (html.length <= 200 ? 'too short' : 'contains NaN/undefined'));
}

console.log('\n— brand rules —');
const strip = (h) => h.replace(/<[^>]+>/g, '');
await setRoute('journey');
const j = strip(await render());
ok('no emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(j), (j.match(/[\u{1F300}-\u{1FAFF}]/u) || [])[0] || '');
ok('no raw hex outside tokens', !/#[0-9a-fA-F]{6}/.test(j.replace(/var\(--/g, '')));
ok('disclaimer rendered on every screen', /توصية أو نصيحة استثمارية|أمثلة توضيحية/.test(j), j.slice(-120));

// the footer must be the LAST element of every route
console.log('\n— the disclaimer is the last element of every route —');
for (const r of ROUTES) {
  await setRoute(r);
  const h = strip(await render());
  const i = h.indexOf('توصية أو نصيحة استثمارية');
  const j2 = h.indexOf('أمثلة توضيحية');
  const at = i === -1 ? j2 : j2 === -1 ? i : Math.max(i, j2);
  // nothing but closing chrome may follow it
  const after = at === -1 ? '' : h.slice(at + 40);
  ok(`#${r} ends with the footer`, at > 0 && after.length < 220, `at=${at} after=${after.length}ch`);
}
ok('no +/- percentage', !/[+-]\d+(\.\d+)?%/.test(j));

// the palette lives in the stylesheet, not inline — assert it there
const { readFileSync, readdirSync } = await import('node:fs');
const cssFile = path.join(ROOT, 'src', 'styles', 'tokens.css');
const css = readFileSync(cssFile, 'utf8');
for (const [token, hex] of [['--cream', '#F2EFE3'], ['--ink', '#1A1A1A'], ['--blue', '#3C5AA6'], ['--orange', '#E8833A'], ['--green', '#4F8F5E'], ['--red', '#C63B2D']]) {
  ok(`token ${token} = ${hex}`, new RegExp(`${token}:${hex}`).test(css));
}
ok('Thmanyah fonts referenced', (css.match(/thmanyah/g) || []).length >= 3);
ok('paper cuts present', css.includes('--cut-1') && css.includes('--circle') && css.includes('--torn'));
void readdirSync;

await setRoute('stage/b-team');
const t = strip(await render());
// currency: Western digits, en-US separators, then ريال — checked on text, not markup
ok('currency word after the number', /\d[\d,]*\s*ريال/.test(t), t.slice(0, 120));
ok('no arabic-indic digits', !/[٠-٩]/.test(t));
ok('10,000,000 formatted en-US', /10,000,000/.test(t));
ok('direction uses arrows not +/-', !/[+-]\d+(\.\d+)?%/.test(t));

await setRoute('openworld');
const ow = strip(await render());
// effects do not run in SSR, so the store is still loading here — assert the
// screen shows its loading guard rather than rendering a half-built chart.
ok('open world shows a loading guard, not a broken chart', /نجهّز|نحمّل|تحميل/u.test(ow), ow.slice(0, 100));
ok('open world never advises', !/اشترِ|شراء الآن|ننصحك|بِع الحين/.test(ow));

console.log('\n— safety —');
const orch = (await import('../src/agents/orchestrator.js')).default ?? (await import('../src/agents/orchestrator.js'));
const mod = await import('../src/agents/orchestrator.js');
const ask = mod.ask;
for (const q of ['Should I buy Al Rajhi stock right now?', 'عليك تشتري سهم الراجحي', 'السعر راح يوصل 60 ريال']) {
  const res = await ask(q, { tier: 'pro', level: 'beginner' });
  const clean = typeof res.text === 'string' && res.text.length > 10 &&
    !/\byou should buy\b/i.test(res.text) && !/راح\s+يوصل\s+\d/.test(res.text);
  ok(`guard holds: "${q.slice(0, 34)}…"`, clean, res.text?.slice(0, 60));
}
void orch;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
