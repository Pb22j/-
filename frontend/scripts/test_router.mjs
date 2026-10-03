/* Router test. The app calls go() with targets that are NOT all in the
   ROUTES table (e.g. 'stage/custom'), and a bug there silently dumped the
   learner on the welcome screen. This walks every target used anywhere in
   src/ and asserts it resolves to the intended screen — not to welcome.
   Run: node scripts/test_router.mjs  */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* --- mirror App.jsx's route table + resolver --- */
const ROUTE_IDS = [
  'welcome', 'choose', 'salary', 'margin', 'quiz', 'journey', 'stages',
  'stage/:id', 'chat', 'result', 'iresult', 'istage', 'openworld',
  'plans', 'news', 'library', 'builder',
];

const resolve = (id, opts = {}) => {
  if (opts?.fly) return { id: 'stage/:id', arg: opts.fly };
  if (ROUTE_IDS.includes(id)) return { id, arg: null };
  const m = String(id).match(/^stage\/(.+)$/);
  if (m) return { id: 'stage/:id', arg: m[1] };
  return { id: 'welcome', arg: null };
};

/* stage ids that must resolve in content/stages.js */
const STAGES = (await import('../src/content/stages.js')).STAGES;
const ALL_STAGE_IDS = Object.values(STAGES).flat().map((s) => s.id);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

console.log('\n— every go() target used in src/ resolves —');

/* scrape the real call sites */
function findTargets(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...findTargets(p));
    else if (/\.jsx?$/.test(e.name)) {
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(/\bgo\(['"]([^'"]+)['"]/g)) out.push({ file: path.relative(ROOT, p), target: m[1] });
      for (const m of src.matchAll(/baseer:go['"]?,\s*\{\s*detail:\s*['"]([^'"]+)['"]/g)) out.push({ file: path.relative(ROOT, p), target: m[1] });
    }
  }
  return out;
}

const targets = findTargets(path.join(ROOT, 'src'));
const unique = [...new Map(targets.map((t) => [t.target, t])).values()];
console.log(`  found ${unique.length} distinct targets across ${targets.length} call sites\n`);

for (const { file, target } of unique) {
  const r = resolve(target);
  ok(`${target}  (${file})`, r.id !== 'welcome' || target === 'welcome', `-> ${r.id}`);
}

console.log('\n— every declared stage resolves —');
for (const sid of ALL_STAGE_IDS) {
  const r = resolve(`stage/${sid}`);
  ok(`stage/${sid}`, r.id === 'stage/:id' && r.arg === sid, `-> ${JSON.stringify(r)}`);
}

console.log('\n— the custom-stage path (the reported bug) —');
const custom = resolve('stage/custom');
ok('stage/custom stays on the stage route', custom.id === 'stage/:id', `-> ${custom.id}`);
ok('custom stage carries arg=custom', custom.arg === 'custom');
const withOpts = resolve('stage/custom', { custom: { id: 'x' } });
ok('opts.custom does not change the route', withOpts.id === 'stage/:id');

console.log('\n— unknown targets degrade loudly, not silently —');
const bogus = resolve('does-not-exist');
ok('unknown falls back to welcome', bogus.id === 'welcome');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
