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
