// tests/price-filter.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PriceFilter = require('../js/price-filter.js');

const NB = String.fromCharCode(0xa0);
const plain = s => s.split(NB).join(' ');

test('bounds: the cheapest and the dearest price, rounded outward; nothing without prices', () => {
  assert.deepEqual(PriceFilter.bounds([2109, 26541, 727354, null, 0]), { min: 2100, max: 728000 });
  assert.deepEqual(PriceFilter.bounds([15400, 15400]), { min: 15000, max: 16000 });
  assert.equal(PriceFilter.bounds([]), null);
  assert.equal(PriceFilter.bounds([null, NaN, -5]), null);
});

test('the scale is logarithmic: the ends map to the ends, the middle to the geometric mean, prices round to a step that suits them', () => {
  const s = PriceFilter.makeScale(2000, 800000);
  assert.equal(s.toPos(2000), 0);
  assert.equal(s.toPos(800000), PriceFilter.STEPS);
  assert.equal(s.toPos(1), 0, 'below the scale: its start');
  assert.equal(s.toPos(9e9), PriceFilter.STEPS, 'above it: its end');
  assert.equal(s.toPrice(0), 2000);
  assert.equal(s.toPrice(PriceFilter.STEPS), 800000);
  assert.equal(s.toPrice(PriceFilter.STEPS / 2), 40000, 'sqrt(2 000 x 800 000) = 40 000');
  assert.equal(PriceFilter.roundNice(4321), 4300);
  assert.equal(PriceFilter.roundNice(43210), 43200);
  assert.equal(PriceFilter.roundNice(432100), 432000);
  // A position and back lands on the same position (the rounding never jumps a handle).
  for (let pos = 0; pos <= PriceFilter.STEPS; pos += 37) {
    assert.ok(Math.abs(s.toPos(s.toPrice(pos)) - pos) <= 2, String(pos));
  }
});

test('formatting and parsing roubles', () => {
  assert.equal(plain(PriceFilter.formatRub(727354)), '727 354');
  assert.equal(PriceFilter.formatRub(900), '900');
  assert.equal(plain(PriceFilter.formatShort(728000)), '728 тыс.');
  assert.equal(plain(PriceFilter.formatShort(2100)), '2,1 тыс.');
  assert.equal(plain(PriceFilter.formatShort(10000)), '10 тыс.');
  assert.equal(PriceFilter.parseRub('12' + NB + '500 ₽'), 12500);
  assert.equal(PriceFilter.parseRub(' 12 500 '), 12500);
  assert.equal(PriceFilter.parseRub(''), null);
  assert.equal(PriceFilter.parseRub('абв'), null);
});

test('ticks: the two ends, and round prices between them where they fall on the scale, none crowding another', () => {
  const t = PriceFilter.ticks(2100, 728000);
  assert.deepEqual(t.map(x => plain(x.label)), ['2,1 тыс.', '10 тыс.', '50 тыс.', '728 тыс.']);
  assert.equal(t[0].at, 0);
  assert.equal(t[t.length - 1].at, 1);
  t.slice(1).forEach((x, i) => assert.ok(x.at - t[i].at >= 0.17, x.label));
  t.slice(1, -1).forEach(x => assert.ok(x.at >= 0.25 && x.at <= 0.75, x.label + ': clear of the ends, whose labels stand inward'));
  assert.deepEqual(PriceFilter.ticks(15000, 16000).map(x => plain(x.label)), ['15 тыс.', '16 тыс.'], 'no room between: only the ends');
});

test('inRange and summary: an unset end is open; a stone without a price passes only an unset filter', () => {
  assert.equal(PriceFilter.inRange(5000, { from: null, to: null }), true);
  assert.equal(PriceFilter.inRange(null, { from: null, to: null }), true);
  assert.equal(PriceFilter.inRange(null, { from: 1000, to: null }), false);
  assert.equal(PriceFilter.inRange(5000, { from: 5000, to: 10000 }), true);
  assert.equal(PriceFilter.inRange(10001, { from: 5000, to: 10000 }), false);
  assert.equal(PriceFilter.inRange(4999, { from: 5000, to: null }), false);
  assert.equal(PriceFilter.inRange(999999, { from: 5000, to: null }), true);
  assert.equal(PriceFilter.summary({ from: null, to: null }), '');
  assert.equal(plain(PriceFilter.summary({ from: 10000, to: null })), 'от 10 тыс.');
  assert.equal(plain(PriceFilter.summary({ from: null, to: 50000 })), 'до 50 тыс.');
  assert.equal(plain(PriceFilter.summary({ from: 10000, to: 50000 })), '10 тыс. – 50 тыс.');
});

test('the site and the configurator carry the same file', () => {
  const calc = path.join('D:', 'calculator', '.worktrees', 'rate-catalog-subcategories', 'price-filter.js');
  if (!fs.existsSync(calc)) return;   // another machine: only the site is here
  const norm = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/^\/\/ (js\/)?price-filter\.js\n/, '');
  assert.equal(norm(path.join(__dirname, '..', 'js', 'price-filter.js')), norm(calc));
});

test('histogram: how many prices fall in each equal part of the logarithmic scale; no price, no count', () => {
  assert.deepEqual(PriceFilter.histogram([2100, 5000, 26000, 26000, 700000, null, 0], 2100, 728000, 8), [1, 1, 0, 2, 0, 0, 0, 1]);
  assert.equal(PriceFilter.histogram([], 2100, 728000).length, 32, '32 bars by default');
  assert.equal(PriceFilter.histogram([728000], 2100, 728000, 4)[3], 1, 'the top price lands in the last bar');
});
