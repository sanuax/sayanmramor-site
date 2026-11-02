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

test('the polishing line crosses the screen from its top-left corner to its bottom-right one', () => {
  [[1280, 800], [390, 844], [2560, 1300]].forEach(([w, h]) => {
    assert.equal(Intro.sweepAt(0, 0, w, h), 0);
    const end = Intro.sweepAt(w, h, w, h);
    [[w, 0], [0, h], [w / 2, h / 2]].forEach(([x, y]) => assert.ok(Intro.sweepAt(x, y, w, h) > 0 && Intro.sweepAt(x, y, w, h) < end, x + ',' + y));
  });
});

test('the letters show one after another, from the left, as the line reaches them', () => {
  const lay = Intro.layout();
  assert.equal(lay.letters.map(l => l.ch).join(''), Intro.NAME);
  lay.letters.slice(1).forEach((l, i) => assert.ok(l.x > lay.letters[i].x));
  const at = lay.letters.map(l => Intro.sweepAt(100 + (l.x + l.adv / 2) * 0.05, 400, 1280, 800));
  at.slice(1).forEach((v, i) => assert.ok(v > at[i]));
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
  // the font's overlapping parts merged: an engraving's wall runs only along the letter's edge
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
  assert.match(read('index.html'), /<img src="[^"]*ai-washbasin-1871\.webp"[^>]*fetchpriority="high"/, 'the first photo first');
});
