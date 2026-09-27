// tests/portfolio.test.js
// Portfolio photos: every path in data/portfolio.json points at a real file
// under /sayanmramor-site/assets/, each of the 9 directions shows the agreed
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
// portfolio_keys). A photo may belong to several directions.
const EXPECTED_COUNTS = {
  lestnitsa: 11, stupeni: 7, stoleshnitsa_kuhnya: 25, stoleshnitsa_vannaya: 21, podokonnik: 2,
  pol: 16, stena: 38, fasad: 7, panno: 20,
};

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

test('portfolio.json has exactly the 9 site directions', () => {
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
  assert.ok(fs.readdirSync(assetDir, { withFileTypes: true }).every(e => !e.isDirectory()),
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
  const used = new Set(Object.values(portfolio).flat().map(i => path.basename(i.image)));
  used.forEach(f => { if (f.endsWith('.webp')) assert.ok(f in listed, f + ' is used but not listed'); });
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

// ---- Masonry ------------------------------------------------------------------
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

test('masonry CSS: 1px rows, no row gap, items keep their own height; 4 / 3 / 2 columns', () => {
  const masonry = ruleBody('.portfolio-grid.is-masonry');
  assert.ok(masonry, '.portfolio-grid.is-masonry rule exists');
  assert.match(masonry, /grid-auto-rows\s*:\s*1px/);
  assert.match(masonry, /row-gap\s*:\s*0/);
  assert.match(ruleBody('.portfolio-grid.is-masonry .portfolio-item'), /align-self\s*:\s*start/);
  assert.doesNotMatch(masonry + ruleBody('.portfolio-grid'), /grid-auto-flow\s*:[^;]*dense/, 'dense packing would reorder photos');
  assert.match(ruleBody('.portfolio-grid'), /grid-template-columns\s*:\s*repeat\(4,/);
  assert.match(mediaBlock('max-width: 900px'), /\.portfolio-grid\s*\{[^}]*repeat\(3,/);
  assert.match(mediaBlock('max-width: 600px'), /\.portfolio-grid\s*\{[^}]*repeat\(2,/);
});

test('masonry span: a photo takes as many 1px rows as its height plus the gap', () => {
  assert.equal(SiteCommon.masonrySpan(399, 16), 415);
  assert.equal(SiteCommon.masonrySpan(398.9, 16), 415);
  assert.equal(SiteCommon.masonrySpan(177.3, 12), 190);
  assert.equal(SiteCommon.masonrySpan(0, 0), 1);
});

test('layoutMasonry measures every photo, then sets its row span', () => {
  const heights = [399.2, 177, 332.6];
  const items = heights.map(h => ({ style: {}, getBoundingClientRect: () => ({ height: h }) }));
  SiteCommon.layoutMasonry({ children: items }, 16);
  assert.deepEqual(items.map(i => i.style.gridRowEnd), ['span 416', 'span 193', 'span 349']);
});

test('renderPortfolio switches the grid to masonry and keeps the photos in order', () => {
  // A minimal DOM, just enough for renderPortfolio.
  const el = tag => ({
    tagName: tag, children: [], style: {}, dataset: {}, listeners: {},
    classList: { set: new Set(), add(c) { this.set.add(c); }, contains(c) { return this.set.has(c); } },
    set className(v) { this.classList.set = new Set(v.split(' ')); },
    set innerHTML(v) { this.children = []; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    getBoundingClientRect: () => ({ height: 300 }),
  });
  const frames = [];
  const saved = { document: global.document, ResizeObserver: global.ResizeObserver,
    requestAnimationFrame: global.requestAnimationFrame, getComputedStyle: global.getComputedStyle };
  global.document = { createElement: el };
  global.ResizeObserver = class { observe() {} };
  global.requestAnimationFrame = fn => frames.push(fn);
  global.getComputedStyle = () => ({ columnGap: '16px' });
  try {
    const grid = el('div');
    const items = ['/sayanmramor-site/assets/portfolio/001.webp', '/sayanmramor-site/assets/portfolio/002.webp']
      .map(image => ({ image, caption: '' }));
    SiteCommon.renderPortfolio(grid, items);
    assert.ok(grid.classList.contains('is-masonry'), 'masonry class is on');
    assert.deepEqual(grid.children.map(f => f.children[0].src), items.map(i => i.image), 'order kept');
    assert.ok(grid.children.every(f => f.children[0].loading === 'lazy'), 'still lazy-loaded');
    assert.ok(grid.listeners.load && grid.listeners.load.length, 're-layout when a photo loads');
    frames.forEach(fn => fn());
    assert.deepEqual(grid.children.map(f => f.style.gridRowEnd), ['span 316', 'span 316']);
  } finally {
    Object.assign(global, saved);
  }
});
