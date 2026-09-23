// tests/site.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const SiteCommon = require('../js/site.js');

test('SiteCommon exports the expected functions', () => {
  assert.equal(typeof SiteCommon.injectMaterialPickerMarkup, 'function');
  assert.equal(typeof SiteCommon.renderPortfolio, 'function');
  assert.equal(typeof SiteCommon.loadPortfolio, 'function');
});

// Path convention (see README, «Локальный запуск»): one server rooted at
// D:\ serves this site as /sayanmramor-site/ and the calculator as
// /calculator/. Every page's own CSS/JS must be an existing
// /sayanmramor-site/ file; calculator files are either /calculator/... or,
// only on pages with <base href="/calculator/">, relative -- and must exist.
test('every page loads its CSS/JS through the /sayanmramor-site/ + /calculator/ convention, and every file exists', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const site = path.join(__dirname, '..');
  const calculator = path.join(site, '..', 'calculator');
  const pages = ['index.html', 'katalog.html', 'showroom.html'].concat(fs.readdirSync(path.join(site, 'categories')).map(f => 'categories/' + f));
  pages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const hasCalculatorBase = /<base href="\/calculator\/">/.test(html);
    const refs = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="stylesheet"[^>]*\shref)="([^"]+)"/g)].map(m => m[1]);
    assert.ok(refs.length > 0, page);
    refs.forEach(ref => {
      if (ref.startsWith('/sayanmramor-site/')) {
        assert.ok(fs.existsSync(path.join(site, ref.slice('/sayanmramor-site/'.length))), page + ': missing ' + ref);
      } else if (ref.startsWith('/calculator/')) {
        assert.ok(fs.existsSync(path.join(calculator, ref.slice('/calculator/'.length))), page + ': missing ' + ref);
      } else {
        assert.ok(hasCalculatorBase && !ref.startsWith('/') && !/^https?:/.test(ref), page + ': ' + ref + ' breaks the /sayanmramor-site/ convention');
        assert.ok(fs.existsSync(path.join(calculator, ref)), page + ': calculator file missing ' + ref);
      }
    });
  });
});
