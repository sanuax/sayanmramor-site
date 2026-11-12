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
    { id: 'absolute-black', name: 'Absolute Black', type: 'Гранит', image: '/sayanmramor-calculator/data/images/absolute-black.webp', price: 7000, countries: ['Индия'], colors: ['Черный'], tone: null },
    { id: 'no-image', name: 'Calacatta Ёлка', type: 'Мрамор', image: null, price: null, countries: ['Италия'], colors: [], tone: null },
    { id: 'nero-marquina', name: 'Nero Marquina', type: 'Мрамор', image: '/sayanmramor-calculator/data/images/nero-marquina.webp', price: 11006, countries: ['Испания'], colors: ['Черный'], tone: null },
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
  assert.deepEqual(CategoryPage.SORT_LABELS, { 'tone-asc': 'Цвет', 'tone-desc': 'Цвет ↓', 'name-asc': 'A-Z', 'name-desc': 'Z-A', 'price-asc': 'Цена ↑', 'price-desc': 'Цена ↓' }, 'the configurator\'s labels');
});

test('sortStones by tone: the gradient either way, a stone without a place always last; the index\'s tone comes through', () => {
  const stones = CategoryPage.normalizeStones({ stones: [
    { id: 'none', name: 'Aaa' }, { id: 'dark', name: 'Bbb', tone: 2 }, { id: 'light', name: 'Ccc', tone: 0 }, { id: 'mid', name: 'Ddd', tone: 1 },
  ] });
  const ids = list => list.map(s => s.id);
  assert.deepEqual(ids(CategoryPage.sortStones(stones, 'tone-asc')), ['light', 'mid', 'dark', 'none']);
  assert.deepEqual(ids(CategoryPage.sortStones(stones, 'tone-desc')), ['dark', 'mid', 'light', 'none']);
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
  assert.equal(CategoryPage.STONE_INDEX_URL, '/sayanmramor-calculator/data/stone-index.json');
  assert.equal(CategoryPage.STONE_IMAGE_BASE, '/sayanmramor-calculator/data/');
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
    // (experiment, round 3: «Фасады» passes its outdoor types first as a second argument)
    const key = (html.match(/CategoryPage\.init\('([a-z_]+)'(?:, \{[^)]*\})?\)/) || [])[1];
    const product = ShowroomData.productByKey(key);
    assert.ok(product, file + ': unknown product key ' + key);
    assert.equal(product.categoryHref, '/sayanmramor-site/categories/' + file);
    const cta = (html.match(/id="configureCta" href="([^"]+)"/) || [])[1];
    assert.equal(cta, ShowroomData.buildConfiguratorUrl(key));
    assert.equal(cta, '/sayanmramor-calculator/sayanmramor-calculator.html?product=' + key);
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

// (experiment, round 2: a designer could not open a stone, nor tell natural stone from man-made)
test('natural and man-made stone: the index types that are made by hand are marked', () => {
  assert.deepEqual(CategoryPage.ARTIFICIAL_TYPES, ['Кварцевый агломерат', 'Искусственный мрамор', 'Спеченный камень']);
  assert.equal(CategoryPage.isArtificial({ type: 'Кварцевый агломерат' }), true);
  assert.equal(CategoryPage.isArtificial({ type: 'Мрамор' }), false);
  assert.equal(CategoryPage.isArtificial({ type: 'Кварцит' }), false);
  assert.equal(CategoryPage.isArtificial(null), false);
});

test('a link from a caption: ?q= fills the search, the one stone of that very name opens', () => {
  assert.equal(CategoryPage.linkedQuery('?q=Sesame%20Black'), 'Sesame Black');
  assert.equal(CategoryPage.linkedQuery(''), '');
  assert.equal(CategoryPage.linkedQuery('?product=pol'), '');
  const stones = [{ name: 'Volakas', type: 'Мрамор' }, { name: 'Volakas', type: 'Кварцевый агломерат' }, { name: 'Sesame Black', type: 'Гранит' }, { name: 'Calacatta Volakas', type: 'Мрамор' }];
  assert.equal(CategoryPage.exactStone(stones, 'sesame black').name, 'Sesame Black');
  assert.equal(CategoryPage.exactStone(stones, 'Volakas'), null, 'two stones of that name: none opens, the search shows both');
  assert.equal(CategoryPage.exactStone(stones, ''), null);
});

test('a stone opens large by its own button on the photo (a press on the card only chooses it, the owner 2026-11-12): the photo whole, what the index knows, «В подборку» and the configurator; the rest is asked for, not guessed', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'category-page.js'), 'utf8');
  assert.match(src, /card\.addEventListener\('click', \(\) => \{[^}]*selected = selected && selected\.id === stone\.id \? null : stone;\s*renderSelection\(\);\s*\}\);/, 'the card only chooses and lets go');
  assert.match(src, /open\.className = 'stone-open';[^]*open\.addEventListener\('click', e => \{ selected = stone; renderSelection\(\); openView\(stone, e\.detail === 0\); \}\);/, 'the button opens it large');
  // Opened by a tap the window holds the focus itself: no ring round its first link «в заявке» (2026-11-12, the owner).
  assert.match(src, /\(viaKeys \? view\.close : view\.dialog\)\.focus\(\{ preventScroll: true \}\);/);
  const siteCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'site.css'), 'utf8');
  assert.match(siteCss, /\.stone-view:focus \{ outline: none; \}/);
  // The window is not a scroller (iOS Safari left the photo standing over the scrolling text and lost it
  // from screenshots): the text scrolls in its own box, the photo has a box of its own and fades in.
  const windowRule = siteCss.match(/\n\.stone-view \{[^}]*\}/)[0];
  assert.match(windowRule, /overflow: hidden;/, 'the window does not scroll');
  assert.doesNotMatch(windowRule, /overflow: auto/);
  assert.match(siteCss, /\.stone-view-text \{[^}]*min-height: 0; overflow-y: auto;/, 'the text scrolls in its own box');
  assert.match(siteCss, /\.stone-view-media img \{ position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0\.25s ease; \}/);
  assert.match(siteCss, /\.stone-view-media img\.is-loaded \{ opacity: 1; \}/);
  assert.match(siteCss, /@keyframes stone-view-in \{ from \{ opacity: 0; \} \}/, 'opening is a fade: nothing moves or scales');
  assert.match(siteCss, /\.stone-view-media \{ min-height: 0; height: calc\(\(100vw - 24px\) \* 10 \/ 17\);/, 'on a phone the photo has a set height: nothing shifts when it arrives');
  assert.match(src, /img\.addEventListener\('load', \(\) => img\.classList\.add\('is-loaded'\)\);/);
  assert.match(src, /view\.text\.scrollTop = 0;/);
  assert.match(src, /const dialog = el\('dialog', 'stone-view'\);/);
  assert.match(src, /Размеров плит, толщины и фактуры в каталоге нет/);
  assert.match(src, /el\('a', 'btn btn-primary', 'Рассчитать в конфигураторе'\)/);
  assert.match(src, /configure\.href = buildUrl\(s\.id\);/);
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'site.css'), 'utf8');
  assert.match(css, /\.stone-view-media img \{[^}]*object-fit: cover;/, 'the stone fills its whole side, no coloured margin (the owner, 2026-11-12)');
  assert.match(css, /\.stone-view-actions \.btn \{ border-radius: var\(--radius-btn\); \}/, 'the buttons stay rectangles');
});

// (experiment, round 3: «Фасады» opened on white marble and quartz agglomerate)
test('a page can lead its gallery with its own kinds of stone: nothing hidden, each group keeps its order', () => {
  const stones = [
    { name: 'A', type: 'Мрамор' }, { name: 'B', type: 'Гранит' }, { name: 'C', type: 'Кварцевый агломерат' },
    { name: 'D', type: 'Травертин' }, { name: 'E', type: 'Гранит' },
  ];
  assert.deepEqual(CategoryPage.typesFirst(stones, ['Гранит', 'Травертин']).map(s => s.name), ['B', 'D', 'E', 'A', 'C']);
  assert.equal(CategoryPage.typesFirst(stones, []), stones);
  const fasady = fs.readFileSync(path.join(__dirname, '..', 'categories', 'fasady.html'), 'utf8');
  assert.ok(fasady.includes("CategoryPage.init('fasad', { firstTypes: ['Гранит', 'Кварцит', 'Травертин', 'Известняк', 'Песчаник', 'Сланец'] });"));
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'category-page.js'), 'utf8');
  assert.ok(src.includes("if (state.sort.startsWith('tone-')) filtered = typesFirst(filtered, firstTypes);"), 'only the colour order; «A-Z» and «Цена» stay plain');
});
