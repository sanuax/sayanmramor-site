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
// page, and the stone data in /calculator/data/ (stone-index.json and the images
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
    ['Кухня', '/sayanmramor-site/categories/stoleshnitsy-kuhnya.html'],
    ['Ванная', '/sayanmramor-site/categories/stoleshnitsy-vannaya.html'],
    ['Подоконники', '/sayanmramor-site/categories/podokonniki.html'],
    ['Полы', '/sayanmramor-site/categories/poly.html'],
    ['Стены', '/sayanmramor-site/categories/steny.html'],
    ['Фасады', '/sayanmramor-site/categories/fasady.html'],
    ['Панно', '/sayanmramor-site/categories/panno.html'],
    ['Камины', '/sayanmramor-site/categories/kaminy.html'],
    ['Спа зоны', '/sayanmramor-site/categories/spa-zony.html'],
    ['Хаммамы', '/sayanmramor-site/categories/hammamy.html'],
    ['Бассейны', '/sayanmramor-site/categories/basseyny.html'],
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
    ['Кухня', '/sayanmramor-site/categories/stoleshnitsy-kuhnya.html'],
  ]);
  // Each link goes to the page the list itself uses for that direction.
  items.forEach(i => assert.ok(links.some(([label, href]) => label === i.caption && href === i.href), i.caption));
  // Each photo is a real exported photo from that direction's own portfolio.
  const portfolio = JSON.parse(fs.readFileSync(path.join(site, 'data', 'portfolio.json'), 'utf8'));
  const keyOf = { 'Лестницы': 'lestnitsa', 'Камины': 'kaminy', 'Подоконники': 'podokonnik', 'Кухня': 'stoleshnitsa_kuhnya' };
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
    assert.equal(nav.includes('<a class="active" href="/sayanmramor-site/categories/kaminy.html" aria-current="page">Камины</a>'), page === 'categories/kaminy.html', page);
  });
});

test('every page: a skip link to <main id="main">; the active menu item is aria-current', () => {
  pages.filter(p => p !== 'showroom.html').forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.ok(html.includes('<a class="skip-link" href="#main">'), page);
    assert.equal((html.match(/<main[\s>]/g) || []).length, 1, page);
    assert.match(html, /<main [^>]*id="main"/, page);
    const nav = html.slice(html.indexOf('<nav class="site-nav">'), html.indexOf('</nav>'));
    const active = nav.match(/<a class="active"[^>]*>/g) || [];
    const current = nav.match(/aria-current="page"/g) || [];
    assert.equal(current.length, active.length, page);
    active.forEach(a => assert.ok(a.includes('aria-current="page"'), page));
  });
});

test('the fireplace page: the category template on the kaminy key', () => {
  const html = fs.readFileSync(path.join(site, 'categories', 'kaminy.html'), 'utf8');
  assert.match(html, /<h1>Камины из камня<\/h1>/);
  assert.match(html, /SiteCommon\.loadPortfolio\('kaminy', document\.getElementById\('portfolioGrid'\)\);/);
  assert.match(html, /CategoryPage\.init\('kaminy'\);/);
  assert.match(html, /href="\/calculator\/sayanmramor-calculator\.html\?product=kaminy"/);
});

test('menu edge fades: scroll-driven only where supported, the static fade stays as the fallback', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const block = css.slice(css.indexOf('@media (max-width: 1148px)'), css.indexOf('@media (max-width: 900px)'));
  // Fallback: the original static right fade, outside @supports.
  const supportsAt = block.indexOf('@supports (animation-timeline: scroll())');
  assert.ok(supportsAt > 0);
  assert.ok(block.slice(0, supportsAt).includes('mask-image: linear-gradient(90deg, #000 85%, transparent);'));
  // Dynamic fades: tied to the row's own horizontal scroll, 48 px each side.
  const dynamic = block.slice(supportsAt);
  assert.match(dynamic, /animation-timeline: scroll\(self inline\);/);
  assert.match(dynamic, /var\(--nav-fade-l\)/);
  assert.match(dynamic, /calc\(100% - var\(--nav-fade-r\)\)/);
  assert.match(css, /@property --nav-fade-l \{ syntax: '<length>'; inherits: false; initial-value: 0px; \}/);
  assert.match(css, /@property --nav-fade-r \{ syntax: '<length>'; inherits: false; initial-value: 0px; \}/);
  const keyframes = css.slice(css.indexOf('@keyframes nav-edges'));
  assert.match(keyframes, /0% \{ --nav-fade-l: 0px; --nav-fade-r: 48px; \}/);
  assert.match(keyframes, /100% \{ --nav-fade-l: 48px; --nav-fade-r: 0px; \}/);
});

test('every page: the header button keeps its full name, with «изделие» as the tail hidden on very narrow screens', () => {
  pages.filter(p => p !== 'showroom.html').forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.ok(html.includes('<a class="btn btn-primary site-header-cta" href="/calculator/sayanmramor-calculator.html" aria-label="Создать изделие"><span>Создать<span class="site-header-cta-tail"> изделие</span></span></a>'), page);
  });
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const narrow = css.slice(css.indexOf('@media (max-width: 360px)'));
  assert.match(narrow.slice(0, narrow.indexOf('}\n}') + 3), /\.site-header-cta-tail \{ display: none; \}/);
});

// ---- Спа зоны / Хаммамы / Бассейны, footer, privacy, коммерческое предложение ----

const SITE_ONLY = [
  ['spa-zony', 'Спа зоны'], ['hammamy', 'Хаммамы'], ['basseyny', 'Бассейны'],
];

test('every page menu: Спа зоны, Хаммамы, Бассейны right after «Камины»; «Ванная» and «Кухня» by their new names', () => {
  pages.filter(p => p !== 'showroom.html').forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const nav = html.slice(html.indexOf('<nav class="site-nav">'), html.indexOf('</nav>'));
    const labels = [...nav.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map(m => m[1]);
    assert.deepEqual(labels.slice(labels.indexOf('Камины') + 1, labels.indexOf('Камины') + 4), ['Спа зоны', 'Хаммамы', 'Бассейны'], page);
    assert.ok(labels.includes('Ванная') && labels.includes('Кухня'), page);
    assert.doesNotMatch(html, /Столешницы в ванную|Столешницы на кухню/, page);
  });
});

test('the site-only directions: their own page and photos, the offer form for that direction, no configurator', () => {
  SITE_ONLY.forEach(([slug, label]) => {
    const html = fs.readFileSync(path.join(site, 'categories', slug + '.html'), 'utf8');
    assert.match(html, new RegExp('<h1>' + label + ' из камня</h1>'), slug);
    assert.ok(html.includes('<a class="active" href="/sayanmramor-site/categories/' + slug + '.html" aria-current="page">' + label + '</a>'), slug);
    assert.ok(html.includes('<div data-offer-form data-preselect="' + slug + '"></div>'), slug);
    assert.doesNotMatch(html, /CategoryPage|configure-bar|product=/, slug + ' is not a configurator product');
    const photos = [...html.matchAll(/image: '([^']+)'/g)].map(m => m[1]);
    assert.ok(photos.length >= 2, slug);
    photos.forEach(src => assert.ok(fs.existsSync(path.join(site, src.replace('/sayanmramor-site/', ''))), src));
  });
});

test('every page but the showroom has the footer: directions, contacts, VK and the privacy link', () => {
  pages.filter(p => p !== 'showroom.html').concat(['privacy.html']).forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const footer = html.slice(html.indexOf('<footer class="site-footer">'), html.indexOf('</footer>'));
    assert.ok(footer.length > 0, page);
    SITE_ONLY.forEach(([slug, label]) => assert.ok(footer.includes('<a href="/sayanmramor-site/categories/' + slug + '.html">' + label + '</a>'), page + ' ' + label));
    assert.ok(footer.includes('<a href="/sayanmramor-site/privacy.html">Политика конфиденциальности</a>'), page);
    assert.ok(footer.includes('href="https://vk.com/sayanmramorru"'), page);
    assert.ok(footer.includes('ОГРН: 1197746382569'), page);
    assert.doesNotMatch(footer, /privacy-policy\.php/, page);
  });
});

test('the privacy policy page: the old site text, from «Город Москва» to its date', () => {
  const html = fs.readFileSync(path.join(site, 'privacy.html'), 'utf8');
  assert.match(html, /<h1>Политика конфиденциальности<\/h1>/);
  assert.ok(html.includes('<p>Город Москва</p>'));
  assert.ok(html.includes('<h2>8. Заключительные положения</h2>'));
  assert.ok(html.includes('<p>Дата размещения: 17.01.2022</p>'));
  const article = html.slice(html.indexOf('<article'), html.indexOf('</article>'));
  assert.equal((article.match(/<(p|h2)>/g) || []).length, 51);
});

test('the offer form lists every direction of the site, the three new ones included', () => {
  const OfferForm = require('../js/offer-form.js');
  const labels = OfferForm.DIRECTIONS.map(d => d.label);
  ['Спа зоны', 'Хаммамы', 'Бассейны', 'Ванная', 'Кухня', 'Камины', 'Готовые изделия'].forEach(l => assert.ok(labels.includes(l), l));
  assert.equal(new Set(OfferForm.DIRECTIONS.map(d => d.key)).size, OfferForm.DIRECTIONS.length);
  const home = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.ok(home.includes('<div data-offer-form></div>'));
  assert.equal((home.match(/data-offer-form/g) || []).length, 1, 'one offer block on the home page');
});

test('the offer band: on the home page and all 13 direction pages, each preselecting its own direction; never on «Готовые изделия»', () => {
  const OfferForm = require('../js/offer-form.js');
  const labelOf = Object.fromEntries(OfferForm.DIRECTIONS.map(d => [d.key, d.label]));
  const directionPages = fs.readdirSync(path.join(site, 'categories')).map(f => 'categories/' + f);
  assert.equal(directionPages.length, 13);
  const band = html => (html.match(/<section class="offer-band" id="offer"/g) || []).length;
  directionPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.equal(band(html), 1, page);
    const key = (html.match(/<div data-offer-form data-preselect="([^"]+)"><\/div>/) || [])[1];
    const active = (html.match(/<a class="active"[^>]*>([^<]+)<\/a>/) || [])[1];
    assert.equal(labelOf[key], active, page + ': the form picks the page\'s own direction');
    assert.ok(html.includes('<script src="/sayanmramor-site/js/offer-form.js"></script>'), page);
    assert.ok(html.indexOf('class="offer-band"') < html.indexOf('</main>'), page + ': inside main, before the footer');
  });
  const home = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.equal(band(home), 1);
  assert.ok(home.includes('<div data-offer-form></div>'), 'the home page lets the visitor choose');
  const katalog = fs.readFileSync(path.join(site, 'katalog.html'), 'utf8');
  assert.equal(band(katalog), 0);
  assert.doesNotMatch(katalog, /data-offer-form|offer-form\.js/);
  assert.equal(OfferForm.DIRECTIONS.length, 14);
});

test('the privacy policy: e-mails, site addresses and phones are links, as on the old site (phones added)', () => {
  const html = fs.readFileSync(path.join(site, 'privacy.html'), 'utf8');
  const article = html.slice(html.indexOf('<article'), html.indexOf('</article>'));
  const links = [...article.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(m => [m[1], m[2]]);
  const by = prefix => links.filter(([href]) => href.startsWith(prefix));
  assert.equal(by('mailto:').length, 7);
  by('mailto:').forEach(([href, text]) => assert.equal(href, 'mailto:' + text));
  assert.equal(by('https://sayanmramor.ru/').length, 7);
  assert.equal(by('tel:+74952155145').length, 2);
  assert.equal(links.length, 16);
  // No other text became a link.
  links.forEach(([, text]) => assert.match(text, /@sayanmramor\.ru$|^https:\/\/sayanmramor\.ru\/?$|^\+ ?7\(495\)215-51-45$/));
});
