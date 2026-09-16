# Sayanmramor Catalog Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standalone sayanmramor catalog site in `D:\sayanmramor-site` — 9 product-category pages (each with a trimmed calculator and a portfolio placeholder section), a fixed-price finished-goods catalog, and a home page — all reusing `D:\calculator`'s stone data and pricing/picker logic by reference, never by copy.

**Architecture:** Static, build-free HTML/CSS/JS (no framework, no bundler), matching `D:\calculator`'s existing style. Three small shared JS modules (`site.js`, `category-calculator.js`, `catalog.js`) carry all logic; the 9 category pages, the catalog page, and the home page are static HTML shells that call into those modules. Stone data, pricing formulas, and product-type config are loaded live from `D:\calculator` (`pricing.js`, `material-picker.js`, `product-types.js`, `data/slabs.json`) via root-absolute URLs against a dev server rooted at `D:\`; the two new data files this project owns (`data/products.json`, `data/portfolio.json`) are hand-editable JSON, same pattern as `slabs.json`.

**Tech Stack:** Vanilla HTML/CSS/JS, UMD modules (same pattern as `pricing.js`/`material-picker.js`), `node:test` for the pure-function unit tests, Python's `http.server` for local dev.

**Spec:** `D:\sayanmramor-site\docs\superpowers\specs\2026-09-16-sayanmramor-catalog-site-design.md`

## Global Constraints

- No filtering of stone by product type anywhere on this site — every material picker shows all 891 stones, on every category page, exactly like the main calculator. (Confirmed with the user: no hard technical restriction exists; edge cases are handled by the manager at order confirmation.)
- Never copy `data/slabs.json`, stone images, `pricing.js`, `material-picker.js`, or `product-types.js` into this project. Always load them from `D:\calculator` by reference (script tag / `fetch`).
- Never modify any file under `D:\calculator` as part of this plan. (The one exception — extracting pricing config into `D:\calculator\product-types.js` — was already done and committed, in `D:\calculator`, as of 2026-09-16, commit `680858a`. This plan only *consumes* that file.)
- No build step, no bundler, no framework, no npm dependency. Every file must run by being opened through a static file server, unmodified.
- Local dev/testing: start one server from `D:\` (the parent of both `calculator` and `sayanmramor-site`), e.g. `python -m http.server 8000` run from `D:\`. All cross-project URLs are root-absolute: `/calculator/...` for calculator's files, `/sayanmramor-site/...` for this project's files.
- Every category page's `<head>` must include `<base href="/calculator/">`. This is required so that `material-picker.js`'s internal, unmodifiable `'data/' + stone.image` path resolves against `/calculator/data/...` instead of the category page's own URL. Because of this `<base>` tag, every link/script/stylesheet that belongs to *this* project (`sayanmramor-site`) on a category page must use a root-absolute `/sayanmramor-site/...` URL, never a bare relative one — a relative URL on those pages resolves against `/calculator/`, not against the page's own folder.
- All new UI copy is Russian, matching the existing calculator's tone.

---

## File Structure

```
D:\sayanmramor-site\
  index.html
  katalog.html
  categories\
    poly.html
    lestnitsy.html
    panno.html
    podokonniki.html
    steny.html
    fasady.html
    stoleshnitsy-vannaya.html
    stoleshnitsy-kuhnya.html
    stupeni.html
  css\
    site.css
  js\
    site.js                    # SiteCommon: injectMaterialPickerMarkup, renderPortfolio, loadPortfolio
    category-calculator.js     # CategoryCalculator: pure pricing-param helpers + init(productKey)
    catalog.js                 # Catalog: formatProductPrice, isAvailable, buildProductCard, renderCatalog
  data\
    products.json
    portfolio.json
  assets\
    portfolio\
      placeholder.svg
  tests\
    site.test.js
    category-calculator.test.js
    catalog.test.js
  docs\superpowers\
    specs\2026-09-16-sayanmramor-catalog-site-design.md   (already exists)
    plans\2026-09-16-sayanmramor-catalog-site.md            (this file)
  README.md
  .gitignore
```

---

### Task 1: Project scaffolding, README, base stylesheet

**Files:**
- Create: `D:\sayanmramor-site\.gitignore`
- Create: `D:\sayanmramor-site\README.md`
- Create: `D:\sayanmramor-site\css\site.css`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `css/site.css` — the shared stylesheet every later HTML page links via `<link rel="stylesheet" href="/sayanmramor-site/css/site.css">`. Class names later tasks rely on: `.site-header`, `.site-logo`, `.site-nav`, `.site-nav a.active`, `.site-nav a.calculator-link`, `.wrap`, `.card`, `.form-side`, `.field`, `.material-field`, `.material-field-thumb`, `.material-field-text`, `.material-field-chevron`, `.dims`, `.error`, `.checkboxes`, `.checkbox-row`, `.result-panel`, `.result-label`, `.result-price`, `.warning-box`, `.result-breakdown`, `.remainder-line`, `.info-block`, `.cta-btn`, `.disclaimer`, all `.picker-*`/`.filter-*`/`.stone-card*`/`.lightbox*`/`.badge-oos` classes (from the copied base), `.portfolio-section`, `.portfolio-grid`, `.portfolio-item`, `.catalog-grid`, `.product-tile*`, `.catalog-empty`, `.home-grid`.

- [ ] **Step 1: Create `.gitignore`**

```
Thumbs.db
.DS_Store
```

- [ ] **Step 2: Write `README.md`**

```markdown
# sayanmramor-site

Каталог продукции sayanmramor — отдельный статический сайт (без сборки,
без фреймворка), будущий поддомен основного сайта. Дизайн:
`docs/superpowers/specs/2026-09-16-sayanmramor-catalog-site-design.md`.

## Важно: этот сайт читает данные из D:\calculator

Этот проект не хранит данные о камне и не дублирует формулу цены — он
загружает `pricing.js`, `material-picker.js`, `product-types.js` и
`data/slabs.json` напрямую из `D:\calculator` (соседний проект,
который этот репозиторий никогда не изменяет).

## Локальный запуск

Поднимите один сервер из `D:\` (родитель и `calculator`, и
`sayanmramor-site`):

```
cd D:\
python -m http.server 8000
```

Откройте `http://localhost:8000/sayanmramor-site/index.html`.

Пути вида `/calculator/data/slabs.json` и
`/sayanmramor-site/css/site.css` работают только при таком запуске —
открытие файлов напрямую (`file://`) не работает, потому что `fetch()`
данных о камне требует http(s).

## `<base href="/calculator/">` на страницах категорий

Каждая страница `categories/*.html` подключает `material-picker.js` из
`D:\calculator` без изменений. Этот файл сам строит путь к картинке
камня как `'data/' + stone.image` — относительный путь, который
браузер обычно резолвил бы относительно адреса ТЕКУЩЕЙ страницы (то
есть `/sayanmramor-site/categories/...`), а не относительно
`/calculator/`. Тег `<base href="/calculator/">` в `<head>` каждой
такой страницы чинит это, не трогая `material-picker.js`. Из-за этого
на страницах категорий все ссылки/скрипты/стили, принадлежащие ЭТОМУ
проекту, обязаны быть абсолютными (`/sayanmramor-site/...`) — просто
`css/site.css` или `js/site.js` резолвился бы в `/calculator/css/...`
и не нашёлся бы. Не убирайте `<base>` и не меняйте абсолютные пути на
относительные на этих страницах.

## Тесты

```
node --test tests/site.test.js tests/category-calculator.test.js tests/catalog.test.js
```

Эти тесты используют реальные `D:\calculator\pricing.js` и
`D:\calculator\product-types.js` (через `require('../../calculator/...')`),
чтобы гарантировать, что урезанный калькулятор считает так же, как
основной.

## Готовые изделия и примеры работ

`data/products.json` и `data/portfolio.json` — обычные JSON-файлы,
правятся вручную текстовым редактором (формат описан в спеке).
```

- [ ] **Step 3: Build `css/site.css`**

Read `D:\calculator\sayanmramor-calculator.html`, find the `<style>` block
(it opens right after the `<title>` line and closes right before
`<body>`). Copy everything between `<style>` and `</style>` verbatim as
the first part of `css/site.css` — this is the exact, already-working
styling for the layout, the material field, the full-screen picker, the
filter dropdowns, the stone cards, the lightbox, and the result panel.
Do not alter it.

Then append this site-specific block to the end of the same file:

```css

/* ---- Site chrome (header/nav) ---------------------------------------- */
.site-header {
  max-width: 900px;
  margin: 0 auto 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.site-logo {
  font-size: 18px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.3px;
  color: #1a1a1a;
  text-decoration: none;
}
.site-nav { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; }
.site-nav a { font-size: 13px; font-weight: 600; color: #555; text-decoration: none; padding: 6px 0; }
.site-nav a:hover, .site-nav a.active { color: #ff5a1f; }
.site-nav a.calculator-link { background: #ff5a1f; color: #fff; padding: 8px 16px; border-radius: 999px; }
.site-nav a.calculator-link:hover { background: #e64f16; color: #fff; }

/* ---- Category page: portfolio placeholder section --------------------- */
.portfolio-section { max-width: 900px; margin: 0 auto 36px; }
.portfolio-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.portfolio-item { margin: 0; }
.portfolio-item img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 6px; display: block; background: #eee; }
.portfolio-item figcaption { font-size: 12px; color: #777; margin-top: 6px; }

/* ---- Готовые изделия (каталог) ---------------------------------------- */
.catalog-grid { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 24px; }
.product-tile { background: #fff; border-radius: 6px; padding: 14px; }
.product-tile-image { position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden; background: #eee; margin-bottom: 10px; }
.product-tile-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.product-tile-image.image-broken { display: flex; align-items: center; justify-content: center; }
.product-tile-name { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.product-tile-price { font-size: 14px; color: #ff5a1f; font-weight: 700; margin-bottom: 6px; }
.product-tile-description { font-size: 12px; color: #777; line-height: 1.4; }
.catalog-empty { grid-column: 1 / -1; text-align: center; color: #777; padding: 60px 0; }

/* ---- Главная: сетка категорий ------------------------------------------ */
.home-grid { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.home-grid a {
  display: block; background: #fff; border-radius: 6px; padding: 24px 16px;
  text-align: center; text-decoration: none; color: #1a1a1a; font-weight: 700;
  font-size: 14px; transition: box-shadow 0.15s;
}
.home-grid a:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore README.md css/site.css
git commit -m "chore: scaffold project, add README and base stylesheet"
```

---

### Task 2: `js/site.js` — shared picker markup injection + portfolio rendering

**Files:**
- Create: `D:\sayanmramor-site\js\site.js`
- Test: `D:\sayanmramor-site\tests\site.test.js`

**Interfaces:**
- Consumes: nothing new (DOM globals only; no dependency on other project files).
- Produces: global `SiteCommon` (browser) / `module.exports` (Node) with:
  - `injectMaterialPickerMarkup()` — idempotent; appends the picker overlay + lightbox DOM (exact ids/classes that `D:\calculator\material-picker.js`'s `init()` requires) to `document.body`. No return value.
  - `renderPortfolio(container, items)` — clears `container` and appends one `<figure class="portfolio-item">` per item in `items` (`{ image, caption }`).
  - `loadPortfolio(productKey, container)` — fetches `/sayanmramor-site/data/portfolio.json`, calls `renderPortfolio(container, data[productKey] || [])`; on fetch failure sets `container.textContent` to an error message.

  Later tasks (3, 5, 6) call `SiteCommon.injectMaterialPickerMarkup()` from `CategoryCalculator.init()` and `SiteCommon.loadPortfolio(productKey, el)` from each category page's inline script.

- [ ] **Step 1: Write the failing test**

```js
// tests/site.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const SiteCommon = require('../js/site.js');

test('SiteCommon exports the expected functions', () => {
  assert.equal(typeof SiteCommon.injectMaterialPickerMarkup, 'function');
  assert.equal(typeof SiteCommon.renderPortfolio, 'function');
  assert.equal(typeof SiteCommon.loadPortfolio, 'function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/site.test.js`
Expected: FAIL — `Cannot find module '../js/site.js'`.

- [ ] **Step 3: Write `js/site.js`**

```js
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteCommon = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // Builds the exact DOM contract D:\calculator\material-picker.js's
  // init() requires (ids, classes, data-filter attributes) so the picker
  // works unmodified on a page that never had this markup written by
  // hand. Idempotent: calling it twice on the same page is a no-op the
  // second time.
  function injectMaterialPickerMarkup() {
    if (document.getElementById('pickerOverlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.id = 'pickerOverlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Выбор камня');
    overlay.innerHTML =
      '<div class="picker-header">' +
        '<input type="search" id="pickerSearch" placeholder="Поиск по названию…" autocomplete="off">' +
        '<button type="button" id="pickerClose" aria-label="Закрыть">✕</button>' +
      '</div>' +
      '<div class="picker-filters" id="pickerFilters">' +
        '<div class="filter-dropdown" data-filter="hardness">' +
          '<button type="button" class="filter-dropdown-btn" aria-haspopup="true" aria-expanded="false"></button>' +
          '<div class="filter-dropdown-panel" hidden></div>' +
        '</div>' +
        '<div class="filter-dropdown" data-filter="category">' +
          '<button type="button" class="filter-dropdown-btn" aria-haspopup="true" aria-expanded="false"></button>' +
          '<div class="filter-dropdown-panel" hidden></div>' +
        '</div>' +
        '<div class="filter-dropdown" data-filter="color">' +
          '<button type="button" class="filter-dropdown-btn" aria-haspopup="true" aria-expanded="false"></button>' +
          '<div class="filter-dropdown-panel" hidden></div>' +
        '</div>' +
      '</div>' +
      '<div class="picker-sort" id="pickerSort">' +
        '<button type="button" class="sort-btn active" data-sort-field="name" data-sort-dir="asc">A-Z</button>' +
        '<button type="button" class="sort-btn" data-sort-field="price" data-sort-dir="asc">Цена ↑</button>' +
      '</div>' +
      '<div class="picker-results" id="pickerResults">' +
        '<div class="picker-grid" id="pickerGrid"></div>' +
        '<div class="picker-sentinel" id="pickerSentinel"></div>' +
        '<div class="picker-empty" id="pickerEmpty" hidden>Ничего не найдено</div>' +
      '</div>';

    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox-overlay';
    lightbox.id = 'lightboxOverlay';
    lightbox.hidden = true;
    lightbox.innerHTML =
      '<button type="button" id="lightboxClose" aria-label="Закрыть">✕</button>' +
      '<img id="lightboxImg" alt="">';

    document.body.appendChild(overlay);
    document.body.appendChild(lightbox);
  }

  function renderPortfolio(container, items) {
    container.innerHTML = '';
    (items || []).forEach(item => {
      const figure = document.createElement('figure');
      figure.className = 'portfolio-item';
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.caption || '';
      img.loading = 'lazy';
      figure.appendChild(img);
      if (item.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = item.caption;
        figure.appendChild(caption);
      }
      container.appendChild(figure);
    });
  }

  function loadPortfolio(productKey, container) {
    fetch('/sayanmramor-site/data/portfolio.json')
      .then(r => r.json())
      .then(data => renderPortfolio(container, data[productKey] || []))
      .catch(() => { container.textContent = 'Не удалось загрузить примеры работ.'; });
  }

  return { injectMaterialPickerMarkup, renderPortfolio, loadPortfolio };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/site.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add js/site.js tests/site.test.js
git commit -m "feat: add SiteCommon module (picker markup injection, portfolio rendering)"
```

---

### Task 3: `data/portfolio.json` + placeholder image

**Files:**
- Create: `D:\sayanmramor-site\assets\portfolio\placeholder.svg`
- Create: `D:\sayanmramor-site\data\portfolio.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `data/portfolio.json`, keyed by the same 9 product keys as `D:\calculator\product-types.js`'s `PRODUCTS` (`lestnitsa`, `panno`, `podokonnik`, `pol`, `stena`, `fasad`, `stoleshnitsa_vannaya`, `stoleshnitsa_kuhnya`, `stupeni`) — each value an array of `{ image, caption }`. Tasks 5 and 6 fetch this file (via `SiteCommon.loadPortfolio`) using these exact keys.

- [ ] **Step 1: Create the placeholder image**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#e7e4e0"/>
  <g fill="none" stroke="#a8a49f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="70" y="90" width="260" height="150" rx="8"/>
    <circle cx="150" cy="150" r="24"/>
    <path d="M70 210 L160 150 L220 190 L270 140 L330 210"/>
  </g>
  <text x="200" y="270" font-family="Arial, sans-serif" font-size="16" fill="#6e6a65" text-anchor="middle">
    Фото проекта появится позже
  </text>
</svg>
```

Save this as `D:\sayanmramor-site\assets\portfolio\placeholder.svg`.

- [ ] **Step 2: Create `data/portfolio.json`**

```json
{
  "lestnitsa": [
    { "image": "/sayanmramor-site/assets/portfolio/placeholder.svg", "caption": "Фото проекта появится позже" }
  ],
  "panno": [
    { "image": "/sayanmramor-site/assets/portfolio/placeholder.svg", "caption": "Фото проекта появится позже" }
  ],
  "podokonnik": [
    { "image": "/sayanmramor-site/assets/portfolio/placeholder.svg", "caption": "Фото проекта появится позже" }
  ],
  "pol": [
    { "image": "/sayanmramor-site/assets/portfolio/placeholder.svg", "caption": "Фото проекта появится позже" }
  ],
  "stena": [
    { "image": "/sayanmramor-site/assets/portfolio/placeholder.svg", "caption": "Фото проекта появится позже" }
  ],
  "fasad": [
    { "image": "/sayanmramor-site/assets/portfolio/placeholder.svg", "caption": "Фото проекта появится позже" }
  ],
  "stoleshnitsa_vannaya": [
    { "image": "/sayanmramor-site/assets/portfolio/placeholder.svg", "caption": "Фото проекта появится позже" }
  ],
  "stoleshnitsa_kuhnya": [
    { "image": "/sayanmramor-site/assets/portfolio/placeholder.svg", "caption": "Фото проекта появится позже" }
  ],
  "stupeni": [
    { "image": "/sayanmramor-site/assets/portfolio/placeholder.svg", "caption": "Фото проекта появится позже" }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add assets/portfolio/placeholder.svg data/portfolio.json
git commit -m "feat: add placeholder portfolio data for all 9 categories"
```

---

### Task 4: `js/category-calculator.js` — trimmed calculator logic

**Files:**
- Create: `D:\sayanmramor-site\js\category-calculator.js`
- Test: `D:\sayanmramor-site\tests\category-calculator.test.js`

**Interfaces:**
- Consumes:
  - `SiteCommon.injectMaterialPickerMarkup()` (Task 2).
  - Browser globals loaded via `<script>` tags on the page that uses this module: `Pricing.calculatePrice(params)` and `MaterialPicker.init({ stones, onSelect })` (from `D:\calculator\pricing.js` / `material-picker.js`, unmodified), and `ProductTypes` (from `D:\calculator\product-types.js`, exposing `PRODUCTS`, `SAW_MARGIN_CM`, `AREA_WASTE_FACTOR`, `WORK_MULTIPLIER`, `HARDNESS_WORK_MULTIPLIER`, `OPTION_SURCHARGE`).
  - In tests (Node), the same modules are loaded via `require('../../calculator/pricing.js')` and `require('../../calculator/product-types.js')`.
- Produces: global `CategoryCalculator` (browser) / `module.exports` (Node) with:
  - `computeOptionSurchargeSum(selected, OPTION_SURCHARGE)` → `number`, where `selected` is `{ complex, polish, install }` (booleans).
  - `buildSurchargeLabels(selected, OPTION_SURCHARGE)` → `string[]`.
  - `buildPricingParams({ stone, widthM, lengthM, product, productTypes, optionSurchargeSum })` → the exact object shape `Pricing.calculatePrice` expects.
  - `messageForReason(reason)` → `string`.
  - `pluralizeSlabs(n)` → `string`.
  - `formatRub(n)` → `string`.
  - `formatDate(iso)` → `string`.
  - `init(productKey)` — DOM wiring; expects the page to already contain elements with ids `materialField`, `materialFieldThumb` (containing an `<img>`), `materialFieldText`, `width`, `length`, `dimError`, `priceOut`, `breakdown`, `warningOut`, `remainderOut`, `updatedAtOut`, `infoBlock`, `ctaBtn`, `opt-complex`, `opt-polish`, `opt-install`. Task 5 provides this markup.

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/category-calculator.test.js`
Expected: FAIL — `Cannot find module '../js/category-calculator.js'`.

- [ ] **Step 3: Write `js/category-calculator.js`**

```js
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoryCalculator = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  function computeOptionSurchargeSum(selected, OPTION_SURCHARGE) {
    let sum = 0;
    if (selected.complex) sum += OPTION_SURCHARGE.complex;
    if (selected.polish) sum += OPTION_SURCHARGE.polish;
    if (selected.install) sum += OPTION_SURCHARGE.install;
    return sum;
  }

  function buildSurchargeLabels(selected, OPTION_SURCHARGE) {
    const labels = [];
    if (selected.complex) labels.push('сложная форма +' + (OPTION_SURCHARGE.complex * 100) + '%');
    if (selected.polish) labels.push('полировка +' + (OPTION_SURCHARGE.polish * 100) + '%');
    if (selected.install) labels.push('монтаж +' + (OPTION_SURCHARGE.install * 100) + '%');
    return labels;
  }

  function buildPricingParams({ stone, widthM, lengthM, product, productTypes, optionSurchargeSum }) {
    return {
      stone,
      widthM,
      lengthM,
      productType: product.type,
      complexityMultiplier: product.complexityMultiplier,
      optionSurchargeSum,
      marginCm: productTypes.SAW_MARGIN_CM,
      wasteFactor: productTypes.AREA_WASTE_FACTOR,
      workMultiplier: productTypes.HARDNESS_WORK_MULTIPLIER[stone.hardness_category] || productTypes.WORK_MULTIPLIER,
      allowSeam: product.allowSeam !== false
    };
  }

  const REASON_MESSAGES = {
    no_slabs_for_stone: 'Для этого камня сейчас нет данных о слэбах в наличии.',
    no_priced_slab: 'Для этого камня есть слэбы в наличии, но актуальная цена ещё не определена — пришлите размеры менеджеру для точного расчёта.',
    insufficient_stock: 'Даже все подходящие слэбы этого камня в сумме не покрывают нужный объём — пришлите размеры менеджеру для точного расчёта.',
    no_fitting_slab: 'Указанная ширина слишком большая для цельного изделия такого типа — шов возможен только по длине. Пришлите точные размеры менеджеру — подберём решение под ваш проект.'
  };
  const DEFAULT_REASON_MESSAGE = 'Подходящего слэба нет в наличии — пришлите размеры менеджеру для точного расчёта.';

  function messageForReason(reason) {
    return REASON_MESSAGES[reason] || DEFAULT_REASON_MESSAGE;
  }

  function pluralizeSlabs(n) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'слэб';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'слэба';
    return 'слэбов';
  }

  function formatRub(n) {
    return Math.round(n).toLocaleString('ru-RU') + ' ₽';
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ru-RU');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const INCOMPLETE_HINT = 'Выберите материал и укажите размеры, чтобы увидеть расчёт';

  function init(productKey) {
    const product = ProductTypes.PRODUCTS[productKey];
    if (!product) throw new Error('Unknown product key: ' + productKey);

    SiteCommon.injectMaterialPickerMarkup();

    const materialField = document.getElementById('materialField');
    const materialFieldThumb = document.getElementById('materialFieldThumb');
    const materialFieldThumbImg = materialFieldThumb.querySelector('img');
    materialFieldThumbImg.addEventListener('error', () => { materialFieldThumb.hidden = true; });
    const materialFieldText = document.getElementById('materialFieldText');
    const widthInput = document.getElementById('width');
    const lengthInput = document.getElementById('length');
    const dimError = document.getElementById('dimError');
    const priceOut = document.getElementById('priceOut');
    const breakdown = document.getElementById('breakdown');
    const warningOut = document.getElementById('warningOut');
    const remainderOut = document.getElementById('remainderOut');
    const updatedAtOut = document.getElementById('updatedAtOut');
    const infoBlock = document.getElementById('infoBlock');
    const ctaBtn = document.getElementById('ctaBtn');
    const optComplex = document.getElementById('opt-complex');
    const optPolish = document.getElementById('opt-polish');
    const optInstall = document.getElementById('opt-install');

    let STONES_BY_ID = {};
    let UPDATED_AT = null;
    let DATA_LOADED = false;
    let selectedStoneId = null;
    let picker = null;
    let dimsTouched = false;

    function setPriceHint(text) { priceOut.textContent = text; priceOut.classList.add('placeholder'); }
    function setPriceValue(text) { priceOut.textContent = text; priceOut.classList.remove('placeholder'); }

    function handleMaterialSelected(stoneId) {
      const stone = STONES_BY_ID[stoneId];
      selectedStoneId = stoneId;
      materialFieldText.textContent = stone.name;
      if (stone.image) {
        materialFieldThumbImg.src = '/calculator/data/' + stone.image;
        materialFieldThumb.hidden = false;
      } else {
        materialFieldThumb.hidden = true;
      }
      calculate();
    }

    materialField.addEventListener('click', () => { if (picker) picker.open(); });

    function calculate() {
      if (!DATA_LOADED) return;

      const widthM = parseFloat(widthInput.value) || 0;
      const lengthM = parseFloat(lengthInput.value) || 0;

      warningOut.style.display = 'none';
      warningOut.innerHTML = '';
      remainderOut.textContent = '';

      if (widthM <= 0 || lengthM <= 0) {
        dimError.style.display = dimsTouched ? 'block' : 'none';
        setPriceHint(INCOMPLETE_HINT);
        breakdown.innerHTML = '';
        updatedAtOut.textContent = '';
        infoBlock.style.display = 'none';
        return;
      }
      dimError.style.display = 'none';

      if (!selectedStoneId) {
        setPriceHint(INCOMPLETE_HINT);
        breakdown.innerHTML = '';
        warningOut.style.display = 'none';
        updatedAtOut.textContent = '';
        infoBlock.style.display = 'none';
        return;
      }
      const stone = STONES_BY_ID[selectedStoneId];

      if (stone.available === false) {
        setPriceValue('Нужно уточнить у менеджера');
        warningOut.textContent = 'Этот камень сейчас распродан — пришлите размеры менеджеру для точного расчёта.';
        warningOut.style.display = 'block';
        breakdown.innerHTML = '';
        remainderOut.textContent = '';
        updatedAtOut.textContent = '';
        infoBlock.style.display = 'none';
        return;
      }

      const selectedOptions = { complex: optComplex.checked, polish: optPolish.checked, install: optInstall.checked };
      const optionSurchargeSum = computeOptionSurchargeSum(selectedOptions, ProductTypes.OPTION_SURCHARGE);
      const surchargeLabels = buildSurchargeLabels(selectedOptions, ProductTypes.OPTION_SURCHARGE);

      const params = buildPricingParams({ stone, widthM, lengthM, product, productTypes: ProductTypes, optionSurchargeSum });
      const result = Pricing.calculatePrice(params);

      if (!result.ok) {
        setPriceValue('Нужно уточнить у менеджера');
        warningOut.textContent = messageForReason(result.reason);
        warningOut.style.display = 'block';
        breakdown.innerHTML = '';
        updatedAtOut.textContent = '';
        infoBlock.style.display = 'none';
        return;
      }

      infoBlock.style.display = '';
      setPriceValue('≈ ' + formatRub(result.total));

      let html = `Площадь: <span>${(widthM * lengthM).toFixed(2)} м²</span><br>`;
      html += `Материал: <span>${escapeHtml(stone.name)}</span><br>`;
      html += `Изделие: <span>${product.label}</span>`;
      if (surchargeLabels.length) {
        html += `<br>Опции: <span>${surchargeLabels.join(', ')}</span>`;
      }
      breakdown.innerHTML = html;

      if (product.type === 'A' && result.remainderM2 !== null) {
        remainderOut.textContent = 'Остаток слэба после раскроя: ' + result.remainderM2.toFixed(2) + ' м²';
      }

      if (result.nSlabs > 1) {
        warningOut.textContent = 'Потребуется ' + result.nSlabs + ' ' + pluralizeSlabs(result.nSlabs) + ' со швом.';
        warningOut.style.display = 'block';
      }

      if (productKey === 'lestnitsa') {
        const note = 'Точный расчёт лестницы требует уточнения количества и размера ступеней у менеджера — цена ориентировочная.';
        warningOut.textContent = warningOut.textContent ? warningOut.textContent + ' ' + note : note;
        warningOut.style.display = 'block';
      }

      updatedAtOut.textContent = 'Расчёт по ценам на ' + formatDate(UPDATED_AT) + ', точная цена подтверждается менеджером.';
    }

    fetch('/calculator/data/slabs.json')
      .then(r => r.json())
      .then(data => {
        UPDATED_AT = data.updated_at;
        (data.stones || []).forEach(stone => { STONES_BY_ID[stone.id] = stone; });
        picker = MaterialPicker.init({ stones: data.stones || [], onSelect: handleMaterialSelected });
        materialField.disabled = false;
        materialFieldText.textContent = 'Выберите камень';
        DATA_LOADED = true;
        calculate();
      })
      .catch(() => {
        materialField.disabled = true;
        materialFieldText.textContent = 'Ошибка загрузки';
        warningOut.textContent = 'Не удалось загрузить данные о камне. Проверьте, что страница открыта через веб-сервер (не как локальный файл).';
        warningOut.style.display = 'block';
      });

    [widthInput, lengthInput].forEach(el => {
      el.addEventListener('input', () => { dimsTouched = true; calculate(); });
      el.addEventListener('change', () => { dimsTouched = true; calculate(); });
    });
    [optComplex, optPolish, optInstall].forEach(el => el.addEventListener('change', calculate));

    ctaBtn.addEventListener('click', () => {
      if (parseFloat(widthInput.value) > 0 && parseFloat(lengthInput.value) > 0) {
        alert('Здесь будет открываться форма заявки с уже заполненными данными расчёта (материал, размеры).');
      } else {
        dimsTouched = true;
        dimError.style.display = 'block';
      }
    });
  }

  return {
    computeOptionSurchargeSum, buildSurchargeLabels, buildPricingParams,
    messageForReason, pluralizeSlabs, formatRub, formatDate, init
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/category-calculator.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add js/category-calculator.js tests/category-calculator.test.js
git commit -m "feat: add CategoryCalculator module (trimmed per-category calculator)"
```

---

### Task 5: First category page — `categories/poly.html` (reference template)

**Files:**
- Create: `D:\sayanmramor-site\categories\poly.html`

**Interfaces:**
- Consumes: `css/site.css` (Task 1), `SiteCommon.loadPortfolio` (Task 2), `CategoryCalculator.init` (Task 4), `data/portfolio.json` (Task 3), and `D:\calculator`'s `pricing.js`/`material-picker.js`/`product-types.js`/`data/slabs.json` by reference.
- Produces: the exact page shell (nav structure, calculator form markup, script include order) that Task 6 copies verbatim into the other 8 category pages, substituting only `<title>`, `<h1>`, the subtitle `<p>`, the two `'pol'` arguments, and which nav `<a>` carries `class="active"`.

- [ ] **Step 1: Write `categories/poly.html`**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="/calculator/">
<title>Полы из камня — Саянмрамор</title>
<link rel="stylesheet" href="/sayanmramor-site/css/site.css">
</head>
<body>
<header class="site-header">
  <a class="site-logo" href="/sayanmramor-site/index.html">Саянмрамор</a>
  <nav class="site-nav">
    <a href="/sayanmramor-site/categories/lestnitsy.html">Лестницы</a>
    <a href="/sayanmramor-site/categories/panno.html">Панно</a>
    <a href="/sayanmramor-site/categories/podokonniki.html">Подоконники</a>
    <a class="active" href="/sayanmramor-site/categories/poly.html">Полы</a>
    <a href="/sayanmramor-site/categories/steny.html">Стены</a>
    <a href="/sayanmramor-site/categories/fasady.html">Фасады</a>
    <a href="/sayanmramor-site/categories/stoleshnitsy-vannaya.html">Столешницы в ванную</a>
    <a href="/sayanmramor-site/categories/stoleshnitsy-kuhnya.html">Столешницы на кухню</a>
    <a href="/sayanmramor-site/categories/stupeni.html">Ступени</a>
    <a href="/sayanmramor-site/katalog.html">Готовые изделия</a>
    <a class="calculator-link" href="/calculator/sayanmramor-calculator.html">Калькулятор</a>
  </nav>
</header>

<div class="wrap">
  <h1>Полы из камня</h1>
  <p class="subtitle">Мраморные и гранитные полы на заказ — рассчитайте ориентировочную стоимость по своим размерам.</p>
</div>

<section class="portfolio-section">
  <div class="portfolio-grid" id="portfolioGrid"></div>
</section>

<div class="wrap">
  <div class="card">
    <div class="form-side">
      <div class="field">
        <label id="materialLabel" for="materialField">Материал</label>
        <button type="button" class="material-field" id="materialField"
                aria-labelledby="materialLabel materialFieldText" aria-haspopup="dialog" disabled>
          <span class="material-field-thumb" id="materialFieldThumb" hidden><img alt=""></span>
          <span class="material-field-text" id="materialFieldText">Загрузка материалов…</span>
          <span class="material-field-chevron" aria-hidden="true">▾</span>
        </button>
      </div>

      <div class="field">
        <label>Размеры, м</label>
        <div class="dims">
          <input type="number" id="width" placeholder="Ширина" min="0" step="0.01">
          <input type="number" id="length" placeholder="Длина" min="0" step="0.01">
        </div>
        <div class="error" id="dimError">Укажите ширину и длину больше нуля</div>
      </div>

      <div class="checkboxes">
        <label class="checkbox-row"><input type="checkbox" id="opt-complex"> Сложная форма / фигурный рез</label>
        <label class="checkbox-row"><input type="checkbox" id="opt-polish"> Дополнительная полировка</label>
        <label class="checkbox-row"><input type="checkbox" id="opt-install"> Монтаж на объекте</label>
      </div>
    </div>

    <div class="result-panel">
      <div>
        <div class="result-label">Ориентировочная стоимость</div>
        <div class="result-price placeholder" id="priceOut">Выберите материал и укажите размеры, чтобы увидеть расчёт</div>
        <div class="warning-box" id="warningOut" style="display:none"></div>
        <div class="result-breakdown" id="breakdown"></div>
        <div class="remainder-line" id="remainderOut"></div>
        <div class="info-block" id="infoBlock">Стоимость указана за весь слэб — остаток после раскроя бесплатно хранится на складе компании, клиент может использовать его для другого проекта или забрать себе.</div>
      </div>
      <div>
        <button class="cta-btn" id="ctaBtn">Получить точный расчёт</button>
        <div class="disclaimer" id="updatedAtOut"></div>
        <div class="disclaimer">Расчёт ориентировочный. Финальная цена зависит от партии камня, сложности рисунка и логистики.</div>
      </div>
    </div>
  </div>
</div>

<script src="pricing.js"></script>
<script src="material-picker.js"></script>
<script src="product-types.js"></script>
<script src="/sayanmramor-site/js/site.js"></script>
<script src="/sayanmramor-site/js/category-calculator.js"></script>
<script>
  SiteCommon.loadPortfolio('pol', document.getElementById('portfolioGrid'));
  CategoryCalculator.init('pol');
</script>
</body>
</html>
```

- [ ] **Step 2: Manual browser verification**

Start the dev server and open the page:

```bash
cd D:\
python -m http.server 8000
```

Open `http://localhost:8000/sayanmramor-site/categories/poly.html` and verify:

1. The placeholder portfolio image and "Фото проекта появится позже" caption render above the calculator.
2. "Материал" shows "Загрузка материалов…" then becomes clickable and shows "Выберите камень".
3. Clicking it opens the full-screen picker with search, the three filter dropdowns (Твёрдость/Тип/Цвет), sort buttons, and the stone grid — same behavior as `http://localhost:8000/calculator/sayanmramor-calculator.html`.
4. Search for "Delicato Brown", select it — the field shows its name and thumbnail.
5. Enter width `1` and length `1` — the price panel shows a computed total (not "Нужно уточнить у менеджера"), matching what the same stone/dimensions would produce on the main calculator with product type "Полы".
6. Toggling the three option checkboxes changes the shown price and the "Опции" line in the breakdown.
7. The "Калькулятор" button in the header navigates to `/calculator/sayanmramor-calculator.html`.
8. Browser devtools Network tab shows no failed requests (particularly stone thumbnail images resolving under `/calculator/data/...`, not `/sayanmramor-site/categories/data/...`).

- [ ] **Step 3: Commit**

```bash
git add categories/poly.html
git commit -m "feat: add Полы category page (reference template for the other 8)"
```

---

### Task 6: Remaining 8 category pages

**Files:**
- Create: `D:\sayanmramor-site\categories\lestnitsy.html`
- Create: `D:\sayanmramor-site\categories\panno.html`
- Create: `D:\sayanmramor-site\categories\podokonniki.html`
- Create: `D:\sayanmramor-site\categories\steny.html`
- Create: `D:\sayanmramor-site\categories\fasady.html`
- Create: `D:\sayanmramor-site\categories\stoleshnitsy-vannaya.html`
- Create: `D:\sayanmramor-site\categories\stoleshnitsy-kuhnya.html`
- Create: `D:\sayanmramor-site\categories\stupeni.html`

**Interfaces:**
- Consumes: same as Task 5.
- Produces: the remaining 8 of the 9 category pages linked from `index.html` (Task 9).

- [ ] **Step 1: Duplicate the template for each of the 8 remaining categories**

For each row in the table below: copy `categories/poly.html` to the target filename, then apply exactly these substitutions:
- Replace `<title>Полы из камня — Саянмрамор</title>` with the row's `<title>`.
- In the nav block, remove `class="active"` from the `Полы` link and add `class="active"` to the link whose href matches the target filename.
- Replace the `<h1>` and `<p class="subtitle">` text with the row's values.
- Replace both occurrences of `'pol'` (in `SiteCommon.loadPortfolio('pol', ...)` and `CategoryCalculator.init('pol')`) with the row's product key.

| Filename | `<title>` | `<h1>` | Subtitle | Product key |
|---|---|---|---|---|
| `lestnitsy.html` | Лестницы из камня — Саянмрамор | Лестницы из камня | Мраморные и гранитные лестницы на заказ — рассчитайте ориентировочную стоимость по своим размерам. | `lestnitsa` |
| `panno.html` | Панно из камня — Саянмрамор | Панно из камня | Декоративные панно и мозаика из натурального камня — рассчитайте ориентировочную стоимость по своим размерам. | `panno` |
| `podokonniki.html` | Подоконники из камня — Саянмрамор | Подоконники из камня | Подоконники из мрамора и гранита на заказ — рассчитайте ориентировочную стоимость по своим размерам. | `podokonnik` |
| `steny.html` | Облицовка стен камнем — Саянмрамор | Облицовка стен камнем | Отделка стен натуральным камнем — рассчитайте ориентировочную стоимость по своим размерам. | `stena` |
| `fasady.html` | Облицовка фасадов камнем — Саянмрамор | Облицовка фасадов камнем | Отделка фасадов натуральным камнем — рассчитайте ориентировочную стоимость по своим размерам. | `fasad` |
| `stoleshnitsy-vannaya.html` | Столешницы в ванную — Саянмрамор | Столешницы в ванную из камня | Столешницы для ванной комнаты из мрамора и гранита — рассчитайте ориентировочную стоимость по своим размерам. | `stoleshnitsa_vannaya` |
| `stoleshnitsy-kuhnya.html` | Столешницы на кухню — Саянмрамор | Столешницы на кухню из камня | Кухонные столешницы из мрамора и гранита на заказ — рассчитайте ориентировочную стоимость по своим размерам. | `stoleshnitsa_kuhnya` |
| `stupeni.html` | Ступени из камня — Саянмрамор | Ступени из камня | Ступени из мрамора и гранита на заказ — рассчитайте ориентировочную стоимость по своим размерам. | `stupeni` |

Do not change anything else — script tags, form markup, the `<base>` tag, and the info-block/disclaimer text stay identical to `poly.html`.

- [ ] **Step 2: Manual browser verification**

With the same `python -m http.server 8000` from `D:\` running, open each of the 8 new pages and confirm: the correct nav link is highlighted `active`, the `<title>`/heading/subtitle match the table, the picker and calculator work exactly as verified for `poly.html` in Task 5, and the portfolio placeholder shows.

For `lestnitsy.html` specifically, additionally verify: after entering valid dimensions and a material, the extra warning "Точный расчёт лестницы требует уточнения количества и размера ступеней у менеджера — цена ориентировочная." appears alongside the price.

- [ ] **Step 3: Commit**

```bash
git add categories/lestnitsy.html categories/panno.html categories/podokonniki.html categories/steny.html categories/fasady.html categories/stoleshnitsy-vannaya.html categories/stoleshnitsy-kuhnya.html categories/stupeni.html
git commit -m "feat: add the remaining 8 category pages"
```

---

### Task 7: `js/catalog.js` — finished-goods catalog rendering

**Files:**
- Create: `D:\sayanmramor-site\js\catalog.js`
- Test: `D:\sayanmramor-site\tests\catalog.test.js`

**Interfaces:**
- Consumes: nothing (DOM globals only).
- Produces: global `Catalog` (browser) / `module.exports` (Node) with:
  - `formatProductPrice(priceRub)` → `string` — `"Цена по запросу"` when `priceRub` is not a finite number, otherwise a rounded ruble-formatted string.
  - `isAvailable(product)` → `boolean` — `true` unless `product.available === false`.
  - `buildProductCard(product)` → `HTMLElement` — a `.product-tile` card.
  - `renderCatalog(container, products)` — clears `container` and appends one card per product, or a `.catalog-empty` message when `products` is empty/missing.

  Task 8 calls `Catalog.renderCatalog(container, data.products)` from `katalog.html`.

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/catalog.test.js`
Expected: FAIL — `Cannot find module '../js/catalog.js'`.

- [ ] **Step 3: Write `js/catalog.js`**

```js
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Catalog = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  function formatProductPrice(priceRub) {
    if (typeof priceRub !== 'number' || !Number.isFinite(priceRub)) return 'Цена по запросу';
    return Math.round(priceRub).toLocaleString('ru-RU') + ' ₽';
  }

  function isAvailable(product) {
    return product.available !== false;
  }

  function buildProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-tile';

    const imageWrap = document.createElement('div');
    imageWrap.className = 'product-tile-image';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = product.name || '';
    img.src = (product.photos && product.photos[0]) || '';
    img.addEventListener('error', () => { imageWrap.classList.add('image-broken'); img.remove(); });
    imageWrap.appendChild(img);
    if (!isAvailable(product)) {
      const badge = document.createElement('span');
      badge.className = 'badge-oos';
      badge.textContent = 'Нет в наличии';
      imageWrap.appendChild(badge);
    }

    const name = document.createElement('div');
    name.className = 'product-tile-name';
    name.textContent = product.name;

    const price = document.createElement('div');
    price.className = 'product-tile-price';
    price.textContent = formatProductPrice(product.price_rub);

    card.appendChild(imageWrap);
    card.appendChild(name);
    card.appendChild(price);

    if (product.description) {
      const desc = document.createElement('div');
      desc.className = 'product-tile-description';
      desc.textContent = product.description;
      card.appendChild(desc);
    }

    return card;
  }

  function renderCatalog(container, products) {
    container.innerHTML = '';
    if (!products || products.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'catalog-empty';
      empty.textContent = 'Пока нет готовых изделий — загляните позже.';
      container.appendChild(empty);
      return;
    }
    products.forEach(product => container.appendChild(buildProductCard(product)));
  }

  return { formatProductPrice, isAvailable, buildProductCard, renderCatalog };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/catalog.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add js/catalog.js tests/catalog.test.js
git commit -m "feat: add Catalog module (finished-goods rendering)"
```

---

### Task 8: `data/products.json` + `katalog.html`

**Files:**
- Create: `D:\sayanmramor-site\data\products.json`
- Create: `D:\sayanmramor-site\katalog.html`

**Interfaces:**
- Consumes: `css/site.css` (Task 1), `Catalog.renderCatalog` (Task 7).
- Produces: `data/products.json`, which the user edits by hand later to add real products; `katalog.html`, linked from every page's nav (already wired in Task 5/6) and from `index.html` (Task 9).

- [ ] **Step 1: Create `data/products.json`**

Seeded with the three product categories the user already mentioned (светильники, эксклюзивные столы, ракушки), with price and description left `null` until the user has real numbers — this also exercises the "цена по запросу" path in `Catalog.formatProductPrice`.

```json
{
  "updated_at": "2026-09-16T00:00:00+03:00",
  "products": [
    {
      "id": "svetilnik-01",
      "name": "Светильник из оникса",
      "category": "svetilniki",
      "price_rub": null,
      "description": null,
      "photos": [],
      "available": true
    },
    {
      "id": "stol-01",
      "name": "Эксклюзивный стол",
      "category": "stoly",
      "price_rub": null,
      "description": null,
      "photos": [],
      "available": true
    },
    {
      "id": "rakushka-01",
      "name": "Декоративная ракушка",
      "category": "rakushki",
      "price_rub": null,
      "description": null,
      "photos": [],
      "available": true
    }
  ]
}
```

- [ ] **Step 2: Write `katalog.html`**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Готовые изделия — Саянмрамор</title>
<link rel="stylesheet" href="/sayanmramor-site/css/site.css">
</head>
<body>
<header class="site-header">
  <a class="site-logo" href="/sayanmramor-site/index.html">Саянмрамор</a>
  <nav class="site-nav">
    <a href="/sayanmramor-site/categories/lestnitsy.html">Лестницы</a>
    <a href="/sayanmramor-site/categories/panno.html">Панно</a>
    <a href="/sayanmramor-site/categories/podokonniki.html">Подоконники</a>
    <a href="/sayanmramor-site/categories/poly.html">Полы</a>
    <a href="/sayanmramor-site/categories/steny.html">Стены</a>
    <a href="/sayanmramor-site/categories/fasady.html">Фасады</a>
    <a href="/sayanmramor-site/categories/stoleshnitsy-vannaya.html">Столешницы в ванную</a>
    <a href="/sayanmramor-site/categories/stoleshnitsy-kuhnya.html">Столешницы на кухню</a>
    <a href="/sayanmramor-site/categories/stupeni.html">Ступени</a>
    <a class="active" href="/sayanmramor-site/katalog.html">Готовые изделия</a>
    <a class="calculator-link" href="/calculator/sayanmramor-calculator.html">Калькулятор</a>
  </nav>
</header>

<div class="wrap">
  <h1>Готовые изделия</h1>
  <p class="subtitle">Изделия из камня в наличии — фиксированная цена, без ожидания расчёта.</p>
</div>

<div class="catalog-grid" id="catalogGrid"></div>

<script src="/sayanmramor-site/js/catalog.js"></script>
<script>
  fetch('/sayanmramor-site/data/products.json')
    .then(r => r.json())
    .then(data => Catalog.renderCatalog(document.getElementById('catalogGrid'), data.products || []))
    .catch(() => {
      document.getElementById('catalogGrid').textContent = 'Не удалось загрузить каталог изделий.';
    });
</script>
</body>
</html>
```

- [ ] **Step 3: Manual browser verification**

With the dev server running, open `http://localhost:8000/sayanmramor-site/katalog.html` and verify: three product tiles render, each showing "Цена по запросу" (since `price_rub` is `null` in the seed data), no description line (since `description` is `null`), and no image (broken-image fallback style applies since `photos` is empty — confirm no console error, just an empty tile image area).

- [ ] **Step 4: Commit**

```bash
git add data/products.json katalog.html
git commit -m "feat: add finished-goods catalog page and seed data"
```

---

### Task 9: `index.html` — home page

**Files:**
- Create: `D:\sayanmramor-site\index.html`

**Interfaces:**
- Consumes: `css/site.css` (Task 1); links to all 9 category pages (Tasks 5–6), `katalog.html` (Task 8), and the full calculator.
- Produces: the site's entry point.

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Саянмрамор — изделия из камня на заказ</title>
<link rel="stylesheet" href="/sayanmramor-site/css/site.css">
</head>
<body>
<header class="site-header">
  <a class="site-logo" href="/sayanmramor-site/index.html">Саянмрамор</a>
  <nav class="site-nav">
    <a href="/sayanmramor-site/categories/lestnitsy.html">Лестницы</a>
    <a href="/sayanmramor-site/categories/panno.html">Панно</a>
    <a href="/sayanmramor-site/categories/podokonniki.html">Подоконники</a>
    <a href="/sayanmramor-site/categories/poly.html">Полы</a>
    <a href="/sayanmramor-site/categories/steny.html">Стены</a>
    <a href="/sayanmramor-site/categories/fasady.html">Фасады</a>
    <a href="/sayanmramor-site/categories/stoleshnitsy-vannaya.html">Столешницы в ванную</a>
    <a href="/sayanmramor-site/categories/stoleshnitsy-kuhnya.html">Столешницы на кухню</a>
    <a href="/sayanmramor-site/categories/stupeni.html">Ступени</a>
    <a href="/sayanmramor-site/katalog.html">Готовые изделия</a>
    <a class="calculator-link" href="/calculator/sayanmramor-calculator.html">Калькулятор</a>
  </nav>
</header>

<div class="wrap">
  <h1>Изделия из камня на заказ</h1>
  <p class="subtitle">Мрамор, гранит и другой натуральный камень — выберите тип изделия, чтобы посмотреть примеры работ и рассчитать стоимость.</p>
</div>

<div class="home-grid">
  <a href="/sayanmramor-site/categories/lestnitsy.html">Лестницы</a>
  <a href="/sayanmramor-site/categories/panno.html">Панно</a>
  <a href="/sayanmramor-site/categories/podokonniki.html">Подоконники</a>
  <a href="/sayanmramor-site/categories/poly.html">Полы</a>
  <a href="/sayanmramor-site/categories/steny.html">Стены</a>
  <a href="/sayanmramor-site/categories/fasady.html">Фасады</a>
  <a href="/sayanmramor-site/categories/stoleshnitsy-vannaya.html">Столешницы в ванную</a>
  <a href="/sayanmramor-site/categories/stoleshnitsy-kuhnya.html">Столешницы на кухню</a>
  <a href="/sayanmramor-site/categories/stupeni.html">Ступени</a>
  <a href="/sayanmramor-site/katalog.html">Готовые изделия</a>
</div>
</body>
</html>
```

- [ ] **Step 2: Manual browser verification**

Open `http://localhost:8000/sayanmramor-site/index.html` and verify all 10 tiles link to the correct pages.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add home page"
```

---

### Task 10: Full regression pass

**Files:** none created; verification only.

**Interfaces:** none (final task).

- [ ] **Step 1: Run this project's full test suite**

Run: `node --test tests/site.test.js tests/category-calculator.test.js tests/catalog.test.js`
Expected: all tests PASS.

- [ ] **Step 2: Confirm the calculator project is still untouched and its own tests still pass**

```bash
cd D:\calculator
node --test tests/pricing.test.js tests/material-picker.test.js
git status --short
```

Expected: 57/57 PASS; `git status --short` shows no changes (this plan must not have modified anything under `D:\calculator`).

- [ ] **Step 3: Full manual walk-through**

With `python -m http.server 8000` running from `D:\`, click through: `index.html` → each of the 9 category pages → `katalog.html` → the "Калькулятор" button → back. Confirm no broken links, no console errors, and that a price computed on `categories/poly.html` for a given stone/size matches the price the same stone/size/product-type produces on `/calculator/sayanmramor-calculator.html`.

- [ ] **Step 4: Final commit**

```bash
git add -A
git status --short
```

If this shows anything unexpected, investigate before committing; otherwise there should be nothing left to commit (every prior task already committed its own files).

---

## Self-Review Notes

- **Spec coverage:** 9 category pages with trimmed calculator (Tasks 5–6) ✓; portfolio placeholder per category (Task 3, wired in Tasks 5–6) ✓; finished-goods catalog with hand-editable JSON (Tasks 7–8) ✓; "Калькулятор" button linking to the existing full calculator (every page's header) ✓; data/logic loaded by reference, never copied (Global Constraints + every fetch/script tag uses `/calculator/...`) ✓; no stone filtering by product type (Global Constraints; the picker markup Task 2 injects has no product-type filter, matching the main calculator) ✓; local dev via a single `D:\`-rooted server (README, Task 1) ✓.
- **Placeholder scan:** no TBD/TODO markers; every step has literal file content.
- **Type consistency:** `buildPricingParams` (Task 4) is called with the exact `{ stone, widthM, lengthM, product, productTypes, optionSurchargeSum }` shape used in both its test (Task 4) and its only call site inside `init()` (same task). `CategoryCalculator.init(productKey)` signature matches its only two call sites (Tasks 5 and 6's inline `<script>`). `SiteCommon.loadPortfolio(productKey, container)` and `SiteCommon.injectMaterialPickerMarkup()` signatures match their call sites in Tasks 5/6. `Catalog.renderCatalog(container, products)` matches its call site in Task 8.
