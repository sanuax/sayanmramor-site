// tests/catalog.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Catalog = require('../js/catalog.js');
const fs = require('fs');
const path = require('path');

test('formatProductPrice formats a known ruble price', () => {
  const formatted = Catalog.formatProductPrice(45000);
  assert.ok(formatted.endsWith('₽'));
  assert.ok(formatted.replace(/\s/g, '').startsWith('45000'));
});

test('formatProductPrice falls back to "Цена по запросу" when price is null', () => {
  assert.equal(Catalog.formatProductPrice(null), 'Цена по запросу');
});

test('formatProductPrice falls back to "Цена по запросу" when price is missing', () => {
  assert.equal(Catalog.formatProductPrice(undefined), 'Цена по запросу');
});

test('isAvailable defaults to true when the field is missing', () => {
  assert.equal(Catalog.isAvailable({}), true);
});

test('isAvailable is false only when explicitly set to false', () => {
  assert.equal(Catalog.isAvailable({ available: false }), false);
  assert.equal(Catalog.isAvailable({ available: true }), true);
});

// ---- the cards of the grid (a minimal stand-in for the DOM) ----------------------

function fakeDocument() {
  function el(tag) {
    const node = {
      tagName: tag.toUpperCase(), className: '', textContent: '', children: [], parent: null, listeners: {}, attrs: {}, dataset: {}, hidden: false,
      setAttribute(name, value) { node.attrs[name] = String(value); },
      classList: {
        add(c) { if (!node.classList.contains(c)) node.className = (node.className + ' ' + c).trim(); },
        remove(c) { node.className = node.className.split(' ').filter(x => x && x !== c).join(' '); },
        contains(c) { return node.className.split(' ').includes(c); },
        toggle(c, on) { if (on) node.classList.add(c); else node.classList.remove(c); },
      },
      set innerHTML(v) { node.children = []; },
      appendChild(child) { child.parent = node; node.children.push(child); return child; },
      addEventListener(type, fn) { node.listeners[type] = fn; },
      replaceWith(other) {
        const siblings = node.parent.children;
        other.parent = node.parent;
        siblings[siblings.indexOf(node)] = other;
        node.parent = null;
      },
    };
    return node;
  }
  return { createElement: el, createTextNode: text => ({ tagName: '#text', textContent: text, children: [] }) };
}

function withDocument(fn) {
  const saved = global.document;
  global.document = fakeDocument();
  try { return fn(); } finally { global.document = saved; }
}

const find = (node, cls) => node.children.find(c => c.classList && c.classList.contains(cls));
const shotOf = card => find(card, 'stock-shot');
const placeholders = area => area.children.filter(c => c.className === 'stock-placeholder');
const images = area => area.children.filter(c => c.tagName === 'IMG');
const text = node => node.textContent || node.children.map(text).join('');

test('a product with photos: [] gets the text placeholder, not an image with an empty src', () => withDocument(() => {
  const area = shotOf(Catalog.buildProductCard({ name: 'Светильник из оникса', photos: [] }));
  assert.equal(images(area).length, 0);
  assert.equal(placeholders(area).length, 1);
  assert.equal(placeholders(area)[0].textContent, Catalog.NO_PHOTO_TEXT);
}));

test('a product without a photos field gets the same placeholder', () => withDocument(() => {
  const area = shotOf(Catalog.buildProductCard({ name: 'Эксклюзивный стол' }));
  assert.equal(images(area).length, 0);
  assert.equal(placeholders(area).length, 1);
}));

test('a product with one photo shows photos[0], named by the product, loaded lazily', () => withDocument(() => {
  const area = shotOf(Catalog.buildProductCard({ name: 'Ракушка', photos: ['/a.webp'] }));
  const [img] = images(area);
  assert.equal(img.src, '/a.webp');
  assert.equal(img.alt, 'Ракушка');
  assert.equal(img.loading, 'lazy');
  assert.equal(area.children.length, 1, 'one photo: no row, no count');
}));

test('a photo that fails to load is replaced by the placeholder in the same place', () => withDocument(() => {
  const area = shotOf(Catalog.buildProductCard({ name: 'Ракушка', photos: ['/missing.webp'], available: false }));
  images(area)[0].listeners.error();
  assert.equal(images(area).length, 0);
  assert.equal(area.children[0].className, 'stock-placeholder');   // still ahead of the badge
  assert.equal(area.children[1].className, 'stock-badge');
}));

test('a product with several photos gets one swipeable, focusable row of them, labelled once, with a count', () => withDocument(() => {
  const photos = ['/1.webp', '/2.webp', '/3.webp', '/4.webp', '/5.webp'];
  const area = shotOf(Catalog.buildProductCard({ name: 'Светильник', photos }));
  const strip = find(area, 'stock-strip');
  assert.equal(strip.tabIndex, 0);
  assert.equal(strip.attrs['aria-label'], 'Светильник, 5 фото');
  assert.deepEqual(images(strip).map(i => i.src), photos);
  assert.deepEqual(images(strip).map(i => i.alt), ['Фото 1 из 5', 'Фото 2 из 5', 'Фото 3 из 5', 'Фото 4 из 5', 'Фото 5 из 5']);
  const count = find(area, 'stock-count');
  assert.equal(count.textContent, '5 фото');
  assert.equal(count.attrs['aria-hidden'], 'true');
  images(strip)[2].listeners.error();                       // one missing photo: only its frame changes
  assert.equal(strip.children[2].className, 'stock-placeholder');
  assert.equal(images(strip).length, 4);
}));

test('a card (2026-10-24, the owner: «Сетка»): the photograph, the kind, the name, then the price and «Запросить» -- the site\'s main button -- at its foot', () => withDocument(() => {
  const card = Catalog.buildProductCard({ name: 'Ракушка', category: 'rakushki', price_rub: 37000, photos: ['/r.jpg'] });
  assert.equal(card.tagName, 'LI');
  assert.equal(card.dataset.group, 'decor');
  const words = find(card, 'stock-text');
  assert.deepEqual(words.children.map(c => c.className), ['stock-kind', 'stock-name', 'stock-foot']);
  assert.equal(find(words, 'stock-kind').textContent, 'Декор');
  assert.equal(find(words, 'stock-name').tagName, 'H2');
  const foot = find(words, 'stock-foot');
  assert.equal(foot.children[0].textContent, '37 000 ₽');
  const ask = foot.children[1];
  assert.equal(ask.tagName, 'A');
  assert.equal(ask.className, 'btn btn-primary stock-ask');
  assert.equal(ask.textContent, 'Запросить');
  assert.equal(ask.href, Catalog.ORDER_URL);
  assert.equal(Catalog.ORDER_URL, '/sayanmramor-site/index.html#offer');
  assert.equal(ask.attrs['aria-label'], 'Запросить: Ракушка');
}));

test('every category in products.json has its kind', () => {
  const { products } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8'));
  products.forEach(p => assert.ok(Catalog.KINDS[p.category], p.id + ': ' + p.category));
});

test('the grid: every piece at once; over it the count and the prices; the kinds filter it', () => withDocument(() => {
  const products = [
    { name: 'Ванная из оникса', category: 'vanny', price_rub: 3977000, photos: ['/v.webp'] },
    { name: 'Ракушка', category: 'rakushki', price_rub: 37000, photos: ['/r.jpg'] },
    { name: 'Стол', category: 'stoly', price_rub: 3177000, photos: [] },
    { name: 'Арт-стол', category: 'stoly', price_rub: 2377000, photos: ['/a.webp'] },
    { name: 'Светильник', category: 'svetilniki', price_rub: 20000, photos: ['/s1.webp', '/s2.webp'] },
  ];
  const container = document.createElement('div'), meta = document.createElement('p'), slot = document.createElement('div');
  const r = Catalog.renderCatalog(container, products, { meta, filter: slot });
  assert.equal(container.children[0].className, 'stock-grid');
  assert.equal(r.cards.length, 5);
  assert.equal(text(meta), '5 изделий от 20 000 до 3 977 000 ₽');
  assert.equal(meta.children[0].tagName, 'B');
  const chips = slot.children[0].children;
  assert.deepEqual(chips.map(text), ['Все 5', 'Столы 2', 'Скульптура и декор 1', 'Ванная 1', 'Свет 1']);
  assert.deepEqual(chips.map(c => c.attrs['aria-pressed']), ['true', 'false', 'false', 'false', 'false']);
  chips[1].listeners.click();
  assert.deepEqual(r.cards.map(c => c.hidden), [true, true, false, false, true], 'only the tables');
  assert.deepEqual(chips.map(c => c.attrs['aria-pressed']), ['false', 'true', 'false', 'false', 'false']);
  chips[0].listeners.click();
  assert.ok(r.cards.every(c => !c.hidden), 'all again');
}));

test('a photograph opens large in the site\'s viewer: every photo of every piece, in order, each opened by its own image', () => withDocument(() => {
  const calls = [];
  const saved = global.window;
  global.window = { SiteCommon: { enableViewer: (...args) => calls.push(args) } };
  try {
    const products = [
      { name: 'Ракушка', category: 'rakushki', price_rub: 37000, photos: ['/r.jpg'] },
      { name: 'Стол', category: 'stoly', price_rub: 3177000, photos: [] },
      { name: 'Светильник', category: 'svetilniki', price_rub: 20000, photos: ['/s1.webp', '/s2.webp'] },
    ];
    const container = document.createElement('div');
    const r = Catalog.renderCatalog(container, products);
    assert.equal(calls.length, 1);
    const [grid, items, parts] = calls[0];
    assert.equal(grid, r.grid);
    assert.deepEqual(items, [{ image: '/r.jpg', thumb: '/r.jpg' }, { image: '/s1.webp', thumb: '/s1.webp' }, { image: '/s2.webp', thumb: '/s2.webp' }]);
    assert.deepEqual(parts.triggers.map(i => [i.tagName, i.src]), [['IMG', '/r.jpg'], ['IMG', '/s1.webp'], ['IMG', '/s2.webp']]);
    assert.equal(parts.radius, 12, 'the corners of the cards\' photographs');
  } finally { global.window = saved; }
}));

test('an empty catalogue says so; one kind only: no filter', () => withDocument(() => {
  const container = document.createElement('div');
  assert.equal(Catalog.renderCatalog(container, []), null);
  assert.equal(container.children[0].className, 'catalog-empty');
  const slot = document.createElement('div');
  Catalog.renderCatalog(container, [{ name: 'Стол', category: 'stoly', price_rub: 1 }, { name: 'Стол 2', category: 'stoly', price_rub: 2 }], { filter: slot });
  assert.equal(slot.children.length, 0);
}));

test('the price range: the pieces in stock, the lowest to the highest', () => {
  assert.equal(Catalog.priceRange([{ price_rub: 37000 }, { price_rub: 3977000 }, { price_rub: 999, available: false }]), 'от 37 000 до 3 977 000 ₽');
  assert.equal(Catalog.priceRange([{ price_rub: 20000 }]), '20 000 ₽');
  assert.equal(Catalog.priceRange([{ price_rub: null }]), '');
});

test('the page: the head holds the count and the filter; the gallery is gone', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'katalog.html'), 'utf8');
  assert.match(html, /<p class="catalog-meta" id="catalogMeta"><\/p>\s*<div class="catalog-filter" id="catalogFilter"><\/div>/);
  assert.doesNotMatch(html, /catalog-kicker|catalogCount/);
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'site.css'), 'utf8');
  assert.doesNotMatch(css, /\.collection-|\.product-tile|\n\.ask \{/, 'no leftovers of the gallery');
  assert.match(css, /\.stock-foot \{[^}]*margin-top: auto;/, 'the price and the button at the card\'s foot');
});

test('products.json: the 8 finished goods with the owner prices, real photo files, no invented text', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const site = path.join(__dirname, '..');
  const { products } = JSON.parse(fs.readFileSync(path.join(site, 'data', 'products.json'), 'utf8'));
  assert.deepEqual(products.map(p => [p.id, p.name, p.price_rub]), [
    ['vanna-oniks-01', 'Ванная из оникса', 3977000],   // the first one shown (2026-10-15, the owner)
    ['rakushka-01', 'Ракушка', 37000],
    ['vaza-01', 'Ваза настольная', 177000],
    ['art-stol-belyy-01', 'Арт-стол (белый)', 2377000],   // (2026-10-15, the owner: the colour in brackets, no long dash)
    ['art-stol-chernyy-01', 'Арт-стол (чёрный)', 3077000],
    ['statuya-01', 'Статуя', 3377000],
    ['stol-01', 'Стол', 3177000],
    ['svetilnik-01', 'Светильник', 20000],
  ]);
  products.forEach(p => {
    assert.equal(p.description, null, p.id);
    assert.ok(p.photos.length >= 1, p.id);
    p.photos.forEach(src => {
      assert.ok(src.startsWith('/sayanmramor-site/assets/products/' + p.id + '/'), src);
      assert.ok(fs.existsSync(path.join(site, src.replace('/sayanmramor-site/', ''))), src);
    });
  });
  assert.equal(products.find(p => p.id === 'svetilnik-01').photos.length, 5);
});

test('the count: «1 изделие», «3 изделия», «8 изделий», «11 изделий», «21 изделие»', () => {
  assert.deepEqual([1, 3, 8, 11, 21, 22, 25].map(Catalog.countLabel),
    ['1 изделие', '3 изделия', '8 изделий', '11 изделий', '21 изделие', '22 изделия', '25 изделий']);
});

test('the ruble sign never wraps away from its number', () => {
  assert.ok(Catalog.formatProductPrice(3977000).endsWith(' ₽'));
});
