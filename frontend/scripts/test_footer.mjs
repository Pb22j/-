/* The disclaimer must be the last element of every screen, centred, and
   never position:fixed — a fixed element inside a `filter`ed ancestor gets
   contained by it and lands mid-screen over the content.  */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : (/\.jsx?$/.test(e.name) ? [p] : []);
});
const files = walk(SRC);

console.log('\n— the footer itself —');
const css = readFileSync(path.join(SRC, 'styles', 'base.css'), 'utf8');
const block = css.match(/\.bs-disclaimer\s*\{[^}]*\}/)?.[0] || '';
ok('.bs-disclaimer exists', !!block);
ok('is not position:fixed', !/position\s*:\s*fixed/.test(block), block);
ok('is centred', /text-align\s*:\s*center/.test(block));
ok('does not pin to a viewport edge', !/bottom\s*:/.test(block) && !/inset-inline\s*:/.test(block));

console.log('\n— the shell renders it once, last —');
const app = readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
ok('App.jsx renders bs-disclaimer', app.includes('bs-disclaimer'));
ok('rendered unconditionally (every route)', /<p className="bs-disclaimer">\{footFor\(r\)\}<\/p>/.test(app));
ok('sits after the screen body', app.indexOf('bs-disclaimer') > app.indexOf('{body}'));

console.log('\n— no screen renders its own copy —');
const offenders = files
  .filter((f) => !f.endsWith(path.join('App.jsx')))
  .filter((f) => readFileSync(f, 'utf8').includes('bs-disclaimer'));
ok('zero screen-local disclaimers', offenders.length === 0, offenders.map((f) => path.relative(SRC, f)).join(', '));

console.log('\n— the in-content note is a different class —');
const b = readFileSync(path.join(SRC, 'screens', 'beginner', 'BeginnerStages.jsx'), 'utf8');
ok('Note uses bs-note, not bs-disclaimer', b.includes('bs-note') && !b.includes('bs-disclaimer'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
