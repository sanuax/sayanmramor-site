// tests/site.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const SiteCommon = require('../js/site.js');

test('SiteCommon exports the expected functions', () => {
  assert.equal(typeof SiteCommon.injectMaterialPickerMarkup, 'function');
  assert.equal(typeof SiteCommon.renderPortfolio, 'function');
  assert.equal(typeof SiteCommon.loadPortfolio, 'function');
});
