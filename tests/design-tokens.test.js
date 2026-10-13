// tests/design-tokens.test.js
//
// One design system (docs/superpowers/specs/2026-10-14-unified-product-design.md): every
// file in CHECKED sets radii, font sizes, shadows and transition times only through the
// tokens of css/tokens.css. Each stage of the plan adds its files here, so the old
// assortment (9 radii, 21 sizes, 10 shadows on the home page) cannot creep back.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const site = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(site, p), 'utf8');
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
// Photo motion is kept as it was (the owner, 2026-10-14): its marked blocks are not checked.
const lintable = css => strip(css.replace(/\/\* photo motion: kept as is[\s\S]*?\/\* end of photo motion \*\//g, ''));

// A file, or [file, fromMarker, toMarker] -- the part of the file between two comments.
const CHECKED = [
  'css/tokens.css',
  'css/header.css',
  ['css/site.css', '/* ---- Footer', '/* ---- Политика'],
];

function source(entry) {
  if (typeof entry === 'string') return lintable(read(entry));
  const [file, from, to] = entry; const css = read(file);
  const a = css.indexOf(from), b = to ? css.indexOf(to, a) : css.length;
  assert.ok(a >= 0 && b > a, file + ': ' + from);
  return lintable(css.slice(a, b));
}
function declarations(css) {
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim().replace(/^@[^{]*$/m, '').trim();
    m[2].split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) out.push({ sel, prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() }); });
  }
  return out;
}
const parts = v => v.split(/\s+(?![^(]*\))/);
const RADIUS = /^(var\(--radius\)|var\(--radius-pill\)|50%|0|inherit|calc\(var\(--radius\) - [\w.()-]+\))$/;
const FONT = /^(var\(--fs-(display|h1|h2|h3|body|small)\)|inherit|[\d.]+em)$/;
const SHADOW = /^var\(--(shadow-1|shadow-2|glass-rim|glass-rim-dark)\)$/;

CHECKED.forEach(entry => {
  const name = typeof entry === 'string' ? entry : entry.slice(0, 2).join(' @ ');
  test('tokens only: ' + name, () => {
    const css = source(entry);
    const tokensFile = entry === 'css/tokens.css';
    declarations(css).forEach(({ sel, prop, value }) => {
      const where = name + ' ' + sel + ' { ' + prop + ': ' + value + ' }';
      if (prop.startsWith('--')) return;                       // token definitions
      if (/^border(-(top|bottom)-(left|right))?-radius$/.test(prop)) parts(value).forEach(p => assert.match(p, RADIUS, where));
      if (prop === 'font-size') assert.match(value, FONT, where);
      if (prop === 'font') assert.doesNotMatch(value, /\d+px/, where);
      if (prop === 'box-shadow' && value !== 'none') value.split(/,(?![^(]*\))/).forEach(p => assert.match(p.trim(), SHADOW, where));
      if (prop === 'transition' || prop === 'transition-duration') assert.doesNotMatch(value.replace(/var\([^)]*\)/g, ''), /\d(ms|s)\b/, where);
      if (prop === 'text-transform') assert.ok(value !== 'uppercase' || /\.(site|sr)-logo/.test(sel), where);   // the wordmark only
    });
    if (!tokensFile) assert.doesNotMatch(css, /#b4562b|#9b4824|--sr-/i, name + ': no copper');
  });
});

test('css/tokens.css holds the system the spec names', () => {
  const css = read('css/tokens.css');
  [
    /--radius: 16px;/, /--radius-pill: 999px;/,
    /--fs-display: clamp\(36px, 4\.4vw, 56px\);/, /--fs-h1: clamp\(32px, 3\.4vw, 46px\);/, /--fs-h2: clamp\(24px, 2\.2vw, 30px\);/,
    /--fs-h3: 19px;/, /--fs-body: 16px;/, /--fs-small: 14px;/,
    /--shadow-1: [^;]+;/, /--shadow-2: [^;]+;/, /--dur-fast: 150ms;/, /--dur-move: 250ms;/,
    /--accent: #2a5446;/, /--graphite: #1e2320;/, /--graphite-2: #262c28;/,
  ].forEach(re => assert.match(css, re));
  assert.doesNotMatch(css, /--radius-s|--radius-m|--fs-meta|--sr-/);
});

// The configurator loads css/header.css with or without css/tokens.css (Review Focus, 2026-10-14):
// every value the header reads has a fallback in its own :where(:root), equal to the token.
test('css/header.css: every variable it reads has a fallback in its :where(:root)', () => {
  const h = read('css/header.css');
  const block = h.slice(h.indexOf(':where(:root) {'), h.indexOf('\n}', h.indexOf(':where(:root) {')));
  const defined = new Set([...block.matchAll(/(--[\w-]+):/g)].map(m => m[1]));
  const local = new Set([...strip(h).replace(block, '').matchAll(/(--[\w-]+):/g)].map(m => m[1]));
  const used = new Set([...strip(h).matchAll(/var\((--[\w-]+)/g)].map(m => m[1]));
  const missing = [...used].filter(v => !defined.has(v) && !local.has(v));
  assert.deepEqual(missing, []);
});

// Photo motion stays as it was (the owner, 2026-10-14): a marked block is left out of the check,
// and only that block.
test('photo motion blocks are left out of the check, nothing else', () => {
  const css = '.a { transition: color 0.2s; }\n/* photo motion: kept as is (the owner, 2026-10-14) */\n.b:hover img { transform: scale(1.04); transition: transform 0.6s; }\n/* end of photo motion */\n.c { box-shadow: 0 1px 2px #000; }';
  const out = lintable(css);
  assert.match(out, /\.a \{ transition: color 0\.2s; \}/);
  assert.match(out, /\.c \{ box-shadow/);
  assert.doesNotMatch(out, /\.b:hover/);
});
