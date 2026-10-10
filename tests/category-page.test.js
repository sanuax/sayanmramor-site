// tests/category-page.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CategoryPage = require('../js/category-page.js');
const ShowroomData = require('../js/showroom/showroom-data.js');

// The stone fields this site relies on (the agreed JSON contract: the
// calculator's slabs.json, served to the site as its light
// stone-index.json with the same field names); everything else in a stone
// record is ignored.
const SLABS = {
  updated_at: '2026-09-01',
  stones: [
    { id: 'nero-marquina', name: 'Nero Marquina', category_label_ru: 'Мрамор', image: 'images/nero-marquina.webp',
      countries: [{ label_ru: 'Испания', segment: 'spain' }], colors: [{ label_ru: 'Черный', segment: 'black' }],
      slabs: [{ price_per_m2_rub: 18554.4 }, { price_per_m2_rub: 11006.4 }, { price_per_m2_rub: null }] },
    { id: 'absolute-black', name: 'Absolute Black', category_label_ru: 'Гранит', image: 'images/absolute-black.webp',
      countries: [{ label_ru: 'Индия', segment: 'india' }], colors: [{ label_ru: 'Черный', segment: 'black' }],
      slabs: [{ price_per_m2_rub: 7000 }] },
    { id: 'sold-out', name: 'Sold Out', category_label_ru: 'Мрамор', image: 'images/sold-out.webp', available: false },
    { id: 'no-image', name: 'Calacatta Ёлка', category_label_ru: 'Мрамор', countries: [{ label_ru: 'Италия', segment: 'italy' }] },
    { id: '', name: 'Broken record' },
  ],
};

test('normalizeStones keeps orderable stones with the gallery fields, sorted by name', () => {
  const stones = CategoryPage.normalizeStones(SLABS);
  assert.deepEqual(stones, [
    { id: 'absolute-black', name: 'Absolute Black', type: 'Гранит', image: '/calculator/data/images/absolute-black.webp', price: 7000, countries: ['Индия'], colors: ['Черный'] },
    { id: 'no-image', name: 'Calacatta Ёлка', type: 'Мрамор', image: null, price: null, countries: ['Италия'], colors: [] },
    { id: 'nero-marquina', name: 'Nero Marquina', type: 'Мрамор', image: '/calculator/data/images/nero-marquina.webp', price: 11006, countries: ['Испания'], colors: ['Черный'] },
  ]);
});

test('normalizeStones tolerates missing or empty data', () => {
  assert.deepEqual(CategoryPage.normalizeStones(null), []);
  assert.deepEqual(CategoryPage.normalizeStones({}), []);
});

test('listOptions: every value the stones have for a filter, in alphabetical order, as the configurator lists them', () => {
  const stones = CategoryPage.normalizeStones(SLABS);
  assert.deepEqual(CategoryPage.listOptions(stones, 'type'), ['Гранит', 'Мрамор']);
  assert.deepEqual(CategoryPage.listOptions(stones, 'countries'), ['Индия', 'Испания', 'Италия']);
  assert.deepEqual(CategoryPage.listOptions(stones, 'colors'), ['Черный']);
});

test('filterStones matches name or type, ignoring case and ё; within a list filter any ticked value will do, the filters together all hold', () => {
  const stones = CategoryPage.normalizeStones(SLABS);
  const ids = list => list.map(s => s.id);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, {})), ['absolute-black', 'no-image', 'nero-marquina']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { query: 'BLACK' })), ['absolute-black']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { query: 'елка' })), ['no-image']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { query: 'гран' })), ['absolute-black']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { types: ['Мрамор'], query: 'nero' })), ['nero-marquina']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { countries: ['Италия', 'Индия'] })), ['absolute-black', 'no-image']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { colors: ['Черный'], types: ['Мрамор'] })), ['nero-marquina']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { colors: ['Черный'], countries: ['Италия'] })), []);
});

test('filterStones by price: the lowest price per m2 inside { from, to }, either end open; a stone without a price only while the filter is unset', () => {
  const stones = CategoryPage.normalizeStones(SLABS);
  const ids = list => list.map(s => s.id);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { price: { from: null, to: null } })), ['absolute-black', 'no-image', 'nero-marquina']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { price: { from: 8000, to: null } })), ['nero-marquina']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { price: { from: null, to: 11006 } })), ['absolute-black', 'nero-marquina']);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { price: { from: 7500, to: 11000 } })), []);
  assert.deepEqual(ids(CategoryPage.filterStones(stones, { types: ['Гранит'], price: { from: 5000, to: 9000 } })), ['absolute-black']);
});

test('sortStones: A-Z / Z-A by name, «Цена» up or down by the lowest price -- a stone without a price always last', () => {
  const stones = CategoryPage.normalizeStones(SLABS);
  const ids = list => list.map(s => s.id);
  assert.deepEqual(ids(CategoryPage.sortStones(stones, 'name-asc')), ['absolute-black', 'no-image', 'nero-marquina']);
  assert.deepEqual(ids(CategoryPage.sortStones(stones, 'name-desc')), ['nero-marquina', 'no-image', 'absolute-black']);
  assert.deepEqual(ids(CategoryPage.sortStones(stones, 'price-asc')), ['absolute-black', 'nero-marquina', 'no-image']);
  assert.deepEqual(ids(CategoryPage.sortStones(stones, 'price-desc')), ['nero-marquina', 'absolute-black', 'no-image']);
  assert.deepEqual(CategoryPage.SORT_LABELS, { 'name-asc': 'A-Z', 'name-desc': 'Z-A', 'price-asc': 'Цена ↑', 'price-desc': 'Цена ↓' }, 'the configurator\'s labels');
});

test('hasActiveFilters: «Сбросить» shows for any search text, any ticked value, any price end', () => {
  assert.equal(CategoryPage.hasActiveFilters({}), false);
  assert.equal(CategoryPage.hasActiveFilters({ query: '  ', types: [], countries: [], colors: [], price: { from: null, to: null } }), false);
  assert.equal(CategoryPage.hasActiveFilters({ query: 'nero' }), true);
  assert.equal(CategoryPage.hasActiveFilters({ colors: ['Черный'] }), true);
  assert.equal(CategoryPage.hasActiveFilters({ price: { from: 1000, to: null } }), true);
});

test('every page with the stone gallery has the filter row, and loads js/price-filter.js before js/category-page.js', () => {
  const dir = path.join(__dirname, '..', 'categories');
  const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html'))
    .map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')]).filter(([, html]) => html.includes('id="stoneGrid"'));
  assert.equal(pages.length, 10);
  pages.forEach(([f, html]) => {
    assert.ok(html.includes('<div class="stone-filters" id="stoneFilters" role="group" aria-label="Фильтры камня" hidden></div>'), f);
    assert.doesNotMatch(html, /stoneTypes|stonePrice/, f + ': the old chips and price block are gone');
    const a = html.indexOf('js/price-filter.js'), b = html.indexOf('js/category-page.js');
    assert.ok(a > 0 && a < b, f);
  });
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'category-page.js'), 'utf8');
  ["listFilter('country', 'Страна'", "listFilter('category', 'Тип'", "listFilter('color', 'Цвет'", 'priceFilter()', "'Сбросить'", 'sortControl()']
    .forEach(part => assert.ok(src.includes(part), part));
});

test('the page reads stone data only from the light stone index, never the full slabs.json', () => {
  assert.equal(CategoryPage.STONE_INDEX_URL, '/calculator/data/stone-index.json');
  assert.equal(CategoryPage.STONE_IMAGE_BASE, '/calculator/data/');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'category-page.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(src, /slabs\.json/, 'no code path fetches the 8.9 MB catalog');
});

test('the index shape (seven fields as scripts/build_stone_index.py writes them: price_from, countries / colors with their labels only; only orderable stones) gives the same gallery as slabs.json', () => {
  const lowest = s => {
    const p = (s.slabs || []).map(x => x.price_per_m2_rub).filter(v => typeof v === 'number' && v > 0);
    return p.length ? Math.round(Math.min(...p)) : null;
  };
  const only = items => (items || []).map(x => ({ label_ru: x.label_ru }));
  const index = {
    updated_at: SLABS.updated_at,
    stones: SLABS.stones.filter(s => s.available !== false && s.id && s.name)
      .map(s => ({ id: s.id, name: s.name, category_label_ru: s.category_label_ru || '', image: s.image || '', price_from: lowest(s),
        countries: only(s.countries), colors: only(s.colors) })),
  };
  assert.deepEqual(CategoryPage.normalizeStones(index), CategoryPage.normalizeStones(SLABS));
});

// Every category page is one of the 10 product directions, initialises the
// gallery with that product key, and without JavaScript still links to the
// canonical configurator URL for it.
const SITE_ONLY = ['spa-zony.html', 'hammamy.html', 'basseyny.html'];

test('every category page hands off to the canonical configurator URL for its own product', () => {
  const dir = path.join(__dirname, '..', 'categories');
  // Spa, hammam and pool pages are directions of the site only: no configurator product.
  const files = fs.readdirSync(dir).filter(f => !SITE_ONLY.includes(f));
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
    // The configure bar's short forms for very narrow screens; the tails are
    // what site.css hides at <= 360 px.
    assert.ok(html.includes('id="configureStone">Не выбран<span class="configure-tail"> - подберёте в конфигураторе</span></span>'), file);
    assert.ok(html.includes('"><span>Рассчитать<span class="configure-tail"> в конфигураторе</span></span></a>'), file);
  });
});

test('every page with the stone catalogue names the supplier once, with a link to Venezia Stone in a new tab', () => {
  const root = path.join(__dirname, '..');
  const pages = ['index.html', 'katalog.html', 'showroom.html'].concat(fs.readdirSync(path.join(root, 'categories')).map(f => 'categories/' + f));
  pages.forEach(page => {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const hasCatalogue = html.includes('id="stoneGrid"');
    const lines = html.split('Камень в нашей коллекции закупается у Venezia Stone').length - 1;
    assert.equal(lines, hasCatalogue ? 1 : 0, page);
    assert.doesNotMatch(html, /взят с сайта/, page);
    if (!hasCatalogue) return;
    const section = html.slice(html.indexOf('class="stone-section"'), html.indexOf('</section>', html.indexOf('class="stone-section"')));
    const links = section.match(/<a [^>]*href="https:\/\/veneziastone\.com\/"[^>]*>([^<]*)<\/a>/g) || [];
    assert.equal(links.length, 1, page);
    assert.match(links[0], /target="_blank"/, page);
    assert.match(links[0], /rel="noopener"/, page);
    assert.match(links[0], />Подробнее о коллекции и материалах - на сайте Venezia Stone</, page);
  });
});

test('each stone card shows «от … ₽/м²» under the type, as the configurator\'s card does: the stone\'s lowest price per m2', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'category-page.js'), 'utf8');
  assert.match(src, /price\.className = 'stone-card-price';/);
  assert.match(src, /price\.textContent = 'от ' \+ PriceFilter\.formatRub\(stone\.price\) \+ ' ₽\/м²';/);
  assert.match(src, /if \(stone\.price != null\)/, 'no line for a stone without a price');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'site.css'), 'utf8');
  assert.match(css, /\.stone-card-price \{[^}]*color: var\(--accent\);[^}]*white-space: nowrap;/);
});
