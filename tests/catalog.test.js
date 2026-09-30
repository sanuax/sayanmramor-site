// tests/catalog.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Catalog = require('../js/catalog.js');

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

// ---- the photo area of a product card (a minimal stand-in for the DOM) ----------

function fakeDocument() {
  function el(tag) {
    const node = {
      tagName: tag.toUpperCase(), className: '', textContent: '', children: [], parent: null, listeners: {}, attrs: {},
      setAttribute(name, value) { node.attrs[name] = String(value); },
      classList: { add(c) { node.className = (node.className + ' ' + c).trim(); } },
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
  return { createElement: el };
}

function withDocument(fn) {
  const saved = global.document;
  global.document = fakeDocument();
  try { return fn(); } finally { global.document = saved; }
}

const photoArea = card => card.children.find(c => c.className === 'product-tile-image');
const placeholders = area => area.children.filter(c => c.className === 'product-tile-placeholder');
const images = area => area.children.filter(c => c.tagName === 'IMG');

test('a product with photos: [] gets the text placeholder, not an image with an empty src', () => withDocument(() => {
  const area = photoArea(Catalog.buildProductCard({ name: 'Светильник из оникса', photos: [] }));
  assert.equal(images(area).length, 0);
  assert.equal(placeholders(area).length, 1);
  assert.equal(placeholders(area)[0].textContent, Catalog.NO_PHOTO_TEXT);
}));

test('a product without a photos field gets the same placeholder', () => withDocument(() => {
  const area = photoArea(Catalog.buildProductCard({ name: 'Эксклюзивный стол' }));
  assert.equal(images(area).length, 0);
  assert.equal(placeholders(area).length, 1);
}));

test('a product with one photo shows it as before: photos[0], named by the product', () => withDocument(() => {
  const area = photoArea(Catalog.buildProductCard({ name: 'Ракушка', photos: ['/a.webp'] }));
  const [img] = images(area);
  assert.equal(img.src, '/a.webp');
  assert.equal(img.alt, 'Ракушка');
  assert.equal(img.loading, 'lazy');
  assert.equal(placeholders(area).length, 0);
}));

test('a photo that fails to load is replaced by the placeholder in the same place', () => withDocument(() => {
  const area = photoArea(Catalog.buildProductCard({ name: 'Ракушка', photos: ['/missing.webp'], available: false }));
  const [img] = images(area);
  img.listeners.error();
  assert.equal(images(area).length, 0);
  assert.equal(area.children[0].className, 'product-tile-placeholder');   // still ahead of the badge
  assert.equal(area.children[1].className, 'badge-oos');
}));

test('a product with several photos gets one swipeable, focusable row of them, labelled once, with a count', () => withDocument(() => {
  const photos = ['/1.webp', '/2.webp', '/3.webp', '/4.webp', '/5.webp'];
  const area = photoArea(Catalog.buildProductCard({ name: 'Светильник', photos }));
  const strip = area.children.find(c => c.className === 'product-tile-strip');
  assert.ok(strip);
  assert.equal(strip.tabIndex, 0);
  assert.equal(strip.attrs['aria-label'], 'Светильник, 5 фото');
  assert.deepEqual(images(strip).map(i => i.src), photos);
  assert.deepEqual(images(strip).map(i => i.alt), ['Фото 1 из 5', 'Фото 2 из 5', 'Фото 3 из 5', 'Фото 4 из 5', 'Фото 5 из 5']);
  const count = area.children.find(c => c.className === 'product-tile-count');
  assert.equal(count.textContent, '5 фото');
  assert.equal(count.attrs['aria-hidden'], 'true');
  images(strip)[2].listeners.error();                       // one missing photo: only its frame changes
  assert.equal(strip.children[2].className, 'product-tile-placeholder');
  assert.equal(images(strip).length, 4);
}));

test('a product with one photo keeps the single image: no row, no count', () => withDocument(() => {
  const area = photoArea(Catalog.buildProductCard({ name: 'Ваза настольная', photos: ['/v.jpg'] }));
  assert.equal(area.children.length, 1);
  assert.equal(area.children[0].tagName, 'IMG');
  assert.equal(area.children[0].alt, 'Ваза настольная');
}));

test('products.json: the 8 finished goods with the owner prices, real photo files, no invented text', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const site = path.join(__dirname, '..');
  const { products } = JSON.parse(fs.readFileSync(path.join(site, 'data', 'products.json'), 'utf8'));
  assert.deepEqual(products.map(p => [p.id, p.name, p.price_rub]), [
    ['rakushka-01', 'Ракушка', 37000],
    ['vaza-01', 'Ваза настольная', 177000],
    ['art-stol-belyy-01', 'Арт-стол — белый', 2377000],
    ['art-stol-chernyy-01', 'Арт-стол — чёрный', 3077000],
    ['statuya-01', 'Статуя', 3377000],
    ['stol-01', 'Стол', 3177000],
    ['vanna-oniks-01', 'Ванная из оникса', 3977000],
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

test('the price is plain text; «Купить» is the primary button of the site, leading to the contacts', () => withDocument(() => {
  const card = Catalog.buildProductCard({ name: 'Ракушка', price_rub: 37000, photos: ['/r.jpg'] });
  const price = card.children.find(c => c.className === 'product-tile-price');
  assert.equal(price.tagName, 'DIV');
  assert.equal(price.textContent, '37 000 ₽');
  const buy = card.children[card.children.length - 1];
  assert.equal(buy.tagName, 'A');
  assert.equal(buy.className, 'btn btn-primary product-tile-buy');
  assert.equal(buy.textContent, 'Купить');
  assert.equal(buy.href, Catalog.ORDER_URL);
  assert.equal(Catalog.ORDER_URL, '/sayanmramor-site/index.html#contacts');
  assert.equal(buy.attrs['aria-label'], 'Купить: Ракушка');
}));

test('the ruble sign never wraps away from its number', () => {
  assert.ok(Catalog.formatProductPrice(3977000).endsWith(' ₽'));
});
