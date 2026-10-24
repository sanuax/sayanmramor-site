// tests/portfolio.test.js
// Portfolio photos: every path in data/portfolio.json points at a real file
// under /sayanmramor-site/assets/, each of the 10 directions shows the agreed
// photos, and every shipped photo is traceable to its archive source.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Data = require('../js/showroom/showroom-data.js');

const site = path.join(__dirname, '..');
const portfolio = JSON.parse(fs.readFileSync(path.join(site, 'data', 'portfolio.json'), 'utf8'));
const assetDir = path.join(site, 'assets', 'portfolio');
const webps = fs.readdirSync(assetDir).filter(f => f.endsWith('.webp')).sort();
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Photos per direction, from photo_classification.csv (confirmed, use_on_site=yes,
// portfolio_keys), plus the owner's photos from the Yandex Maps card
// (assets/portfolio-yandex: pol 2, stena 2, panno 2, stoleshnitsa_kuhnya 1).
// A photo may belong to several directions.
const EXPECTED_COUNTS = {
  lestnitsa: 11, stupeni: 7, stoleshnitsa_kuhnya: 26, stoleshnitsa_vannaya: 21, podokonnik: 2,
  pol: 18, stena: 40, fasad: 7, panno: 22, kaminy: 6,
};
const YANDEX_DIR = path.join(site, 'assets', 'portfolio-yandex');

// Minimal RFC 4180 reader: quoted fields may contain commas, quotes ("") and newlines.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// SOURCES.md is the in-repo manifest: "### <file>" then its photo_id, archive path and SHA-256.
function sources() {
  const text = fs.readFileSync(path.join(assetDir, 'SOURCES.md'), 'utf8');
  const entries = {};
  text.split(/^### /m).slice(1).forEach(block => {
    const file = block.split('\n')[0].trim();
    entries[file] = {
      photoId: (block.match(/← photo_id (\d{3})/) || [])[1],
      source: (block.match(/← `([^`]+)`/) || [])[1],
      sha: (block.match(/SHA-256 `([0-9a-f]{64})`/) || [])[1],
    };
  });
  return entries;
}

test('portfolio.json has exactly the 10 site directions', () => {
  assert.deepEqual(Object.keys(portfolio).sort(), [...Data.PRODUCT_KEYS].sort());
});

test('every portfolio photo is an absolute /sayanmramor-site/assets/ path to an existing file', () => {
  Object.entries(portfolio).forEach(([key, items]) => {
    assert.ok(Array.isArray(items), key);
    items.forEach(item => {
      assert.equal(typeof item.image, 'string', key);
      assert.equal(typeof item.caption, 'string', key + ': ' + item.image);
      assert.ok(item.image.startsWith('/sayanmramor-site/assets/'), key + ': ' + item.image);
      const file = path.join(site, item.image.slice('/sayanmramor-site/'.length));
      assert.ok(fs.existsSync(file), key + ': missing ' + item.image);
    });
  });
});

test('each direction shows the agreed number of photos', () => {
  const counts = Object.fromEntries(Object.entries(portfolio).map(([k, items]) => [k, items.length]));
  assert.deepEqual(counts, EXPECTED_COUNTS);
});

test('a photo appears once per direction; sharing one file between directions is allowed', () => {
  const directionsOf = {};
  Object.entries(portfolio).forEach(([key, items]) => {
    const images = items.map(i => i.image);
    assert.equal(new Set(images).size, images.length, key + ' lists a photo twice');
    images.forEach(img => (directionsOf[img] = directionsOf[img] || []).push(key));
  });
  // Shared photos are one physical file referenced from several directions, not copies.
  const shared = Object.entries(directionsOf).filter(([, keys]) => keys.length > 1);
  shared.forEach(([img]) => assert.ok(fs.existsSync(path.join(site, img.slice('/sayanmramor-site/'.length))), img));
  // The only folder is w640: the grid's smaller copy of each photo (scripts/portfolio_media.js), not a direction's copy.
  assert.deepEqual(fs.readdirSync(assetDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name), ['w640'],
    'assets/portfolio/ is flat: one file per photo, no per-direction copies');
});

test('every shipped portfolio photo is in SOURCES.md with its archive path and matching SHA-256', () => {
  const listed = sources();
  assert.deepEqual(Object.keys(listed).sort(), webps, 'SOURCES.md lists exactly the .webp files');
  webps.forEach(f => {
    const e = listed[f];
    assert.equal(f, e.photoId + '.webp', f + ': named by its photo_id');
    assert.ok(e.source && e.source.startsWith('Мрамор все фото/'), f + ': archive path recorded');
    assert.equal(sha256(path.join(assetDir, f)), e.sha, f + ': content matches SOURCES.md');
  });
  // Not every file must be in the portfolio: some photos wait for the home page or products.
  const used = new Set(Object.values(portfolio).flat().filter(i => i.image.startsWith('/sayanmramor-site/assets/portfolio/')).map(i => path.basename(i.image)));
  used.forEach(f => { if (f.endsWith('.webp')) assert.ok(f in listed, f + ' is used but not listed'); });
});

test('the owner\'s photos from the Yandex Maps card: their own folder and SOURCES.md (size and SHA-256), the first in their galleries', () => {
  const files = fs.readdirSync(YANDEX_DIR).filter(f => f.endsWith('.webp')).sort();
  assert.deepEqual(files, ['ya-01.webp', 'ya-02.webp', 'ya-03.webp', 'ya-04.webp', 'ya-05.webp', 'ya-06.webp', 'ya-07.webp', 'ya-08.webp']);
  const text = fs.readFileSync(path.join(YANDEX_DIR, 'SOURCES.md'), 'utf8');
  files.forEach(f => {
    const block = text.split('### ' + f)[1];
    assert.ok(block, f + ' is in SOURCES.md');
    assert.equal((block.match(/SHA-256 `([0-9a-f]{64})`/) || [])[1], sha256(path.join(YANDEX_DIR, f)), f);
  });
  const first = key => portfolio[key].filter(i => i.image.includes('/portfolio-yandex/')).map(i => path.basename(i.image));
  assert.deepEqual(first('pol'), ['ya-01.webp', 'ya-06.webp']);
  assert.deepEqual(first('stena'), ['ya-06.webp', 'ya-07.webp']);
  assert.deepEqual(first('panno'), ['ya-03.webp', 'ya-08.webp']);
  assert.deepEqual(first('stoleshnitsa_kuhnya'), ['ya-05.webp']);
  ['pol', 'stena', 'panno', 'stoleshnitsa_kuhnya'].forEach(key =>
    assert.ok(portfolio[key].slice(0, first(key).length).every(i => i.image.includes('/portfolio-yandex/')), key + ': the new photos come first'));
  assert.match(fs.readFileSync(path.join(site, 'categories', 'spa-zony.html'), 'utf8'), /renderPortfolio\(document\.getElementById\('portfolioGrid'\), \[\n    \{ image: '\/sayanmramor-site\/assets\/portfolio-yandex\/ya-02\.webp'/);
  assert.match(fs.readFileSync(path.join(site, 'categories', 'hammamy.html'), 'utf8'), /renderPortfolio\(document\.getElementById\('portfolioGrid'\), \[\n    \{ image: '\/sayanmramor-site\/assets\/portfolio-yandex\/ya-04\.webp'/);
});

// The export manifest lives outside the repository (D:\photo_marble); check it when present.
test('shipped photos match the export manifest (when the photo archive is available)', t => {
  const manifestPath = process.env.SAYAN_PHOTO_MANIFEST || 'D:\\photo_marble\\site_export\\manifest.csv';
  if (!fs.existsSync(manifestPath)) { t.skip('export manifest not available: ' + manifestPath); return; }
  const [head, ...rows] = parseCsv(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  const fileCol = head.indexOf('output_file'), shaCol = head.indexOf('output_sha256');
  assert.ok(fileCol >= 0 && shaCol >= 0, 'manifest has output_file and output_sha256');
  const byFile = Object.fromEntries(rows.map(r => [r[fileCol], r[shaCol]]));
  webps.forEach(f => {
    assert.ok(f in byFile, f + ' is in manifest.csv');
    assert.equal(sha256(path.join(assetDir, f)), byFile[f], f + ': same bytes as the export');
  });
});

test('portfolio photos are shown whole: no forced crop to a fixed frame', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const rule = (css.match(/\.portfolio-item img\s*\{([^}]*)\}/) || [])[1];
  assert.ok(rule, '.portfolio-item img rule exists');
  assert.ok(!/object-fit\s*:\s*cover/.test(rule), 'no object-fit: cover');
  assert.ok(/aspect-ratio\s*:\s*auto\b/.test(rule), 'aspect-ratio follows the photo (auto)');
  assert.ok(/height\s*:\s*auto/.test(rule), 'height follows the photo');
  // No portfolio rule anywhere (media queries included) crops with object-fit: cover.
  [...css.matchAll(/([^{}]*portfolio[^{}]*)\{([^}]*)\}/g)].forEach(([, selector, body]) =>
    assert.ok(!/object-fit\s*:\s*cover/.test(body), selector.trim() + ' must not use object-fit: cover'));
});

// ---- Rows ---------------------------------------------------------------------
const SiteCommon = require('../js/site.js');
const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
const ruleBody = selector => {
  const m = css.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
};
const mediaBlock = query => {
  const start = css.indexOf('@media (' + query + ')');
  if (start < 0) return '';
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i);
  }
  return '';
};

test('rows CSS: full rows of one height -- each photo starts at the row height times its proportion and grows by it; the row height 340 / 230 / 200 px', () => {
  assert.match(ruleBody('.portfolio-grid'), /--row-h: 340px; display: flex; flex-wrap: wrap;/);
  assert.match(ruleBody('.portfolio-item'), /flex: var\(--ar, 0\.6667\) 1 calc\(var\(--ar, 0\.6667\) \* var\(--row-h\)\);/);
  assert.match(ruleBody('.portfolio-grid::after'), /flex: 1000 1 0;/, 'without the script the last row keeps the row height');
  assert.match(ruleBody('.portfolio-grid.is-planned::after'), /display: none;/, 'with it every row is full');
  assert.doesNotMatch(css, /is-masonry|grid-auto-rows: 1px/, 'no masonry left');
  assert.match(mediaBlock('max-width: 900px'), /\.portfolio-grid \{ --row-h: 230px; \}/);
  assert.match(mediaBlock('max-width: 600px'), /\.portfolio-grid \{ --row-h: 200px; gap: var\(--s-2\); \}/);
});

test('every photo has its size, its 640 px grid copy and its 16 px preview listed -- all of them its own (scripts/portfolio_media.js)', () => {
  const sizeOf = file => {
    const b = fs.readFileSync(file);
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    const bits = b.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  };
  const fileOf = url => path.join(site, url.replace('/sayanmramor-site/', ''));
  const check = (item, where) => {
    const [w, h] = sizeOf(fileOf(item.image));
    assert.deepEqual([item.width, item.height], [w, h], where + ': ' + item.image);
    assert.equal(item.thumb, item.image.replace(/\/([^/]+)\.webp$/, '/w640/$1.webp'), where + ': ' + item.image);
    const [tw, th] = sizeOf(fileOf(item.thumb));
    assert.equal(tw, 640, item.thumb);
    assert.ok(Math.abs(tw / th - w / h) < 0.01, item.thumb + ': the same proportions');
    assert.match(item.preview, /^data:image\/webp;base64,[A-Za-z0-9+/=]{40,600}$/, where + ': ' + item.image);
  };
  Object.entries(portfolio).forEach(([key, items]) => items.forEach(item => check(item, key)));
  ['spa-zony', 'hammamy', 'basseyny'].forEach(slug => {
    const html = fs.readFileSync(path.join(site, 'categories', slug + '.html'), 'utf8');
    const items = [...html.matchAll(/\{ image: '([^']+)', caption: '([^']*)', width: (\d+), height: (\d+), thumb: '([^']+)', preview: '([^']+)' \}/g)]
      .map(([, image, caption, width, height, thumb, preview]) => ({ image, caption, width: +width, height: +height, thumb, preview }));
    assert.ok(items.length > 0, slug);
    assert.equal(items.length, (html.match(/\{ image: '/g) || []).length, slug + ': every photo listed in full');
    items.forEach(item => check(item, slug));
  });
});

test('photoRatio: width / height when listed, 2:3 otherwise', () => {
  assert.equal(SiteCommon.photoRatio({ width: 1600, height: 1067 }), 1600 / 1067);
  assert.equal(SiteCommon.photoRatio({ image: 'a.webp' }), 2 / 3);
  assert.equal(SiteCommon.photoRatio({ width: 0, height: 100 }), 2 / 3);
});

test('rowPlan: the photos in their order, shared out so the rows come close to the row height and to each other', () => {
  const sum = a => a.reduce((x, y) => x + y, 0);
  // 11 portraits at 1232 px and 340 px rows: two rows, 6 + 5.
  const portraits = Array(11).fill(2 / 3);
  assert.deepEqual(SiteCommon.rowPlan(portraits, 1232, 16, 340), [6, 5]);
  // A landscape counts for more than a portrait: the rows' total proportions stay even.
  const mixed = [2 / 3, 1.5, 2 / 3, 2 / 3, 2 / 3, 0.8, 0.8, 0.8, 0.8, 1.5, 2 / 3];
  const plan = SiteCommon.rowPlan(mixed, 1232, 16, 340);
  assert.equal(sum(plan), mixed.length, 'every photo once');
  let start = 0;
  const totals = plan.map(n => { const t = sum(mixed.slice(start, start + n)); start += n; return t; });
  assert.ok(Math.max(...totals) - Math.min(...totals) < 1, totals.join(' / '));
  // A few photos: one row; none: no rows; no width yet: no plan.
  assert.deepEqual(SiteCommon.rowPlan([2 / 3, 2 / 3], 1232, 16, 340), [2]);
  assert.deepEqual(SiteCommon.rowPlan([], 1232, 16, 340), []);
  assert.deepEqual(SiteCommon.rowPlan([1, 1], 0, 16, 340), []);
  // Every direction of the site: every photo once, every row in the plan, at 1232 px.
  Object.entries(portfolio).forEach(([key, items]) => {
    const p = SiteCommon.rowPlan(items.map(SiteCommon.photoRatio), 1232, 16, 340);
    assert.equal(sum(p), items.length, key);
    assert.ok(p.every(n => n > 0), key);
  });
});

// A minimal DOM, just enough for renderPortfolio and layoutRows.
const fakeEl = tag => ({
  tagName: tag, children: [], dataset: {}, listeners: {}, attrs: {},
  style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
  classList: { set: new Set(), add(c) { this.set.add(c); }, contains(c) { return this.set.has(c); } },
  set className(v) { this.classList.set = new Set(v.split(' ')); },
  set innerHTML(v) { this.children = []; },
  appendChild(c) { this.children.push(c); return c; },
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
});
function withFakeDom(fn) {
  const frames = [];
  const saved = { document: global.document, ResizeObserver: global.ResizeObserver,
    requestAnimationFrame: global.requestAnimationFrame, getComputedStyle: global.getComputedStyle };
  global.document = { createElement: fakeEl };
  global.ResizeObserver = class { observe() {} };
  global.requestAnimationFrame = f => frames.push(f);
  global.getComputedStyle = () => ({ columnGap: '16px', getPropertyValue: p => (p === '--row-h' ? ' 340px' : '') });
  try { fn(frames); } finally { Object.assign(global, saved); }
}

test('layoutRows: a full row shares the width by proportion (less its gaps); a row that would stand too tall keeps 1.5 x the row height', () => withFakeDom(() => {
  const grid = fakeEl('div');
  grid.clientWidth = 1232;
  grid.children = [2 / 3, 2 / 3, 2 / 3, 2 / 3].map(r => { const f = fakeEl('figure'); f.dataset.ar = String(r); return f; });
  SiteCommon.layoutRows(grid);
  assert.ok(grid.classList.contains('is-planned'));
  grid.children.forEach(f => assert.match(f.style.flex, /^0\.6666\d* 1 calc\(\(100% - 48px\) \* 0\.250000 - 1px\)$/));
  const pair = fakeEl('div');
  pair.clientWidth = 1232;
  pair.children = [2 / 3, 2 / 3].map(r => { const f = fakeEl('figure'); f.dataset.ar = String(r); return f; });
  SiteCommon.layoutRows(pair);
  pair.children.forEach(f => assert.equal(f.style.flex, '0 0 340.00px'), 'two photos: 510 px tall, not 900');
}));

test('renderPortfolio: the photos in order, each in its frame with its proportion and size; the rows planned once the width is known', () => withFakeDom(frames => {
  const grid = fakeEl('div');
  grid.clientWidth = 1232;
  const items = [
    { image: '/sayanmramor-site/assets/portfolio/001.webp', caption: '', width: 1067, height: 1600 },
    { image: '/sayanmramor-site/assets/portfolio/002.webp', caption: '', width: 1600, height: 1067 },
    { image: '/sayanmramor-site/assets/portfolio/003.webp', caption: '' },
  ];
  SiteCommon.renderPortfolio(grid, items);
  assert.ok(grid.children.every(f => f.children[0].classList.contains('portfolio-shot')), 'each photo in its frame');
  const imgs = grid.children.map(f => f.children[0].children[0]);
  assert.deepEqual(imgs.map(i => i.src), items.map(i => i.image), 'order kept');
  assert.ok(imgs.every(i => i.loading === 'lazy'), 'still lazy-loaded');
  assert.deepEqual(grid.children.map(f => f.style.props['--ar']), ['0.6669', '1.4995', '0.6667']);
  assert.deepEqual(grid.children.map(f => f.dataset.ar), ['0.6669', '1.4995', '0.6667']);
  assert.deepEqual([imgs[0].width, imgs[0].height], [1067, 1600], 'the size is on the photo: its box is right before it loads');
  assert.ok(imgs[2].listeners.load, 'an unlisted photo takes its proportion when it loads');
  assert.ok(grid.listeners.load && grid.listeners.load.length, 're-plan when a photo loads');
  frames.forEach(f => f());
  assert.ok(grid.classList.contains('is-planned'));
  assert.ok(grid.children.every(f => /calc\(/.test(f.style.flex)));
}));

test('photoSources: the 640 px copy and the original for dense screens, sized by the tallest row of each layout', () => {
  const src = SiteCommon.photoSources({ image: '/a/184.webp', thumb: '/a/w640/184.webp', width: 1067, height: 1600 });
  assert.equal(src.srcset, '/a/w640/184.webp 640w, /a/184.webp 1067w');
  assert.equal(src.sizes, '(max-width: 600px) 174px, (max-width: 900px) 201px, 294px');
  assert.equal(SiteCommon.photoSources({ image: '/a/1.webp' }), null, 'no copy: the photo alone');
});

test('the viewer: a photo grows from its frame to the screen; whole, centred, clear of the edges', () => {
  const stage = { left: 0, top: 80, width: 1440, height: 700 };
  const portrait = SiteCommon.fitRect(stage, 2 / 3, 88);
  assert.equal(Math.round(portrait.height), 684, 'a portrait: as tall as the stage allows');
  assert.equal(Math.round(portrait.left + portrait.width / 2), 720, 'centred');
  const wide = SiteCommon.fitRect(stage, 3, 88);
  assert.equal(Math.round(wide.width), 1440 - 176, 'a wide photo: as wide as the stage allows, less the arrows');
  const src = fs.readFileSync(path.join(site, 'js', 'site.js'), 'utf8');
  assert.match(src, /setAttribute\('role', 'dialog'\)/);
  assert.match(src, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(src, /e\.key === 'Escape'/);
  assert.match(src, /opener\.focus\(\{ preventScroll: true \}\)/, 'the focus goes back to the photo it came from');
  assert.match(src, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(css, /\.portfolio-item\[role="button"\] \{ cursor: zoom-in; \}/);
  // The reveal: one quiet movement -- a fade and a 14 px rise (24 px until 2026-10-24); with reduced motion, the fade alone.
  assert.match(css, /\.portfolio-item\.will-reveal \{ opacity: 0; transform: translateY\(14px\); \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.portfolio-item\.will-reveal \{ transform: none; \}/);
  assert.doesNotMatch(css, /will-reveal[^{]*\{[^}]*clip-path/, 'no wipe');
});

test('reveal: the photos entering together rise top to bottom, left to right', () => {
  const at = (top, left) => ({ getBoundingClientRect: () => ({ top, left }) });
  const a = at(0, 300), b = at(0, 0), c = at(400, 0);
  assert.deepEqual(SiteCommon.revealOrder([c, a, b]), [b, a, c]);
});
