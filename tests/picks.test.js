// tests/picks.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Picks = require('../js/picks.js');
const PicksPage = require('../js/picks-page.js');

const site = path.join(__dirname, '..');
function memoryStore(initial) {
  const data = new Map(initial ? [['sayan-picks', initial]] : []);
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}

test('a heart marks and unmarks, in the order marked, stones and pieces apart', () => {
  const store = memoryStore();
  assert.equal(Picks.total(Picks.read(store)), 0);
  assert.equal(Picks.toggle(store, Picks.STONES, 'b'), true);
  assert.equal(Picks.toggle(store, Picks.STONES, 'a'), true);
  assert.equal(Picks.toggle(store, Picks.PIECES, 'a'), true);
  assert.deepEqual(Picks.read(store), { stones: ['b', 'a'], pieces: ['a'] });
  assert.equal(Picks.toggle(store, Picks.STONES, 'b'), false);
  assert.deepEqual(Picks.read(store), { stones: ['a'], pieces: ['a'] });
});

test('a broken or strange saved list is no list, and throws nothing', () => {
  assert.deepEqual(Picks.read(memoryStore('{not json')), { stones: [], pieces: [] });
  assert.deepEqual(Picks.read(memoryStore('{"stones":"x","pieces":[1,"a","a",""]}')), { stones: [], pieces: ['a'] });
});

test('without working storage the hearts still hold on this page', () => {
  const store = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(Picks.toggle(store, Picks.STONES, 'held'), true);
  assert.deepEqual(Picks.read(store), { stones: ['held'], pieces: [] });
  assert.equal(Picks.toggle(null, Picks.PIECES, 'none'), true);
  assert.deepEqual(Picks.read(null), { stones: ['held'], pieces: ['none'] });
  Picks.toggle(memoryStore(), Picks.STONES, 'next');   // storage works again: the list is its own from now on
  assert.equal(Picks.read(null).stones.length, 0);
});

test('the link carries the list there and back, ids with odd characters too', () => {
  const picks = { stones: ['calacatta-nova', 'a b&c'], pieces: ['vaza-01'] };
  const url = Picks.sharePath(picks);
  assert.ok(url.startsWith(Picks.PAGE + '?s='));
  assert.deepEqual(Picks.readShared(url.slice(url.indexOf('?'))), picks);
  assert.equal(Picks.sharePath({ stones: [], pieces: [] }), Picks.PAGE);
  assert.equal(Picks.readShared(''), null);
  assert.equal(Picks.readShared('?s=&p='), null);
  assert.deepEqual(Picks.readShared('?p=x'), { stones: [], pieces: ['x'] });
});

test('merging someone\'s list loses nothing and repeats nothing', () => {
  const store = memoryStore('{"stones":["a"],"pieces":["p"]}');
  Picks.merge(store, { stones: ['b', 'a'], pieces: [] });
  assert.deepEqual(Picks.read(store), { stones: ['a', 'b'], pieces: ['p'] });
});

test('a stone that left the catalogue comes off the list; what is still there stays in order', () => {
  const store = memoryStore('{"stones":["old","b","a"],"pieces":["p"]}');
  const got = PicksPage.found(['old', 'b', 'a'], [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'new', name: 'N' }]);
  assert.deepEqual(got.known.map(s => s.id), ['b', 'a']);
  assert.equal(got.missing, 1);
  Picks.removeMissing(store, Picks.STONES, ['b', 'a']);
  assert.deepEqual(Picks.read(store), { stones: ['b', 'a'], pieces: ['p'] });
});

test('«Собрать» keeps the product of the direction page the visitor came from', () => {
  const calc = '/sayanmramor-calculator/sayanmramor-calculator.html';
  assert.equal(PicksPage.buildUrl('pure-white', 'kaminy'), calc + '?product=kaminy&stone=pure-white');
  assert.equal(PicksPage.buildUrl('pure-white', null), calc + '?stone=pure-white');
  assert.equal(Picks.readShared('?product=kaminy'), null, 'the product alone is not a shared list');
});

test('the count in words', () => {
  const stones = n => ({ stones: Array(n).fill('x'), pieces: [] });
  assert.equal(Picks.label(stones(1)), '1 камень');
  assert.equal(Picks.label(stones(3)), '3 камня');
  assert.equal(Picks.label(stones(11)), '11 камней');
  assert.equal(Picks.label(stones(21)), '21 камень');
  assert.equal(Picks.label({ stones: ['a', 'b'], pieces: ['c'] }), '2 камня, 1 изделие');
  assert.equal(Picks.label({ stones: [], pieces: ['a', 'b', 'c', 'd', 'e'] }), '5 изделий');
});

test('a request carries the shared list on its own page, else this browser\'s, else nothing', () => {
  const store = memoryStore('{"stones":["mine"],"pieces":[]}');
  assert.deepEqual(Picks.forRequest({ pathname: '/sayanmramor-site/index.html', search: '?s=theirs' }, store), { stones: ['mine'], pieces: [] });
  assert.deepEqual(Picks.forRequest({ pathname: Picks.PAGE, search: '?s=theirs' }, store), { stones: ['theirs'], pieces: [] });
  assert.deepEqual(Picks.forRequest({ pathname: Picks.PAGE, search: '' }, store), { stones: ['mine'], pieces: [] });
  assert.equal(Picks.forRequest({ pathname: Picks.PAGE, search: '' }, memoryStore()), null);
});

test('the Telegram message holds the request and the list\'s address', () => {
  const text = Picks.requestText('Кухня · Анна · +7 999', 'https://x.example/p?s=a,b');
  assert.equal(text, 'Заявка: Кухня · Анна · +7 999\nПодборка: https://x.example/p?s=a,b');
  assert.equal(Picks.telegramUrl('https://t.me/name', 'a b\nc'), 'https://t.me/name?text=a%20b%0Ac');
  assert.equal(Picks.requestText('', 'u'), 'Подборка: u');
});

test('pages: the page exists, the footer leads to it, galleries and requests load the module first', () => {
  const read = p => fs.readFileSync(path.join(site, p), 'utf8');
  const categories = fs.readdirSync(path.join(site, 'categories')).map(f => 'categories/' + f);
  const page = read('podborka.html');
  ['id="picksTitle"', 'id="picksHost"', 'id="picksActions"', 'data-offer-form data-offer-steps', 'PicksPage.init(document)'].forEach(s => assert.ok(page.includes(s), s));
  ['index.html', 'katalog.html', 'privacy.html', 'podborka.html', 'kamen.html'].concat(categories).forEach(p => {
    assert.ok(read(p).includes('<a href="/sayanmramor-site/podborka.html">Моя подборка</a>'), p + ': footer');
    assert.ok(read(p).includes('<a href="/sayanmramor-site/kamen.html">Камень</a>'), p + ': footer, the stone');
  });
  ['index.html', 'katalog.html', 'podborka.html'].concat(categories).forEach(p => {
    const html = read(p);
    const module = html.indexOf('js/picks.js');
    assert.ok(module > 0, p);
    ['js/offer-form.js', 'js/catalog.js'].forEach(s => {
      if (html.includes(s)) assert.ok(module < html.indexOf(s), p + ': before ' + s);
    });
  });
  const galleries = categories.filter(p => read(p).includes('stone-section'));
  assert.ok(galleries.length > 0);
  ['katalog.html', 'podborka.html', 'kamen.html'].concat(galleries).forEach(p => assert.ok(read(p).includes('css/picks.css'), p + ': css'));
});

test('«Камень»: the stone gallery on its own page; the empty «Моя подборка» leads there, not to the calculator', () => {
  const read = p => fs.readFileSync(path.join(site, p), 'utf8');
  const page = read('kamen.html');
  ['<h1 id="pageTitle">Камень</h1>', 'class="stone-section" aria-labelledby="pageTitle"', 'id="stoneGrid"', 'id="configureCta"', 'data-offer-form data-offer-steps', 'CategoryPage.init(null)'].forEach(s => assert.ok(page.includes(s), s));
  assert.doesNotMatch(page, /data-preselect=|\?product=|<summary class="active">/, 'no product, no current section of the menu');
  assert.ok(page.indexOf('js/picks.js') < page.indexOf('CategoryPage.init'));
  const CategoryPage = require('../js/category-page.js');
  assert.equal(CategoryPage.stoneOnlyUrl(null), '/sayanmramor-calculator/sayanmramor-calculator.html');
  assert.equal(CategoryPage.stoneOnlyUrl('nero-marquina'), '/sayanmramor-calculator/sayanmramor-calculator.html?stone=nero-marquina');
  const empty = read('js/picks-page.js');
  assert.ok(empty.includes("stones.href = '/sayanmramor-site/kamen.html'"), 'the empty state leads to the stone');
});
