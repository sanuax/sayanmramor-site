// tests/site.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SiteCommon = require('../js/site.js');
const SiteHeader = require('../js/header.js');

const site = path.join(__dirname, '..');
const pages = ['index.html', 'katalog.html', 'showroom.html']
  .concat(fs.readdirSync(path.join(site, 'categories')).map(f => 'categories/' + f));

function filesIn(dir, ext) {
  return fs.readdirSync(path.join(site, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? filesIn(path.join(dir, e.name), ext) : e.name.endsWith(ext) ? [path.join(dir, e.name)] : []);
}

test('SiteCommon exports the expected functions', () => {
  assert.equal(typeof SiteCommon.renderPortfolio, 'function');
  assert.equal(typeof SiteCommon.loadPortfolio, 'function');
});

// Path convention (see README, «Локальный запуск»): one server rooted at
// D:\ serves this site as /sayanmramor-site/ and the calculator as
// /calculator/. Every page loads only this site's own CSS/JS -- never a
// calculator script or stylesheet, and never through <base>.
test('every page loads only this site\'s own CSS/JS, and every file exists', () => {
  pages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.ok(!/<base\b/i.test(html), page + ': <base> is not allowed');
    const refs = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="stylesheet"[^>]*\shref)="([^"]+)"/g)].map(m => m[1]);
    assert.ok(refs.length > 0, page);
    refs.forEach(ref => {
      assert.ok(ref.startsWith('/sayanmramor-site/'), page + ': ' + ref + ' is not a /sayanmramor-site/ file');
      assert.ok(fs.existsSync(path.join(site, ref.slice('/sayanmramor-site/'.length))), page + ': missing ' + ref);
    });
  });
});

// The only two contracts with the calculator: links to the configurator
// page, and the stone data in /calculator/data/ (stone-index.json and the images
// it names). Any other /calculator/ reference would couple the site to the
// calculator's internals.
test('site code references the calculator only through the configurator URL and /calculator/data/', () => {
  const sources = pages.concat(filesIn('js', '.js'), filesIn('css', '.css'));
  sources.forEach(file => {
    const text = fs.readFileSync(path.join(site, file), 'utf8');
    [...text.matchAll(/\/calculator\/[^\s"'`)<>]*/g)].forEach(([ref]) => {
      assert.ok(ref.startsWith('/calculator/sayanmramor-calculator.html') || ref.startsWith('/calculator/data/'),
        file + ': ' + ref + ' is outside the site -> calculator contract');
    });
  });
});

test('site tests never load calculator modules', () => {
  filesIn('tests', '.js').forEach(file => {
    const text = fs.readFileSync(path.join(site, file), 'utf8');
    assert.ok(!/require\([^)]*calculator[\\/]/.test(text) && !/import[^;]*calculator[\\/]/.test(text), file);
  });
});

// ---- Home: the scenes ---------------------------------------------------------------

const homeHtml = () => fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const sectionOf = (html, start) => html.slice(html.indexOf(start), html.indexOf('</section>', html.indexOf(start)));
// Every photograph a direction's own page shows: inline items and its portfolio key.
function photosOfPage(page) {
  const portfolio = JSON.parse(fs.readFileSync(path.join(site, 'data', 'portfolio.json'), 'utf8'));
  const html = fs.readFileSync(path.join(site, page), 'utf8');
  const inline = [...html.matchAll(/image: '([^']+)'/g)].map(m => m[1]);
  const key = html.match(/SiteCommon\.loadPortfolio\('([^']+)'/);
  return inline.concat(key ? portfolio[key[1]].map(p => p.image) : []);
}

// The width and height of a WebP photograph, from its header.
function webpSize(file) {
  const b = fs.readFileSync(file);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

test('«Что можно заказать» in CSS: a wall, not cards -- joints that are recesses, sawn edges, the light falling off, its shadow at the foot; the names turned up the slabs; two courses (7 and 6) on phones, tablets and touch screens; on a desktop with a real pointer one course and one slab open, 2:3, drawn out of the wall by its thickness', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const block = css.slice(css.indexOf('/* 2. What can be ordered'), css.indexOf('/* 4. The showroom'));
  assert.match(block, /\.home-directions \{ background: var\(--ground\);/, 'on the limestone');
  assert.match(block, /\.wall-bay \{\s*--row: 7; --joints: 5; --reveals: 1;/, 'the first course: two groups, seven slabs');
  assert.match(block, /\.wall-bay:nth-child\(n \+ 3\) \{ --row: 6; --joints: 3; --reveals: 2; \}/, 'the second: three groups, six slabs');
  assert.match(block, /\.wall-bay-name \{[^}]*order: 1;/, 'the group\'s name on the floor under it');
  assert.match(block, /\.wall-slabs \{[^}]*gap: var\(--joint\);[^}]*background: linear-gradient\(to bottom, #6b665d, #46433d\);[^}]*box-shadow: 0 30px 34px -28px/, 'the wall behind, seen in the joints; its shadow at the foot');
  assert.match(block, /\.wall-slab \{[^}]*box-shadow: 1px 2px 3px rgba\(20, 21, 19, 0\.55\);/, 'each slab casts into its joint');
  assert.match(block, /\.wall-slab::after \{[^}]*inset 1px 1px 0 rgba\(255, 252, 245, 0\.32\), inset -1px -1px 0 rgba\(0, 0, 0, 0\.32\);/, 'the sawn edges');
  assert.match(block, /\.wall-face img \{[^}]*object-fit: cover;/);
  assert.match(block, /\.wall-name \{\s*writing-mode: vertical-rl; transform: rotate\(180deg\);/, 'the name read from the floor up');
  assert.match(block, /\.wall-text \{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset\(50%\);/, 'a closed slab\'s words: heard, not seen');
  assert.match(block, /\.wall-slab:focus-visible \{[^}]*outline: 2px solid var\(--figure\);/);
  assert.doesNotMatch(block, /border-radius|border: 1px|border-top|border-bottom/, 'no cards, no drawn lines');
  const desk = block.slice(block.indexOf('@media (min-width: 1200px) and (hover: hover) and (pointer: fine) {'));
  assert.ok(desk.length > 0, 'the open slab only where there is a real pointer');
  assert.match(desk, /\.wall \{ --wall-h: clamp\(440px, 66vh, 620px\); --open: calc\(var\(--wall-h\) \* 2 \/ 3\); flex-wrap: nowrap; \}/, 'the open slab as wide as its photograph at the wall\'s height: 2:3');
  assert.match(desk, /\.wall-slabs > li:has\(> \.wall-slab\.is-open\) \{ z-index: 2; flex: 0 0 var\(--open\); \}/);
  assert.match(desk, /\.wall-bay:has\(\.wall-slab\.is-open\) \{ flex-grow: calc\(var\(--n\) - 1\); flex-basis: calc\(var\(--open\) \+ \(var\(--n\) - 1\) \* var\(--joint\)\); \}/);
  assert.match(desk, /\.wall-slab\.is-open \{\s*transform: translate\(-5px, -6px\);\s*box-shadow:\s*1px 1px 0 #ddd7cc,[^;]*6px 6px 0 #6d6961,\s*20px 28px 36px -12px rgba\(20, 21, 19, 0\.55\);/, 'drawn out by its thickness (the hero\'s sawn edge), its shadow on its neighbours');
  assert.match(desk, /transition: flex-grow 0\.6s var\(--spring\), flex-basis 0\.6s var\(--spring\);/, 'the site\'s soft spring');
  assert.match(desk, /\.wall-slab\.is-open \.wall-name \{[^}]*writing-mode: horizontal-tb; transform: none;/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{\s*\.wall-slab \.wall-label \{ animation: none; \}/, 'reduce motion: the words simply there');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ transition: none !important; \}/, 'reduce motion: no transitions');
  assert.doesNotMatch(css, /\.stack-|\.direction-|\.directions-|\.project|\.home-works|\.works-title/, 'nothing left of the earlier blocks');
});

test('home-wall.js: one slab open at a time -- the one the pointer moves over or the focus is on; it stays open when the pointer leaves; the one closed is marked; a touch is only a tap', () => {
  const HomeWall = require('../js/home-wall.js');
  const a = {}, b = {}, other = {};
  assert.equal(HomeWall.choose([a, b], a, b), b);
  assert.equal(HomeWall.choose([a, b], a, other), a, 'something that is not a slab changes nothing');
  const mk = on => {
    const cls = new Set(on ? ['is-open'] : []); const handlers = {};
    return {
      classList: { contains: c => cls.has(c), add: c => cls.add(c), remove: c => cls.delete(c), replace: (x, y) => { cls.delete(x); cls.add(y); } },
      addEventListener: (t, f) => { handlers[t] = f; }, handlers, cls,
    };
  };
  const slabs = [mk(true), mk(false), mk(false)];
  const wall = { querySelectorAll: s => (s === '.wall-slab' ? slabs : []) };
  const api = HomeWall.init({ querySelector: s => (s === '[data-wall]' ? wall : null) });
  const state = () => slabs.map(s => (s.cls.has('is-open') ? 'open' : s.cls.has('was-open') ? 'was' : '-'));
  assert.ok(!slabs[0].handlers.pointerenter, 'a wall scrolled under a resting pointer stays as it is');
  slabs[2].handlers.pointermove({ pointerType: 'mouse' });
  assert.deepEqual(state(), ['was', '-', 'open']);
  slabs[1].handlers.pointermove({ pointerType: 'touch' });
  assert.deepEqual(state(), ['was', '-', 'open'], 'a touch opens the page, not the slab');
  slabs[1].handlers.focus();
  assert.deepEqual(state(), ['-', 'open', 'was'], 'only the one just closed is marked');
  slabs[1].handlers.pointermove({ pointerType: 'pen' });
  assert.deepEqual(state(), ['-', 'open', 'was'], 'the open one stays open');
  assert.equal(api.open, slabs[1]);
  assert.equal(HomeWall.init({ querySelector: () => null }), null);
});

test('all 16 pages share one header: <header class="site-header"> and header.js, no masthead anywhere', () => {
  headerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.match(html, /<header class="site-header">/, page);
    assert.ok(html.includes('js/header.js'), page);
    assert.doesNotMatch(html, /mast-|masthead\.js|home-hero\.js/, page);
  });
});

test('the masthead in CSS: ovals with a thin edge (no fill, no shadow), a plane of stone drawn from the oval\'s own outline on a soft spring, light over a light section; the home palette belongs to the home page only', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const rule = sel => { const i = css.indexOf('\n' + sel + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  assert.match(rule('.mast, .home-main'), /--night: #1e2320;[\s\S]*--travertine: #ece5d8;[\s\S]*--verde: #2f5d50;/);
  assert.match(rule('.mast, .home-main'), /--spring: linear\(0, /);
  const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')));
  assert.doesNotMatch(root, /--night|--travertine|--spring/, 'not a shared variable: other pages never see it');
  assert.match(rule('.mast-inner'), /grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\);/, 'the name exactly in the middle');
  assert.match(rule('.mast-pill'), /border: 1px solid var\(--pill-line\); border-radius: calc\(var\(--pill-h\) \/ 2\);/);
  assert.match(rule('.mast-pill'), /background: transparent;/);
  assert.doesNotMatch(rule('.mast-pill'), /box-shadow|backdrop-filter|gradient/);
  assert.match(css, /\.js \.mast-drop\.is-ready > \.mast-sheet \{\s*clip-path: inset\(0 0 calc\(100% - var\(--pill-h\)\) calc\(100% - var\(--pill-w, 120px\)\) round calc\(var\(--pill-h\) \/ 2\)\);/);
  assert.match(css, /\.js \.mast-drop\.is-ready\.is-open > \.mast-sheet \{\s*clip-path: inset\(0 0 0 0 round 22px\);[\s\S]*?transition: clip-path 0\.56s var\(--spring\);/);
  assert.match(rule('.mast-sheet'), /background: var\(--sheet\);/);
  assert.match(rule('.mast'), /--sheet: var\(--travertine\);/, 'travertine over the dark page');
  assert.match(rule('.mast.is-light'), /--sheet: var\(--night\);/, 'basalt over a light one');
  const block = css.slice(css.indexOf('/* ---- Masthead'), css.indexOf('/* ---- Home ----'));
  assert.doesNotMatch(block, /backdrop-filter|blur\(|glow|var\(--sr-/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{\s*\.js \.mast-drop\.is-ready > \.mast-sheet, \.js \.mast-drop\.is-ready\.is-open > \.mast-sheet \{ transition: none; \}/);
});

test('masthead.js: one plane at a time, opened from the oval\'s width and closed after its animation; the tone follows the ground under the masthead', () => {
  const Masthead = require('../js/masthead.js');
  assert.equal(Masthead.toneOf('rgb(239, 237, 232)'), 'light');
  assert.equal(Masthead.toneOf('rgb(26, 28, 25)'), 'dark');
  assert.equal(Masthead.toneOf('rgb(30, 26, 22)'), 'dark', 'the showroom\'s graphite');
  assert.equal(Masthead.toneOf('rgba(0, 0, 0, 0)', 'rgb(239, 237, 232)'), 'light', 'a transparent section shows the page');
  assert.ok(Masthead.CLOSE_MS >= 180 && Masthead.CLOSE_MS <= 300);
  const src = fs.readFileSync(path.join(site, 'js', 'masthead.js'), 'utf8');
  ["e.preventDefault()", "'--pill-w'", "classList.add('is-open')", "e.key === 'Escape'", "'focusout'", "'menu-lock'", "IntersectionObserver", "prefers-reduced-motion"]
    .forEach(t => assert.ok(src.includes(t), t));
});

test('the hero in CSS: held while you scroll (sticky), moved only by transform and opacity from a few numbers; standing still by default (no JavaScript, phones, «reduce motion»)', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const block = css.slice(css.indexOf('/* 1. The hero'), css.indexOf('/* 2. What can be ordered'));
  assert.match(block, /\.night-hero\[data-mode="scrub"\] \{ height: 250svh; \}/);
  assert.match(block, /\[data-mode="scrub"\] \.hero-stage \{[\s\S]*?position: sticky;/);
  assert.match(block, /\[data-mode="scrub"\] \.hero-slab \{[\s\S]*?transform: translate3d\(0, var\(--y, 0px\), 0\) rotateX\(var\(--t, 0deg\)\) rotateZ\(var\(--r, 0deg\)\) scale\(var\(--s, 1\)\);/);
  // The lying slab as a real object (the scrolled scene only): turned a little on the floor, seen from a little off centre,
  // its sawn edge and its shadow on the floor, a slight fall of light.
  assert.match(block, /perspective-origin: 44% 0;/);
  assert.match(block, /\.hero-floor-shadow, \.hero-edge \{ display: none; \}/, 'not on a phone, not without the scene');
  // The thickness is a real face of the slab in 3D: hung from the bottom edge and turned 90° about it, along the slab's own normal,
  // 3 cm at the slab's scale; the perspective alone thins it as the slab stands. The shadow lies on the floor, 3 cm under the top.
  assert.match(block, /\[data-mode="scrub"\] \.hero-slab \{ --thick: calc\(var\(--fw\) \/ var\(--slab-ratio\) \* 0\.0172\); transform-style: preserve-3d; \}/);
  assert.match(block, /\[data-mode="scrub"\] \.hero-edge \{[^}]*top: 96\.5%; left: 4\.6%; width: 89\.9%; height: var\(--thick\);[^}]*transform: rotateX\(-90deg\); transform-origin: 50% 0;/);
  assert.match(block, /\[data-mode="scrub"\] \.hero-floor-shadow \{[^}]*transform: translateZ\(calc\(var\(--thick\) \* -1\)\); opacity: var\(--shade, 0\);/);
  const edgeRule = block.slice(block.indexOf('[data-mode="scrub"] .hero-edge {'), block.indexOf('}', block.indexOf('[data-mode="scrub"] .hero-edge {')));
  assert.doesNotMatch(edgeRule, /scale|var\(--e/, 'no faked edge: no scaling by a number');
  assert.match(block, /\[data-mode="scrub"\] \.hero-stone \{[^}]*mask-image: linear-gradient\(to bottom, rgba\(0, 0, 0, 0\.88\), #000 60%\);/, 'a fall of light of only 12 %');
  // The slab whole, four corners: the sawn top and the slanted left side, the right side inside the missing corner, a straight bottom --
  // in every mode: its studio's dark ground is never shown on the limestone.
  assert.match(block, /\n\.hero-stone-frame \{ position: absolute; inset: 0; overflow: hidden; clip-path: polygon\(2\.4% 2\.7%, 94\.5% 2\.7%, 94\.5% 96\.5%, 4\.6% 96\.5%\); \}/);
  assert.match(block, /\.hero-raw \{ position: relative; isolation: isolate; aspect-ratio: 4096 \/ 2437; \}/, 'no ground behind the slab');
  assert.match(block, /\[data-mode="scrub"\] \.hero-mark-word \{\s*transform: translate3d\(0, var\(--mk-y, 0px\), 0\) scale\(var\(--mk-s, 1\)\); opacity: var\(--mk-o, 1\);/);
  assert.match(block, /\.hero-stone \{ width: 100%; height: 100%; filter: url\(#slabBalance\); \}/);
  assert.doesNotMatch(block, /mix-blend-mode: lighten/, 'nothing blended into a dark ground');
  // Nothing but the scrub mode sticks or moves: without it the scene is a plain column.
  const free = block.replace(/\[data-mode="scrub"\][^{]*\{[^}]*\}/g, '');
  assert.doesNotMatch(free, /position: sticky|rotateX|250svh|clip-path: inset/);
  // The slab opens: the object is seen through a cut widening from its middle -- never laid over the stone.
  assert.match(block, /\[data-mode="scrub"\] \.hero-made \{[^}]*clip-path: inset\(calc\(\(1 - var\(--cut, 1\)\) \* 50%\) calc\(\(1 - var\(--cut, 1\)\) \* 50%\) round 2px\);/);
  assert.doesNotMatch(block.slice(block.indexOf('[data-mode="scrub"] .hero-made {')), /^[^}]*opacity/, 'no cross-fade of the two images');
  assert.match(block, /\[data-mode="scrub"\] \.hero-cut \{[^}]*opacity: var\(--edge, 0\);/);
  assert.match(block, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.js \.is-lit \.hero-stone-frame::after \{ animation: hero-light/, 'the one pass of light, only when motion is welcome');
  // No decorative shadow or blur: the one shade is inside the cut (inset), where the object lies below the stone's face.
  const cutRule = block.slice(block.indexOf('[data-mode="scrub"] .hero-cut {'), block.indexOf('}', block.indexOf('[data-mode="scrub"] .hero-cut {')));
  assert.match(cutRule, /box-shadow: inset /);
  assert.doesNotMatch(cutRule.replace(/box-shadow:[^;]*;/, ''), /box-shadow/);
  const shadowRule = block.slice(block.indexOf('[data-mode="scrub"] .hero-floor-shadow {'), block.indexOf('}', block.indexOf('[data-mode="scrub"] .hero-floor-shadow {')));
  assert.match(shadowRule, /filter: blur\(22px\);/, 'the one blur: the slab\'s own shadow on the floor');
  assert.doesNotMatch(block.replace(cutRule, '').replace(shadowRule, ''), /box-shadow|backdrop-filter|blur\(/);
  // The masthead's name stays visible without JavaScript.
  assert.match(css, /\.js \.mast\[data-dock\] \.mast-logo \{ opacity: var\(--logo, 0\); \}/);
});

test('home-hero.js: one number from 0 to 1 -- the slab lies at 0 and stands as the object at 1, the dimensions come between, the name has risen into the masthead early; the still scene below 768 px or with «reduce motion»', () => {
  const HomeHero = require('../js/home-hero.js');
  const mark = { dy: -67, s: 0.125 };
  const a = HomeHero.stage(0, 300, mark), z = HomeHero.stage(1, 300, mark);
  assert.equal(a.t, HomeHero.TILT); assert.equal(a.y, 300); assert.equal(a.cut, 0); assert.equal(a.edge, 0); assert.equal(a.d, 0); assert.equal(a.copy, 1); assert.equal(a.step, 1);
  assert.equal(Math.abs(a.mkY), 0); assert.equal(a.mkS, 1); assert.equal(a.logo, 0);
  assert.equal(a.r, HomeHero.TURN); assert.equal(a.shade, 1);
  assert.equal(Math.abs(z.r), 0); assert.equal(z.shade, 0, 'standing: no turn, no shadow (the edge is edge-on)');
  assert.equal(a.e, undefined, 'the edge is geometry, not a number');
  assert.equal(z.t, 0); assert.equal(z.y, 0); assert.ok(Math.abs(z.s - 1) < 1e-9); assert.equal(z.cut, 1); assert.equal(z.edge, 0); assert.equal(z.dd, 0); assert.equal(z.fin, 1); assert.equal(z.step, 3);
  assert.equal(z.mkY, -67); assert.equal(z.mkS, 0.125); assert.equal(z.mkO, 0); assert.equal(z.logo, 1);
  const mid = HomeHero.stage(0.45, 300, mark);
  assert.equal(mid.step, 2); assert.ok(mid.d > 0.5 && mid.cut === 0, 'the dimensions are drawn before the slab opens');
  const opening = HomeHero.stage(0.7, 300, mark);
  assert.ok(opening.t > 0 && opening.cut > 0 && opening.cut < 1 && opening.dd === 0, 'the slab is still moving as it opens; its dimensions are put away');
  assert.ok(opening.edge > 0.9, 'the cut has its edge while it opens');
  assert.equal(HomeHero.stage(0.2, 300, mark).logo, 1, 'the name is in the masthead before the story begins');
  let prev = HomeHero.stage(0, 300, mark);
  for (let p = 0.02; p <= 1.0001; p += 0.02) {
    const v = HomeHero.stage(Math.min(1, p), 300, mark);
    assert.ok(v.t <= prev.t && v.cut >= prev.cut && v.mkS <= prev.mkS + 1e-9, 'one calm movement, never back: ' + p.toFixed(2));
    assert.ok(Math.abs(v.r) <= Math.abs(prev.r) + 1e-9 && v.shade <= prev.shade + 1e-9, 'the turn and the shadow only fade: ' + p.toFixed(2));
    prev = v;
  }
  assert.equal(HomeHero.MIN_WIDTH, 768);
  const src = fs.readFileSync(path.join(site, 'js', 'home-hero.js'), 'utf8');
  ["prefers-reduced-motion: reduce", "{ passive: true }", "requestAnimationFrame", "dataset.mode"].forEach(t => assert.ok(src.includes(t), t));
  assert.doesNotMatch(src, /\.style\.(transform|top|left|width|height)\b/, 'only custom properties are written');
});


test('home-portal.js: a plain click fades the page into the showroom\'s graphite, then opens the link; modifier clicks and «reduce motion» keep the plain link', () => {
  const HomePortal = require('../js/home-portal.js');
  assert.ok(HomePortal.FADE_MS >= 180 && HomePortal.FADE_MS <= 300);
  assert.equal(HomePortal.isPlainClick({ button: 0 }), true);
  [{ button: 1 }, { button: 0, ctrlKey: true }, { button: 0, metaKey: true }, { button: 0, shiftKey: true }, { button: 0, altKey: true }]
    .forEach(e => assert.equal(HomePortal.isPlainClick(e), false, JSON.stringify(e)));
  const handlers = [];
  const link = { href: '/sayanmramor-site/showroom.html', addEventListener: (t, f) => handlers.push([t, f]) };
  const reduced = HomePortal.init({ querySelectorAll: () => [link] }, { matchMedia: () => ({ matches: true }) });
  assert.equal(reduced.reduce, true);
  assert.equal(handlers.length, 0, 'reduce motion: nothing is taken over');
  const timers = [];
  const appended = [];
  const veilClasses = new Set();
  const win = {
    matchMedia: () => ({ matches: false }), location: { href: '' },
    setTimeout: (f, ms) => timers.push([f, ms]), addEventListener: () => {},
  };
  const doc = {
    querySelectorAll: () => [link], body: { appendChild: n => appended.push(n) },
    createElement: () => ({ setAttribute() {}, classList: { add: c => veilClasses.add(c), remove: c => veilClasses.delete(c) } }),
  };
  HomePortal.init(doc, win);
  let prevented = false;
  handlers.find(([t]) => t === 'click')[1]({ button: 0, preventDefault: () => { prevented = true; } });
  assert.ok(prevented);
  assert.equal(appended.length, 1);
  assert.ok(veilClasses.has('is-on'));
  assert.equal(timers[0][1], HomePortal.FADE_MS);
  timers[0][0]();
  assert.equal(win.location.href, '/sayanmramor-site/showroom.html');
  // The module stays (until the clean-up step), but the static home page no longer loads it.
  assert.ok(!homeHtml().includes('home-portal.js'));
  assert.ok(!fs.existsSync(path.join(site, 'js', 'home-directions.js')));
});

// ---- Header: one row, «Изделия» panel with the 13 directions in five groups ----------

const NAV_START = '<nav class="site-nav"';
const navOf = html => html.slice(html.indexOf(NAV_START), html.indexOf('</nav>'));
const DIRECTIONS = {
  'Лестницы': 'categories/lestnitsy.html', 'Ступени': 'categories/stupeni.html',
  'Полы': 'categories/poly.html', 'Стены': 'categories/steny.html', 'Панно': 'categories/panno.html',
  'Подоконники': 'categories/podokonniki.html', 'Камины': 'categories/kaminy.html',
  'Кухня': 'categories/stoleshnitsy-kuhnya.html', 'Ванная': 'categories/stoleshnitsy-vannaya.html',
  'Фасады': 'categories/fasady.html',
  'Спа зоны': 'categories/spa-zony.html', 'Хаммамы': 'categories/hammamy.html', 'Бассейны': 'categories/basseyny.html',
};
const GROUPS = [
  ['Лестницы и ступени', ['Лестницы', 'Ступени']],
  ['Пространство', ['Полы', 'Стены', 'Панно', 'Подоконники', 'Камины']],
  ['Кухня и ванная', ['Кухня', 'Ванная']],
  ['Фасады', ['Фасады']],
  ['Спа и бассейны', ['Спа зоны', 'Хаммамы', 'Бассейны']],
];
// One header on every page but the showroom: the home page has the same header as the other 15.
const headerPages = pages.filter(p => p !== 'showroom.html').concat(['privacy.html']);

test('every page: the header is «Изделия» (a panel with all 13 directions in five groups), Готовые изделия, Шоурум (a panel: the house, the way in, its rooms), Контакты', () => {
  headerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const nav = navOf(html);
    const panel = nav.slice(nav.indexOf('<details class="nav-drop nav-products">'), nav.indexOf('</details>'));
    assert.ok(panel.includes('<summary'), page);
    const groups = [...panel.matchAll(/<div class="nav-group">\s*<p class="nav-group-title">([^<]+)<\/p>([\s\S]*?)<\/ul>/g)]
      .map(m => [m[1], [...m[2].matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(a => [a[2], a[1]])]);
    assert.deepEqual(groups, GROUPS.map(([title, names]) => [title, names.map(n => [n, '/sayanmramor-site/' + DIRECTIONS[n]])]), page);
    // The places in order: the products' panel, the ready-made pieces, the showroom's panel, the contacts.
    const places = [...nav.matchAll(/\n      (?:<details class="([^"]+)">\s*<summary[^>]*>([^<]+)<\/summary>|<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>)/g)]
      .map(m => (m[1] ? ['details:' + m[1], m[2]] : ['a:' + m[3], m[4]]));
    assert.deepEqual(places, [
      ['details:nav-drop nav-products', 'Изделия'],
      ['a:/sayanmramor-site/katalog.html', 'Готовые изделия'],
      ['details:nav-drop nav-showroom', 'Шоурум'],
      ['a:/sayanmramor-site/index.html#contacts', 'Контакты'],
    ], page);
    const showroom = nav.slice(nav.indexOf('<details class="nav-drop nav-showroom">'));
    assert.match(showroom, /<a class="nav-showroom-house" href="\/sayanmramor-site\/showroom\.html" tabindex="-1" aria-hidden="true"><img src="\/sayanmramor-site\/assets\/home\/showroom-house-640\.webp"[^>]*alt="" width="640" height="400" loading="lazy"/, page);
    assert.match(showroom, /<p class="nav-showroom-title">Дом из натурального камня<\/p>/, page);
    assert.match(showroom, /<a class="btn btn-primary nav-showroom-enter" href="\/sayanmramor-site\/showroom\.html">Открыть шоурум<\/a>/, page);
    const rooms = [...showroom.matchAll(/<li><a href="\/sayanmramor-site\/showroom\.html#(\w+)">([^<]+)<\/a><\/li>/g)].map(m => [m[1], m[2]]);
    assert.deepEqual(rooms, [['hall', 'Холл'], ['living', 'Гостиная'], ['kitchen', 'Кухня'], ['staircase', 'Лестница'], ['bathroom', 'Ванная']], page);
  });
  ['showroom-house-640.webp', 'showroom-house-1600.webp'].forEach(f => assert.ok(fs.existsSync(path.join(site, 'assets', 'home', f)), f));
});

test('the page\'s own direction is marked active (and aria-current) in the panel, and «Изделия» is marked too; «Готовые изделия» is its own item', () => {
  headerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const nav = navOf(html);
    const active = [...nav.matchAll(/<a class="active" href="([^"]+)" aria-current="page">([^<]+)<\/a>/g)].map(m => m[1]);
    const isDirection = page.startsWith('categories/');
    assert.deepEqual(active, isDirection ? ['/sayanmramor-site/' + page] : page === 'katalog.html' ? ['/sayanmramor-site/katalog.html'] : [], page);
    assert.equal(nav.includes('<summary class="active">Изделия</summary>'), isDirection, page);
    assert.equal((nav.match(/aria-current/g) || []).length, active.length, page);
  });
});

test('every page: the header button keeps its full name, with «изделие» as the tail hidden on very narrow screens; one menu button', () => {
  headerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.ok(html.includes('<a class="btn btn-primary site-header-cta" href="/calculator/sayanmramor-calculator.html" aria-label="Создать изделие"><span>Создать<span class="site-header-cta-tail"> изделие</span></span></a>'), page);
    assert.equal((html.match(/<button class="nav-toggle" type="button" aria-controls="siteNav" aria-expanded="false" aria-label="Меню">/g) || []).length, 1, page);
    assert.ok(html.includes('id="siteNav"'), page);
  });
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  // On a phone the capsule holds the name and the menu button; «Создать изделие» waits inside the open menu, full width.
  assert.match(css, /\.js \.site-header-cta \{ display: none; \}/);
  assert.match(css, /\.js \.site-header\.menu-open \.site-header-cta \{ order: 4; display: inline-flex;/);
});

test('every page: «Заказать» beside «Создать изделие» -- to the request form on the page where it has one, else to the home page\'s; at the open menu\'s foot on a phone, and the menu closes on it', () => {
  headerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const href = html.includes('id="offer"') ? '#offer' : '/sayanmramor-site/index.html#offer';
    assert.ok(html.includes('<div class="site-header-actions"><a class="btn btn-secondary site-header-order" href="' + href + '">Заказать</a><a class="btn btn-primary site-header-cta"'), page);
  });
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.match(css, /\.js \.site-header-actions \{ display: none; \}/);
  assert.match(css, /\.js \.site-header\.menu-open \.site-header-actions \{ order: 4; display: flex;/);
  const js = fs.readFileSync(path.join(site, 'js', 'header.js'), 'utf8');
  assert.match(js, /closest\('\.site-nav a, \.site-header-actions a'\)/);
});

test('header.js is loaded deferred on every header page; the «js» flag is set before the stylesheet', () => {
  headerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.equal((html.match(/<script src="\/sayanmramor-site\/js\/header\.js" defer><\/script>/g) || []).length, 1, page);
    const flag = html.indexOf("document.documentElement.classList.add('js')");
    assert.ok(flag > 0 && flag < html.indexOf('<link rel="stylesheet"'), page);
  });
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.ok(css.includes('@media (max-width: 1000px)'));
  assert.ok(css.includes('html.menu-lock'));
  assert.equal(SiteHeader.MOBILE_QUERY, '(max-width: 1000px)');
});

// A minimal DOM: just what header.js touches.
function fakeHeaderDom(mobile) {
  const doc = { activeElement: null, listeners: {} };
  function el(name, extra) {
    const classes = new Set();
    const attrs = {};
    return Object.assign({
      name, attrs, listeners: {},
      classList: {
        contains: c => classes.has(c),
        toggle(c, on) { const v = on === undefined ? !classes.has(c) : on; if (v) classes.add(c); else classes.delete(c); return v; },
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      removeAttribute(k) { delete attrs[k]; },
      addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      focus() { doc.activeElement = this; },
    }, extra);
  }
  const summary = el('summary');
  const link = el('a', { closest: sel => (sel.split(', ').includes('.site-nav a') ? link : null) });
  const outside = el('outside', { closest: () => null });
  const toggle = el('toggle');
  const products = el('products', { open: false });
  products.contains = x => x === products || x === summary || x === link;
  products.querySelector = sel => (sel === 'summary' ? summary : null);
  const header = el('header', {
    querySelector: sel => ({ '.nav-toggle': toggle, '.nav-group a': link })[sel] || null,
    querySelectorAll: sel => (sel === '.nav-drop' ? [products] : []),
  });
  const rootEl = el('html');
  const mq = { matches: !!mobile, listeners: [], addEventListener(t, fn) { this.listeners.push(fn); } };
  Object.assign(doc, {
    documentElement: rootEl,
    querySelector: sel => (sel === '.site-header' ? header : null),
    addEventListener(type, fn) { (doc.listeners[type] = doc.listeners[type] || []).push(fn); },
  });
  const win = { matchMedia: () => mq };
  // An event goes to its target, then up through the header (if the target is inside it) to the document.
  const inHeader = t => [products, summary, link, toggle].includes(t);
  const fire = (target, type, e) => {
    const ev = Object.assign({ type, target, preventDefault() { this.prevented = true; } }, e);
    (target.listeners[type] || []).forEach(fn => fn(ev));
    if (target === summary) (products.listeners[type] || []).forEach(fn => fn(ev));
    if (inHeader(target)) (header.listeners[type] || []).forEach(fn => fn(ev));
    if (type !== 'focusout') (doc.listeners[type] || []).forEach(fn => fn(ev));
    return ev;
  };
  return { doc, win, header, products, summary, link, outside, toggle, rootEl, mq, fire };
}

test('header.js, wide screen: Esc, a click outside and focus leaving close the «Изделия» panel; Esc returns focus to it', () => {
  const d = fakeHeaderDom(false);
  SiteHeader.init(d.doc, d.win);
  d.products.open = true;
  d.fire(d.doc, 'keydown', { key: 'Escape' });
  assert.equal(d.products.open, false);
  assert.equal(d.doc.activeElement, d.summary);
  d.products.open = true;
  d.fire(d.outside, 'click');
  assert.equal(d.products.open, false);
  d.products.open = true;
  d.fire(d.link, 'click');                         // inside: stays (the browser navigates)
  assert.equal(d.products.open, true);
  d.fire(d.products, 'focusout', { relatedTarget: d.outside });
  assert.equal(d.products.open, false);
  const ev = d.fire(d.summary, 'click');
  assert.ok(!ev.prevented, 'on a wide screen the summary toggles natively');
});

test('header.js, mobile: the button opens the menu with the products listed, locks the page scroll, Esc / a link / a wider window close it', () => {
  const d = fakeHeaderDom(true);
  SiteHeader.init(d.doc, d.win);
  assert.equal(d.summary.attrs.tabindex, '-1');
  assert.ok(d.fire(d.summary, 'click').prevented, 'the heading does not toggle');
  d.fire(d.toggle, 'click');
  assert.ok(d.header.classList.contains('menu-open'));
  assert.ok(d.rootEl.classList.contains('menu-lock'));
  assert.equal(d.toggle.attrs['aria-expanded'], 'true');
  assert.equal(d.toggle.attrs['aria-label'], 'Закрыть меню');
  assert.equal(d.products.open, true);
  d.fire(d.doc, 'keydown', { key: 'Escape' });
  assert.ok(!d.header.classList.contains('menu-open') && !d.rootEl.classList.contains('menu-lock'));
  assert.equal(d.toggle.attrs['aria-expanded'], 'false');
  assert.equal(d.products.open, false);
  assert.equal(d.doc.activeElement, d.toggle);
  d.fire(d.toggle, 'click');
  d.fire(d.link, 'click');
  assert.ok(!d.header.classList.contains('menu-open'), 'following a link closes the menu');
  d.fire(d.toggle, 'click');
  d.mq.matches = false;
  d.mq.listeners.forEach(fn => fn());
  assert.ok(!d.header.classList.contains('menu-open') && !d.rootEl.classList.contains('menu-lock'), 'back to a wide screen: the menu is closed');
  assert.equal(d.summary.attrs.tabindex, undefined);
});

test('header.js, wide screen: a panel folds up before it closes (caught while folding, it stays); opening one folds the other away; no fold under reduced motion', () => {
  const timers = [];
  const listen = o => Object.assign(o, { listeners: {}, addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); } });
  function makeDrop(name) {
    const classes = new Set();
    const panel = listen({});
    const summary = listen({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, focus() {} });
    const drop = listen({
      name, open: false, panel, summary,
      classList: { contains: c => classes.has(c), toggle(c, on) { if (on) classes.add(c); else classes.delete(c); } },
      querySelector: sel => (sel === 'summary' ? summary : sel === '.nav-panel' ? panel : null),
      contains: x => x === drop || x === summary || x === panel,
    });
    return drop;
  }
  const products = makeDrop('products'), showroom = makeDrop('showroom');
  const header = listen({ classList: { contains: () => false, toggle() {} }, querySelector: () => null,
    querySelectorAll: sel => (sel === '.nav-drop' ? [products, showroom] : []) });
  const doc = listen({ documentElement: { classList: { toggle() {} } }, querySelector: sel => (sel === '.site-header' ? header : null) });
  let reduce = false;
  const win = {
    matchMedia: q => ({ matches: q === SiteHeader.REDUCED_QUERY ? reduce : false, addEventListener() {} }),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: id => { if (timers[id - 1]) timers[id - 1].fn = () => {}; },
  };
  SiteHeader.init(doc, win);
  const click = drop => { const ev = { prevented: false, preventDefault() { this.prevented = true; } }; drop.summary.listeners.click.forEach(fn => fn(ev)); return ev; };
  const esc = () => doc.listeners.keydown.forEach(fn => fn({ key: 'Escape' }));

  products.open = true;
  esc();
  assert.ok(products.classList.contains('is-closing') && products.open, 'folding: still open, marked');
  products.panel.listeners.animationend.forEach(fn => fn());
  assert.ok(!products.open && !products.classList.contains('is-closing'), 'the fold ends: closed');

  products.open = true;
  assert.ok(click(products).prevented, 'its own name closes it -- by folding, not natively');
  assert.ok(products.classList.contains('is-closing'));
  assert.ok(click(products).prevented, 'caught while folding');
  assert.ok(products.open && !products.classList.contains('is-closing'), 'it stays open');
  timers[timers.length - 1].fn();
  assert.ok(products.open, 'the cancelled fold does not close it later');

  assert.ok(!click(showroom).prevented, 'a closed panel opens natively');
  assert.ok(products.classList.contains('is-closing'), 'and the other one folds away');
  assert.equal(timers[timers.length - 1].ms, SiteHeader.FOLD_MS);
  timers[timers.length - 1].fn();
  assert.equal(products.open, false);

  reduce = true;
  showroom.open = true;
  esc();
  assert.ok(!showroom.open && !showroom.classList.contains('is-closing'), 'reduced motion: closed at once');
});

test('the header points only at what exists: «Контакты» lands on the home page contacts; no «Камень» / «Производство» items or sections', () => {
  const home = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.equal((home.match(/id="contacts"/g) || []).length, 1);
  assert.doesNotMatch(home, /id="stone"|id="production"/);
  headerPages.forEach(page => {
    const nav = navOf(fs.readFileSync(path.join(site, page), 'utf8'));
    assert.doesNotMatch(nav, />Камень<|>Производство<|#stone|#production/, page);
  });
});

test('the header is a floating capsule: sticky, never full width, fully rounded, a little translucent over a soft blur (solid where blur is missing), a hairline edge; it opens downward into the menu on a phone', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.doesNotMatch(css, /nav-fade|nav-edges/);
  const header = css.slice(css.indexOf('/* ---- Header: the capsule'), css.indexOf('/* ---- Home (static)'));
  const start = header.indexOf('\n.site-header {');
  const rule = header.slice(start, header.indexOf('}', start));
  assert.match(rule, /position: sticky; top: 12px;/);
  assert.match(rule, /width: min\(1120px, calc\(100% - 2 \* var\(--gutter\)\)\); margin: 12px auto 0;/);
  assert.match(rule, /border-radius: 999px;/);
  assert.match(rule, /--capsule-bg: rgba\(248, 247, 244, 0\.8\);/);
  assert.match(rule, /backdrop-filter: blur\(18px\) saturate\(1\.2\);/);
  assert.match(header, /@supports not \(\(-webkit-backdrop-filter: blur\(1px\)\) or \(backdrop-filter: blur\(1px\)\)\) \{\s*\.site-header \{ --capsule-bg: rgba\(248, 247, 244, 0\.97\); \}/);
  assert.doesNotMatch(header, /position: fixed/);
  // The places stand on the capsule's middle; the action is a pill set into its curve.
  assert.match(header, /grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\);/);
  assert.match(header, /\.site-header-cta \{\s*grid-column: 3; justify-self: end;[^}]*border-radius: 999px;/);
  // Open on a phone: only the list scrolls; the name, the close button and the action stay in view.
  assert.match(header, /\.js \.site-header\.menu-open \.site-nav \{[^}]*overflow-y: auto;/);
  // The brand's own letters belong to the name in the header alone (a hook; no font is shipped yet).
  assert.match(header, /\.site-header \.site-logo \{[^}]*font-family: var\(--font-brand, var\(--font\)\);/);
  assert.equal((css.match(/var\(--font-brand/g) || []).length, 1, 'used by that one rule only');
});

// ---- Typography: the site's own -------------------------------------------------------

test('typography: Montserrat for text, Unbounded for h1 / h2 and the name -- local files (no CDN, no preload), each with its licence; the showroom reads both, as the site', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.match(css, /--font: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif;/);
  assert.match(css, /--font-display: 'Unbounded', 'Montserrat', Arial, sans-serif;/);
  assert.match(css, /--font-brand: var\(--font-display\);/);
  assert.match(css, /\nh1, h2 \{ font-family: var\(--font-display\); font-weight: 600;/);
  const sr = fs.readFileSync(path.join(site, 'css', 'showroom.css'), 'utf8');
  assert.match(sr, /font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif;/);
  assert.equal((sr.match(/@font-face \{ font-family: 'Montserrat';[^}]*url\(\.\.\/assets\/fonts\/montserrat-[a-z-]+-wght-normal\.woff2\)/g) || []).length, 3);
  assert.equal((sr.match(/@font-face \{ font-family: 'Unbounded';[^}]*url\(\.\.\/assets\/fonts\/unbounded-[a-z-]+-wght-normal\.woff2\)/g) || []).length, 2);
  ['.sr-logo', '.sr-caption-title', '.sr-panel-title', '.sr-fallback-title'].forEach(sel =>
    assert.match(sr, new RegExp('\\n\\' + sel + ' \\{[^}]*font-family: var\\(--sr-font-display\\);'), sel + ': the name and the titles in Unbounded (2026-10-10)'));
  const faces = [...css.matchAll(/@font-face \{ font-family: '([^']+)';[^}]*src: url\(\.\.\/assets\/fonts\/([^)]+\.woff2)\) format\('woff2-variations'\); unicode-range: [^;]+; \}/g)];
  assert.equal(faces.length, (css.match(/@font-face/g) || []).length, 'every face a local woff2 with its unicode-range');
  assert.deepEqual([...new Set(faces.map(f => f[1]))], ['Montserrat', 'Unbounded']);
  faces.forEach(([, , file]) => assert.ok(fs.existsSync(path.join(site, 'assets', 'fonts', file)), file));
  ['montserrat', 'unbounded'].forEach(f => assert.ok(fs.existsSync(path.join(site, 'assets', 'fonts', 'LICENSE-' + f + '.txt')), f));
  assert.doesNotMatch(css, /Golos|Source Serif|fonts\.googleapis|fonts\.gstatic/);
  headerPages.concat(['showroom.html', 'index.html']).forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.doesNotMatch(html, /\.woff2|rel="preload" [^>]*as="font"|fonts\.googleapis|fonts\.gstatic/, page);
  });
});

test('header: the places are soft pills in the capsule -- the current one and the pointed one a faint fill, the keyboard ring the same shape; no line, no springs; the «Изделия» panel unfolds downward', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const header = css.slice(css.indexOf('/* ---- Header: the capsule'), css.indexOf('/* ---- Home (static)'));
  assert.match(header, /\.site-nav > a, \.nav-drop > summary \{[^}]*height: 36px; padding: 0 14px; border-radius: 999px;[^}]*transition: color 0\.15s, background-color 0\.15s;/);
  assert.match(header, /\.site-nav > a\.active, \.nav-drop > summary\.active \{ color: var\(--ink\); background: rgba\(28, 29, 27, 0\.06\); \}/);
  assert.match(header, /@media \(hover: hover\) \{ \.site-nav > a:hover, \.nav-drop > summary:hover \{[^}]*background: rgba\(28, 29, 27, 0\.05\); \} \}/);
  assert.match(header, /\.nav-indicator \{ display: none; \}/, 'header.js may place its line; the capsule does not show it');
  const wide = css.slice(css.indexOf('@media (min-width: 1001px) {'), css.indexOf('@keyframes nav-panel-unfold'));
  assert.ok(wide.includes('.nav-drop[open] > .nav-panel { animation: nav-panel-unfold 0.22s var(--ease); }'));
  assert.ok(wide.includes('.nav-drop.is-closing > .nav-panel { animation: nav-panel-fold 0.18s var(--ease) forwards; pointer-events: none; }'), 'and folds back up when it closes');
  assert.match(css, /@keyframes nav-panel-unfold \{\s*from \{ clip-path: inset\(0 0 100% 0 round 24px\); \}/);
  assert.match(css, /@keyframes nav-panel-fold \{\s*from \{ clip-path: inset\(0 0 0 0 round 24px\);[^}]*\}\s*to \{ clip-path: inset\(0 0 100% 0 round 24px\);/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.nav-drop\[open\] > \.nav-panel, \.nav-drop\.is-closing > \.nav-panel \{ animation: none; \}/);
  assert.doesNotMatch(css, /nav-group:nth-child\(\d\) \{[^}]*animation-delay/);
});

test('header.js: the line rests under the current section, follows the pointer and the focus, and comes back', () => {
  const listeners = {};
  const on = owner => (type, fn) => { (listeners[owner + ':' + type] = listeners[owner + ':' + type] || []).push(fn); };
  const rect = (left, width) => ({ left, width, getBoundingClientRect: () => ({ left, width }) });
  const classes = () => { const set = new Set(); return { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c) }; };
  const summary = Object.assign(rect(400, 80), { classList: classes(), addEventListener: on('summary') });
  summary.classList.add('active');
  const contacts = Object.assign(rect(700, 70), { classList: classes(), addEventListener: on('contacts') });
  const bar = { className: '', style: {}, classList: classes(), setAttribute() {} };
  const box = rect(100, 1000);
  const nav = {
    parentNode: box, appended: null,
    querySelectorAll: () => [summary, contacts],
    appendChild(el) { this.appended = el; },
    contains: el => el === summary || el === contacts,
    addEventListener: on('nav'),
  };
  const header = { querySelector: sel => (sel === '.site-nav' ? nav : null) };
  const doc = { createElement: () => bar };
  const win = { addEventListener() {}, requestAnimationFrame: f => f() };
  const ind = SiteHeader.initIndicator(doc, win, header, { matches: false });
  assert.equal(nav.appended, bar);
  assert.equal(bar.className, 'nav-indicator');
  assert.equal(bar.style.transform, 'translateX(300px) scaleX(80)', 'rests under the current section');
  assert.ok(bar.classList.contains('is-on') && bar.classList.contains('is-ready'));
  listeners['contacts:mouseenter'][0]();
  assert.equal(bar.style.transform, 'translateX(600px) scaleX(70)', 'travels to the item under the pointer');
  listeners['nav:mouseleave'][0]();
  assert.equal(bar.style.transform, 'translateX(300px) scaleX(80)', 'comes back when the pointer leaves the row');
  listeners['contacts:focus'][0]();
  assert.equal(bar.style.transform, 'translateX(600px) scaleX(70)', 'and follows the keyboard focus');
  // On the home page (no current section) it is hidden at rest; on a narrow screen it is never shown.
  summary.classList.remove('active');
  const home = SiteHeader.initIndicator(doc, win, header, { matches: false });
  assert.ok(!bar.classList.contains('is-on'));
  ind.show(contacts);
  const narrow = SiteHeader.initIndicator(doc, win, header, { matches: true });
  narrow.show(contacts);
  assert.ok(!bar.classList.contains('is-on'));
  assert.ok(home);
});

// ---- Коммерческое предложение -------------------------------------------------------

test('the offer band on the 13 direction pages: the home page\'s «Получить расчёт» -- the master\'s photo, «Проект», the heading, the phone and Telegram, the questions starting at the name, the <noscript> fallback (2026-10-10)', () => {
  const offerPages = fs.readdirSync(path.join(site, 'categories')).map(f => 'categories/' + f);
  offerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const band = html.slice(html.indexOf('<section class="offer-band'), html.indexOf('</section>', html.indexOf('<section class="offer-band')));
    assert.match(band, /<img class="offer-talk-photo" src="\/sayanmramor-site\/assets\/home\/offer-master-040-480\.webp"/, page);
    assert.match(band, /<p class="offer-kicker">Проект<\/p>/, page);
    assert.match(band, /<h2 class="offer-title" id="offerTitle">Получить расчёт <span class="offer-title-soft">по вашему проекту<\/span><\/h2>/, page);
    assert.match(band, /<p class="offer-lead">Мастер задаст пару коротких вопросов - этого хватит, чтобы подготовить расчёт\. Без длинных анкет\.<\/p>/, page + ': the direction is known, so two questions are left');
    assert.match(band, /<div class="offer-contact">\s*<p class="offer-phone">Или позвоните: <a href="tel:\+74952155145">\+7 \(495\) 215-51-45<\/a><\/p>\s*<p class="offer-phone offer-tg">Или напишите в Telegram: <a href="https:\/\/t\.me\/TeaN_SayanMramor" target="_blank" rel="noopener">@TeaN_SayanMramor<\/a><\/p>\s*<\/div>/, page + ': Telegram under the phone');
    assert.match(band, /<div class="offer-talk-main">\s*<div data-offer-form data-offer-steps data-preselect="[a-z-]+"><\/div>\s*<noscript><p class="offer-noscript">/, page);
    assert.doesNotMatch(band, /offer-reveal|offer-needs|Получите коммерческое предложение/, page + ': no trace of the old form');
  });
});

test('the offer form: fields in the order they are filled in, written lines (label over an underline), no frame or cells; the heading becomes the button; the form unfolds in place (no dialog)', () => {
  const OfferForm = require('../js/offer-form.js');
  assert.deepEqual(OfferForm.FIELDS, ['Направление', 'Имя', 'Телефон', 'Техническое задание']);
  assert.equal(typeof OfferForm.enhanceBand, 'function');
  const src = fs.readFileSync(path.join(site, 'js', 'offer-form.js'), 'utf8');
  assert.ok(src.indexOf("field(doc, id('direction'), FIELDS[0]") < src.indexOf("field(doc, id('name'), FIELDS[1]"));
  assert.ok(src.indexOf("field(doc, id('name'), FIELDS[1]") < src.indexOf("field(doc, id('phone'), FIELDS[2]"));
  assert.match(src, /'aria-expanded': 'false'/);
  assert.match(src, /first\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(src, /<dialog|showModal|window\.open/);
  // The sending is unchanged: no request leaves the page, the message says so.
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon/);
  assert.match(OfferForm.NOT_SENT, /Заявки с сайта пока не отправляются/);
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.match(css, /\.offer-band\.is-collapsible \.offer-reveal \{[^}]*grid-template-rows: 0fr; visibility: hidden;/);
  assert.match(css, /\.offer-band\.is-open \.offer-reveal \{[^}]*grid-template-rows: 1fr; visibility: visible;/);
  const band = css.slice(css.indexOf('/* ---- Коммерческое предложение'), css.indexOf('.offer-consent {'));
  assert.doesNotMatch(band, /gradient|backdrop-filter|box-shadow: 0 \d+px \d+px/);
  // Open, the form is a few written lines: two abreast, each an underline, no frame, no cells.
  const rule = sel => { const i = css.indexOf('\n' + sel + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  assert.match(rule('.offer-form'), /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.doesNotMatch(rule('.offer-form'), /border|background/);
  assert.doesNotMatch(rule('.offer-field'), /border|background/);
  assert.match(rule('.offer-input'), /border: 0; border-bottom: 1px solid var\(--line-control\);/);
  assert.match(rule('.offer-file'), /border-bottom: 1px solid var\(--line-control\);/);
  assert.doesNotMatch(css, /\.offer-field::(before|after)|counter\(offer-field/);
  assert.match(rule('.offer-consent'), /grid-column: 1 \/ -1;/);
  assert.match(rule('.offer-submit'), /grid-column: 1 \/ -1; justify-self: start;/);
  const phone = css.slice(css.indexOf('@media (max-width: 600px) {'));
  assert.match(phone, /\.offer-form \{ grid-template-columns: 1fr; \}/, 'one line per field on a phone');
});

test('the request stands open (data-offer-open) on the home page and on every direction page: no toggle, the questions in view', () => {
  const OfferForm = require('../js/offer-form.js');
  const home = homeHtml();
  assert.match(home, /<section class="offer-band offer-talk" id="offer" aria-labelledby="offerTitle" data-offer-open>/);
  fs.readdirSync(path.join(site, 'categories')).forEach(f => {
    const html = fs.readFileSync(path.join(site, 'categories', f), 'utf8');
    assert.match(html, /<section class="offer-band offer-talk" id="offer" aria-labelledby="offerTitle" data-offer-open>/, f);
  });
  const fakeBand = open => {
    const classes = new Set();
    const title = { querySelector: () => null, firstChild: null, appendChild() {} };
    const band = { hasAttribute: a => a === 'data-offer-open' && open, querySelector: s => (s === '.offer-title' ? title : s === '.offer-reveal' ? reveal : null), classList: { add: c => classes.add(c) } };
    const reveal = { id: '' };
    const doc = { createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {} }) };
    const container = { ownerDocument: doc, closest: () => band };
    return { container, classes };
  };
  const opened = fakeBand(true);
  assert.equal(OfferForm.enhanceBand(opened.container, {}, 1), null);
  assert.equal(opened.classes.size, 0, 'the open band is not made collapsible');
  const folded = fakeBand(false);
  assert.ok(OfferForm.enhanceBand(folded.container, {}, 2), 'a band without data-offer-open still gets its toggle');
  assert.ok(folded.classes.has('is-collapsible'));
  // Only the home page's band is laid out anew (a project sheet, below); every rule of it is scoped to the home page.
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const sheet = css.slice(css.indexOf('/* The request, the home page'), css.indexOf('/* Narrower screens: the same scenes'));
  assert.ok(sheet.length > 0);
  [...sheet.matchAll(/^(\.[^{]+)\{/gm)].map(m => m[1]).forEach(sel => {
    sel.split(',').forEach(s => assert.match(s.trim(), /^\.home-main |^\.offer-drawing|^\.drawing-|^\.is-named /, s.trim() + ': the home page only'));
  });
});

test('home-request.js: the chosen direction names the piece on the drawing and draws it solid; «Без направления» gives back «Ваше изделие» and the dashes', () => {
  const HomeRequest = require('../js/home-request.js');
  const select = (value, text) => ({ selectedIndex: 0, options: [{ value, textContent: text }] });
  assert.equal(HomeRequest.label(select('', 'Без направления')), 'Ваше изделие');
  assert.equal(HomeRequest.label(select('kuhnya', 'Кухня')), 'Кухня');
  assert.equal(HomeRequest.label(null), 'Ваше изделие');
  const classes = new Set(); let onChange = null;
  const note = { textContent: '' };
  const drawing = { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } };
  const band = {
    querySelector: s => (s === '[data-piece-name]' ? note : s === '.offer-drawing' ? drawing : null),
    addEventListener: (t, f) => { if (t === 'change') onChange = f; },
  };
  const api = HomeRequest.init({ querySelector: s => (s === '.home-main .offer-band' ? band : null) });
  assert.ok(api);
  assert.equal(note.textContent, 'Ваше изделие', 'no form yet: the piece unnamed');
  onChange({ target: Object.assign(select('hammamy', 'Хаммамы'), { name: 'direction' }) });
  assert.equal(note.textContent, 'Хаммамы'); assert.ok(classes.has('is-named'));
  onChange({ target: Object.assign(select('x', 'Иван'), { name: 'name' }) });
  assert.equal(note.textContent, 'Хаммамы', 'other fields leave the drawing as it is');
  onChange({ target: Object.assign(select('', 'Без направления'), { name: 'direction' }) });
  assert.equal(note.textContent, 'Ваше изделие'); assert.ok(!classes.has('is-named'));
  assert.equal(HomeRequest.init({ querySelector: () => null }), null);
  // The hints in the two empty entry cells: short, neutral, only a placeholder, never over one already there.
  assert.deepEqual(HomeRequest.HINTS, { name: 'Ваше имя', phone: '+7' });
  const inputs = { name: { attrs: {} }, phone: { attrs: { placeholder: 'свой' } } };
  Object.values(inputs).forEach(i => { i.getAttribute = a => i.attrs[a] || null; i.setAttribute = (a, v) => { i.attrs[a] = v; }; });
  HomeRequest.hint({ querySelector: s => inputs[(s.match(/name="([^"]+)"/) || [])[1]] || null });
  assert.equal(inputs.name.attrs.placeholder, 'Ваше имя');
  assert.equal(inputs.phone.attrs.placeholder, 'свой');
  assert.ok(!('value' in inputs.name.attrs) && !('required' in inputs.name.attrs), 'nothing but the hint');
  HomeRequest.hint(null);
  const src = fs.readFileSync(path.join(site, 'js', 'home-request.js'), 'utf8');
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon|submit/, 'it never sends nor submits anything');
});

test('the home page\'s desktop grid (1024 px and wider): 12 columns between margins of 5 %, content at most 1440 px, a wide field for the objects; one 5 / 7 vertical; narrower screens untouched', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const start = css.indexOf('@media (min-width: 1024px) {\n  .mast, .home-main');
  assert.ok(start > 0, 'one desktop block for the home page');
  const block = css.slice(start, css.indexOf('\n}\n', start));
  // The three fields.
  assert.match(block, /\.mast, \.home-main, \.home-main ~ \.site-footer \{\s*--margin: clamp\(24px, 5vw, 120px\);\s*--content: min\(calc\(100vw - 2 \* var\(--margin\)\), 1440px\);\s*--wide: min\(calc\(100vw - var\(--margin\)\), 1760px\);/);
  assert.match(block, /\.mast-inner, \.home-main \.wrap, \.home-main \.offer-band-inner,\s*\.home-main ~ \.site-footer \.site-footer-inner, \.home-main ~ \.site-footer \.site-footer-bottom \{\s*max-width: calc\(1440px \+ 2 \* var\(--margin\)\); padding-left: var\(--margin\); padding-right: var\(--margin\);/);
  // One vertical: the second column starts at the sixth -- the hero's words, the passage, the request, where we are.
  assert.match(block, /\.hero-title \{ grid-column: 1 \/ 6;[^}]*font-size: max\(28px, calc\(var\(--mark-fs\) \* 0\.37\)\); \}/);
  assert.match(block, /\.hero-side \{ grid-column: 6 \/ 13; \}/);
  assert.match(block, /\.ready-text \{ grid-column: 6 \/ 11; \}/);
  // The request's sheet keeps the vertical: its heading and phone in the first five columns, its drawing and title block from the sixth.
  assert.match(block, /\.home-main \.offer-title \{ grid-column: 1 \/ 6;/);
  assert.match(block, /\.home-main \.offer-meta \{ grid-column: 1 \/ 6;/);
  assert.match(block, /\.home-main \.offer-reveal, \.home-main \.offer-noscript \{ grid-column: 6 \/ 13;/);
  assert.match(block, /\.contacts-head, \.contacts-card \{ grid-column: 1 \/ 6; \}\s*\.contacts-map-frame \{ grid-column: 6 \/ 13; width: 100%; min-height: 360px; aspect-ratio: 16 \/ 10; \}/, 'the map\'s height from its width');
  // The objects in the wide field: the slab (as tall as the screen allows), the house to the right.
  assert.match(block, /\[data-mode="scrub"\] \.hero-stage \{ --fw: min\(var\(--wide\), 1320px, calc\(\(100svh - var\(--mast-h, 64px\) - var\(--band\) - 28px\) \* var\(--slab-ratio\)\)\); \}/);
  assert.match(block, /\[data-mode="scrub"\] \.hero-scene \{ perspective: max\(1800px, calc\(var\(--fw\) \* 1\.5385\)\); \}/, 'a larger slab: the same scene, larger');
  assert.match(block, /\.portal-text \{ grid-column: 1 \/ 5; \}\s*\.portal-house \{ grid-column: 5 \/ 13; margin-right: calc\(var\(--bleed\) \* -1\); \}/, 'the showroom keeps its 4 / 8');
  // What can be ordered: the title in five columns, its line on the vertical; the wall in the wide field.
  assert.match(block, /\.wall-title \{ grid-column: 1 \/ 6; \}\s*\.wall-lead \{ grid-column: 6 \/ 12; margin-top: 0; \}/);
  assert.match(block, /\.wall \{ max-width: var\(--wide\); padding: 0; \}/);
  // One material language for the opening scenes: the second stone. The arrow is the site's one arrow.
  assert.match(block, /\.night-hero, \.home-directions \{\s*--stone-2: #e3ded5;\s*\}/);
  assert.match(css, /\n  --arrow: url\([^)]*stroke-width='2' stroke-linecap='square'/, 'one arrow for the whole site: 2 px, square ends');
  assert.equal((css.match(/--arrow: url\(/g) || []).length, 1, 'declared once');
  // The hero's caption band back in the content's field (its centring was reset by margin: 0).
  assert.match(css, /\[data-mode="scrub"\] \.hero-story \{\s*position: absolute; top: calc\(var\(--frame-top\) - var\(--band\) \+ 26px\); left: 0; right: 0; z-index: 3; margin: 0 auto;/);
  // Only the home page: the shared footer and container keep their measure; nothing below 1024 px changes.
  assert.match(css, /\n\.site-footer-inner, \.site-footer-bottom \{ max-width: var\(--measure\);/);
  assert.match(css, /\n\.wrap \{ width: 100%; max-width: var\(--measure\);/);
  assert.doesNotMatch(block, /@media \(max-width/);
});

test('«Где мы находимся»: one limestone plane, no cards -- the address column on the left, the map on the right in a plain 1 px frame, the verde pin kept', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const rule = sel => { const i = css.indexOf('\n' + sel + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  assert.match(rule('.home-contacts'), /grid-template-columns: minmax\(0, 4fr\) minmax\(0, 7fr\);/);
  assert.doesNotMatch(rule('.contacts-card'), /background|border|radius|shadow/, 'the address column is not a card');
  assert.match(rule('.contacts-map-frame'), /border: 1px solid var\(--line-strong\);/);
  assert.doesNotMatch(rule('.contacts-map-frame'), /border-radius/, 'the map is a plain rectangle');
  assert.match(rule('.contacts-map .leaflet-tile-pane'), /filter: grayscale\(1\) sepia\(0\.3\)/);
  assert.match(rule('.map-pin'), /color: var\(--accent\);/, 'the verde pin');
  // The section's own planes: no rounded corners (the map's popup and hint are the map's, not cards).
  const block = css.slice(css.indexOf('\n.home-contacts {'), css.indexOf('\n.map-pin {'));
  assert.doesNotMatch(block, /border-radius: (?!0)/, 'no rounded corners');
});

test('the «Изделия» panel is a ledger about 640 px wide: numbered group rows, thin neutral rules, copper only for hover / the current page', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const rule = sel => { const i = css.indexOf('\n' + sel + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  assert.match(rule('.nav-panel'), /width: min\(640px,/);
  assert.match(rule('.nav-panel-inner'), /counter-reset: nav-group/);
  assert.match(rule('.nav-group-title::before'), /content: counter\(nav-group, decimal-leading-zero\)/);
  assert.match(rule('.nav-group'), /border-top: 1px solid var\(--line\)/);
  assert.match(rule('.nav-group a::before'), /background: var\(--accent\)[\s\S]*transform: scaleX\(0\)/);
  assert.match(css, /\.nav-group a:focus-visible::before, \.nav-group a\.active::before \{ transform: scaleX\(1\); \}/);
  assert.match(css, /@media \(hover: hover\) \{ \.nav-group a:hover::before \{ transform: scaleX\(1\); \} \}/);
  const panel = css.slice(css.indexOf('/* The panel: a ledger'), css.indexOf('.site-header-cta {'));
  assert.doesNotMatch(panel, /<img|url\((?!\s*var)|font-family|uppercase/);
});

test('palette «basalt and serpentine»: limestone, warm stone, basalt, deep green-graphite, one verde accent; the showroom\'s copper only on the doorway\'s action; css/showroom.css untouched', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  [['--page', '#efede8'], ['--stone', '#e6e1d8'], ['--surface', '#f8f7f4'], ['--ink', '#1c1d1b'], ['--graphite', '#1e2320'], ['--accent', '#2a5446'], ['--accent-hover', '#1f4036'], ['--link', '#2a5446'], ['--accent-on-dark', '#7fa698']]
    .forEach(([name, value]) => assert.match(css, new RegExp(name + ': ' + value + ';'), name));
  // The old copper lives on only as the showroom's own colour.
  const copper = [...css.matchAll(/#b4562b/gi)].map(m => css.slice(css.lastIndexOf('\n', m.index), m.index));
  copper.forEach(line => assert.match(line, /--sr-copper/));
  assert.match(css, /\.home-portal \{\s*background: var\(--ground\);/);
  // The home page: limestone, paper, thin lines, basalt type, verde; the dark only inside «.night» (the showroom) and the footer.
  const home = css.slice(css.indexOf('\n.mast, .home-main {'), css.indexOf('}', css.indexOf('\n.mast, .home-main {')));
  [['--page', '#f0eee9'], ['--surface', '#f7f5f1'], ['--line', '#d5d1c8'], ['--ink', '#1c1d1b'], ['--accent', '#2f5d50'], ['--night', '#1e2320']]
    .forEach(([name, value]) => assert.match(home, new RegExp(name + ': ' + value + ';'), 'home ' + name));
  assert.match(home, /--ground: var\(--page\); --figure: var\(--ink\);/, 'light by default');
  assert.match(css, /\n\.night \{\s*--ground: var\(--night\); --figure: var\(--travertine\);/, 'dark only inside .night');
  assert.match(css, /\.site-footer \{[^}]*background: var\(--graphite\);/, 'the footer stays dark');
  assert.match(css, /\.portal-enter \{[^}]*background: var\(--sr-copper\);/);
  assert.doesNotMatch(css, /#0068d6|#007bff/, 'no blue');
  const sr = fs.readFileSync(path.join(site, 'css', 'showroom.css'), 'utf8');
  assert.match(sr, /--sr-accent: #b4562b;/);
  assert.match(sr, /--sr-panel-solid: #1e1a16;/);
});
test('every page: a skip link to <main id="main">; the active menu item is aria-current', () => {
  pages.filter(p => p !== 'showroom.html').forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.ok(html.includes('<a class="skip-link" href="#main">'), page);
    assert.equal((html.match(/<main[\s>]/g) || []).length, 1, page);
    assert.match(html, /<main [^>]*id="main"/, page);
    const nav = navOf(html);
    const active = nav.match(/<a class="active"[^>]*>/g) || [];
    const current = nav.match(/aria-current="page"/g) || [];
    assert.equal(current.length, active.length, page);
    active.forEach(a => assert.ok(a.includes('aria-current="page"'), page));
  });
});

test('the fireplace page: the category template on the kaminy key', () => {
  const html = fs.readFileSync(path.join(site, 'categories', 'kaminy.html'), 'utf8');
  assert.match(html, /<h1>Камины из камня<\/h1>/);
  assert.match(html, /SiteCommon\.loadPortfolio\('kaminy', document\.getElementById\('portfolioGrid'\)\);/);
  assert.match(html, /CategoryPage\.init\('kaminy'\);/);
  assert.match(html, /href="\/calculator\/sayanmramor-calculator\.html\?product=kaminy"/);
});

// ---- Спа зоны / Хаммамы / Бассейны, footer, privacy, коммерческое предложение ----

const SITE_ONLY = [
  ['spa-zony', 'Спа зоны'], ['hammamy', 'Хаммамы'], ['basseyny', 'Бассейны'],
];

test('the site-only directions: their own page and photos, the offer form for that direction, no configurator', () => {
  SITE_ONLY.forEach(([slug, label]) => {
    const html = fs.readFileSync(path.join(site, 'categories', slug + '.html'), 'utf8');
    assert.match(html, new RegExp('<h1>' + label + ' из камня</h1>'), slug);
    assert.ok(html.includes('<a class="active" href="/sayanmramor-site/categories/' + slug + '.html" aria-current="page">' + label + '</a>'), slug);
    assert.ok(html.includes('<div data-offer-form data-offer-steps data-preselect="' + slug + '"></div>'), slug);
    assert.doesNotMatch(html, /CategoryPage|configure-bar|product=/, slug + ' is not a configurator product');
    const photos = [...html.matchAll(/image: '([^']+)'/g)].map(m => m[1]);
    assert.ok(photos.length >= 2, slug);
    photos.forEach(src => assert.ok(fs.existsSync(path.join(site, src.replace('/sayanmramor-site/', ''))), src));
  });
});

test('every page but the showroom has the footer: directions, contacts, VK and the privacy link', () => {
  pages.filter(p => p !== 'showroom.html').concat(['privacy.html']).forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const footer = html.slice(html.indexOf('<footer class="site-footer">'), html.indexOf('</footer>'));
    assert.ok(footer.length > 0, page);
    SITE_ONLY.forEach(([slug, label]) => assert.ok(footer.includes('<a href="/sayanmramor-site/categories/' + slug + '.html">' + label + '</a>'), page + ' ' + label));
    assert.ok(footer.includes('<a href="/sayanmramor-site/privacy.html">Политика конфиденциальности</a>'), page);
    assert.ok(footer.includes('href="https://vk.com/sayanmramorru"'), page);
    assert.ok(footer.includes('ОГРН: 1197746382569'), page);
    assert.doesNotMatch(footer, /privacy-policy\.php/, page);
  });
});

test('the privacy policy page: the old site text, from «Город Москва» to its date', () => {
  const html = fs.readFileSync(path.join(site, 'privacy.html'), 'utf8');
  assert.match(html, /<h1>Политика конфиденциальности<\/h1>/);
  assert.ok(html.includes('<p>Город Москва</p>'));
  assert.ok(html.includes('<h2>8. Заключительные положения</h2>'));
  assert.ok(html.includes('<p>Дата размещения: 17.01.2022</p>'));
  const article = html.slice(html.indexOf('<article'), html.indexOf('</article>'));
  assert.equal((article.match(/<(p|h2)>/g) || []).length, 51);
});

test('the offer form lists every direction of the site, the three new ones included', () => {
  const OfferForm = require('../js/offer-form.js');
  const labels = OfferForm.DIRECTIONS.map(d => d.label);
  ['Спа зоны', 'Хаммамы', 'Бассейны', 'Ванная', 'Кухня', 'Камины', 'Готовые изделия'].forEach(l => assert.ok(labels.includes(l), l));
  assert.equal(new Set(OfferForm.DIRECTIONS.map(d => d.key)).size, OfferForm.DIRECTIONS.length);
  const home = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.ok(home.includes('<div data-offer-form data-offer-steps></div>'));
  assert.equal((home.match(/data-offer-form/g) || []).length, 1, 'one offer block on the home page');
});

test('the offer band: on the home page and all 13 direction pages, each preselecting its own direction; never on «Готовые изделия»', () => {
  const OfferForm = require('../js/offer-form.js');
  const labelOf = Object.fromEntries(OfferForm.DIRECTIONS.map(d => [d.key, d.label]));
  const directionPages = fs.readdirSync(path.join(site, 'categories')).map(f => 'categories/' + f);
  assert.equal(directionPages.length, 13);
  const band = html => (html.match(/<section class="offer-band[^"]*" id="offer"/g) || []).length;
  directionPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.equal(band(html), 1, page);
    const key = (html.match(/<div data-offer-form data-offer-steps data-preselect="([^"]+)"><\/div>/) || [])[1];
    const active = (html.match(/<a class="active"[^>]*>([^<]+)<\/a>/) || [])[1];
    assert.equal(labelOf[key], active, page + ': the form picks the page\'s own direction');
    assert.ok(html.includes('<script src="/sayanmramor-site/js/offer-form.js"></script>'), page);
    assert.ok(html.indexOf('class="offer-band offer-talk"') > 0 && html.indexOf('class="offer-band offer-talk"') < html.indexOf('</main>'), page + ': inside main, before the footer');
  });
  const home = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.equal(band(home), 1);
  assert.ok(home.includes('<div data-offer-form data-offer-steps></div>'), 'the home page lets the visitor choose (no preselect), in three questions');
  const katalog = fs.readFileSync(path.join(site, 'katalog.html'), 'utf8');
  assert.equal(band(katalog), 0);
  assert.doesNotMatch(katalog, /data-offer-form|offer-form\.js/);
  assert.equal(OfferForm.DIRECTIONS.length, 14);
});

test('the privacy policy: e-mails, site addresses and phones are links, as on the old site (phones added)', () => {
  const html = fs.readFileSync(path.join(site, 'privacy.html'), 'utf8');
  const article = html.slice(html.indexOf('<article'), html.indexOf('</article>'));
  const links = [...article.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(m => [m[1], m[2]]);
  const by = prefix => links.filter(([href]) => href.startsWith(prefix));
  assert.equal(by('mailto:').length, 7);
  by('mailto:').forEach(([href, text]) => assert.equal(href, 'mailto:' + text));
  assert.equal(by('https://sayanmramor.ru/').length, 7);
  assert.equal(by('tel:+74952155145').length, 2);
  assert.equal(links.length, 16);
  // No other text became a link.
  links.forEach(([, text]) => assert.match(text, /@sayanmramor\.ru$|^https:\/\/sayanmramor\.ru\/?$|^\+ ?7\(495\)215-51-45$/));
});

test('hover only where there is a pointer: every :hover rule sits in @media (hover: hover) (or the desktop wall\'s fine-pointer block); focus keeps its own rules', () => {
  ['site.css', 'showroom.css'].forEach(name => {
    const css = fs.readFileSync(path.join(site, 'css', name), 'utf8');
    const loose = css.split('\n').filter(line => line.includes(':hover')
      && !line.startsWith('@media (hover: hover)') && !/^\s+\S/.test(line) && !line.trim().startsWith('/*'));
    assert.deepEqual(loose, [], name);
  });
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const wall = css.slice(css.indexOf('@media (min-width: 1200px) and (hover: hover) and (pointer: fine)'));
  assert.ok(wall.indexOf('.wall-slab:not(.is-open):hover') < wall.indexOf('\n}\n'), 'the wall\'s indented hovers are inside its fine-pointer block');
});

test('step 0 fixes: the phone\'s contacts line up with their heading; touch targets of 44 px in the menus; the configure bar shortens instead of cutting off', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.doesNotMatch(css, /\.contacts-card \{ padding:/, 'no card padding left over on phones');
  assert.match(css, /\.mast-menu \.mast-group a, \.mast-menu-links a \{ display: inline-flex; align-items: center; min-height: 44px; \}/);
  assert.match(css, /\.js \.nav-group a \{ min-height: 44px;/);
  assert.match(css, /@media \(max-width: 540px\) \{\s*\.configure-stone \.configure-tail \{ display: none; \}\s*\}/);
  assert.match(css, /@media \(max-width: 420px\) \{\s*\.configure-cta \.configure-tail \{ display: none; \}\s*\}/);
});

test('the showroom draws its icons: no ✕ / ← / → typed as text; the cross is an SVG line icon, the arrows the site\'s arrow', () => {
  const html = fs.readFileSync(path.join(site, 'showroom.html'), 'utf8');
  const ui = fs.readFileSync(path.join(site, 'js', 'showroom', 'showroom-ui.js'), 'utf8').replace(/\/\/.*$/gm, '');
  const state = fs.readFileSync(path.join(site, 'js', 'showroom', 'showroom-state.js'), 'utf8').replace(/\/\/.*$/gm, '');
  [html.replace(/<!--[\s\S]*?-->/g, ''), ui, state].forEach(src => assert.doesNotMatch(src, /[✕×←→]/));
  assert.equal((html.match(/class="sr-close"[^>]*aria-label="Закрыть"><svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">/g) || []).length, 3, 'the card, «Все изделия», «Связаться»');
  const sr = fs.readFileSync(path.join(site, 'css', 'showroom.css'), 'utf8');
  assert.match(sr, /--sr-arrow: url\([^)]*stroke-width='2' stroke-linecap='square'/);
});

// ---- Home: the static page (rebuilt on 4ad72f4's structure, in the site's own system) -----

test('the home page is static: header, hero, from stone to object, what can be ordered, the showroom, about, why us, who trusts us, the request, where we are, footer -- and no script of the redesign', () => {
  const html = homeHtml();
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const order = [...main.matchAll(/<section class="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(order, ['home-hero', 'wrap home-s2o', 'wrap home-products', 'home-showroom', 'wrap home-about', 'wrap home-why', 'wrap home-trust', 'offer-band offer-talk', 'wrap home-contacts']);
  assert.match(html, /<main class="home" id="main">/);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1].replace('/sayanmramor-site/', ''));
  assert.deepEqual(scripts, ['js/header.js', 'vendor/leaflet/leaflet.js', 'js/contacts-map.js', 'js/offer-form.js', 'js/site.js']);
  assert.doesNotMatch(html, /data-(hero|wall|portal|mast|dock)\b|class="mast|home-main|night-hero|wall-slab|offer-drawing|portal-veil/);
  // The redesign's modules are kept until the clean-up step.
  ['masthead.js', 'home-hero.js', 'home-wall.js', 'home-portal.js', 'home-request.js'].forEach(f =>
    assert.ok(fs.existsSync(path.join(site, 'js', f)), f + ' is kept for now'));
});

test('about, why us, who trusts us: the old site\'s three blocks -- its words and figures, the six companies each a link to its site, the logos on disk', () => {
  const html = homeHtml();
  const about = sectionOf(html, '<section class="wrap home-about"');
  assert.match(about, /<p class="home-about-kicker">О компании<\/p>/);
  assert.match(about, /<h2 id="aboutTitle">Собственное производство в&nbsp;Московской области<\/h2>/);
  assert.match(about, /современным итальянским оборудованием/);
  const facts = [...about.matchAll(/<dt>([^<]+)<\/dt><dd>(.+?)<\/dd>/g)].map(m => [m[2].replace(/<[^>]+>/g, ' ').replace('&#8239;', ''), m[1]]);
  assert.deepEqual(facts, [['12 лет ', 'на рынке'], ['7320', 'изделий'], ['130', 'камней'], ['2301', 'клиент']]);
  assert.equal((about.match(/<figure class="home-about-shot /g) || []).length, 2, 'two photographs from the workshop');
  assert.doesNotMatch(about, /rutube|home-about-video/, 'no video (the owner, 2026-10-10)');

  const why = sectionOf(html, '<section class="wrap home-why"');
  assert.match(why, /<h2 id="whyTitle">Почему выбирают <em>нас<\/em>\?<\/h2>/);
  assert.deepEqual([...why.matchAll(/<span class="home-why-num" aria-hidden="true">(\d+)<\/span>/g)].map(m => m[1]), ['01', '02', '03', '04']);
  const titles = [...why.matchAll(/<h3 class="home-why-title">([^<]+)<\/h3>/g)].map(m => m[1]);
  assert.deepEqual(titles, ['Оперативность выполнения', 'Оптимальная стоимость', 'Высокое качество продукции', 'Подготовка дизайн-проектов']);
  assert.equal((why.match(/<p class="home-why-text">/g) || []).length, 4);

  const trust = sectionOf(html, '<section class="wrap home-trust"');
  assert.match(trust, /<h2 id="trustTitle">Нам доверяют<\/h2>/);
  assert.match(trust, /<div class="home-trust-panel">[\s\S]*<ul class="home-trust-wall">/, 'the words and the wall of tiles side by side (concept C, 2026-10-10)');
  const trustPanel = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8').match(/\.home-trust-panel \{[^}]*\}/)[0];
  assert.doesNotMatch(trustPanel, /background/, 'no ground of its own: between the two dark cards it stays on the limestone, so light and dark take turns');
  assert.doesNotMatch(trust, /2&#8239;301|home-trust-num/, 'no figure and no numbers on the tiles');
  const links = [...trust.matchAll(/<a class="home-trust-item" href="([^"]+)" target="_blank" rel="noopener">/g)].map(m => m[1]);
  assert.deepEqual(links, ['https://resobank.com/', 'https://www.rshb.ru/', 'https://bamboobar.su/', 'https://www.vtb.ru/', 'https://mcx.gov.ru/', 'https://hlebnasushny.ru/']);
  assert.equal((trust.match(/откроется в новой вкладке/g) || []).length, 6, 'each outside link says it opens a new tab');
  [...html.matchAll(/\/sayanmramor-site\/(assets\/(?:home\/trust\/|home\/about-|portfolio\/035)[^ "]+)/g)].forEach(m => assert.ok(fs.existsSync(path.join(site, m[1])), m[1]));
});

test('the home hero: the headline, one line and two plain actions on the wall of one generated picture -- the washbasin, called a visualisation; wide and upright versions; nothing moves', () => {
  const hero = sectionOf(homeHtml(), '<section class="home-hero"');
  assert.match(hero, /<h1 id="heroTitle">Изделия из натурального камня на заказ<\/h1>/);
  assert.match(hero, /<p class="lead">Лестницы, столешницы, полы, стены и фасады/);
  const actions = [...hero.matchAll(/<a class="btn (btn-\w+)" href="([^"]+)">([^<]+)<\/a>/g)].map(m => m.slice(1));
  assert.deepEqual(actions, [
    ['btn-primary', '/calculator/sayanmramor-calculator.html', 'Создать изделие'],
    ['btn-secondary', '/sayanmramor-site/showroom.html', 'Открыть 3D-шоурум'],
  ]);
  const imgs = [...hero.matchAll(/<img [^>]*>/g)].map(m => m[0]);
  assert.equal(imgs.length, 1, 'one picture');
  assert.match(imgs[0], /src="\/sayanmramor-site\/assets\/hero\/ai-washbasin-1871\.webp"/);
  assert.match(imgs[0], /alt="[^"]*визуализация" width="1871" height="841" fetchpriority="high" decoding="async"/);
  assert.doesNotMatch(imgs[0], /loading="lazy"/, 'the first picture is not held back');
  assert.match(hero, /<source media="\(max-aspect-ratio: 1\/1\), \(max-width: 900px\)" srcset="[^"]*ai-washbasin-4x5-720\.webp 720w, [^"]*ai-washbasin-4x5-1121\.webp 1121w"/, 'phones and upright windows get the upright version');
  [...hero.matchAll(/\/sayanmramor-site\/(assets\/hero\/[^ "]+)/g)].forEach(m => assert.ok(fs.existsSync(path.join(site, m[1])), m[1]));
  assert.match(hero, /<p class="wrap home-hero-note">Раковина из кварцита — визуализация<\/p>/, 'a generated picture is said to be one');
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.match(css, /\.home-hero \{\s*display: grid;[^}]*margin-top: -74px;/, 'the picture runs under the floating header');
  assert.match(css, /\.js \.home-hero \{ margin-top: -66px; \}/);
  assert.match(css, /html:not\(\.js\) \.home-hero \{ margin-top: 0; \}/);
  assert.match(css, /\.home-hero \.lead \{[^}]*color: var\(--ink\);/, 'the lead in full ink on the picture');
  assert.match(css, /@media \(max-aspect-ratio: 1\/1\), \(max-width: 900px\) \{[\s\S]*?\.home-hero-content \{ padding-top: calc\(66px \+ var\(--s-6\)\); padding-bottom: calc\(62cqw \+ var\(--s-6\)\); \}/, 'room kept for the washbasin under the words');
});

test('«От камня к изделию»: three real photographs in order -- the stone, its cutting, the finished piece -- each with alt, size, srcset and lazy loading; labels and arrows are decoration', () => {
  const sec = sectionOf(homeHtml(), '<section class="wrap home-s2o"');
  assert.match(sec, /<h2 id="s2oTitle">От камня к&nbsp;изделию<\/h2>/);
  assert.match(sec, /<p>Выбираем камень, проектируем форму и изготавливаем изделие по вашим размерам\.<\/p>/);
  const steps = [...sec.matchAll(/<li class="home-s2o-step">([\s\S]*?)<\/li>/g)].map(m => m[1]);
  assert.equal(steps.length, 3);
  const expected = [
    ['s2o-quartz-white-640.webp', 'Слэб полудрагоценного кварца Quartz White', 'Натуральный камень', 'Кварц Quartz White', '1', 'Камень'],
    ['s2o-making-036-960.webp', 'Распил каменной плиты на станке', 'Раскрой и обработка', 'Распил плиты и обработка кромки', '2', 'Производство'],
    ['s2o-kitchen-155-640.webp', 'Кухонная столешница и фартук с подсветкой из кварца Quartz White', 'Готовое изделие', 'Столешница и фартук с подсветкой', '3', 'Изделие'],
  ];
  steps.forEach((step, i) => {
    const [file, alt, title, text, n, label] = expected[i];
    const img = step.match(/<img [^>]*>/)[0];
    assert.match(img, new RegExp(`src="/sayanmramor-site/assets/home/${file.replace('.', '\\.')}"`));
    assert.match(img, new RegExp(`alt="${alt}" width="\\d+" height="\\d+" loading="lazy" decoding="async"`));
    assert.match(img, /srcset="[^"]+ \d+w, [^"]+ \d+w" sizes="[^"]+"/);
    [...img.matchAll(/\/sayanmramor-site\/(assets\/home\/[^ "]+)/g)].forEach(m => assert.ok(fs.existsSync(path.join(site, m[1])), m[1]));
    assert.match(step, new RegExp(`<span class="home-s2o-chip" aria-hidden="true"><b><span>${n}</span></b>${label}</span>`));
    assert.match(step, new RegExp(`<p class="home-s2o-cap"><strong>${title}</strong>${text}</p>`));
    assert.equal((step.match(/<span class="home-s2o-arrow" aria-hidden="true">/g) || []).length, i === 0 ? 0 : 1, 'an arrow on the seam before steps 2 and 3');
  });
  assert.doesNotMatch(sec, /<script|data-[a-z]+=/, 'static: no script, no hooks');
});

test('«От камня к изделию» in CSS: equal 4:5 cards laid over each other, the middle one lower, arrows on the seams, captions on one line; one column on phones (600 px), the words above the photographs from 900 px; a light lift under a pointer only', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const block = css.slice(css.indexOf('/* From stone to object'), css.indexOf('/* What can be ordered'));
  assert.ok(block.length > 500);
  assert.match(block, /\.home-s2o-steps \{[^}]*grid-template-columns: minmax\(0, 6fr\) minmax\(0, 1fr\) minmax\(0, 5fr\) minmax\(0, 1fr\) minmax\(0, 6fr\);/);
  assert.match(block, /\.home-s2o-step \{ display: grid; grid-row: 1 \/ 3; grid-template-rows: subgrid; grid-template-columns: subgrid; \}/);
  assert.match(block, /\.home-s2o-shot \{[^}]*aspect-ratio: 4 \/ 5;/);
  assert.match(block, /\.home-s2o-step:nth-child\(2\) \.home-s2o-card \{ margin-top: var\(--s2o-dy\); \}/);
  assert.match(block, /\.home-s2o-cap \{ grid-row: 2;/, 'all captions on the one row under the cards');
  assert.match(block, /@supports not \(grid-template-columns: subgrid\)/, 'a plain three-column fallback');
  const phones = css.slice(css.indexOf('@media (max-width: 600px) {\n  .offer-form'));
  assert.match(phones.slice(0, phones.indexOf('\n}\n')), /\.home-s2o-steps \{ display: block; \}[\s\S]*\.home-s2o-arrow-right \{ display: none; \}\s*\.home-s2o-arrow-down \{ display: block; \}/,
    'on phones the steps stand one under another and the arrow points down');
  // Motion only under a pointer and only when motion is welcome: one block, transform and opacity, no animations.
  const motionAt = block.indexOf('@media (hover: hover) and (prefers-reduced-motion: no-preference) {');
  assert.ok(motionAt > 0, 'the hover lift sits in one pointer + no-preference block');
  const motion = block.slice(motionAt, block.indexOf('\n}\n', motionAt));
  const outside = block.slice(0, motionAt) + block.slice(motionAt + motion.length);
  assert.doesNotMatch(outside, /:hover|transition|transform:/, 'nothing reacts or moves outside that block');
  assert.doesNotMatch(block, /animation|@keyframes|will-change/);
  [...motion.matchAll(/transition: ([^;]+);/g)].forEach(m => m[1].split(/,\s*(?=[a-z-]+ \d)/).forEach(t => assert.match(t, /^(transform|opacity) 0\.\d+s cubic-bezier\(/, t)));
  assert.match(motion, /\.home-s2o-card:hover \.home-s2o-shot, \.home-s2o-card:hover::before \{ transform: translateY\(-6px\); \}/);
  assert.match(motion, /\.home-s2o-card:hover \.home-s2o-shot img \{ transform: scale\(1\.04\); \}/);
  // The step's digit: its box trimmed to the cap height, so the circle centres the figure.
  assert.match(block, /\.home-s2o-chip b span \{ display: block; line-height: 1; font-variant-numeric: tabular-nums; text-box: trim-both cap alphabetic; \}/);
});

test('«Что можно заказать»: one stone panel with the menu\'s five groups -- each a photograph, its name and its real links -- and the ready-made pieces on their own line, not a configurator direction', () => {
  const sec = sectionOf(homeHtml(), '<section class="wrap home-products"');
  assert.match(sec, /<h2 id="productsTitle">Что можно заказать<\/h2>/);
  // The page names the countertops in full; the menu keeps them short.
  const HOME_NAMES = { 'Кухня': 'Столешница на кухню', 'Ванная': 'Столешница в ванную' };
  const homeName = n => HOME_NAMES[n] || n;
  const directionOf = caption => DIRECTIONS[Object.keys(HOME_NAMES).find(n => HOME_NAMES[n] === caption) || caption];
  const groups = [...sec.matchAll(/<h3 class="home-group-title">([^<]+)<\/h3>\s*<ul>([\s\S]*?)<\/ul>/g)]
    .map(m => [m[1], [...m[2].matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(a => [a[2], a[1]])]);
  assert.deepEqual(groups, GROUPS.map(([title, names]) => [title, names.map(n => [homeName(n), '/sayanmramor-site/' + DIRECTIONS[n]])]));
  // Every group has its photograph, a decoration (alt=""): the group's name says what it is.
  const shots = [...sec.matchAll(/<span class="home-group-frame"><img class="home-group-shot" src="([^"]+)" alt="" width="720" height="300" loading="lazy" decoding="async"><\/span>\s*<h3 class="home-group-title">/g)];
  assert.equal(shots.length, 5);
  shots.forEach(([, src]) => assert.ok(fs.existsSync(path.join(site, src.replace('/sayanmramor-site/', ''))), src));
  // The panel's ground: the stone, a local file at two sizes.
  const ground = [...sec.matchAll(/(?:srcset|src)="(\/sayanmramor-site\/assets\/home\/order\/bg-[^"]+)"/g)];
  assert.equal(ground.length, 2);
  ground.forEach(([, src]) => assert.ok(fs.existsSync(path.join(site, src.replace('/sayanmramor-site/', ''))), src));
  assert.match(sec, /<a class="home-order-go" href="\/calculator\/sayanmramor-calculator\.html" aria-label="Создать изделие в конфигураторе"/);
  assert.doesNotMatch(sec, /home-feature/, 'the four works are gone: the panel has the photographs');
  assert.match(sec, /<a class="home-instock" href="\/sayanmramor-site\/katalog\.html">[\s\S]*?<span class="home-instock-title">Готовые изделия из камня<\/span>/);
  // Its two promises, each an icon (hidden from screen readers) and two lines.
  assert.deepEqual([...sec.matchAll(/<span class="home-instock-point"><svg [^>]*aria-hidden="true">[\s\S]*?<\/svg><span><b>([^<]+)<\/b>([^<]+)<\/span><\/span>/g)].map(m => [m[1], m[2]]),
    [['Фиксированная цена', 'Стоимость известна заранее'], ['Без ожидания расчёта', 'Сразу к выбору изделия']]);
  const groupLinks = sec.slice(sec.indexOf('home-groups'), sec.indexOf('home-instock'));
  assert.doesNotMatch(groupLinks, /katalog\.html/, 'the ready-made pieces are not one of the groups');
});

test('works in frames: the direction pages\' photos -- rounded, a soft shadow, a hairline edge; a light lift under a pointer only, never over each other', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const block = css.slice(css.indexOf('/* ---- Works in frames'), css.indexOf('/* ---- Готовые изделия'));
  assert.ok(block.length > 300, 'one block for both');
  assert.match(block, /\.portfolio-shot \{\s*position: relative; display: block; overflow: hidden; border-radius: 20px;[^}]*box-shadow: 0 0 0 1px rgba\(28, 29, 27, 0\.06\),/);
  assert.match(block, /\.portfolio-shot::after \{[^}]*inset 0 0 0 1px rgba\(255, 255, 255, 0\.22\)/);
  const motionAt = block.indexOf('@media (hover: hover) and (prefers-reduced-motion: no-preference) {');
  assert.ok(motionAt > 0);
  const motion = block.slice(motionAt, block.indexOf('\n}\n', motionAt));
  const outside = block.slice(0, motionAt) + block.slice(motionAt + motion.length);
  assert.doesNotMatch(outside, /:hover|transition|transform:/, 'nothing reacts or moves outside the pointer block');
  assert.doesNotMatch(block, /margin-(left|top): -|animation|@keyframes/, 'side by side: no overlap, no animations');
  assert.match(motion, /\.portfolio-item:hover \.portfolio-shot \{\s*transform: translateY\(-6px\);/);
  assert.match(motion, /transform: scale\(1\.04\);/);
  [...motion.matchAll(/transition: ([^;]+);/g)].forEach(m => m[1].split(/,\s*(?=[a-z-]+ \d)/).forEach(t => assert.match(t, /^(transform|box-shadow) 0\.\d+s cubic-bezier\(/, t)));
  // The photos sit in the frame: the frame rounds them, the photos themselves keep their shape.
  assert.match(css, /\.portfolio-item img \{ display: block; width: 100%; height: auto; aspect-ratio: auto 2 \/ 3; \}/);
  assert.doesNotMatch(css, /\.portfolio-item img \{[^}]*border-radius/);
});

test('the home showroom band: words, a plain link into the showroom and its house -- no veil, no doorway script', () => {
  const sec = sectionOf(homeHtml(), '<section class="home-showroom"');
  assert.match(sec, /<h2 id="showroomTitle">Дом из натурального камня<\/h2>/);
  assert.match(sec, /<a class="btn btn-on-dark" href="\/sayanmramor-site\/showroom\.html">Открыть шоурум<\/a>/);
  assert.match(sec, /<img src="\/sayanmramor-site\/assets\/home\/showroom-house-1600\.webp" alt="" width="1600" height="1000" loading="lazy"/);
  assert.doesNotMatch(sec, /data-portal/);
});

test('the home request is three questions to a master: a workshop photo, the heading and contacts on the left, the talk on the right; the noscript line stays', () => {
  const sec = sectionOf(homeHtml(), '<section class="offer-band offer-talk"');
  assert.match(sec, /data-offer-open/);
  assert.match(sec, /<p class="offer-kicker">Проект<\/p>/);
  assert.match(sec, /<h2 class="offer-title" id="offerTitle">Получить расчёт <span class="offer-title-soft">по вашему проекту<\/span><\/h2>/);
  assert.match(sec, /<p class="offer-lead">Мастер задаст три коротких вопроса/);
  // The photo: a real one from the workshop (assets/home/SOURCES.md), two sizes, lazy, described.
  const img = (sec.match(/<img class="offer-talk-photo"[^>]*>/) || [''])[0];
  assert.match(img, /srcset="\/sayanmramor-site\/assets\/home\/offer-master-040-480\.webp 480w, \/sayanmramor-site\/assets\/home\/offer-master-040-960\.webp 960w"/);
  assert.match(img, /alt="Мастер обрабатывает каменную плиту на станке"/);
  assert.match(img, /loading="lazy"/);
  ['offer-master-040-480.webp', 'offer-master-040-960.webp'].forEach(f => assert.ok(fs.existsSync(path.join(site, 'assets', 'home', f)), f));
  assert.match(sec, /<div class="offer-contact">\s*<p class="offer-phone">Или позвоните: [\s\S]*?<\/p>\s*<p class="offer-phone offer-tg">Или напишите в Telegram: <a href="https:\/\/t\.me\/TeaN_SayanMramor"/);
  assert.match(sec, /<div data-offer-form data-offer-steps><\/div>\s*<noscript><p class="offer-noscript">/);
  assert.doesNotMatch(sec, /offer-drawing|offer-notes|<svg/);
});

test('three questions (offer-form.js): what, how to address you, where to call; a phone has ten digits; the end says honestly that nothing is sent yet', () => {
  const OfferForm = require('../js/offer-form.js');
  assert.deepEqual(OfferForm.STEPS.map(s => s.chip), ['Изделие', 'Имя', 'Телефон']);
  assert.deepEqual(OfferForm.STEPS.map(s => s.q.join('')), ['Что будем делать из камня?', 'Как к вам обращаться?', 'Куда позвонить с расчётом?']);
  ['+7 999 123-45-67', '89991234567', '+7 (495) 215-51-45'].forEach(v => assert.ok(OfferForm.phoneOk(v), v));
  ['', '123', '+7 999', 'abc'].forEach(v => assert.ok(!OfferForm.phoneOk(v), v));
  assert.match(OfferForm.DONE_NOTE, /ещё настраивается/);
  const src = fs.readFileSync(path.join(site, 'js', 'offer-form.js'), 'utf8');
  // Every direction of the site is an answer, and «Пока не знаю»; the name may be skipped; the phone and the consent are required.
  assert.match(src, /DIRECTIONS\.map\(d => d\.label\)\.concat\(\[UNSURE\]\)/);
  assert.match(src, /linkButton\('Можно без имени'/);
  assert.match(src, /if \(!phoneOk\(phone\.value\)\)/);
  assert.match(src, /if \(!consent\.checked\)/);
  assert.match(src, /c\.hasAttribute\('data-offer-steps'\) \? mountSteps\(c\) : mount\(c\)/);
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon/, 'nothing leaves the page yet');
});

test('three questions in CSS: scoped to the home page\'s band, hover only where there is a pointer, motion off when asked, a phone stacks each answer', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const block = css.slice(css.indexOf('/* ---- «Получить расчёт» на главной: три вопроса мастеру'), css.indexOf('/* ---- Footer'));
  assert.ok(block.length > 2000);
  // Every selector belongs to the home page's band (or its keyframes).
  const noComments = block.replace(/\/\*[\s\S]*?\*\//g, '');
  [...noComments.matchAll(/([^{}]+)\{/g)].map(m => m[1].trim()).filter(sel => !sel.startsWith('@')).forEach(sel => {
    sel.replace(/\([^)]*\)/g, '()').split(',').forEach(s => assert.match(s.trim(), /^(main \.offer-talk|\.offer-talk|\.talk-|\.offer-file-input:focus-visible \+ \.talk-file|from|to)\b/, s.trim()));
  });
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{ \.talk-step \{ animation: none; \} \}/);
  assert.match(block, /@media \(max-width: 560px\) \{[\s\S]*\.talk-answer \{ flex-direction: column; \}/);
});

test('the static home in CSS: colour on hover and focus only -- no sticky, no transforms, no animations, transitions of 150 ms; hover only where there is a pointer', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const whole = css.slice(css.indexOf('/* ---- Home (static)'), css.indexOf('/* ---- Home palette'));
  // «От камня к изделию» is the one exception: its cards lift under a pointer (tested on its own below).
  const block = whole.slice(0, whole.indexOf('/* From stone to object')) + whole.slice(whole.indexOf('/* What can be ordered'));
  assert.ok(block.length > 500);
  assert.doesNotMatch(block, /sticky|position: fixed|(?<!text-)transform|animation|@keyframes|will-change|perspective|clip-path/);
  [...block.matchAll(/transition: ([^;]+);/g)].forEach(m => assert.match(m[1], /^(color|opacity) 0\.15s$/, m[1]));
  assert.match(block, /\.home-hero \{\s*display: grid;/);
  assert.match(block, /\.home-groups \{ display: grid; grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/);
});
