// tests/site.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SiteCommon = require('../js/site.js');

const site = path.join(__dirname, '..');
const pages = ['index.html', 'katalog.html', 'showroom.html']
  .concat(fs.readdirSync(path.join(site, 'categories')).map(f => 'categories/' + f));

function filesIn(dir, ext) {
  return fs.readdirSync(path.join(site, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? filesIn(path.join(dir, e.name), ext) : e.name.endsWith(ext) ? [path.join(dir, e.name)] : []);
}

test('SiteCommon exports the expected functions', () => {
  assert.equal(typeof SiteCommon.renderPortfolio, 'function');
  assert.equal(typeof SiteCommon.loadPortfolio, 'function');
});

// Path convention (see README, «Локальный запуск»): one server rooted at
// D:\ serves this site as /sayanmramor-site/ and the calculator as
// /calculator/. Every page loads only this site's own CSS/JS -- never a
// calculator script or stylesheet, and never through <base>.
test('every page loads only this site\'s own CSS/JS, and every file exists', () => {
  pages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.ok(!/<base\b/i.test(html), page + ': <base> is not allowed');
    const refs = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="stylesheet"[^>]*\shref)="([^"]+)"/g)].map(m => m[1]);
    assert.ok(refs.length > 0, page);
    refs.forEach(ref => {
      assert.ok(ref.startsWith('/sayanmramor-site/'), page + ': ' + ref + ' is not a /sayanmramor-site/ file');
      assert.ok(fs.existsSync(path.join(site, ref.slice('/sayanmramor-site/'.length))), page + ': missing ' + ref);
    });
  });
});

// The only two contracts with the calculator: links to the configurator
// page, and the stone data in /calculator/data/ (slabs.json and the images
// it names). Any other /calculator/ reference would couple the site to the
// calculator's internals.
test('site code references the calculator only through the configurator URL and /calculator/data/', () => {
  const sources = pages.concat(filesIn('js', '.js'), filesIn('css', '.css'));
  sources.forEach(file => {
    const text = fs.readFileSync(path.join(site, file), 'utf8');
    [...text.matchAll(/\/calculator\/[^\s"'`)<>]*/g)].forEach(([ref]) => {
      assert.ok(ref.startsWith('/calculator/sayanmramor-calculator.html') || ref.startsWith('/calculator/data/'),
        file + ': ' + ref + ' is outside the site -> calculator contract');
    });
  });
});

test('site tests never load calculator modules', () => {
  filesIn('tests', '.js').forEach(file => {
    const text = fs.readFileSync(path.join(site, file), 'utf8');
    assert.ok(!/require\([^)]*calculator[\\/]/.test(text) && !/import[^;]*calculator[\\/]/.test(text), file);
  });
});
