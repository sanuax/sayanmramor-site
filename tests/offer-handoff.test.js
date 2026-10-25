const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const OfferHandoff = require('../js/offer-handoff.js');
const OfferForm = require('../js/offer-form.js');

const site = path.join(__dirname, '..');
const KITCHEN = '/sayanmramor-site/categories/stoleshnitsy-kuhnya.html';

// A storage as the browser has it, and one that throws on every call (a private window, a blocked site).
function memoryStore() {
  const data = {};
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
  };
}
const brokenStore = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
};

test('the ten directions the calculator builds, the catalogue, and the rest', () => {
  assert.equal(OfferHandoff.branchOf('kuhnya'), 'calc');
  assert.equal(OfferHandoff.branchOf('gotovye-izdeliya'), 'katalog');
  assert.equal(OfferHandoff.branchOf('hammamy'), 'plain');
  assert.equal(OfferHandoff.branchOf(''), 'plain');
  assert.deepEqual(OfferHandoff.CALC_PRODUCT, {
    lestnitsy: 'lestnitsa', panno: 'panno', podokonniki: 'podokonnik', poly: 'pol', steny: 'stena',
    fasady: 'fasad', vannaya: 'stoleshnitsa_vannaya', kuhnya: 'stoleshnitsa_kuhnya', stupeni: 'stupeni', kaminy: 'kaminy',
  });
  const keys = OfferForm.DIRECTIONS.map(d => d.key);
  Object.keys(OfferHandoff.CALC_PRODUCT).forEach(k => assert.ok(keys.includes(k), k));
  assert.ok(keys.includes(OfferHandoff.KATALOG_KEY));
  Object.values(OfferHandoff.CALC_PRODUCT).forEach(p => assert.ok(OfferHandoff.CALC_LABEL[p], p));
  assert.equal(OfferHandoff.CALC_LABEL.stoleshnitsa_kuhnya, 'Столешницы на кухню');
});

test('the addresses: the calculator on a product, back to a passport link, the catalogue', () => {
  assert.equal(OfferHandoff.calcUrl('kuhnya'), '/sayanmramor-calculator/sayanmramor-calculator.html?product=stoleshnitsa_kuhnya');
  assert.equal(OfferHandoff.editUrl('product=pol&pv=1'), '/sayanmramor-calculator/sayanmramor-calculator.html?product=pol&pv=1');
  assert.equal(OfferHandoff.KATALOG, '/sayanmramor-site/katalog.html');
  assert.equal(OfferHandoff.HOME, '/sayanmramor-site/index.html');
});

test('a request returns to the page it was started on, else to the home page', () => {
  const store = memoryStore();
  assert.equal(OfferHandoff.returnUrl(store, 'piece=vaza-01'), '/sayanmramor-site/index.html?piece=vaza-01#offer');
  OfferHandoff.saveTalk(store, { page: KITCHEN, direction: 'kuhnya', name: 'Анна', nameSkipped: false, phone: '', current: 'fork', piece: null, attachmentName: '' });
  assert.equal(OfferHandoff.returnUrl(store, 'product=stoleshnitsa_kuhnya&pv=1'), KITCHEN + '?product=stoleshnitsa_kuhnya&pv=1#offer');
  assert.equal(OfferHandoff.returnUrl(store, ''), KITCHEN + '#offer');
  assert.equal(OfferHandoff.loadTalk(store).name, 'Анна');
});

test('what the address brings: a ready piece, a calculator passport link, or nothing', () => {
  assert.deepEqual(OfferHandoff.readArrival('?piece=vaza-01'), { kind: 'katalog', id: 'vaza-01' });
  assert.deepEqual(OfferHandoff.readArrival('?product=pol&stone=x&pv=1&len=3000'), { kind: 'calc', query: 'product=pol&stone=x&pv=1&len=3000' });
  assert.equal(OfferHandoff.readArrival(''), null);
  assert.equal(OfferHandoff.readArrival('?product=pol'), null);
});

test('the calculator\'s record is taken once and only for its own passport link', () => {
  const store = memoryStore();
  const piece = { kind: 'calc', query: 'product=pol&pv=1', product: 'Полы', stone: 'Taj Mahal', stoneImage: '', sizes: '3000 × 2000 мм', price: '≈ 186 400 ₽', priced: true };
  OfferHandoff.putCalcPiece(store, piece);
  assert.deepEqual(OfferHandoff.takeCalcPiece(store, 'product=pol&pv=1'), piece);
  assert.equal(OfferHandoff.takeCalcPiece(store, 'product=pol&pv=1'), null, 'gone after it was taken');
  OfferHandoff.putCalcPiece(store, piece);
  assert.equal(OfferHandoff.takeCalcPiece(store, 'product=stena&pv=1'), null, 'another configuration');
  assert.deepEqual(Object.keys(store.data), [], 'a stale record is removed too');
});

test('a ready piece from data/products.json; a missing or sold one gives no card', () => {
  const products = JSON.parse(fs.readFileSync(path.join(site, 'data', 'products.json'), 'utf8')).products;
  const shell = OfferHandoff.catalogPiece(products, 'rakushka-01');
  assert.equal(shell.kind, 'katalog');
  assert.equal(shell.name, 'Ракушка');
  assert.equal(shell.price, 37000);
  assert.equal(shell.photo, '/sayanmramor-site/assets/products/rakushka-01/1.webp');
  assert.equal(OfferHandoff.catalogPiece(products, 'no-such-piece'), null);
  assert.equal(OfferHandoff.catalogPiece([{ id: 'x', name: 'X', available: false, photos: [] }], 'x'), null);
});

test('without the calculator\'s record: the product and the stone from the address, no price', () => {
  const piece = OfferHandoff.calcPieceFromIndex('product=stoleshnitsa_kuhnya&stone=s1&pv=1', [{ id: 's1', name: 'Taj Mahal', image: 'images/s1.webp' }]);
  assert.equal(piece.kind, 'calc');
  assert.equal(piece.query, 'product=stoleshnitsa_kuhnya&stone=s1&pv=1');
  assert.equal(piece.product, 'Столешницы на кухню');
  assert.equal(piece.stone, 'Taj Mahal');
  assert.equal(piece.stoneImage, '/sayanmramor-calculator/data/images/s1.webp');
  assert.equal(piece.price, '');
  assert.equal(piece.priced, false);
});

test('prices as the catalogue writes them', () => {
  assert.equal(OfferHandoff.formatRub(37000), '37' + ' ' + '000' + ' ' + '₽');
  assert.equal(OfferHandoff.formatRub(null), 'Цена по запросу');
});

test('a blocked storage never breaks the request', () => {
  assert.doesNotThrow(() => OfferHandoff.saveTalk(brokenStore, { page: KITCHEN }));
  assert.equal(OfferHandoff.loadTalk(brokenStore), null);
  assert.doesNotThrow(() => OfferHandoff.putCalcPiece(brokenStore, { query: 'x' }));
  assert.equal(OfferHandoff.takeCalcPiece(brokenStore, 'x'), null);
  assert.equal(OfferHandoff.returnUrl(brokenStore, 'piece=a'), '/sayanmramor-site/index.html?piece=a#offer');
  assert.equal(OfferHandoff.returnUrl(null, ''), '/sayanmramor-site/index.html#offer');
});
