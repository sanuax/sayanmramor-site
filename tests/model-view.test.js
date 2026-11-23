// tests/model-view.test.js -- the pure parts of js/model-view.js (2026-11-23, the owner: 3D and AR)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'js', 'model-view.js')).href);
const piece = { id: 'stol-01', name: 'Стол из мрамора Bianco Carrara',
  model: { glb: '/sayanmramor-site/assets/products/stol-01/model.glb', usdz: '/sayanmramor-site/assets/products/stol-01/model.usdz', size_mm: [1900, 950, 750] } };
const PAGE = 'https://sayanmramor.ru/katalog.html?kind=tables';

test('the size: width × depth × height in mm, never broken over two lines; nothing when unknown', async () => {
  const { modelSize } = await load();
  assert.equal(modelSize(piece), '1900 × 950 × 750 мм');
  assert.equal(modelSize({ model: { size_mm: [1, 2] } }), '');
  assert.equal(modelSize({}), '');
});

test('AR on an iPhone: Quick Look on the usdz, the size locked', async () => {
  const { arLinks } = await load();
  const r = arLinks(piece, PAGE, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
  assert.deepEqual(r, { kind: 'ios', href: 'https://sayanmramor.ru/sayanmramor-site/assets/products/stol-01/model.usdz#allowsContentScaling=0' });
  // an iPad that calls itself a Mac: the browser's own answer (rel="ar") decides
  assert.equal(arLinks(piece, PAGE, 'Mozilla/5.0 (Macintosh)', true).kind, 'ios');
});

test('AR on Android: Scene Viewer on the absolute glb, not resizable, back to this piece if it is missing', async () => {
  const { arLinks } = await load();
  const r = arLinks(piece, PAGE, 'Mozilla/5.0 (Linux; Android 15; Pixel 9)', false);
  assert.equal(r.kind, 'android');
  assert.equal(r.href,
    'intent://arvr.google.com/scene-viewer/1.0?file=' + encodeURIComponent('https://sayanmramor.ru/sayanmramor-site/assets/products/stol-01/model.glb')
    + '&mode=ar_preferred&resizable=false&title=' + encodeURIComponent(piece.name)
    + '#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;'
    + 'S.browser_fallback_url=' + encodeURIComponent('https://sayanmramor.ru/katalog.html?3d=stol-01') + ';end;');
});

test('AR on a computer: a QR code to this piece\'s window on the catalogue page', async () => {
  const { arLinks } = await load();
  assert.deepEqual(arLinks(piece, PAGE, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', false),
    { kind: 'qr', href: 'https://sayanmramor.ru/katalog.html?3d=stol-01' });
});

test('parseGlb reads a built model: matching arrays, a JPEG, metres with the base on the floor', async () => {
  const { parseGlb } = await load();
  const file = fs.readFileSync(path.join(__dirname, '..', 'assets', 'products', 'rakushka-01', 'model.glb'));
  const g = parseGlb(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  assert.equal(g.positions.length % 3, 0);
  assert.equal(g.normals.length, g.positions.length);
  assert.equal(g.uvs.length / 2, g.positions.length / 3);
  assert.equal(g.indices.length % 3, 0);
  let maxIndex = 0;
  for (const i of g.indices) if (i > maxIndex) maxIndex = i;
  assert.ok(maxIndex < g.positions.length / 3);
  assert.equal(g.image.type, 'image/jpeg');
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < g.positions.length; i += 3) { minY = Math.min(minY, g.positions[i]); maxY = Math.max(maxY, g.positions[i]); }
  assert.ok(Math.abs(minY) < 1e-4, 'the base on y = 0');
  assert.ok(Math.abs(maxY - 0.040) < 0.002, 'the shell is 40 mm high, in metres');
});

test('the catalogue pages load the viewer as a small module and its style; three.js only on a press', () => {
  const site = path.join(__dirname, '..');
  ['katalog.html', 'podborka.html'].forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.match(html, /<link rel="stylesheet" href="\/sayanmramor-site\/css\/model-view\.css\?v=[0-9a-f]{8}">/, page);
    assert.match(html, /<script type="module" src="\/sayanmramor-site\/js\/model-view\.js\?v=[0-9a-f]{8}"><\/script>/, page);
    assert.doesNotMatch(html, /three\.module\.js/, page);
  });
  const js = fs.readFileSync(path.join(site, 'js', 'model-view.js'), 'utf8');
  assert.doesNotMatch(js, /^import /m, 'no static import: three.js comes with the first window');
});
