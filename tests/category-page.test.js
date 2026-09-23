// tests/category-page.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CategoryPage = require('../js/category-page.js');
const ShowroomData = require('../js/showroom/showroom-data.js');

// The slabs.json fields this site relies on (the agreed JSON contract);
// everything else in a stone record is ignored.
const SLABS = {
  updated_at: '2026-09-01',
  stones: [
    { id: 'nero-marquina', name: 'Nero Marquina', category_label_ru: 'Мрамор', image: 'images/nero-marquina.webp', slabs: [] },
    { id: 'absolute-black', name: 'Absolute Black', category_label_ru: 'Гранит', image: 'images/absolute-black.webp' },
    { id: 'sold-out', name: 'Sold Out', category_label_ru: 'Мрамор', image: 'images/sold-out.webp', available: false },
    { id: 'no-image', name: 'Calacatta Ёлка', category_label_ru: 'Мрамор' },
    { id: '', name: 'Broken record' },
  ],
};

test('normalizeStones keeps orderable stones with the gallery fields, sorted by name', () => {
  const stones = CategoryPage.normalizeStones(SLABS);
  assert.deepEqual(stones, [
    { id: 'absolute-black', name: 'Absolute Black', type: 'Гранит', image: '/calculator/data/images/absolute-black.webp' },
    { id: 'no-image', name: 'Calacatta Ёлка', type: 'Мрамор', image: null },
    { id: 'nero-marquina', name: 'Nero Marquina', type: 'Мрамор', image: '/calculator/data/images/nero-marquina.webp' },
  ]);
});

test('normalizeStones tolerates missing or empty data', () => {
  assert.deepEqual(CategoryPage.normalizeStones(null), []);
  assert.deepEqual(CategoryPage.normalizeStones({}), []);
});

test('listTypes returns the common types, most numerous first', () => {
  const stones = CategoryPage.normalizeStones(SLABS);
  assert.deepEqual(CategoryPage.listTypes(stones, 1), [{ label: 'Мрамор', count: 2 }, { label: 'Гранит', count: 1 }]);
  assert.deepEqual(CategoryPage.listTypes(stones, 2), [{ label: 'Мрамор', count: 2 }]);
});

test('filterStones matches name or type, ignoring case and ё, within the chosen type', () => {
  const stones = CategoryPage.normalizeStones(SLABS);
  const ids = list => list.map(s => s.id);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, {})), ['absolute-black', 'no-image', 'nero-marquina']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { query: 'BLACK' })), ['absolute-black']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { query: 'елка' })), ['no-image']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { query: 'гран' })), ['absolute-black']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { type: 'Мрамор', query: 'nero' })), ['nero-marquina']);
});

test('the page reads stone data only from the slabs.json contract', () => {
  assert.equal(CategoryPage.SLABS_URL, '/calculator/data/slabs.json');
  assert.equal(CategoryPage.STONE_IMAGE_BASE, '/calculator/data/');
});

// Every category page is one of the 9 product directions, initialises the
// gallery with that product key, and without JavaScript still links to the
// canonical configurator URL for it.
test('every category page hands off to the canonical configurator URL for its own product', () => {
  const dir = path.join(__dirname, '..', 'categories');
  const files = fs.readdirSync(dir);
  assert.equal(files.length, ShowroomData.PRODUCTS.length);
  files.forEach(file => {
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    const key = (html.match(/CategoryPage\.init\('([a-z_]+)'\)/) || [])[1];
    const product = ShowroomData.productByKey(key);
    assert.ok(product, file + ': unknown product key ' + key);
    assert.equal(product.categoryHref, '/sayanmramor-site/categories/' + file);
    const cta = (html.match(/id="configureCta" href="([^"]+)"/) || [])[1];
    assert.equal(cta, ShowroomData.buildConfiguratorUrl(key));
    assert.equal(cta, '/calculator/sayanmramor-calculator.html?product=' + key);
  });
});
