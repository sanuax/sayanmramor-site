// tests/intro.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Intro = require('../js/intro.js');

const site = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(site, p), 'utf8');
const pages = ['index.html', 'katalog.html', 'privacy.html', 'podborka.html', 'kamen.html']
  .concat(fs.readdirSync(path.join(site, 'categories')).map(f => 'categories/' + f));

test('it plays once, on the way in: not again, not back, not on reload, not to an anchor, not with reduced motion', () => {
  const first = { reduced: false, canAnimate: true, hash: '', navigationType: 'navigate', seen: false, fromThisAddress: false };
  assert.equal(Intro.shouldPlay(first), true);
  [{ seen: true }, { reduced: true }, { canAnimate: false }, { hash: '#offer' }, { navigationType: 'back_forward' }, { navigationType: 'reload' }, { fromThisAddress: true }]
    .forEach(change => assert.equal(Intro.shouldPlay(Object.assign({}, first, change)), false, JSON.stringify(change)));
});

test('the sheen of light crosses the screen from its top-left corner to its bottom-right one', () => {
  [[1280, 800], [390, 844], [2560, 1300]].forEach(([w, h]) => {
    assert.equal(Intro.sweepAt(0, 0, w, h), 0);
    const end = Intro.sweepAt(w, h, w, h);
    [[w, 0], [0, h], [w / 2, h / 2]].forEach(([x, y]) => assert.ok(Intro.sweepAt(x, y, w, h) > 0 && Intro.sweepAt(x, y, w, h) < end, x + ',' + y));
  });
});

test('the name draws together around its middle: the letters come from outside in, the farther the more', () => {
  const lay = Intro.layout();
  assert.equal(lay.letters.map(l => l.ch).join(''), Intro.NAME);
  lay.letters.slice(1).forEach((l, i) => assert.ok(l.x > lay.letters[i].x));
  const spread = lay.letters.map(l => Intro.spreadOf(l, lay.units));
  spread.slice(1).forEach((v, i) => assert.ok(v > spread[i]));
  assert.ok(spread[0] < 0 && spread[spread.length - 1] > 0);
  assert.ok(Math.abs(spread[0] + spread[spread.length - 1]) < lay.units * 0.01, 'about as far on both sides');
  assert.ok(Math.max(...spread.map(Math.abs)) < lay.units * 0.05, 'a quiet move, not a fly-in');
});

test('one thing after another: the name, the hairline, the quiet line; the words go before the slab, and it is all over in time', () => {
  const T = Intro.TIMELINE;
  assert.ok(T.name < T.rule && T.rule < T.quiet && T.quiet < T.quietLate && T.quietLate < T.hold);
  assert.ok(T.name + T.nameMs <= T.hold && T.quiet + T.quietMs <= T.hold, 'all settled before the words go');
  assert.ok(T.hold <= T.cap && T.cap + T.out + T.fade < Intro.MAX_MS);
  assert.ok(T.cap + T.out + T.fade <= 5000, 'a first look, not a film');
});

test('the noise of the stone is the same every time and seamless at its repeat', () => {
  const a = Intro.noiseData(), b = Intro.noiseData();
  assert.equal(a.N, 512);
  assert.deepEqual(a.data.slice(0, 4096), b.data.slice(0, 4096));
  const v = (x, y) => a.data[(y * a.N + x) * 4] * 256 + a.data[(y * a.N + x) * 4 + 1];
  // the last texel of a row runs on into the first one as smoothly as any two neighbours
  for (let y = 0; y < a.N; y += 37) assert.ok(Math.abs(v(a.N - 1, y) - v(0, y)) < 65535 * 0.05, 'row ' + y);
});

test('every letter of the name has its outline, so no font has to load; one contour per letter, holes aside', () => {
  Intro.NAME.split('').forEach(ch => {
    assert.ok(Intro.GLYPHS[ch], ch);
    assert.match(Intro.GLYPHS[ch][0], /^M/);
  });
  // the font's overlapping parts merged: one clean edge per letter
  ['М', 'Н', 'С'].forEach(ch => assert.equal(Intro.GLYPHS[ch][0].split('M').length - 1, 1, ch));
  ['А', 'О', 'Р', 'Я'].forEach(ch => assert.equal(Intro.GLYPHS[ch][0].split('M').length - 1, 2, ch));
  assert.equal(Intro.NAME, 'САЯНМРАМОР');
});

test('pages: the intro loads in <head> without defer, before the stylesheets; the fonts of the first screen are preloaded', () => {
  pages.forEach(p => {
    const html = read(p);
    const head = html.slice(0, html.indexOf('</head>'));
    const script = head.match(/<script src="\/sayanmramor-site\/js\/intro\.js[^"]*"><\/script>/);
    assert.ok(script, p + ': intro');
    assert.ok(head.indexOf(script[0]) < head.indexOf('css/tokens.css'), p + ': before the styles');
    ['unbounded-cyrillic', 'montserrat-cyrillic'].forEach(font => {
      assert.ok(head.includes('<link rel="preload" href="/sayanmramor-site/assets/fonts/' + font + '-wght-normal.woff2" as="font" type="font/woff2" crossorigin>'), p + ': ' + font);
    });
  });
  assert.doesNotMatch(read('showroom.html'), /js\/intro\.js/, 'the showroom has its own loading screen');
  assert.match(read('index.html'), /<img src="[^"]*hammam-pano-1997\.webp"[^>]*fetchpriority="high"/, 'the first photo first');
});
