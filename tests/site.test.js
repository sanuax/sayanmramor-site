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

// ---- «Камины» on the site ----------------------------------------------------------

test('«Что можно заказать»: «Камины» before «Готовые изделия» (always last), and 4 photos -- each its own direction', () => {
  const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  const block = html.slice(html.indexOf('id="directionsTitle"'), html.indexOf('</section>', html.indexOf('id="directionsTitle"')));
  const grid = block.slice(block.indexOf('<div class="home-grid">'), block.indexOf('</div>'));
  const links = [...grid.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(m => [m[2], m[1]]);
  assert.deepEqual(links, [
    ['Лестницы', '/sayanmramor-site/categories/lestnitsy.html'],
    ['Ступени', '/sayanmramor-site/categories/stupeni.html'],
    ['Столешницы на кухню', '/sayanmramor-site/categories/stoleshnitsy-kuhnya.html'],
    ['Столешницы в ванную', '/sayanmramor-site/categories/stoleshnitsy-vannaya.html'],
    ['Подоконники', '/sayanmramor-site/categories/podokonniki.html'],
    ['Полы', '/sayanmramor-site/categories/poly.html'],
    ['Стены', '/sayanmramor-site/categories/steny.html'],
    ['Фасады', '/sayanmramor-site/categories/fasady.html'],
    ['Панно', '/sayanmramor-site/categories/panno.html'],
    ['Камины', '/sayanmramor-site/categories/kaminy.html'],
    ['Готовые изделия', '/sayanmramor-site/katalog.html'],
  ]);
  // The strip: one link per photo, never one link round all of them.
  const strip = block.slice(block.indexOf('<div class="home-feature">'));
  assert.doesNotMatch(block, /<a class="home-feature"/);
  const items = [...strip.matchAll(/<a class="home-feature-item" href="([^"]+)">\s*<img src="([^"]+)" alt="([^"]+)" loading="lazy"[^>]*>\s*<span class="home-feature-caption">([^<]+)<\/span>\s*<\/a>/g)]
    .map(([, href, src, alt, caption]) => ({ href, src, alt, caption }));
  assert.deepEqual(items.map(i => [i.caption, i.href]), [
    ['Лестницы', '/sayanmramor-site/categories/lestnitsy.html'],
    ['Камины', '/sayanmramor-site/categories/kaminy.html'],
    ['Подоконники', '/sayanmramor-site/categories/podokonniki.html'],
    ['Столешницы на кухню', '/sayanmramor-site/categories/stoleshnitsy-kuhnya.html'],
  ]);
  // Each link goes to the page the list itself uses for that direction.
  items.forEach(i => assert.ok(links.some(([label, href]) => label === i.caption && href === i.href), i.caption));
  // Each photo is a real exported photo from that direction's own portfolio.
  const portfolio = JSON.parse(fs.readFileSync(path.join(site, 'data', 'portfolio.json'), 'utf8'));
  const keyOf = { 'Лестницы': 'lestnitsa', 'Камины': 'kaminy', 'Подоконники': 'podokonnik', 'Столешницы на кухню': 'stoleshnitsa_kuhnya' };
  assert.deepEqual(items.map(i => i.src.split('/').pop()), ['201.webp', '005.webp', '098.webp', '143.webp']);
  items.forEach(i => {
    assert.ok(fs.existsSync(path.join(site, i.src.replace('/sayanmramor-site/', ''))), i.src);
    assert.ok(portfolio[keyOf[i.caption]].some(p => p.image === i.src), i.src + ' is a ' + i.caption + ' portfolio photo');
    assert.ok(i.alt.length > 10, 'meaningful alt');
  });
});

test('every page menu lists «Камины» after «Ступени»; the fireplace page marks it active', () => {
  pages.filter(p => p !== 'showroom.html').forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const nav = html.slice(html.indexOf('<nav class="site-nav">'), html.indexOf('</nav>'));
    const labels = [...nav.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map(m => m[1]);
    assert.equal(labels[labels.indexOf('Ступени') + 1], 'Камины', page);
    assert.equal(nav.includes('<a class="active" href="/sayanmramor-site/categories/kaminy.html">Камины</a>'), page === 'categories/kaminy.html', page);
  });
});

test('the fireplace page: the category template on the kaminy key', () => {
  const html = fs.readFileSync(path.join(site, 'categories', 'kaminy.html'), 'utf8');
  assert.match(html, /<h1>Камины из камня<\/h1>/);
  assert.match(html, /SiteCommon\.loadPortfolio\('kaminy', document\.getElementById\('portfolioGrid'\)\);/);
  assert.match(html, /CategoryPage\.init\('kaminy'\);/);
  assert.match(html, /href="\/calculator\/sayanmramor-calculator\.html\?product=kaminy"/);
});
