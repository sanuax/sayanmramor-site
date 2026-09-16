// tests/category-calculator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const CategoryCalculator = require('../js/category-calculator.js');
const ProductTypes = require('../../calculator/product-types.js');
const Pricing = require('../../calculator/pricing.js');

test('computeOptionSurchargeSum sums only the checked options', () => {
  const sum = CategoryCalculator.computeOptionSurchargeSum(
    { complex: true, polish: false, install: true },
    ProductTypes.OPTION_SURCHARGE
  );
  const expected = ProductTypes.OPTION_SURCHARGE.complex + ProductTypes.OPTION_SURCHARGE.install;
  assert.ok(Math.abs(sum - expected) < 1e-9);
});

test('computeOptionSurchargeSum is 0 when nothing is selected', () => {
  const sum = CategoryCalculator.computeOptionSurchargeSum(
    { complex: false, polish: false, install: false },
    ProductTypes.OPTION_SURCHARGE
  );
  assert.equal(sum, 0);
});

test('buildSurchargeLabels lists only the checked options with their percentage', () => {
  const labels = CategoryCalculator.buildSurchargeLabels(
    { complex: true, polish: true, install: false },
    ProductTypes.OPTION_SURCHARGE
  );
  assert.deepEqual(labels, ['сложная форма +25%', 'полировка +10%']);
});

test('buildPricingParams uses the product-types config and the stone hardness override', () => {
  const stone = { hardness_category: 2, slabs: [] };
  const product = ProductTypes.PRODUCTS.pol;
  const params = CategoryCalculator.buildPricingParams({
    stone, widthM: 2, lengthM: 3, product, productTypes: ProductTypes, optionSurchargeSum: 0.1
  });
  assert.equal(params.productType, product.type);
  assert.equal(params.complexityMultiplier, product.complexityMultiplier);
  assert.equal(params.marginCm, ProductTypes.SAW_MARGIN_CM);
  assert.equal(params.wasteFactor, ProductTypes.AREA_WASTE_FACTOR);
  assert.equal(params.workMultiplier, ProductTypes.HARDNESS_WORK_MULTIPLIER[2]);
  assert.equal(params.allowSeam, true);
});

test('buildPricingParams falls back to WORK_MULTIPLIER when the stone has no hardness_category', () => {
  const stone = { slabs: [] };
  const product = ProductTypes.PRODUCTS.stupeni;
  const params = CategoryCalculator.buildPricingParams({
    stone, widthM: 1, lengthM: 1, product, productTypes: ProductTypes, optionSurchargeSum: 0
  });
  assert.equal(params.workMultiplier, ProductTypes.WORK_MULTIPLIER);
});

test('buildPricingParams output feeds Pricing.calculatePrice and matches the expected total', () => {
  // Same single-slab fixture shape as D:\calculator\tests\pricing.test.js.
  const stone = {
    hardness_category: 1,
    slabs: [
      { article: 'P0444194', width_cm: 276, length_cm: 177, price_per_m2_rub: 11008, price_total_rub: 52673 },
    ]
  };
  const product = ProductTypes.PRODUCTS.pol; // type B, complexityMultiplier 1.0
  const params = CategoryCalculator.buildPricingParams({
    stone, widthM: 1, lengthM: 1, product, productTypes: ProductTypes, optionSurchargeSum: 0
  });
  const result = Pricing.calculatePrice(params);
  assert.equal(result.ok, true);
  // area 1*1=1 m2, waste 1.3 -> 1.3 m2 needed; the one slab (2.76*1.77=4.8852 m2) covers it alone.
  assert.equal(result.subtotal, 52673);
  // work = subtotal * WORK_MULTIPLIER(2, hardness 1) * complexityMultiplier(1.0) * (1+0) = subtotal * 2
  // total = subtotal + work = subtotal * 3
  assert.equal(result.total, 52673 * 3);
});

test('messageForReason returns the specific message for a known reason', () => {
  assert.match(CategoryCalculator.messageForReason('no_priced_slab'), /актуальная цена ещё не определена/);
  assert.match(CategoryCalculator.messageForReason('no_slabs_for_stone'), /нет данных о слэбах/);
  assert.match(CategoryCalculator.messageForReason('insufficient_stock'), /не покрывают нужный объём/);
  assert.match(CategoryCalculator.messageForReason('no_fitting_slab'), /шов возможен только по длине/);
});

test('messageForReason falls back to the generic message for an unknown reason', () => {
  assert.match(CategoryCalculator.messageForReason('something_else'), /Подходящего слэба нет в наличии/);
});

test('pluralizeSlabs picks the correct Russian plural form', () => {
  assert.equal(CategoryCalculator.pluralizeSlabs(1), 'слэб');
  assert.equal(CategoryCalculator.pluralizeSlabs(2), 'слэба');
  assert.equal(CategoryCalculator.pluralizeSlabs(5), 'слэбов');
  assert.equal(CategoryCalculator.pluralizeSlabs(11), 'слэбов');
  assert.equal(CategoryCalculator.pluralizeSlabs(21), 'слэб');
});

test('formatRub rounds to the nearest ruble and appends the sign', () => {
  const formatted = CategoryCalculator.formatRub(158019.6);
  assert.ok(formatted.endsWith('₽'));
  assert.ok(formatted.replace(/\s/g, '').startsWith('158020'));
});

test('formatDate returns an empty string for a missing date and a locale string otherwise', () => {
  assert.equal(CategoryCalculator.formatDate(null), '');
  assert.equal(CategoryCalculator.formatDate(undefined), '');
  const formatted = CategoryCalculator.formatDate('2026-09-16T00:00:00+03:00');
  assert.ok(formatted.length > 0);
  assert.notEqual(formatted, '2026-09-16T00:00:00+03:00');
});

test('CategoryCalculator exposes init', () => {
  assert.equal(typeof CategoryCalculator.init, 'function');
});
