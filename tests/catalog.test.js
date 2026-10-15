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
      classList: {
        add(c) { if (!node.classList.contains(c)) node.className = (node.className + ' ' + c).trim(); },
        remove(c) { node.className = node.className.split(' ').filter(x => x && x !== c).join(' '); },
        contains(c) { return node.className.split(' ').includes(c); },
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

test('a piece\'s label: the price is plain text; «Запросить» is a quiet link to the request form, naming the piece', () => withDocument(() => {
  const card = Catalog.buildProductCard({ name: 'Ракушка', price_rub: 37000, photos: ['/r.jpg'] });
  const price = card.children.find(c => c.className === 'product-tile-price');
  assert.equal(price.tagName, 'DIV');
  assert.equal(price.textContent, '37\u00a0000\u00a0₽');
  const ask = card.children[card.children.length - 1];
  assert.equal(ask.tagName, 'A');
  assert.equal(ask.className, 'ask');
  assert.equal(ask.textContent, 'Запросить');
  assert.equal(ask.href, Catalog.ORDER_URL);
  assert.equal(Catalog.ORDER_URL, '/sayanmramor-site/index.html#offer');
  assert.equal(ask.attrs['aria-label'], 'Запросить: Ракушка');
  assert.ok(!card.children.some(c => /btn/.test(c.className)), 'no button in a row of buttons');
}));

test('the gallery: one piece at a time -- its words, its photograph; the arrows, the index and ← → change it', () => withDocument(() => {
  const products = [
    { name: 'Ракушка', price_rub: 37000, photos: ['/r.jpg'] },
    { name: 'Светильник', price_rub: 20000, photos: ['/s1.webp', '/s2.webp', '/s3.webp'] },
    { name: 'Стол', price_rub: 3177000, photos: [] },
  ];
  const c = Catalog.buildCollection(products);
  assert.deepEqual(c.root.children.map(x => x.className), ['collection-info', 'collection-stage', 'collection-cards']);
  const [info, stage, cards] = c.root.children;
  assert.deepEqual(info.children.map(x => x.className), ['collection-piece', 'collection-thumbs', 'collection-list', 'collection-nav']);
  const [piece, thumbs, list, nav] = info.children;
  const frame = stage.children[0];
  const words = () => [piece.children[0].textContent, piece.children[1].textContent, piece.children[2].children[0].textContent];
  const count = () => nav.children[1].textContent;
  const current = () => c.rows.map(b => b.attrs['aria-current']);
  const shown = () => frame.children.filter(s => s.classList.contains('is-on'));
  // The first piece: its name as a heading, its price, «Запросить».
  assert.equal(piece.children[0].tagName, 'H2');
  assert.deepEqual(words(), ['Ракушка', '37 000 ₽', 'Запросить']);
  assert.equal(count(), '1 из 3');
  assert.deepEqual(current(), ['true', 'false', 'false']);
  assert.equal(thumbs.children.length, 0, 'one photo: no thumbnails');
  assert.equal(list.tagName, 'OL');
  assert.deepEqual(c.rows.map(b => [b.tagName, b.type, b.textContent]), [['BUTTON', 'button', 'Ракушка'], ['BUTTON', 'button', 'Светильник'], ['BUTTON', 'button', 'Стол']]);
  // The arrow: the next piece; its photographs as thumbnails; one photograph at a time.
  c.next.listeners.click();
  assert.deepEqual(words(), ['Светильник', '20 000 ₽', 'Запросить']);
  assert.equal(count(), '2 из 3');
  assert.equal(thumbs.children.length, 3);
  thumbs.children[2].listeners.click();
  assert.deepEqual(thumbs.children.map(t => t.attrs['aria-current']), ['false', 'false', 'true']);
  assert.equal(shown().length, 1);
  assert.equal(shown()[0].children[0].src, '/s3.webp');
  // The index (the keyboard reaches it): no photo -- the quiet line.
  c.rows[2].listeners.focus();
  assert.equal(shown()[0].children[0].textContent, Catalog.NO_PHOTO_TEXT);
  // Past the last piece: the first again; back from the first: the last. ← → do the same.
  c.next.listeners.click();
  assert.equal(count(), '1 из 3');
  c.prev.listeners.click();
  assert.equal(count(), '3 из 3');
  let prevented = 0;
  c.root.listeners.keydown({ key: 'ArrowRight', preventDefault: () => prevented++ });
  assert.equal(count(), '1 из 3');
  assert.equal(prevented, 1);
  // A touch passing over the index does not preview.
  c.rows[1].listeners.pointerenter({ pointerType: 'touch' });
  assert.equal(count(), '1 из 3');
  // The narrow screen's column: every piece, as a card.
  assert.equal(cards.children.length, 3);
  assert.ok(cards.children.every(x => x.className === 'product-tile'));
}));

test('the place in the collection: «1 из 8» (2026-10-15, the owner: no «01 / 08»)', () => {
  assert.equal(Catalog.position(0, 8), '1 из 8');
  assert.equal(Catalog.position(11, 12), '12 из 12');
});

test('the count: «1 изделие», «3 изделия», «8 изделий», «11 изделий», «21 изделие»', () => {
  assert.deepEqual([1, 3, 8, 11, 21, 22, 25].map(Catalog.countLabel),
    ['1 изделие', '3 изделия', '8 изделий', '11 изделий', '21 изделие', '22 изделия', '25 изделий']);
});

test('the ruble sign never wraps away from its number', () => {
  assert.ok(Catalog.formatProductPrice(3977000).endsWith(' ₽'));
});
