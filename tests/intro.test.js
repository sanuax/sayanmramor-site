// tests/intro.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Intro = require('../js/intro.js');

const site = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(site, p), 'utf8');
const pages = ['index.html', 'katalog.html', 'privacy.html', 'podborka.html']
  .concat(fs.readdirSync(path.join(site, 'categories')).map(f => 'categories/' + f));

test('it plays once, on the way in: not again, not back, not on reload, not to an anchor, not with reduced motion', () => {
  const first = { reduced: false, canAnimate: true, hash: '', navigationType: 'navigate', seen: false, fromThisAddress: false };
  assert.equal(Intro.shouldPlay(first), true);
  [{ seen: true }, { reduced: true }, { canAnimate: false }, { hash: '#offer' }, { navigationType: 'back_forward' }, { navigationType: 'reload' }, { fromThisAddress: true }]
    .forEach(change => assert.equal(Intro.shouldPlay(Object.assign({}, first, change)), false, JSON.stringify(change)));
});

test('the ridge runs from edge to edge, always onward, in the upper part of the screen; the same each time', () => {
  [[1280, 800], [390, 780], [2560, 1300]].forEach(([w, h]) => {
    const points = Intro.ridgePoints(w, h);
    assert.ok(points.length > 40);
    assert.equal(points[0][0], 0);
    assert.equal(points[points.length - 1][0], w);
    points.slice(1).forEach((p, i) => assert.ok(p[0] > points[i][0], 'x grows at ' + i));
    points.forEach(p => assert.ok(p[1] > h * 0.2 && p[1] < h * 0.62, 'y ' + p[1]));
    assert.deepEqual(Intro.ridgePoints(w, h), points);
  });
});

test('the two halves share the ridge as their edge and together cover the screen', () => {
  const points = [[0, 50], [50, 20], [100, 60]];
  assert.equal(Intro.upperClip(points), 'polygon(0 0,100% 0,100px 60px,50px 20px,0px 50px)');
  assert.equal(Intro.lowerClip(points), 'polygon(0px 50px,50px 20px,100px 60px,100% 100%,0 100%)');
});

test('veins leave the ridge: below it in the lower half, above it in the upper', () => {
  const ridge = Intro.ridgePoints(1280, 800);
  const veins = Intro.veins(1280, 800, ridge);
  assert.ok(veins.some(v => v.part === 'up') && veins.some(v => v.part === 'down'));
  veins.forEach(v => {
    assert.ok(ridge.some(p => p[0] === v.points[0][0] && p[1] === v.points[0][1]), 'starts on the ridge');
    const end = v.points[v.points.length - 1][1];
    assert.ok(v.part === 'down' ? end > v.points[0][1] : end < v.points[0][1], v.part);
  });
});

test('every letter of the name has its outline, so no font has to load', () => {
  Intro.NAME.split('').forEach(ch => {
    assert.ok(Intro.GLYPHS[ch], ch);
    assert.match(Intro.GLYPHS[ch][0], /^M/);
  });
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
