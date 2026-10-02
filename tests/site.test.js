// tests/site.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SiteCommon = require('../js/site.js');
const SiteHeader = require('../js/header.js');

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

// ---- Home: the scenes ---------------------------------------------------------------

const homeHtml = () => fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const sectionOf = (html, start) => html.slice(html.indexOf(start), html.indexOf('</section>', html.indexOf(start)));
// Every photograph a direction's own page shows: inline items and its portfolio key.
function photosOfPage(page) {
  const portfolio = JSON.parse(fs.readFileSync(path.join(site, 'data', 'portfolio.json'), 'utf8'));
  const html = fs.readFileSync(path.join(site, page), 'utf8');
  const inline = [...html.matchAll(/image: '([^']+)'/g)].map(m => m[1]);
  const key = html.match(/SiteCommon\.loadPortfolio\('([^']+)'/);
  return inline.concat(key ? portfolio[key[1]].map(p => p.image) : []);
}

test('«Что можно заказать»: one stack of 13 rows (the edges of slabs) in the header\'s five groups -- the names large, the groups only a tag; each row a link to its page with one photograph its own page shows, framed so the thing itself is plain; the first row open', () => {
  const sec = sectionOf(homeHtml(), '<section class="home-directions night"');
  assert.match(sec, /<h2 class="stack-title" id="directionsTitle">Что можно заказать<\/h2>/);
  assert.doesNotMatch(sec, /Склад плит/, 'the name of the idea stays inside');
  assert.equal((sec.match(/<ul class="stack">/g) || []).length, 1, 'one list: one object, not five boxes');
  const rows = [...sec.matchAll(/<li class="stack-item( is-group)?">(?:<span class="stack-group">([^<]+)<\/span>)?<a class="stack-row( is-open)?" href="([^"]+)" style="--pos: (\d+% \d+%)">\s*<span class="stack-number">(\d\d)<\/span>\s*<span class="stack-name">([^<]+)<\/span>\s*<span class="stack-cut" aria-hidden="true"><img src="([^"]+)" alt="" width="\d+" height="\d+" loading="lazy" decoding="async"><\/span>\s*<span class="stack-arrow" aria-hidden="true"><\/span>\s*<\/a><\/li>/g)]
    .map(m => ({ group: m[2] || null, open: !!m[3], href: m[4], pos: m[5], number: m[6], name: m[7], photo: m[8] }));
  assert.equal(rows.length, 13);
  // The groups and directions are the header's, in its order.
  const groups = [];
  rows.forEach(r => { if (r.group) groups.push([r.group, []]); groups[groups.length - 1][1].push([r.name, r.href]); });
  assert.deepEqual(groups, GROUPS.map(([title, names]) => [title, names.map(n => [n, '/sayanmramor-site/' + DIRECTIONS[n]])]));
  assert.deepEqual(rows.map(r => r.number), rows.map((r, i) => String(i + 1).padStart(2, '0')));
  assert.deepEqual(rows.map(r => r.open), rows.map((r, i) => i === 0), 'one row open: the first');
  // Each photograph is one its own direction's page shows; each crop is chosen for it.
  rows.forEach(r => {
    assert.ok(photosOfPage(r.href.replace('/sayanmramor-site/', '')).includes(r.photo), r.name + ': ' + r.photo);
    assert.ok(fs.existsSync(path.join(site, r.photo.replace('/sayanmramor-site/', ''))), r.photo);
  });
  assert.equal(new Set(rows.map(r => r.photo)).size, 13, 'thirteen different photographs');
  // «Полы» and «Стены» are not shown through a bathroom: a hall's stone floor, a stone wall in an architectural interior.
  const photoOf = name => rows.find(r => r.name === name).photo.split('/').pop();
  assert.equal(photoOf('Полы'), '159.webp');
  assert.equal(photoOf('Стены'), '168.webp');
  assert.ok(new Set(rows.map(r => r.pos)).size > 6, 'the crops are not all alike');
  const works = sectionOf(homeHtml(), '<section class="home-works night"');
  rows.forEach(r => assert.ok(!works.includes(r.photo), r.photo + ' is not repeated in «Реальные работы»'));
  assert.ok(homeHtml().includes('<script src="/sayanmramor-site/js/home-stack.js" defer></script>'));
});

test('the stack in CSS: rows of one fixed height (opening never moves the list), the photograph in a small 3:2 window that opens as the hero\'s cut, laid over its row; a calm ease; the groups only air and a tag; a plain list with small pictures on a phone', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const block = css.slice(css.indexOf('/* 2. What can be ordered'), css.indexOf('/* 4. The showroom'));
  assert.match(block, /\.stack-row \{[^}]*height: var\(--row-h\);/);
  const wide = block.slice(0, block.indexOf('@media (max-width: 767px)'));
  assert.doesNotMatch(wide.replace(/\.stack-row \{[^}]*\}/, ''), /\.is-open[^{]*\{[^}]*(height|padding|margin)/, 'opening changes no size (on a phone every strip is the same, open or not)');
  assert.match(block, /\.stack-cut \{[^}]*position: absolute;[^}]*height: var\(--win-h\); aspect-ratio: 3 \/ 2;[^}]*clip-path: inset\(50% 50% round 2px\);/, 'a 3:2 window over its row, opening from its middle');
  assert.match(block, /\.home-directions \{ --row-h: 104px; --win-h: 120px;/, 'big enough to read: 180 x 120 at full width');
  assert.match(block, /\.stack-row\.is-open \.stack-cut,[^{]*\{\s*clip-path: inset\(0 0 round 2px\);/);
  assert.match(block, /\.stack-cut img \{[^}]*object-position: var\(--pos, 50% 50%\);/);
  assert.match(block, /\.stack-name \{[^}]*font-size: clamp\(30px, 3\.3vw, 48px\);/, 'the names are the main thing');
  assert.match(block, /\.stack-group \{[^}]*font-size: 12\.5px;/);
  assert.doesNotMatch(block, /\.stack-(item|group)[^{]*\{[^}]*(background:|border-radius: (?!2px)|box-shadow: 0)/, 'no boxes around the groups');
  assert.doesNotMatch(block, /var\(--spring\)|linear\(|bounce|scale\(1\.[1-9]/, 'no spring, no bounce');
  assert.match(block, /\.home-directions \{[^}]*background: var\(--night\);/, 'the gallery goes on');
  const phone = block.slice(block.indexOf('@media (max-width: 767px)'));
  assert.match(phone, /--win-h: 48px;/);
  assert.match(phone, /\.stack-cut, \.stack-row\.is-open \.stack-cut \{ position: relative;[^}]*clip-path: none; \}/, 'on a phone every row shows its small picture');
  assert.match(phone, /\.stack-arrow \{ display: none; \}/);
  // Without JavaScript: the first row open, the row under the pointer opens.
  assert.match(block, /html:not\(\.js\) \.stack-row:hover \.stack-cut/);
});

test('home-stack.js: one row open at a time -- the one pointed at or focused; it stays open when the pointer leaves; a touch is only a tap', () => {
  const HomeStack = require('../js/home-stack.js');
  const a = {}, b = {}, other = {};
  assert.equal(HomeStack.choose([a, b], a, b), b);
  assert.equal(HomeStack.choose([a, b], a, other), a, 'something that is not a row changes nothing');
  const mk = open => {
    const cls = new Set(open ? ['is-open'] : []); const handlers = {};
    return { classList: { contains: c => cls.has(c), add: c => cls.add(c), remove: c => cls.delete(c) }, addEventListener: (t, f) => { handlers[t] = f; }, handlers, cls };
  };
  const rows = [mk(true), mk(false), mk(false)];
  const stack = { querySelectorAll: () => rows };
  const api = HomeStack.init({ querySelector: () => stack });
  rows[2].handlers.pointerenter({ pointerType: 'mouse' });
  assert.deepEqual(rows.map(r => r.cls.has('is-open')), [false, false, true]);
  rows[1].handlers.pointerenter({ pointerType: 'touch' });
  assert.deepEqual(rows.map(r => r.cls.has('is-open')), [false, false, true], 'a touch opens the page, not the cut');
  rows[1].handlers.focus();
  assert.deepEqual(rows.map(r => r.cls.has('is-open')), [false, true, false]);
  assert.equal(api.open, rows[1]);
});

test('the home page\'s masthead: the name in the middle, «Создать изделие» on the left, the ovals on the right -- «Изделия +» (all 13 directions in five groups), «Готовые изделия», «Шоурум +» (the house, the way in, the rooms), «Контакты»; «Меню» on narrower screens', () => {
  const html = homeHtml();
  const mast = html.slice(html.indexOf('<header class="mast night" data-mast data-dock>'), html.indexOf('</header>'));
  assert.ok(mast.length > 0, 'the new masthead');
  assert.doesNotMatch(html, /<header class="site-header">/, 'the old header is gone from the home page');
  assert.match(mast, /<div class="mast-start">\s*<a class="mast-pill mast-cta" href="\/calculator\/sayanmramor-calculator\.html">Создать изделие<\/a>/);
  assert.match(mast, /<a class="mast-logo" href="\/sayanmramor-site\/index\.html">Саянмрамор<\/a>/);
  const nav = mast.slice(mast.indexOf('<nav class="mast-nav"'), mast.indexOf('</nav>'));
  const ovals = [...nav.matchAll(/<(summary|a) class="mast-pill"[^>]*>([^<]+)/g)].map(m => m[1] + ':' + m[2]);
  assert.deepEqual(ovals, ['summary:Изделия', 'a:Готовые изделия', 'summary:Шоурум', 'a:Контакты']);
  assert.match(nav, /<a class="mast-pill" href="\/sayanmramor-site\/katalog\.html">Готовые изделия<\/a>/);
  assert.match(nav, /<a class="mast-pill" href="\/sayanmramor-site\/index\.html#contacts">Контакты<\/a>/);
  // Both planes that list the directions list all 13, in the five groups, each to its own page.
  const groupsOf = part => [...part.matchAll(/<div class="mast-group">\s*<p class="mast-group-title">([^<]+)<\/p>\s*<ul>([\s\S]*?)<\/ul>/g)]
    .map(m => [m[1], [...m[2].matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g)].map(a => [a[2], a[1]])]);
  const expected = GROUPS.map(([title, names]) => [title, names.map(n => [n, '/sayanmramor-site/' + DIRECTIONS[n]])]);
  const products = nav.slice(nav.indexOf('mast-drop-products'), nav.indexOf('mast-drop-showroom'));
  const menu = mast.slice(mast.indexOf('<details class="mast-drop mast-menu">'));
  assert.deepEqual(groupsOf(products), expected);
  assert.deepEqual(groupsOf(menu), expected);
  // «Шоурум»: the house (loaded only when the plane opens), the way in, the rooms the showroom opens by hash -- all through the quiet fade.
  const showroom = nav.slice(nav.indexOf('mast-drop-showroom'));
  assert.match(showroom, /<img src="\/sayanmramor-site\/assets\/home\/showroom-house-1600\.webp" alt="" width="1600" height="1000" loading="lazy"/);
  assert.match(showroom, /<a class="mast-enter" href="\/sayanmramor-site\/showroom\.html" data-portal>Открыть шоурум<\/a>/);
  const rooms = [...showroom.matchAll(/<li><a href="\/sayanmramor-site\/showroom\.html#(\w+)" data-portal>([^<]+)<\/a><\/li>/g)].map(m => m[1]);
  assert.deepEqual(rooms, ['hall', 'living', 'kitchen', 'staircase', 'bathroom']);
  // «Меню»: everything, the action and the phone.
  assert.match(menu, /<a href="\/sayanmramor-site\/katalog\.html">Готовые изделия<\/a>/);
  assert.match(menu, /<a href="\/sayanmramor-site\/showroom\.html" data-portal>Шоурум<\/a>/);
  assert.match(menu, /<a class="mast-pill mast-cta mast-menu-cta" href="\/calculator\/sayanmramor-calculator\.html">Создать изделие<\/a>/);
  assert.match(menu, /<a class="mast-menu-phone" href="tel:\+74952155145">\+7 \(495\) 215-51-45<\/a>/);
  assert.equal((mast.match(/<details class="mast-drop/g) || []).length, 3, 'native <details>: they open without JavaScript');
  // The home page loads the masthead's own script, not the other pages' header.js.
  assert.ok(html.includes('<script src="/sayanmramor-site/js/masthead.js" defer></script>'));
  assert.ok(!html.includes('js/header.js'));
});

test('the other 15 pages keep their header for now: the old <header class="site-header"> and header.js, no masthead', () => {
  headerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.match(html, /<header class="site-header">/, page);
    assert.ok(html.includes('js/header.js'), page);
    assert.doesNotMatch(html, /mast-|masthead\.js|home-hero\.js/, page);
  });
});

test('the masthead in CSS: ovals with a thin edge (no fill, no shadow), a plane of stone drawn from the oval\'s own outline on a soft spring, light over a light section; the night palette belongs to the home page only', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const rule = sel => { const i = css.indexOf('\n' + sel + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  assert.match(rule('.night'), /--night: #1a1c19;[\s\S]*--travertine: #ece5d8;[\s\S]*--verde: #2a5446;/);
  assert.match(rule('.night'), /--spring: linear\(0, /);
  const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')));
  assert.doesNotMatch(root, /--night|--travertine|--spring/, 'not a shared variable: other pages never see it');
  assert.match(rule('.mast-inner'), /grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\);/, 'the name exactly in the middle');
  assert.match(rule('.mast-pill'), /border: 1px solid var\(--pill-line\); border-radius: calc\(var\(--pill-h\) \/ 2\);/);
  assert.match(rule('.mast-pill'), /background: transparent;/);
  assert.doesNotMatch(rule('.mast-pill'), /box-shadow|backdrop-filter|gradient/);
  assert.match(css, /\.js \.mast-drop\.is-ready > \.mast-sheet \{\s*clip-path: inset\(0 0 calc\(100% - var\(--pill-h\)\) calc\(100% - var\(--pill-w, 120px\)\) round calc\(var\(--pill-h\) \/ 2\)\);/);
  assert.match(css, /\.js \.mast-drop\.is-ready\.is-open > \.mast-sheet \{\s*clip-path: inset\(0 0 0 0 round 22px\);[\s\S]*?transition: clip-path 0\.56s var\(--spring\);/);
  assert.match(rule('.mast-sheet'), /background: var\(--sheet\);/);
  assert.match(rule('.mast'), /--sheet: var\(--travertine\);/, 'travertine over the dark page');
  assert.match(rule('.mast.is-light'), /--sheet: var\(--night\);/, 'basalt over a light one');
  const block = css.slice(css.indexOf('/* ---- Masthead'), css.indexOf('/* ---- Home ----'));
  assert.doesNotMatch(block, /backdrop-filter|blur\(|glow|var\(--sr-/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{\s*\.js \.mast-drop\.is-ready > \.mast-sheet, \.js \.mast-drop\.is-ready\.is-open > \.mast-sheet \{ transition: none; \}/);
});

test('masthead.js: one plane at a time, opened from the oval\'s width and closed after its animation; the tone follows the ground under the masthead', () => {
  const Masthead = require('../js/masthead.js');
  assert.equal(Masthead.toneOf('rgb(239, 237, 232)'), 'light');
  assert.equal(Masthead.toneOf('rgb(26, 28, 25)'), 'dark');
  assert.equal(Masthead.toneOf('rgb(30, 26, 22)'), 'dark', 'the showroom\'s graphite');
  assert.equal(Masthead.toneOf('rgba(0, 0, 0, 0)', 'rgb(239, 237, 232)'), 'light', 'a transparent section shows the page');
  assert.ok(Masthead.CLOSE_MS >= 180 && Masthead.CLOSE_MS <= 300);
  const src = fs.readFileSync(path.join(site, 'js', 'masthead.js'), 'utf8');
  ["e.preventDefault()", "'--pill-w'", "classList.add('is-open')", "e.key === 'Escape'", "'focusout'", "'menu-lock'", "IntersectionObserver", "prefers-reduced-motion"]
    .forEach(t => assert.ok(src.includes(t), t));
});

test('the hero: the great name, the headline and the action; a real slab (the showroom\'s Calacatta photograph, its real size drawn on it) that becomes the staircase (photo 200); the three steps in the site\'s own words', () => {
  const crypto = require('node:crypto');
  const html = homeHtml();
  const sec = sectionOf(html, '<section class="night-hero night"');
  assert.match(sec, /<p class="hero-mark" aria-hidden="true"><span class="hero-mark-word">Саянмрамор<\/span><\/p>/);
  assert.match(sec, /<h1 class="hero-title" id="heroTitle">Изделия из натурального камня на заказ<\/h1>/);
  assert.match(sec, /<p class="hero-lead">Лестницы, столешницы, полы, стены и фасады из мрамора, кварцита, оникса и гранита\. Выберите камень из каталога и задайте размеры - изделие сразу появится в 3D с ориентировочной стоимостью\.<\/p>/);
  const actions = [...sec.matchAll(/<a class="night-cta[^"]*" href="([^"]+)">([^<]+)<\/a>/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(actions, [['/calculator/sayanmramor-calculator.html', 'Создать изделие'], ['/calculator/sayanmramor-calculator.html', 'Создать изделие']], 'the action, and again at the end of the story');
  // The slab: an existing photograph of a real slab (the showroom uses it too), its size as the showroom records it.
  // A phone never decodes the 4096 px original: 1600 / 2560 copies of it (assets/home/SOURCES.md), the original only for the densest large screens.
  const stoneImg = sec.match(/<img class="hero-stone" ([^>]*)>/)[1];
  assert.match(stoneImg, /src="\/sayanmramor-site\/assets\/home\/calacatta-nova-P0585309-1600\.webp"/);
  assert.match(stoneImg, /alt="" width="4096" height="2437" fetchpriority="high"/);
  const stoneSet = [...stoneImg.match(/srcset="([^"]+)"/)[1].matchAll(/(\S+) (\d+)w/g)].map(m => [m[1], Number(m[2])]);
  assert.deepEqual(stoneSet, [
    ['/sayanmramor-site/assets/home/calacatta-nova-P0585309-1600.webp', 1600],
    ['/sayanmramor-site/assets/home/calacatta-nova-P0585309-2560.webp', 2560],
    ['/sayanmramor-site/assets/showroom/stone/calacatta-nova-P0585309.webp', 4096],
  ]);
  assert.match(stoneImg, /sizes="\(max-width: 767px\) [^"]+"/);
  const homeSources = fs.readFileSync(path.join(site, 'assets', 'home', 'SOURCES.md'), 'utf8');
  stoneSet.forEach(([src]) => {
    const data = fs.readFileSync(path.join(site, src.replace('/sayanmramor-site/', '')));
    assert.ok(homeSources.includes(crypto.createHash('sha256').update(data).digest('hex')), src + ' is in assets/home/SOURCES.md');
  });
  const Photos = require('../js/showroom/stone-photos.js');
  assert.deepEqual(Photos.PHOTOS['calacatta-nova-P0585309'].slab, [2.84, 1.66]);
  assert.match(sec, /<span class="hero-dim-label">2840<\/span>[\s\S]*<span class="hero-dim-label">1660<\/span>/);
  assert.doesNotMatch(sec.replace(/<[^>]*>/g, ' '), /Calacatta|калакатт/i, 'the stone is not named in the text');
  // Its colour balance is the showroom's own (mean -> target, linear light).
  const gain = Photos.gain('calacatta-nova-P0585309').map(g => g.toFixed(3));
  assert.ok(sec.includes(`values="${gain[0]} 0 0 0 0  0 ${gain[1]} 0 0 0  0 0 ${gain[2]} 0 0  0 0 0 1 0"`), gain.join(' '));
  // The object it becomes: photo 200, as in SOURCES.md.
  const img = sec.match(/<img class="hero-photo" ([^>]*)>/)[1];
  assert.match(img, /alt="Лестница из натурального камня"/);
  const srcset = [...img.match(/srcset="([^"]+)"/)[1].matchAll(/(\S+) (\d+)w/g)].map(m => [m[1].split('/').pop(), Number(m[2])]);
  assert.deepEqual(srcset, [['hero-stair-1200.webp', 1200], ['hero-stair-1920.webp', 1920], ['hero-stair-2880.webp', 2880]]);
  const sources = fs.readFileSync(path.join(site, 'assets', 'hero', 'SOURCES.md'), 'utf8');
  srcset.forEach(([file]) => {
    const data = fs.readFileSync(path.join(site, 'assets', 'hero', file));
    assert.ok(sources.includes(crypto.createHash('sha256').update(data).digest('hex')), file + ' is in SOURCES.md');
  });
  assert.match(sec, /<a class="hero-tag" href="\/sayanmramor-site\/categories\/lestnitsy\.html">Лестницы<\/a>/);
  const steps = [...sec.matchAll(/<li class="hero-step" data-step="(\d)"><span class="hero-step-number">(\d\d)<\/span><span class="hero-step-name">([^<]+)<\/span><span class="hero-step-note">([^<]+)<\/span><\/li>/g)].map(m => m.slice(1));
  assert.deepEqual(steps, [
    ['1', '01', 'Камень', 'Выберите камень из каталога'],
    ['2', '02', 'Размеры', 'Задайте размеры'],
    ['3', '03', '3D и стоимость', 'Изделие сразу появится в 3D с ориентировочной стоимостью'],
  ]);
  assert.ok(html.indexOf('js/home-hero.js') > 0);
  assert.doesNotMatch(html, /home-process|process-step|class="slab/, '«От идеи к изделию» is the hero\'s story now');
});

test('the hero in CSS: held while you scroll (sticky), moved only by transform and opacity from a few numbers; standing still by default (no JavaScript, phones, «reduce motion»)', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const block = css.slice(css.indexOf('/* 1. The hero'), css.indexOf('/* 2. What can be ordered'));
  assert.match(block, /\.night-hero\[data-mode="scrub"\] \{ height: 250svh; \}/);
  assert.match(block, /\[data-mode="scrub"\] \.hero-stage \{[\s\S]*?position: sticky;/);
  assert.match(block, /\[data-mode="scrub"\] \.hero-slab \{[\s\S]*?transform: translate3d\(0, var\(--y, 0px\), 0\) rotateX\(var\(--t, 0deg\)\) rotateZ\(var\(--r, 0deg\)\) scale\(var\(--s, 1\)\);/);
  // The lying slab as a real object (the scrolled scene only): turned a little on the floor, seen from a little off centre,
  // its sawn edge and its shadow under the photograph (let through by «lighten» only around the stone), a slight fall of light.
  assert.match(block, /perspective-origin: 44% 0;/);
  assert.match(block, /\.hero-floor-shadow, \.hero-edge \{ display: none; \}/, 'not on a phone, not without the scene');
  // The thickness is a real face of the slab in 3D: hung from the bottom edge and turned 90° about it, along the slab's own normal,
  // 3 cm at the slab's scale; the perspective alone thins it as the slab stands. The shadow lies on the floor, 3 cm under the top.
  assert.match(block, /\[data-mode="scrub"\] \.hero-slab \{ --thick: calc\(var\(--fw\) \/ var\(--slab-ratio\) \* 0\.0172\); transform-style: preserve-3d; \}/);
  assert.match(block, /\[data-mode="scrub"\] \.hero-edge \{[^}]*top: 96\.5%; left: 4\.6%; width: 89\.9%; height: var\(--thick\);[^}]*transform: rotateX\(-90deg\); transform-origin: 50% 0;/);
  assert.match(block, /\[data-mode="scrub"\] \.hero-floor-shadow \{[^}]*transform: translateZ\(calc\(var\(--thick\) \* -1\)\); opacity: var\(--shade, 0\);/);
  const edgeRule = block.slice(block.indexOf('[data-mode="scrub"] .hero-edge {'), block.indexOf('}', block.indexOf('[data-mode="scrub"] .hero-edge {')));
  assert.doesNotMatch(edgeRule, /scale|var\(--e/, 'no faked edge: no scaling by a number');
  assert.match(block, /\[data-mode="scrub"\] \.hero-stone \{[^}]*mask-image: linear-gradient\(to bottom, rgba\(0, 0, 0, 0\.88\), #000 60%\);/, 'a fall of light of only 12 %');
  // The slab whole, four corners: the sawn top and the slanted left side, the right side inside the missing corner, a straight bottom -- in the scene only.
  assert.match(block, /\[data-mode="scrub"\] \.hero-stone-frame \{ clip-path: polygon\(2\.4% 2\.7%, 94\.5% 2\.7%, 94\.5% 96\.5%, 4\.6% 96\.5%\); \}/);
  assert.match(block, /\[data-mode="scrub"\] \.hero-raw \{ background: transparent; isolation: auto; \}/, 'no basalt ground hiding the face');
  assert.match(block, /\[data-mode="scrub"\] \.hero-mark-word \{\s*transform: translate3d\(0, var\(--mk-y, 0px\), 0\) scale\(var\(--mk-s, 1\)\); opacity: var\(--mk-o, 1\);/);
  assert.match(block, /\.hero-stone \{[^}]*mix-blend-mode: lighten; filter: url\(#slabBalance\);/, 'the studio\'s black ground becomes the gallery');
  // Nothing but the scrub mode sticks or moves: without it the scene is a plain column.
  const free = block.replace(/\[data-mode="scrub"\][^{]*\{[^}]*\}/g, '');
  assert.doesNotMatch(free, /position: sticky|rotateX|250svh|clip-path/);
  // The slab opens: the object is seen through a cut widening from its middle -- never laid over the stone.
  assert.match(block, /\[data-mode="scrub"\] \.hero-made \{[^}]*clip-path: inset\(calc\(\(1 - var\(--cut, 1\)\) \* 50%\) calc\(\(1 - var\(--cut, 1\)\) \* 50%\) round 2px\);/);
  assert.doesNotMatch(block.slice(block.indexOf('[data-mode="scrub"] .hero-made {')), /^[^}]*opacity/, 'no cross-fade of the two images');
  assert.match(block, /\[data-mode="scrub"\] \.hero-cut \{[^}]*opacity: var\(--edge, 0\);/);
  assert.match(block, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.js \.is-lit \.hero-stone-frame::after \{ animation: hero-light/, 'the one pass of light, only when motion is welcome');
  // No decorative shadow or blur: the one shade is inside the cut (inset), where the object lies below the stone's face.
  const cutRule = block.slice(block.indexOf('[data-mode="scrub"] .hero-cut {'), block.indexOf('}', block.indexOf('[data-mode="scrub"] .hero-cut {')));
  assert.match(cutRule, /box-shadow: inset /);
  assert.doesNotMatch(cutRule.replace(/box-shadow:[^;]*;/, ''), /box-shadow/);
  const shadowRule = block.slice(block.indexOf('[data-mode="scrub"] .hero-floor-shadow {'), block.indexOf('}', block.indexOf('[data-mode="scrub"] .hero-floor-shadow {')));
  assert.match(shadowRule, /filter: blur\(22px\);/, 'the one blur: the slab\'s own shadow on the floor');
  assert.doesNotMatch(block.replace(cutRule, '').replace(shadowRule, ''), /box-shadow|backdrop-filter|blur\(/);
  // The masthead's name stays visible without JavaScript.
  assert.match(css, /\.js \.mast\[data-dock\] \.mast-logo \{ opacity: var\(--logo, 0\); \}/);
});

test('home-hero.js: one number from 0 to 1 -- the slab lies at 0 and stands as the object at 1, the dimensions come between, the name has risen into the masthead early; the still scene below 768 px or with «reduce motion»', () => {
  const HomeHero = require('../js/home-hero.js');
  const mark = { dy: -67, s: 0.125 };
  const a = HomeHero.stage(0, 300, mark), z = HomeHero.stage(1, 300, mark);
  assert.equal(a.t, HomeHero.TILT); assert.equal(a.y, 300); assert.equal(a.cut, 0); assert.equal(a.edge, 0); assert.equal(a.d, 0); assert.equal(a.copy, 1); assert.equal(a.step, 1);
  assert.equal(Math.abs(a.mkY), 0); assert.equal(a.mkS, 1); assert.equal(a.logo, 0);
  assert.equal(a.r, HomeHero.TURN); assert.equal(a.shade, 1);
  assert.equal(Math.abs(z.r), 0); assert.equal(z.shade, 0, 'standing: no turn, no shadow (the edge is edge-on)');
  assert.equal(a.e, undefined, 'the edge is geometry, not a number');
  assert.equal(z.t, 0); assert.equal(z.y, 0); assert.ok(Math.abs(z.s - 1) < 1e-9); assert.equal(z.cut, 1); assert.equal(z.edge, 0); assert.equal(z.dd, 0); assert.equal(z.fin, 1); assert.equal(z.step, 3);
  assert.equal(z.mkY, -67); assert.equal(z.mkS, 0.125); assert.equal(z.mkO, 0); assert.equal(z.logo, 1);
  const mid = HomeHero.stage(0.45, 300, mark);
  assert.equal(mid.step, 2); assert.ok(mid.d > 0.5 && mid.cut === 0, 'the dimensions are drawn before the slab opens');
  const opening = HomeHero.stage(0.7, 300, mark);
  assert.ok(opening.t > 0 && opening.cut > 0 && opening.cut < 1 && opening.dd === 0, 'the slab is still moving as it opens; its dimensions are put away');
  assert.ok(opening.edge > 0.9, 'the cut has its edge while it opens');
  assert.equal(HomeHero.stage(0.2, 300, mark).logo, 1, 'the name is in the masthead before the story begins');
  let prev = HomeHero.stage(0, 300, mark);
  for (let p = 0.02; p <= 1.0001; p += 0.02) {
    const v = HomeHero.stage(Math.min(1, p), 300, mark);
    assert.ok(v.t <= prev.t && v.cut >= prev.cut && v.mkS <= prev.mkS + 1e-9, 'one calm movement, never back: ' + p.toFixed(2));
    assert.ok(Math.abs(v.r) <= Math.abs(prev.r) + 1e-9 && v.shade <= prev.shade + 1e-9, 'the turn and the shadow only fade: ' + p.toFixed(2));
    prev = v;
  }
  assert.equal(HomeHero.MIN_WIDTH, 768);
  const src = fs.readFileSync(path.join(site, 'js', 'home-hero.js'), 'utf8');
  ["prefers-reduced-motion: reduce", "{ passive: true }", "requestAnimationFrame", "dataset.mode"].forEach(t => assert.ok(src.includes(t), t));
  assert.doesNotMatch(src, /\.style\.(transform|top|left|width|height)\b/, 'only custom properties are written');
});


test('the showroom doorway: the house (a clean frame of the 3D scene, in SOURCES.md) is the object and the link; «Открыть шоурум» the action; the rooms a quiet second way in', () => {
  const crypto = require('node:crypto');
  const sec = sectionOf(homeHtml(), '<section class="home-portal"');
  assert.match(sec, /<h2 class="portal-title" id="portalTitle">Дом из натурального камня<\/h2>/);
  assert.match(sec, /<a class="portal-enter" href="\/sayanmramor-site\/showroom\.html" data-portal>Открыть шоурум<\/a>/);
  const rooms = [...sec.matchAll(/<li><a href="\/sayanmramor-site\/showroom\.html#(\w+)" data-portal>([^<]+)<\/a><\/li>/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(rooms, [['hall', 'Холл'], ['living', 'Гостиная'], ['kitchen', 'Кухня'], ['staircase', 'Лестница'], ['bathroom', 'Ванная']]);
  // The rooms are zones the showroom itself opens by hash.
  const app = fs.readFileSync(path.join(site, 'js', 'showroom', 'showroom-data.js'), 'utf8');
  rooms.forEach(([id]) => assert.ok(app.includes("'" + id + "'"), id));
  const house = sec.match(/<a class="portal-house" href="\/sayanmramor-site\/showroom\.html" data-portal aria-label="([^"]+)">\s*<img ([^>]*)>/);
  assert.match(house[1], /Открыть шоурум/);
  const srcset = [...house[2].match(/srcset="([^"]+)"/)[1].matchAll(/(\S+) (\d+)w/g)].map(m => [m[1].split('/').pop(), Number(m[2])]);
  assert.deepEqual(srcset, [['showroom-house-1600.webp', 1600], ['showroom-house-2560.webp', 2560]]);
  const sources = fs.readFileSync(path.join(site, 'assets', 'home', 'SOURCES.md'), 'utf8');
  srcset.forEach(([file]) => {
    const data = fs.readFileSync(path.join(site, 'assets', 'home', file));
    assert.ok(sources.includes(crypto.createHash('sha256').update(data).digest('hex')), file + ' is in SOURCES.md');
  });
  assert.match(sources, /toDataURL/);
  assert.match(sources, /не фотография реального здания/);
  // The showroom's own graphite and copper, only here; no zoom on the way in.
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const block = css.slice(css.indexOf('/* 4. The showroom'), css.indexOf('/* 5. Real works'));
  assert.match(block, /\.home-portal \{\s*background: var\(--sr-graphite\); color: var\(--sr-on-dark\);/);
  assert.match(block, /\.portal-enter \{[^}]*background: var\(--sr-copper\); color: #fff;/);
  assert.match(block, /\.portal-veil \{[^}]*position: fixed; inset: 0;[^}]*background: var\(--sr-graphite\);/);
  assert.doesNotMatch(block, /scale\(|zoom/);
  assert.doesNotMatch(block, /\.portal-rooms[^{]*\{[^}]*(border|::before|border-radius)/, 'the rooms: no dots, lines or cards');
  const outside = css.slice(0, css.indexOf('/* 4. The showroom')) + css.slice(css.indexOf('/* 5. Real works'));
  assert.doesNotMatch(outside.replace(/:root \{[\s\S]*?\n\}/, ''), /var\(--sr-/, 'the showroom\'s colours stay in its doorway');
});

test('home-portal.js: a plain click fades the page into the showroom\'s graphite, then opens the link; modifier clicks and «reduce motion» keep the plain link', () => {
  const HomePortal = require('../js/home-portal.js');
  assert.ok(HomePortal.FADE_MS >= 180 && HomePortal.FADE_MS <= 300);
  assert.equal(HomePortal.isPlainClick({ button: 0 }), true);
  [{ button: 1 }, { button: 0, ctrlKey: true }, { button: 0, metaKey: true }, { button: 0, shiftKey: true }, { button: 0, altKey: true }]
    .forEach(e => assert.equal(HomePortal.isPlainClick(e), false, JSON.stringify(e)));
  const handlers = [];
  const link = { href: '/sayanmramor-site/showroom.html', addEventListener: (t, f) => handlers.push([t, f]) };
  const reduced = HomePortal.init({ querySelectorAll: () => [link] }, { matchMedia: () => ({ matches: true }) });
  assert.equal(reduced.reduce, true);
  assert.equal(handlers.length, 0, 'reduce motion: nothing is taken over');
  const timers = [];
  const appended = [];
  const veilClasses = new Set();
  const win = {
    matchMedia: () => ({ matches: false }), location: { href: '' },
    setTimeout: (f, ms) => timers.push([f, ms]), addEventListener: () => {},
  };
  const doc = {
    querySelectorAll: () => [link], body: { appendChild: n => appended.push(n) },
    createElement: () => ({ setAttribute() {}, classList: { add: c => veilClasses.add(c), remove: c => veilClasses.delete(c) } }),
  };
  HomePortal.init(doc, win);
  let prevented = false;
  handlers.find(([t]) => t === 'click')[1]({ button: 0, preventDefault: () => { prevented = true; } });
  assert.ok(prevented);
  assert.equal(appended.length, 1);
  assert.ok(veilClasses.has('is-on'));
  assert.equal(timers[0][1], HomePortal.FADE_MS);
  timers[0][0]();
  assert.equal(win.location.href, '/sayanmramor-site/showroom.html');
  assert.ok(homeHtml().includes('<script src="/sayanmramor-site/js/home-portal.js" defer></script>'));
  assert.ok(!fs.existsSync(path.join(site, 'js', 'home-directions.js')));
});

test('«Реальные работы»: two projects shown whole -- the staircase (185 the whole of it, 186 a closer look) and the kitchen (142 the whole, 144 closer), each spread one link to its direction, named only by it; pictures of one project from one folder of the archive', () => {
  const sec = sectionOf(homeHtml(), '<section class="home-works night"');
  assert.match(sec, /<h2 class="works-title" id="worksTitle">Реальные работы<\/h2>/);
  const projects = [...sec.matchAll(/<a class="project( is-reversed)?" href="([^"]+)"[^>]*>\s*<div class="project-line"><span class="project-number">(\d\d)<\/span><h3 class="project-name">([^<]+)<\/h3><span class="project-rule"><\/span><span class="project-more">Смотреть<\/span><\/div>\s*<div class="project-frames">([\s\S]*?)<\/div>\s*<\/a>/g)]
    .map(m => ({ reversed: !!m[1], href: m[2], number: m[3], name: m[4],
      frames: [...m[5].matchAll(/<span class="project-frame (is-main|is-second)" style="--ar: ([\d.]+)"><img src="([^"]+)" alt="([^"]+)" width="(\d+)" height="(\d+)" loading="lazy"/g)]
        .map(f => ({ role: f[1], ar: Number(f[2]), src: f[3], alt: f[4], w: Number(f[5]), h: Number(f[6]) })) }));
  assert.deepEqual(projects.map(p => [p.number, p.name, p.href, p.reversed]), [
    ['01', 'Лестницы', '/sayanmramor-site/categories/lestnitsy.html', false],
    ['02', 'Кухня', '/sayanmramor-site/categories/stoleshnitsy-kuhnya.html', true],
  ], 'two spreads, the sides alternating -- not a catalogue');
  const ids = p => p.frames.map(f => f.role + ':' + f.src.split('/').pop());
  assert.deepEqual(ids(projects[0]), ['is-main:185.webp', 'is-second:186.webp']);
  assert.deepEqual(ids(projects[1]), ['is-second:144.webp', 'is-main:142.webp']);
  projects.forEach(p => p.frames.forEach(f => {
    assert.ok(Math.abs(f.ar - f.w / f.h) < 0.002, f.src + ': its own proportion, never cropped');
    assert.ok(photosOfPage(p.href.replace('/sayanmramor-site/', '')).includes(f.src), f.src + ' is shown on ' + p.href);
    assert.doesNotMatch(f.alt, /Emperador|Esmeralda|деталь|мрамор|кварцит|оникс|гранит/i, 'no unconfirmed material, no «деталь»: ' + f.alt);
  }));
  assert.doesNotMatch(sec.replace(/<[^>]*>/g, ' '), /деталь|Emperador|Esmeralda/i);
  // The stack shows other photographs.
  const stack = sectionOf(homeHtml(), '<section class="home-directions night"');
  projects.forEach(p => p.frames.forEach(f => assert.ok(!stack.includes(f.src), f.src + ' is not in the stack')));
});

test('«Реальные работы» in CSS: on the gallery\'s basalt; frames in their own proportions (height from the spread, width from the photograph); only the second picture comes a little closer; no boxes; on a phone the whole first, the second large under it', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const block = css.slice(css.indexOf('/* 5. Real works'), css.indexOf('/* 6. Ready-made'));
  assert.match(block, /\.home-works \{ background: var\(--night\);/);
  assert.match(block, /\.project-frame \{[^}]*height: var\(--h\); aspect-ratio: var\(--ar\);/);
  assert.match(block, /\.project:hover \.project-frame\.is-second img, \.project:focus-visible \.project-frame\.is-second img \{ transform: scale\(1\.03\); \}/);
  assert.doesNotMatch(block, /\.is-main img[^{]*\{[^}]*transform/, 'the whole of the object stays still');
  assert.doesNotMatch(block, /box-shadow|border-radius|border: 1px/, 'no cards, no frames');
  assert.match(block, /\.project:focus-visible \{ outline: 2px solid var\(--travertine\);/);
  assert.doesNotMatch(css, /\.works-strip|\.work \{|\n\.tag \{/, 'the old strip is gone');
  const phone = css.slice(css.indexOf('/* Phones: the whole object across the width'));
  assert.match(phone, /\.project-frame\.is-second, \.project\.is-reversed \.project-frame\.is-second \{ width: 72%; \}/);
  assert.match(phone, /\.project\.is-reversed \.project-frame\.is-main \{ order: -1; \}/);
});

test('«Готовые изделия»: a section of its own -- the heading, the catalogue line, «Все готовые изделия», and the exhibition wall the data fills', () => {
  const html = homeHtml();
  const sec = sectionOf(html, '<section class="home-objects"');
  assert.match(sec, /<h2 class="section-title" id="collectionTitle">Готовые изделия<\/h2>/);
  assert.match(sec, /<p class="objects-text">Изделия из камня в наличии - фиксированная цена, без ожидания расчёта\.<\/p>/);
  assert.match(sec, /<a class="home-ready-link" href="\/sayanmramor-site\/katalog\.html">Все готовые изделия<\/a>/);
  assert.match(sec, /<div class="exhibit" data-collection><\/div>/, 'nothing written by hand: the data fills it');
  assert.ok(html.indexOf('js/catalog.js') < html.indexOf('js/home-collection.js'), 'catalog.js (the price format) loads first');
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.match(css, /\.exhibit-row \{\s*--exhibit-max-h: 400px;/, 'the pieces stay at most 400 px tall');
  assert.match(css, /\.exhibit-photo img \{ display: block; width: 100%; height: auto; \}/, 'their own proportions, no cropping');
});

test('home-collection.js: every product of products.json -- its number, own name and price (formatted as in the catalogue) -- in rows of four; no «Купить»', () => {
  const HomeCollection = require('../js/home-collection.js');
  const Catalog = require('../js/catalog.js');
  const data = JSON.parse(fs.readFileSync(path.join(site, 'data', 'products.json'), 'utf8'));
  const items = HomeCollection.items(data.products);
  assert.equal(items.length, data.products.length);
  assert.equal(items.length, 8);
  items.forEach((item, i) => {
    const p = data.products[i];
    assert.equal(item.number, String(i + 1).padStart(2, '0'));
    assert.equal(item.name, p.name);
    assert.equal(item.price, Catalog.formatProductPrice(p.price_rub));
    assert.equal(item.photo, p.photos[0]);
    assert.ok(fs.existsSync(path.join(site, item.photo.replace('/sayanmramor-site/', ''))), item.photo);
  });
  assert.equal(HomeCollection.PER_ROW, 4);
  assert.deepEqual(HomeCollection.rows(items).map(r => r.length), [4, 4]);
  assert.deepEqual(HomeCollection.rows([1, 2, 3, 4, 5]).map(r => r.length), [4, 1]);
  assert.equal(HomeCollection.CATALOG_URL, '/sayanmramor-site/katalog.html');
  const code = fs.readFileSync(path.join(site, 'js', 'home-collection.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /Купить|ORDER_URL|buy/i);
});



// ---- Header: one row, «Изделия» panel with the 13 directions in five groups ----------

const NAV_START = '<nav class="site-nav"';
const navOf = html => html.slice(html.indexOf(NAV_START), html.indexOf('</nav>'));
const DIRECTIONS = {
  'Лестницы': 'categories/lestnitsy.html', 'Ступени': 'categories/stupeni.html',
  'Полы': 'categories/poly.html', 'Стены': 'categories/steny.html', 'Панно': 'categories/panno.html',
  'Подоконники': 'categories/podokonniki.html', 'Камины': 'categories/kaminy.html',
  'Кухня': 'categories/stoleshnitsy-kuhnya.html', 'Ванная': 'categories/stoleshnitsy-vannaya.html',
  'Фасады': 'categories/fasady.html',
  'Спа зоны': 'categories/spa-zony.html', 'Хаммамы': 'categories/hammamy.html', 'Бассейны': 'categories/basseyny.html',
};
const GROUPS = [
  ['Лестницы и ступени', ['Лестницы', 'Ступени']],
  ['Пространство', ['Полы', 'Стены', 'Панно', 'Подоконники', 'Камины']],
  ['Кухня и ванная', ['Кухня', 'Ванная']],
  ['Фасады', ['Фасады']],
  ['Спа и вода', ['Спа зоны', 'Хаммамы', 'Бассейны']],
];
// The home page has its own masthead now (stage 1 of the night gallery); the other pages keep this header.
const headerPages = pages.filter(p => p !== 'showroom.html' && p !== 'index.html').concat(['privacy.html']);

test('every page: the header is «Изделия» (a panel with all 13 directions in five groups), Готовые изделия, Шоурум, Контакты', () => {
  headerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const nav = navOf(html);
    const panel = nav.slice(nav.indexOf('<details class="nav-products">'), nav.indexOf('</details>'));
    assert.ok(panel.includes('<summary'), page);
    const groups = [...panel.matchAll(/<div class="nav-group">\s*<p class="nav-group-title">([^<]+)<\/p>([\s\S]*?)<\/ul>/g)]
      .map(m => [m[1], [...m[2].matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(a => [a[2], a[1]])]);
    assert.deepEqual(groups, GROUPS.map(([title, names]) => [title, names.map(n => [n, '/sayanmramor-site/' + DIRECTIONS[n]])]), page);
    const rest = [...nav.slice(nav.indexOf('</details>')).matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(a => [a[2], a[1]]);
    assert.deepEqual(rest, [
      ['Готовые изделия', '/sayanmramor-site/katalog.html'],
      ['Шоурум', '/sayanmramor-site/showroom.html'],
      ['Контакты', '/sayanmramor-site/index.html#contacts'],
    ], page);
  });
});

test('the page\'s own direction is marked active (and aria-current) in the panel, and «Изделия» is marked too; «Готовые изделия» is its own item', () => {
  headerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const nav = navOf(html);
    const active = [...nav.matchAll(/<a class="active" href="([^"]+)" aria-current="page">([^<]+)<\/a>/g)].map(m => m[1]);
    const isDirection = page.startsWith('categories/');
    assert.deepEqual(active, isDirection ? ['/sayanmramor-site/' + page] : page === 'katalog.html' ? ['/sayanmramor-site/katalog.html'] : [], page);
    assert.equal(nav.includes('<summary class="active">Изделия</summary>'), isDirection, page);
    assert.equal((nav.match(/aria-current/g) || []).length, active.length, page);
  });
});

test('every page: the header button keeps its full name, with «изделие» as the tail hidden on very narrow screens; one menu button', () => {
  headerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.ok(html.includes('<a class="btn btn-primary site-header-cta" href="/calculator/sayanmramor-calculator.html" aria-label="Создать изделие"><span>Создать<span class="site-header-cta-tail"> изделие</span></span></a>'), page);
    assert.equal((html.match(/<button class="nav-toggle" type="button" aria-controls="siteNav" aria-expanded="false" aria-label="Меню">/g) || []).length, 1, page);
    assert.ok(html.includes('id="siteNav"'), page);
  });
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const narrow = css.slice(css.indexOf('@media (max-width: 360px)'));
  assert.match(narrow.slice(0, narrow.indexOf('}\n}') + 3), /\.site-header-cta-tail \{ display: none; \}/);
});

test('header.js is loaded deferred on every header page; the «js» flag is set before the stylesheet', () => {
  headerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.equal((html.match(/<script src="\/sayanmramor-site\/js\/header\.js" defer><\/script>/g) || []).length, 1, page);
    const flag = html.indexOf("document.documentElement.classList.add('js')");
    assert.ok(flag > 0 && flag < html.indexOf('<link rel="stylesheet"'), page);
  });
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.ok(css.includes('@media (max-width: 1000px)'));
  assert.ok(css.includes('html.menu-lock'));
  assert.equal(SiteHeader.MOBILE_QUERY, '(max-width: 1000px)');
});

// A minimal DOM: just what header.js touches.
function fakeHeaderDom(mobile) {
  const doc = { activeElement: null, listeners: {} };
  function el(name, extra) {
    const classes = new Set();
    const attrs = {};
    return Object.assign({
      name, attrs, listeners: {},
      classList: {
        contains: c => classes.has(c),
        toggle(c, on) { const v = on === undefined ? !classes.has(c) : on; if (v) classes.add(c); else classes.delete(c); return v; },
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      removeAttribute(k) { delete attrs[k]; },
      addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      focus() { doc.activeElement = this; },
    }, extra);
  }
  const summary = el('summary');
  const link = el('a', { closest: sel => (sel === '.site-nav a' ? link : null) });
  const outside = el('outside', { closest: () => null });
  const toggle = el('toggle');
  const products = el('products', { open: false });
  products.contains = x => x === products || x === summary || x === link;
  products.querySelector = sel => (sel === 'summary' ? summary : null);
  const header = el('header', {
    querySelector: sel => ({ '.nav-products': products, '.nav-toggle': toggle, '.nav-group a': link })[sel] || null,
  });
  const rootEl = el('html');
  const mq = { matches: !!mobile, listeners: [], addEventListener(t, fn) { this.listeners.push(fn); } };
  Object.assign(doc, {
    documentElement: rootEl,
    querySelector: sel => (sel === '.site-header' ? header : null),
    addEventListener(type, fn) { (doc.listeners[type] = doc.listeners[type] || []).push(fn); },
  });
  const win = { matchMedia: () => mq };
  // An event goes to its target, then up through the header (if the target is inside it) to the document.
  const inHeader = t => [products, summary, link, toggle].includes(t);
  const fire = (target, type, e) => {
    const ev = Object.assign({ type, target, preventDefault() { this.prevented = true; } }, e);
    (target.listeners[type] || []).forEach(fn => fn(ev));
    if (target === summary) (products.listeners[type] || []).forEach(fn => fn(ev));
    if (inHeader(target)) (header.listeners[type] || []).forEach(fn => fn(ev));
    if (type !== 'focusout') (doc.listeners[type] || []).forEach(fn => fn(ev));
    return ev;
  };
  return { doc, win, header, products, summary, link, outside, toggle, rootEl, mq, fire };
}

test('header.js, wide screen: Esc, a click outside and focus leaving close the «Изделия» panel; Esc returns focus to it', () => {
  const d = fakeHeaderDom(false);
  SiteHeader.init(d.doc, d.win);
  d.products.open = true;
  d.fire(d.doc, 'keydown', { key: 'Escape' });
  assert.equal(d.products.open, false);
  assert.equal(d.doc.activeElement, d.summary);
  d.products.open = true;
  d.fire(d.outside, 'click');
  assert.equal(d.products.open, false);
  d.products.open = true;
  d.fire(d.link, 'click');                         // inside: stays (the browser navigates)
  assert.equal(d.products.open, true);
  d.fire(d.products, 'focusout', { relatedTarget: d.outside });
  assert.equal(d.products.open, false);
  const ev = d.fire(d.summary, 'click');
  assert.ok(!ev.prevented, 'on a wide screen the summary toggles natively');
});

test('header.js, mobile: the button opens the menu with the products listed, locks the page scroll, Esc / a link / a wider window close it', () => {
  const d = fakeHeaderDom(true);
  SiteHeader.init(d.doc, d.win);
  assert.equal(d.summary.attrs.tabindex, '-1');
  assert.ok(d.fire(d.summary, 'click').prevented, 'the heading does not toggle');
  d.fire(d.toggle, 'click');
  assert.ok(d.header.classList.contains('menu-open'));
  assert.ok(d.rootEl.classList.contains('menu-lock'));
  assert.equal(d.toggle.attrs['aria-expanded'], 'true');
  assert.equal(d.toggle.attrs['aria-label'], 'Закрыть меню');
  assert.equal(d.products.open, true);
  d.fire(d.doc, 'keydown', { key: 'Escape' });
  assert.ok(!d.header.classList.contains('menu-open') && !d.rootEl.classList.contains('menu-lock'));
  assert.equal(d.toggle.attrs['aria-expanded'], 'false');
  assert.equal(d.products.open, false);
  assert.equal(d.doc.activeElement, d.toggle);
  d.fire(d.toggle, 'click');
  d.fire(d.link, 'click');
  assert.ok(!d.header.classList.contains('menu-open'), 'following a link closes the menu');
  d.fire(d.toggle, 'click');
  d.mq.matches = false;
  d.mq.listeners.forEach(fn => fn());
  assert.ok(!d.header.classList.contains('menu-open') && !d.rootEl.classList.contains('menu-lock'), 'back to a wide screen: the menu is closed');
  assert.equal(d.summary.attrs.tabindex, undefined);
});

test('the header points only at what exists: «Контакты» lands on the home page contacts; no «Камень» / «Производство» items or sections', () => {
  const home = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.equal((home.match(/id="contacts"/g) || []).length, 1);
  assert.doesNotMatch(home, /id="stone"|id="production"/);
  headerPages.forEach(page => {
    const nav = navOf(fs.readFileSync(path.join(site, page), 'utf8'));
    assert.doesNotMatch(nav, />Камень<|>Производство<|#stone|#production/, page);
  });
});

test('the old scrolling menu row is gone with its edge fades; the mobile menu hangs from the header (absolute), so the header keeps its blur', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.doesNotMatch(css, /nav-fade|nav-edges/);
  const header = css.slice(css.indexOf('/* ---- Header'), css.indexOf('/* ---- Night gallery'));
  assert.match(header, /backdrop-filter: blur\(10px\)/);
  assert.doesNotMatch(header, /position: fixed/);
});

// ---- Typography: the site's own -------------------------------------------------------

test('typography is the Helvetica stack of the site: no web fonts loaded or preloaded anywhere', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.match(css, /--font: 'Helvetica Neue', Helvetica, Arial, sans-serif;/);
  assert.doesNotMatch(css, /@font-face|Source Serif|Golos|--font-display/);
  headerPages.concat(['showroom.html', 'index.html']).forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.doesNotMatch(html, /\.woff2|rel="preload" [^>]*as="font"|fonts\.googleapis|fonts\.gstatic/, page);
  });
});

test('header: one travelling line under the row, a copper segment under an open «Изделия», the panel unfolding downward; no pills, springs or staggered rows', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const wide = css.slice(css.indexOf('@media (min-width: 1001px) {'), css.indexOf('@keyframes nav-panel-unfold'));
  assert.ok(wide.includes('.js .site-nav > a, .js .nav-products > summary { border-bottom-color: transparent; }'));
  assert.match(wide, /\.js \.nav-indicator \{[^}]*height: 2px;[^}]*background: var\(--ink\)/);
  assert.match(wide, /\.nav-products > summary::before \{[^}]*background: var\(--accent\)[^}]*transform: scaleX\(0\)/);
  assert.ok(wide.includes('.nav-products[open] > summary::before { transform: scaleX(1);'));
  assert.ok(wide.includes('.nav-products[open] > .nav-panel { animation: nav-panel-unfold 0.22s var(--ease); }'));
  assert.match(css, /@keyframes nav-panel-unfold \{\s*from \{ clip-path: inset\(0 0 100% 0\); \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.nav-products\[open\] > \.nav-panel \{ animation: none; \}/);
  assert.doesNotMatch(css, /nav-group:nth-child\(\d\) \{[^}]*animation-delay/);
});

test('header.js: the line rests under the current section, follows the pointer and the focus, and comes back', () => {
  const listeners = {};
  const on = owner => (type, fn) => { (listeners[owner + ':' + type] = listeners[owner + ':' + type] || []).push(fn); };
  const rect = (left, width) => ({ left, width, getBoundingClientRect: () => ({ left, width }) });
  const classes = () => { const set = new Set(); return { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c) }; };
  const summary = Object.assign(rect(400, 80), { classList: classes(), addEventListener: on('summary') });
  summary.classList.add('active');
  const contacts = Object.assign(rect(700, 70), { classList: classes(), addEventListener: on('contacts') });
  const bar = { className: '', style: {}, classList: classes(), setAttribute() {} };
  const box = rect(100, 1000);
  const nav = {
    parentNode: box, appended: null,
    querySelectorAll: () => [summary, contacts],
    appendChild(el) { this.appended = el; },
    contains: el => el === summary || el === contacts,
    addEventListener: on('nav'),
  };
  const header = { querySelector: sel => (sel === '.site-nav' ? nav : null) };
  const doc = { createElement: () => bar };
  const win = { addEventListener() {}, requestAnimationFrame: f => f() };
  const ind = SiteHeader.initIndicator(doc, win, header, { matches: false });
  assert.equal(nav.appended, bar);
  assert.equal(bar.className, 'nav-indicator');
  assert.equal(bar.style.transform, 'translateX(300px) scaleX(80)', 'rests under the current section');
  assert.ok(bar.classList.contains('is-on') && bar.classList.contains('is-ready'));
  listeners['contacts:mouseenter'][0]();
  assert.equal(bar.style.transform, 'translateX(600px) scaleX(70)', 'travels to the item under the pointer');
  listeners['nav:mouseleave'][0]();
  assert.equal(bar.style.transform, 'translateX(300px) scaleX(80)', 'comes back when the pointer leaves the row');
  listeners['contacts:focus'][0]();
  assert.equal(bar.style.transform, 'translateX(600px) scaleX(70)', 'and follows the keyboard focus');
  // On the home page (no current section) it is hidden at rest; on a narrow screen it is never shown.
  summary.classList.remove('active');
  const home = SiteHeader.initIndicator(doc, win, header, { matches: false });
  assert.ok(!bar.classList.contains('is-on'));
  ind.show(contacts);
  const narrow = SiteHeader.initIndicator(doc, win, header, { matches: true });
  narrow.show(contacts);
  assert.ok(!bar.classList.contains('is-on'));
  assert.ok(home);
});

// ---- Коммерческое предложение -------------------------------------------------------

test('the offer band on all 14 pages: «Проект», one heading row, the line of what is needed, the phone, the form inside the unfolding block, the <noscript> fallback', () => {
  const offerPages = ['index.html'].concat(fs.readdirSync(path.join(site, 'categories')).map(f => 'categories/' + f));
  offerPages.forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const band = html.slice(html.indexOf('<section class="offer-band"'), html.indexOf('</section>', html.indexOf('<section class="offer-band"')));
    assert.match(band, /<p class="offer-kicker">Проект<\/p>/, page);
    assert.match(band, /<h2 class="offer-title" id="offerTitle">Получить расчёт <span class="offer-title-soft">по вашему проекту<\/span><\/h2>/, page);
    assert.match(band, /<p class="offer-needs">Направление · Имя · Телефон · Техническое задание<\/p>/, page);
    assert.match(band, /<p class="offer-phone">Или позвоните: <a href="tel:\+74952155145">\+7 \(495\) 215-51-45<\/a><\/p>/, page);
    assert.match(band, /<div class="offer-reveal">\s*<div class="offer-reveal-inner">\s*<div data-offer-form[^>]*><\/div>\s*<\/div>\s*<\/div>/, page);
    assert.match(band, /<noscript><p class="offer-noscript">/, page);
    assert.ok(band.indexOf('</noscript>') > band.indexOf('offer-reveal'), page + ': the fallback stands outside the folding block');
    assert.doesNotMatch(band, /Получите коммерческое предложение/, page);
  });
});

test('the offer form: fields in the order they are filled in, written lines (label over an underline), no frame or cells; the heading becomes the button; the form unfolds in place (no dialog)', () => {
  const OfferForm = require('../js/offer-form.js');
  assert.deepEqual(OfferForm.FIELDS, ['Направление', 'Имя', 'Телефон', 'Техническое задание']);
  assert.equal(typeof OfferForm.enhanceBand, 'function');
  const src = fs.readFileSync(path.join(site, 'js', 'offer-form.js'), 'utf8');
  assert.ok(src.indexOf("field(doc, id('direction'), FIELDS[0]") < src.indexOf("field(doc, id('name'), FIELDS[1]"));
  assert.ok(src.indexOf("field(doc, id('name'), FIELDS[1]") < src.indexOf("field(doc, id('phone'), FIELDS[2]"));
  assert.match(src, /'aria-expanded': 'false'/);
  assert.match(src, /first\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(src, /<dialog|showModal|window\.open/);
  // The sending is unchanged: no request leaves the page, the message says so.
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon/);
  assert.match(OfferForm.NOT_SENT, /Заявки с сайта пока не отправляются/);
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.match(css, /\.offer-band\.is-collapsible \.offer-reveal \{[^}]*grid-template-rows: 0fr; visibility: hidden;/);
  assert.match(css, /\.offer-band\.is-open \.offer-reveal \{[^}]*grid-template-rows: 1fr; visibility: visible;/);
  const band = css.slice(css.indexOf('/* ---- Коммерческое предложение'), css.indexOf('.offer-consent {'));
  assert.doesNotMatch(band, /gradient|backdrop-filter|box-shadow: 0 \d+px \d+px/);
  // Open, the form is a few written lines: two abreast, each an underline, no frame, no cells.
  const rule = sel => { const i = css.indexOf('\n' + sel + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  assert.match(rule('.offer-form'), /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.doesNotMatch(rule('.offer-form'), /border|background/);
  assert.doesNotMatch(rule('.offer-field'), /border|background/);
  assert.match(rule('.offer-input'), /border: 0; border-bottom: 1px solid var\(--line-control\);/);
  assert.match(rule('.offer-file'), /border-bottom: 1px solid var\(--line-control\);/);
  assert.doesNotMatch(css, /\.offer-field::(before|after)|counter\(offer-field/);
  assert.match(rule('.offer-consent'), /grid-column: 1 \/ -1;/);
  assert.match(rule('.offer-submit'), /grid-column: 1 \/ -1; justify-self: start;/);
  const phone = css.slice(css.indexOf('@media (max-width: 600px) {'));
  assert.match(phone, /\.offer-form \{ grid-template-columns: 1fr; \}/, 'one line per field on a phone');
});

test('the «Изделия» panel is a ledger about 640 px wide: numbered group rows, thin neutral rules, copper only for hover / the current page', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const rule = sel => { const i = css.indexOf('\n' + sel + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  assert.match(rule('.nav-panel'), /width: min\(640px,/);
  assert.match(rule('.nav-panel-inner'), /counter-reset: nav-group/);
  assert.match(rule('.nav-group-title::before'), /content: counter\(nav-group, decimal-leading-zero\)/);
  assert.match(rule('.nav-group'), /border-top: 1px solid var\(--line\)/);
  assert.match(rule('.nav-group a::before'), /background: var\(--accent\)[\s\S]*transform: scaleX\(0\)/);
  assert.match(css, /\.nav-group a:hover::before, \.nav-group a:focus-visible::before, \.nav-group a\.active::before \{ transform: scaleX\(1\); \}/);
  const panel = css.slice(css.indexOf('/* The panel: a ledger'), css.indexOf('.site-header-cta {'));
  assert.doesNotMatch(panel, /<img|url\((?!\s*var)|font-family|uppercase/);
});

test('the home page tells it in order: the hero (from the slab to the object), what can be ordered, the showroom, the real works, the ready-made pieces, the request, where we are', () => {
  const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  const order = ['<section class="night-hero night"', '<section class="home-directions night"', '<section class="home-portal"',
    '<section class="home-works night"', '<section class="home-objects"', '<section class="offer-band"', '<section class="wrap home-contacts"'].map(s => html.indexOf(s));
  order.forEach(i => assert.ok(i > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.equal((html.match(/<section[ >]/g) || []).length, 7, 'no other sections');
  assert.doesNotMatch(html, /home-showroom|home-index|home-object"|index-link|grid-bleed|home-hero"|home-process|colonnade/, 'nothing left of the earlier home pages');
});
test('palette «basalt and serpentine»: limestone, warm stone, basalt, deep green-graphite, one verde accent; the showroom doorway keeps the showroom\'s graphite and copper; css/showroom.css untouched', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  [['--page', '#efede8'], ['--stone', '#e6e1d8'], ['--surface', '#f8f7f4'], ['--ink', '#1c1d1b'], ['--graphite', '#1e2320'], ['--accent', '#2a5446'], ['--accent-hover', '#1f4036'], ['--link', '#2a5446'], ['--accent-on-dark', '#7fa698']]
    .forEach(([name, value]) => assert.match(css, new RegExp(name + ': ' + value + ';'), name));
  // The old copper lives on only as the showroom's own colour.
  const copper = [...css.matchAll(/#b4562b/gi)].map(m => css.slice(css.lastIndexOf('\n', m.index), m.index));
  copper.forEach(line => assert.match(line, /--sr-copper/));
  assert.match(css, /\.home-portal \{\s*background: var\(--sr-graphite\);/);
  assert.match(css, /\.portal-enter \{[^}]*background: var\(--sr-copper\);/);
  assert.doesNotMatch(css, /#0068d6|#007bff/, 'no blue');
  const sr = fs.readFileSync(path.join(site, 'css', 'showroom.css'), 'utf8');
  assert.match(sr, /--sr-accent: #b4562b;/);
  assert.match(sr, /--sr-panel-solid: #1e1a16;/);
});
test('every page: a skip link to <main id="main">; the active menu item is aria-current', () => {
  pages.filter(p => p !== 'showroom.html').forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    assert.ok(html.includes('<a class="skip-link" href="#main">'), page);
    assert.equal((html.match(/<main[\s>]/g) || []).length, 1, page);
    assert.match(html, /<main [^>]*id="main"/, page);
    const nav = navOf(html);
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

// ---- Спа зоны / Хаммамы / Бассейны, footer, privacy, коммерческое предложение ----

const SITE_ONLY = [
  ['spa-zony', 'Спа зоны'], ['hammamy', 'Хаммамы'], ['basseyny', 'Бассейны'],
];

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
