# Единый продукт: план работ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** перевести сайт, конфигуратор и шоурум на одну дизайн-систему (`css/tokens.css`) и убрать признаки сгенерированного дизайна, не меняя фирменный стиль, структуру, фото и 3D-сцену.

**Architecture:** один файл значений `css/tokens.css` на сайте; его подключают страницы сайта, шоурум и конфигуратор (с того же хоста, как уже подключается `header.css`). Соблюдение системы держит автоматическая проверка `tests/design-tokens.test.js`: в проверенных файлах скругления, размеры шрифта, тени и длительности задаются только токенами. Каждый этап расширяет список проверенных файлов, поэтому разнобой не может вернуться.

**Tech Stack:** статический HTML/CSS/JS, `node --test`, dev-сервер `python scripts/dev_server.py` (в `.claude/launch.json` - `site-dev`, порт 8010), встроенный браузер для замеров и скриншотов.

**Spec:** `docs/superpowers/specs/2026-10-14-unified-product-design.md` (читать вместе с планом).

## Global Constraints

- Палитра, шрифты (Montserrat, Unbounded), фото, порядок блоков, 3D-сцена шоурума, логика конфигуратора, политика и реквизиты не меняются.
- Скругления: `var(--radius)` (16px), `var(--radius-pill)` (999px), `50%` только для круглых иконок-кнопок, `calc(var(--radius) - Npx)` для вложенного фото.
- Размеры шрифта: только `--fs-display`, `--fs-h1`, `--fs-h2`, `--fs-h3`, `--fs-body`, `--fs-small` (и относительные `em` внутри уже заданного размера).
- Тени: только `var(--shadow-1)`, `var(--shadow-2)` и стеклянные `var(--glass-rim)`, `var(--glass-rim-dark)`; у карточек в покое тени нет.
- Длительности переходов: `var(--dur-fast)` (150ms) и `var(--dur-move)` (250ms).
- Никакого `text-transform: uppercase` кроме логотипа (`.site-logo`, `.sr-logo` в шоуруме).
- Медь (`#b4562b`, `#9b4824`, `--sr-*`) удаляется отовсюду.
- В текстах « - » (дефис); длинное тире « — » в новых текстах запрещено.
- Тексты меняются только по таблице раздела 6 спецификации.
- Ничего не пушится: коммиты локальные, публикация на GitHub Pages только по команде владельца.
- После каждого этапа (конец задач 4, 6, 8, 9, 10) - остановка и показ владельцу.

## Review Focus

- Телефон 375px и 320px: после замены размеров и скруглений ничего не вылезает по горизонтали (проверка `scrollWidth === clientWidth`) - задачи 5-10.
- Конфигуратор открывают с сайта и напрямую: без `tokens.css` (если файл не загрузился) он не должен развалиться - токены в `header.css` остаются запасными значениями `:where(:root)` (задача 3).
- Клавиатура: фокус виден на всех кнопках, карточках-ссылках и плитках «Нам доверяют» после смены стилей (переворот по фокусу сохраняется) - задачи 6, 7.
- «Уменьшить движение» и «уменьшить прозрачность»: наклон, переворот и стекло отключаются как раньше - задачи 6, 9, 10.
- Шоурум: кадры 3D до и после совпадают, меняется только интерфейс поверх - задача 10.

## Файлы

| Файл | Что с ним |
|---|---|
| `css/tokens.css` (новый) | все значения системы |
| `scripts/design-audit.js` (новый) | замер и снимок вычисленных стилей в браузере |
| `tests/design-tokens.test.js` (новый) | проверка соблюдения токенов |
| `css/header.css`, `css/site.css`, `css/showroom.css` | перевод на токены, правки по спецификации |
| `index.html`, `katalog.html`, `privacy.html`, `showroom.html`, `categories/*.html` | подключение `tokens.css`, тексты, удаление надписей над заголовками |
| `js/site.js`, `js/catalog.js`, `js/offer-form.js`, `js/category-page.js` | «штамп»/наклон «Нам доверяют», счётчик каталога, «Вопрос 1 из 3», класс карточки камня |
| `js/masthead.js`, `js/home-hero.js`, `js/home-portal.js`, `js/home-wall.js`, `js/home-request.js` | удаляются: ни одна страница их не загружает |
| `tests/site.test.js`, `tests/showroom.test.js`, `tests/catalog.test.js`, `tests/category-page.test.js` | тесты старых решений переписываются под новые |
| конфигуратор: `sayanmramor-calculator.html`, `material-picker.js`, `tests/*.test.js` | подключение токенов, карточки, текст, вкладка |

---

### Task 1: Инструменты - замер стилей и проверка токенов

**Files:**
- Create: `scripts/design-audit.js`
- Create: `tests/design-tokens.test.js`

**Interfaces:**
- Produces: `window.DesignAudit.metrics(doc, win)` → `{ radii: {value: count}, fontSizes: number, shadowKinds: number, buttonKinds: number, glass: string[], capsLabels: string[], hairlines: number, overflowX: boolean }`; `window.DesignAudit.snapshot(doc, win)` → `{ [path]: string }`; `window.DesignAudit.diff(a, b)` → `string[]` (пути с отличиями).
- Produces: в `tests/design-tokens.test.js` массив `CHECKED` - список файлов (или срезов `[file, fromMarker, toMarker]`), которые обязаны соблюдать токены. Следующие задачи только дописывают в него элементы.

- [ ] **Step 1: Создать `scripts/design-audit.js`**

```js
// scripts/design-audit.js -- dev only. Load into a page served by scripts/dev_server.py:
//   const s = document.createElement('script'); s.src = '/sayanmramor-site/scripts/design-audit.js';
//   document.head.append(s); await new Promise(r => s.onload = r);
// metrics(): the spec's numbers for one page; snapshot()/diff(): proof that a refactor changed nothing.
(function () {
  const visible = (el, win) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && win.getComputedStyle(el).visibility !== 'hidden'; };
  const path = el => { const p = []; for (let e = el; e && e.nodeType === 1 && e !== e.ownerDocument.body; e = e.parentElement) { const i = Array.prototype.indexOf.call(e.parentElement.children, e); p.unshift(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '') + ':' + i); } return p.join('>'); };
  const PROPS = ['borderTopLeftRadius', 'borderBottomRightRadius', 'boxShadow', 'fontSize', 'fontWeight', 'letterSpacing', 'textTransform', 'color', 'backgroundColor', 'backdropFilter', 'paddingTop', 'paddingLeft', 'marginTop', 'width', 'height'];
  function metrics(doc, win) {
    const els = [...doc.body.querySelectorAll('*')].filter(e => visible(e, win));
    const radii = {}, shadows = new Set(), sizes = new Set(), glass = new Set(), caps = new Set(), buttons = new Set(); let hairlines = 0;
    for (const e of els) {
      const cs = win.getComputedStyle(e);
      const boxed = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px' || cs.boxShadow !== 'none';
      if (boxed && cs.borderTopLeftRadius !== '0px') radii[cs.borderTopLeftRadius] = (radii[cs.borderTopLeftRadius] || 0) + 1;
      if (cs.boxShadow !== 'none') shadows.add(cs.boxShadow);
      if (cs.backdropFilter && cs.backdropFilter !== 'none') glass.add(String(e.className).split(' ')[0]);
      const text = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
      if (text) { sizes.add(cs.fontSize); if (cs.textTransform === 'uppercase' && !e.closest('.site-logo')) caps.add(text.slice(0, 30)); }
      if (cs.borderTopWidth === '1px' || cs.borderBottomWidth === '1px') hairlines++;
      if (e.matches('a.btn, button.btn, .btn')) buttons.add([cs.borderTopLeftRadius, cs.height, cs.backgroundColor, cs.borderTopColor].join('/'));
    }
    return { radii, fontSizes: sizes.size, shadowKinds: shadows.size, buttonKinds: buttons.size, glass: [...glass], capsLabels: [...caps], hairlines, overflowX: doc.documentElement.scrollWidth > doc.documentElement.clientWidth };
  }
  function snapshot(doc, win) {
    const out = {};
    for (const e of doc.body.querySelectorAll('*')) { if (!visible(e, win)) continue; const cs = win.getComputedStyle(e); out[path(e)] = PROPS.map(p => cs[p]).join('|'); }
    return out;
  }
  function diff(a, b) { const keys = new Set([...Object.keys(a), ...Object.keys(b)]); return [...keys].filter(k => a[k] !== b[k]); }
  window.DesignAudit = { metrics, snapshot, diff };
})();
```

- [ ] **Step 2: Создать `tests/design-tokens.test.js`** (сначала проверяет только `css/tokens.css`, которого ещё нет)

```js
// tests/design-tokens.test.js
//
// One design system (docs/superpowers/specs/2026-10-14-unified-product-design.md): every
// file in CHECKED sets radii, font sizes, shadows and transition times only through the
// tokens of css/tokens.css. Each stage of the plan adds its files here, so the old
// assortment (9 radii, 21 sizes, 10 shadows on the home page) cannot creep back.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const site = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(site, p), 'utf8');
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

// A file, or [file, fromMarker, toMarker] -- the part of the file between two comments.
const CHECKED = [
  'css/tokens.css',
];

function source(entry) {
  if (typeof entry === 'string') return strip(read(entry));
  const [file, from, to] = entry; const css = read(file);
  const a = css.indexOf(from), b = to ? css.indexOf(to, a) : css.length;
  assert.ok(a >= 0 && b > a, file + ': ' + from);
  return strip(css.slice(a, b));
}
function declarations(css) {
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim().replace(/^@[^{]*$/m, '').trim();
    m[2].split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) out.push({ sel, prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() }); });
  }
  return out;
}
const parts = v => v.split(/\s+(?![^(]*\))/);
const RADIUS = /^(var\(--radius\)|var\(--radius-pill\)|50%|0|inherit|calc\(var\(--radius\) - [\w.()-]+\))$/;
const FONT = /^(var\(--fs-(display|h1|h2|h3|body|small)\)|inherit|[\d.]+em)$/;
const SHADOW = /^var\(--(shadow-1|shadow-2|glass-rim|glass-rim-dark)\)$/;

CHECKED.forEach(entry => {
  const name = typeof entry === 'string' ? entry : entry.slice(0, 2).join(' @ ');
  test('tokens only: ' + name, () => {
    const css = source(entry);
    const tokensFile = entry === 'css/tokens.css';
    declarations(css).forEach(({ sel, prop, value }) => {
      const where = name + ' ' + sel + ' { ' + prop + ': ' + value + ' }';
      if (prop.startsWith('--')) return;                       // token definitions
      if (/^border(-(top|bottom)-(left|right))?-radius$/.test(prop)) parts(value).forEach(p => assert.match(p, RADIUS, where));
      if (prop === 'font-size') assert.match(value, FONT, where);
      if (prop === 'font') assert.doesNotMatch(value, /\d+px/, where);
      if (prop === 'box-shadow' && value !== 'none') value.split(/,(?![^(]*\))/).forEach(p => assert.match(p.trim(), SHADOW, where));
      if (prop === 'transition' || prop === 'transition-duration') assert.doesNotMatch(value.replace(/var\([^)]*\)/g, ''), /\d(ms|s)\b/, where);
      if (prop === 'text-transform') assert.ok(value !== 'uppercase' || /\.(site|sr)-logo/.test(sel), where);   // the wordmark only
    });
    if (!tokensFile) assert.doesNotMatch(css, /#b4562b|#9b4824|--sr-/i, name + ': no copper');
  });
});

test('css/tokens.css holds the system the spec names', () => {
  const css = read('css/tokens.css');
  [
    /--radius: 16px;/, /--radius-pill: 999px;/,
    /--fs-display: clamp\(36px, 4\.4vw, 56px\);/, /--fs-h1: clamp\(32px, 3\.4vw, 46px\);/, /--fs-h2: clamp\(24px, 2\.2vw, 30px\);/,
    /--fs-h3: 19px;/, /--fs-body: 16px;/, /--fs-small: 14px;/,
    /--shadow-1: [^;]+;/, /--shadow-2: [^;]+;/, /--dur-fast: 150ms;/, /--dur-move: 250ms;/,
    /--accent: #2a5446;/, /--graphite: #1e2320;/, /--graphite-2: #262c28;/,
  ].forEach(re => assert.match(css, re));
  assert.doesNotMatch(css, /--radius-s|--radius-m|--fs-meta|--sr-/);
});
```

- [ ] **Step 3: Запустить и убедиться, что падает**

Run: `node --test tests/design-tokens.test.js`
Expected: FAIL - `ENOENT ... css/tokens.css`.

- [ ] **Step 4: Коммит инструментов** (тест пока красный; зелёным его делает задача 2, коммитятся вместе в задаче 2 - здесь только `scripts/design-audit.js`)

```bash
git add scripts/design-audit.js
git commit -m "chore: design audit -- the spec's numbers and a style snapshot for a page"
```

---

### Task 2: `css/tokens.css` и снимок «до»

**Files:**
- Create: `css/tokens.css`
- Test: `tests/design-tokens.test.js` (из задачи 1)

**Interfaces:**
- Produces: токены из Global Constraints плюс все цвета, шрифты, отступы, высоты контролов, `--measure`, `--gutter`, `--ease`, `--arrow`, `--glass-*` - с теми же именами, что сейчас в `site.css :root`.

- [ ] **Step 1: Снять «до» для всех страниц (для задачи 3)**

Запустить `site-dev` (preview_start `site-dev`), открыть каждую из страниц `index.html`, `katalog.html`, `privacy.html`, `categories/lestnitsy.html`, `categories/spa-zony.html`, `/sayanmramor-calculator/sayanmramor-calculator.html` в окне 1440×900 и 375×812, загрузить `scripts/design-audit.js` (как в его шапке) и выполнить:

```js
localStorage.setItem('snap:' + location.pathname + ':' + innerWidth, JSON.stringify(DesignAudit.snapshot(document, window)));
JSON.stringify(DesignAudit.metrics(document, window))
```

Записать метрики в рабочие заметки (таблица «до» уже в спецификации, сверить).

- [ ] **Step 2: Создать `css/tokens.css`**

Перенести блок `:root { ... }` из `css/site.css` (строки 23-91 на момент плана, от `--page` до `--glass-shine-dark`) и `--arrow` из `css/header.css` в новый файл со следующими изменениями: убрать `--radius-s`, `--radius-m`, `--fs-meta`, все `--sr-*`; добавить новые токены. Итог:

```css
/* css/tokens.css -- the one design system of the site, the configurator and the showroom
   (docs/superpowers/specs/2026-10-14-unified-product-design.md). Values live only here;
   css/header.css, css/site.css, css/showroom.css and the configurator read them. */
:root {
  /* colours: unchanged from the site's palette */
  --page: #efede8; --surface: #f8f7f4; --surface-sunk: #e4e1d9; --stone: #e6e1d8;
  --ink: #1c1d1b; --ink-soft: #474944; --muted: #63645b;
  --line: #dcd8cf; --line-strong: #b6b0a4; --line-control: #7e7d73;
  --graphite: #1e2320; --graphite-2: #262c28;
  --on-dark: #e9e7e1; --on-dark-muted: #a3a89f; --on-dark-line: rgba(233, 231, 225, 0.18);
  --accent: #2a5446; --accent-hover: #1f4036; --accent-on-dark: #7fa698; --link: #2a5446;

  --font: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --font-display: 'Unbounded', 'Montserrat', Arial, sans-serif;
  --font-brand: var(--font-display);
  /* six sizes, far apart */
  --fs-display: clamp(36px, 4.4vw, 56px);
  --fs-h1: clamp(32px, 3.4vw, 46px);
  --fs-h2: clamp(24px, 2.2vw, 30px);
  --fs-h3: 19px;
  --fs-body: 16px;
  --fs-small: 14px;

  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 72px;
  --section: clamp(64px, 8vw, 96px);
  --control-h-s: 44px; --control-h: 48px; --control-h-l: 56px;
  --measure: 1280px; --gutter: 24px;

  /* two radii: every surface, and everything you press */
  --radius: 16px;
  --radius-pill: 999px;

  /* two shadows: lying over the content, and lifted or open over the page */
  --shadow-1: 0 1px 2px rgba(28, 29, 27, 0.08), 0 10px 24px -14px rgba(28, 29, 27, 0.35);
  --shadow-2: 0 2px 6px rgba(28, 29, 27, 0.10), 0 28px 56px -24px rgba(28, 29, 27, 0.45);

  /* one curve, two times */
  --ease: cubic-bezier(0.22, 0.68, 0.24, 1);
  --dur-fast: 150ms;
  --dur-move: 250ms;

  --arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 10' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='square'%3E%3Cpath d='M1 5h12.5M10 1.5L13.5 5 10 8.5'/%3E%3C/svg%3E");

  /* glass: light over photographs, dark over the dark and the 3D */
  --glass-frost: blur(12px) saturate(1.7);
  --glass-bend: url(#lg-bend) var(--glass-frost);
  --glass-rim: inset 0 1px 0 rgba(255, 255, 255, 0.75), inset 0 -1px 1px rgba(255, 255, 255, 0.18), inset 0 0 0 1px rgba(255, 255, 255, 0.22);
  --glass-rim-dark: inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 -1px 1px rgba(255, 255, 255, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  --glass-shine: linear-gradient(rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0) 50%);
  --glass-shine-dark: linear-gradient(rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0) 50%);
}
@media (max-width: 600px) { :root { --gutter: 16px; } }
```

Перед этим сверить с `css/site.css :root` и его адаптивными переопределениями (`grep -n ":root {" css/site.css`): всё, что там переопределяется (например `--gutter`, `--fs-h3` на телефоне), перенести в такие же `@media` в `tokens.css`.

- [ ] **Step 3: Запустить проверку**

Run: `node --test tests/design-tokens.test.js`
Expected: PASS (2 теста).

- [ ] **Step 4: Коммит**

```bash
git add css/tokens.css tests/design-tokens.test.js
git commit -m "feat: css/tokens.css -- the one design system, and its check"
```

---

### Task 3: Подключение `tokens.css` везде, без видимых изменений

**Files:**
- Modify: все 17 страниц сайта (`index.html`, `katalog.html`, `privacy.html`, `showroom.html`, `categories/*.html`) - `<link rel="stylesheet" href="/sayanmramor-site/css/tokens.css">` первой таблицей стилей.
- Modify: `css/site.css` - удалить `:root { ... }` с перенесёнными токенами (оставить только то, чего нет в `tokens.css`: `--sticky-top`/`--fixed-bottom` и локальные переменные блоков).
- Modify: `css/header.css` - блок `:where(:root)` оставить как запасные значения для страницы без `tokens.css`, но привести к тем же именам: убрать `--radius-s`, `--fs-meta`, добавить `--radius-pill: 999px; --radius: 16px; --dur-fast: 150ms; --dur-move: 250ms; --shadow-1: ...` (то же значение, что в `tokens.css`).
- Test: `tests/site.test.js` (новый тест подключения)

**Interfaces:**
- Consumes: `css/tokens.css` (задача 2).

- [ ] **Step 1: Тест подключения (падает)** - дописать в конец `tests/site.test.js`:

```js
test('one design system: every page loads css/tokens.css first, before any other stylesheet', () => {
  const pages = ['index.html', 'katalog.html', 'privacy.html', 'showroom.html', ...fs.readdirSync(path.join(site, 'categories')).filter(f => f.endsWith('.html')).map(f => 'categories/' + f)];
  pages.forEach(p => {
    const sheets = [...fs.readFileSync(path.join(site, p), 'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => m[1]);
    assert.equal(sheets[0], '/sayanmramor-site/css/tokens.css', p);
  });
  assert.doesNotMatch(fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8'), /^\s*--accent: #2a5446;/m, 'the values live in tokens.css only');
});
```

Run: `node --test tests/site.test.js` - Expected: FAIL на `index.html`.

- [ ] **Step 2: Подключить** - скриптом вставить строку перед первой `<link rel="stylesheet"` в каждой странице (на `index.html` это перед leaflet.css):

```bash
python - <<'EOF'
import glob,re
tag='<link rel="stylesheet" href="/sayanmramor-site/css/tokens.css">\n'
for f in ['index.html','katalog.html','privacy.html','showroom.html']+glob.glob('categories/*.html'):
    s=open(f,encoding='utf-8',newline='').read(); assert 'tokens.css' not in s
    i=s.index('<link rel="stylesheet"'); open(f,'w',encoding='utf-8',newline='').write(s[:i]+tag+s[i:])
EOF
```

- [ ] **Step 3: Удалить перенесённые токены из `css/site.css :root`** и привести `header.css :where(:root)` как описано в Files.

- [ ] **Step 4: Тесты** - `node --test tests/*.test.js`. Expected: всё зелёное. Тесты, проверявшие значения в `site.css :root` (`grep -n "radius-s\|fs-meta\|:root {" tests/site.test.js`), перевести на чтение `css/tokens.css`.

- [ ] **Step 5: Снимок «после» = «до»** - на тех же страницах и ширинах, что в задаче 2:

```js
const before = JSON.parse(localStorage.getItem('snap:' + location.pathname + ':' + innerWidth));
DesignAudit.diff(before, DesignAudit.snapshot(document, window))
```

Expected: `[]` на каждой странице. Любое отличие - вернуть значение, а не принимать.

- [ ] **Step 6: Коммит**

```bash
git add -A css index.html katalog.html privacy.html showroom.html categories tests
git commit -m "refactor: every page reads css/tokens.css; site.css keeps no copies of the values"
```

---

### Task 4: Мёртвый код и шапка с подвалом на токенах (конец этапа 1)

**Files:**
- Delete: `js/masthead.js`, `js/home-hero.js`, `js/home-portal.js`, `js/home-wall.js`, `js/home-request.js` (ни одна страница их не грузит: `grep -h 'src="/sayanmramor-site/js' *.html categories/*.html`).
- Modify: `css/site.css` - удалить правила, все селекторы которых ссылаются только на классы, которых нет ни в HTML, ни в загружаемых JS (разделы «Masthead» 719-899 целиком; в «Home» 899-1471 и «Home: the desktop grid» 1549-1655 - правила для `hero-*`, `drawing-*`, `mast-*`, `wall*`, `ready-*` и пр.).
- Modify: `tests/site.test.js`, `tests/showroom.test.js` - удалить тесты удалённых файлов и разделов.
- Modify: `css/header.css` - перевод на токены; добавить в `CHECKED`.
- Modify: `css/site.css` разделы «Footer» и общие кнопки (`.btn*`) - на токены; добавить в `CHECKED`.

**Interfaces:**
- Produces: кнопки `.btn.btn-primary|btn-secondary|btn-on-dark` с `border-radius: var(--radius-pill)` - их используют задачи 6-10.

- [ ] **Step 1: Список мёртвых классов** - выполнить и сохранить вывод в заметки:

```bash
python - <<'EOF'
import re,glob
css=re.sub(r'/\*[\s\S]*?\*/','',open('css/site.css',encoding='utf-8').read())
html=''.join(open(f,encoding='utf-8').read() for f in glob.glob('*.html')+glob.glob('categories/*.html'))
loaded=['js/site.js','js/header.js','js/offer-form.js','js/category-page.js','js/catalog.js','js/contacts-map.js','js/price-filter.js']+glob.glob('js/showroom/*.js')
js=''.join(open(f,encoding='utf-8').read() for f in loaded)
classes=set(re.findall(r'\.([a-zA-Z][\w-]*)',css))
dead=sorted(c for c in classes if not re.search(r'[\s"\']'+re.escape(c)+r'[\s"\']',html) and c not in js)
print(len(dead)); print(' '.join(dead))
EOF
```

- [ ] **Step 2: Удалить правила, у которых в каждом селекторе есть мёртвый класс** (правило с хотя бы одним живым селектором - оставить, удалив из списка только мёртвые селекторы). Удалить 5 файлов JS. Удалить из тестов проверки этих файлов и разделов (`grep -n "masthead\|home-hero\|home-portal\|home-wall\|home-request\|'/\* ---- Masthead" tests/*.js`).

- [ ] **Step 3: Снимок «после» = «до»** на всех страницах (как в задаче 3, шаг 5). Expected: `[]`.

- [ ] **Step 4: Шапка и подвал на токенах.** В `css/header.css` и разделе «Footer» `site.css`, а также в правилах `.btn`:
  - скругления: `999px`, `var(--radius-s)`, `calc(var(--pill-h) / 2)` у кнопок и капсул → `var(--radius-pill)`; `16px`, `24px`, `28px` у панелей меню и капсулы на телефоне → `var(--radius)`; `1px`/`0` у линий иконки «бургер» → `0`;
  - размеры шрифта по таблице: `11px, 12px, 12.5px, 13px, 14px, var(--fs-meta)` → `var(--fs-small)`; `15px, 16px` → `var(--fs-body)`; `17px, 18px, 19px, 20px` → `var(--fs-h3)` если это название/заголовок, иначе `var(--fs-body)`;
  - тени: капсула шапки, открытые панели меню → `var(--glass-rim), var(--shadow-1)` (стекло) или `var(--shadow-1)`; остальное → `none`;
  - переходы: `0.15s`, `0.18s` → `var(--dur-fast)`; `0.2s`-`0.35s` → `var(--dur-move)`;
  - `text-transform: uppercase` в подвале (`site.css` ~2476, заголовки колонок) → убрать, оставить `font-weight: 600`.

Добавить в `CHECKED`: `'css/header.css'`, `['css/site.css', '/* ---- Footer', '/* ---- Политика']`.

- [ ] **Step 5: Тесты** - `node --test tests/*.test.js`, всё зелёное.

- [ ] **Step 6: Проверка в браузере** - главная и `lestnitsy.html` на 1440 и 375: шапка, открытое меню, подвал; `DesignAudit.metrics` - `overflowX: false`; кнопки шапки - капсулы как были.

- [ ] **Step 7: Коммит и остановка**

```bash
git add -A css js tests
git commit -m "refactor: drop the unused home page drafts; the header, footer and buttons on the tokens"
```

**СТОП: этап 1 готов.** Показать владельцу: снимки «до = после» (задачи 3-4), список удалённого мёртвого кода, шапку и подвал. Ждать «да» перед задачей 5.

---

### Task 5: Общая карточка и заголовок раздела

**Files:**
- Modify: `css/site.css` - новый раздел сразу после «Tokens»-подключения: `/* ---- Components: section head, card ---- */`.
- Test: `tests/design-tokens.test.js` (добавить раздел в `CHECKED`), `tests/site.test.js` (новый тест).

**Interfaces:**
- Produces: классы `.section-head` (H2 + `.section-lead`), `.card`, `.card-dark`, `.card-title`, `.card-link` (карточка-ссылка) - их используют задачи 6-8.

- [ ] **Step 1: Тест (падает)** - в `tests/site.test.js`:

```js
test('components: one section head, one card -- tone on the ground, no shadow; a card-link turns its title verde and shows the arrow, never moves', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  const block = css.slice(css.indexOf('/* ---- Components'), css.indexOf('/* end of components */'));
  assert.match(block, /\.card \{[^}]*background: var\(--surface\);[^}]*border-radius: var\(--radius\);[^}]*padding: var\(--s-5\);/);
  assert.match(block, /\.card-dark \{[^}]*background: var\(--graphite-2\);[^}]*color: var\(--on-dark\);/);
  assert.doesNotMatch(block, /box-shadow: (?!none)|transform/);
  assert.match(block, /a\.card-link:hover \.card-title, a\.card-link:focus-visible \.card-title \{ color: var\(--accent\); \}/);
  assert.match(block, /\.section-head h2 \{[^}]*font-size: var\(--fs-h1\);/);
  assert.match(block, /\.section-lead \{[^}]*max-width: 40em;/);
});
```

- [ ] **Step 2: Реализация** - в `css/site.css`:

```css
/* ---- Components: section head, card ----------------------------------------
   The spec's one section head (a heading on the left, at most one sentence under it, no
   label above) and one card (paper on limestone, no shadow). */
.section-head { display: grid; gap: var(--s-3); margin-bottom: var(--s-6); }
.section-head h2 { margin: 0; font-family: var(--font-display); font-size: var(--fs-h1); font-weight: 600; line-height: 1.1; letter-spacing: -0.015em; }
.section-lead { max-width: 40em; margin: 0; font-size: var(--fs-body); line-height: 1.55; color: var(--ink-soft); }
.card { display: flex; flex-direction: column; gap: var(--s-3); background: var(--surface); border-radius: var(--radius); padding: var(--s-5); color: var(--ink); text-decoration: none; }
.card-dark { background: var(--graphite-2); color: var(--on-dark); }
.card-dark .card-text { color: var(--on-dark-muted); }
.card-photo { display: block; overflow: hidden; border-radius: calc(var(--radius) - var(--s-3)); }
.card-title { margin: 0; font-size: var(--fs-h3); font-weight: 600; line-height: 1.25; transition: color var(--dur-fast) var(--ease); }
.card-text { margin: 0; font-size: var(--fs-small); line-height: 1.5; color: var(--muted); }
a.card-link .card-title::after { content: ''; display: inline-block; width: 14px; height: 9px; margin-left: var(--s-2); background: currentColor; opacity: 0; transition: opacity var(--dur-fast) var(--ease); -webkit-mask: var(--arrow) center / contain no-repeat; mask: var(--arrow) center / contain no-repeat; }
@media (hover: hover) { a.card-link:hover .card-title, a.card-link:focus-visible .card-title { color: var(--accent); } a.card-link:hover .card-title::after { opacity: 1; } }
a.card-link:hover .card-title, a.card-link:focus-visible .card-title { color: var(--accent); }
a.card-link:focus-visible .card-title::after { opacity: 1; }
/* end of components */
```

Добавить в `CHECKED`: `['css/site.css', '/* ---- Components', '/* end of components */']`.

- [ ] **Step 3: Тесты** - `node --test tests/site.test.js tests/design-tokens.test.js` - PASS.

- [ ] **Step 4: Коммит**

```bash
git add css/site.css tests
git commit -m "feat: one section head and one card for the whole site"
```

---

### Task 6: Главная (этап 2)

**Files:**
- Modify: `index.html`, `css/site.css` (разделы главной: «Home (static)» 147-689, «Home palette», «Home: where we are», «Home: the desktop grid»), `js/site.js` (`mountTrustMotion`), `js/offer-form.js:328` («Вопрос»), все страницы и конфигуратор (меню «Пространство» → «Интерьер»).
- Test: `tests/site.test.js`, `tests/design-tokens.test.js`.

**Interfaces:**
- Consumes: `.section-head`, `.section-lead`, `.card`, `.card-dark`, `.card-title`, `.card-text` (задача 5); `.btn*` (задача 4).

- [ ] **Step 1: Тесты новых решений (падают)** - в `tests/site.test.js`:

```js
test('home, one product (2026-10-14): no label above a heading, no 01-04, no stamp or lean on «Нам доверяют», the agreed words', () => {
  const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /class="[^"]*-kicker"/, 'no label above any heading');
  assert.doesNotMatch(html, /home-why-num/);
  assert.match(html, /<h2 id="whyTitle">Почему выбирают нас<\/h2>/);
  assert.doesNotMatch(html, /Что вы получаете, заказывая изделие/);
  assert.match(html, /Выберите направление: покажем наши работы, подберём камень и посчитаем стоимость\./);
  assert.match(html, /<h3 class="home-group-title">Интерьер<\/h3>/);
  assert.doesNotMatch(html, /Пространство/);
  assert.match(html, /Расскажите, что хотите сделать, и оставьте телефон\. Мастер свяжется с вами и подготовит расчёт\./);
  assert.doesNotMatch(html, /Открыть 3D-шоурум/);
  const js = fs.readFileSync(path.join(site, 'js', 'site.js'), 'utf8');
  const trust = js.slice(js.indexOf('function mountTrustMotion'), js.indexOf('mountTrustMotion(document, window)'));
  assert.doesNotMatch(trust, /IntersectionObserver|--rx|--ry|pointermove/, 'the flip stays; the stamp and the lean go');
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.doesNotMatch(css, /trust-stamp|trust-lay|\.trust-tilt/);
  assert.match(css, /\.trust-motion \.trust-pass:focus-visible \.trust-flip \{ transform: rotateY\(180deg\); \}/);
  assert.doesNotMatch(css, /\.home-s2o-card:hover|\.home-showroom-house:hover \{ transform/);
});
```

Run: `node --test tests/site.test.js` - FAIL.

- [ ] **Step 2: Разметка `index.html`**
  - удалить `<p class="home-order-kicker">`, `<p class="home-about-kicker">`, `<p class="home-why-kicker">`, `<p class="home-trust-kicker">`, `<p class="offer-kicker">` на главной;
  - удалить `<span class="home-why-num" aria-hidden="true">NN</span>` (4 шт.);
  - пункты «Почему выбирают нас»: `<li class="home-why-item">` → `<li class="home-why-item card card-dark">`, заголовок пункта - класс `card-title`, текст - `card-text`; иконку оставить внутри заголовка слева;
  - плитки «Нам доверяют»: добавить `card` к `.home-trust-item`;
  - тексты: `<h2 id="whyTitle">Почему выбирают <em>нас</em>?</h2>` → `<h2 id="whyTitle">Почему выбирают нас</h2>` (курсив одного слова - признак шаблона, «пробел перед ?» был от него); удалить `<p class="home-why-lead">`; подводка «Что можно заказать» и «Получить расчёт» - по спецификации; `Открыть 3D-шоурум` → `Открыть шоурум`; группа и меню «Пространство» → «Интерьер».

- [ ] **Step 3: Меню «Интерьер» везде** - тот же текст в меню на всех страницах и в конфигураторе:

```bash
python - <<'EOF'
import glob
fs=['index.html','katalog.html','privacy.html','showroom.html']+glob.glob('categories/*.html')
for f in fs:
    s=open(f,encoding='utf-8',newline='').read()
    open(f,'w',encoding='utf-8',newline='').write(s.replace('<p class="nav-group-title">Пространство</p>','<p class="nav-group-title">Интерьер</p>'))
EOF
grep -rn "Пространство" *.html categories/*.html js/ | grep -v "^docs"
```

Expected: пусто. В конфигураторе - то же в задаче 9.

- [ ] **Step 4: `js/site.js` `mountTrustMotion`** - удалить наблюдатель появления (`IntersectionObserver`, классы `is-in`), слой `trust-tilt` и обработчики `pointermove`/`pointerleave`; переворот (`trust-flip`, лицевая и оборотная стороны, блик) оставить. `js/offer-form.js:328` - текст счётчика оставить «Вопрос N из 3», а в CSS `.talk-count` убрать `text-transform: uppercase` и `letter-spacing`.

- [ ] **Step 5: CSS главной на токены и по спецификации** - в разделах главной `css/site.css`:
  - удалить правила `*-kicker` и `.home-why-num`; заголовки разделов: `font-size` → `var(--fs-h1)`, подводки - `.section-lead`-значения (`var(--fs-body)`);
  - скругления: панель «Что можно заказать» `20px` → `var(--radius)`; карточки и фото `10/12/14/16/17/20/22/23/24px`, `var(--radius-m)`, `var(--s2o-radius)` → `var(--radius)` (вложенное фото - `calc(var(--radius) - <отступ>)`); чипы и стрелки на фото, кнопки → `var(--radius-pill)`; `2px/3px` у тонких индикаторов → `var(--radius-pill)`;
  - тени: стекло на фото → `var(--glass-rim), var(--shadow-1)` (светлое) / `var(--glass-rim-dark), var(--shadow-1)` (тёмное); карточки, рамки фото, `inset 0 0 0 1px` рамки → `none`;
  - удалить из раздела «Works in frames» подъём `.home-showroom-house:hover`; в «От камня к изделию» - `:hover` с `transform`;
  - вход в шоурум: `--sr-*` → `--graphite`, `--on-dark`, `--accent`;
  - «Нам доверяют»: удалить `trust-lay`, `trust-stamp`, `.trust-tilt` и `.trust-motion:not(.is-in)`; блик и переворот оставить; `.home-trust-mcx-name` - без `uppercase`, `font-size: var(--fs-small)`;
  - наклон: в «What can be ordered in motion» `transition: transform 0.2s ease-out` → `transform var(--dur-move) var(--ease)`, `opacity 0.3s` → `opacity var(--dur-move)`;
  - размеры шрифта по таблице задачи 4; цифры «О компании» (`clamp(36px, 4.6vw, 64px)`) → `var(--fs-display)`; заголовок первого экрана → `var(--fs-display)`;
  - переходы: как в задаче 4.

Добавить в `CHECKED`: `['css/site.css', '/* ---- Home (static)', '/* ---- Category page: examples']` (после удаления мёртвого кода в задаче 4 это все разделы главной).

- [ ] **Step 6: Переписать тесты старых решений** - `node --test tests/*.test.js`; каждый упавший тест, закреплявший старое (надписи `*-kicker`, `home-why-num`, «штамп», `--sr-*` на входе в шоурум, «Открыть 3D-шоурум», «Пространство», `font-size: var(--fs-meta)`, подъём при наведении), переписать на новое решение с комментарием `(2026-10-14, единый продукт: ...)`. Не удалять тест целиком, если он проверяет что-то ещё.

- [ ] **Step 7: Тесты** - `node --test tests/*.test.js` - всё зелёное.

- [ ] **Step 8: Браузер** - главная на 1440, 1024, 768, 390, 375, 320:
  - `DesignAudit.metrics` на 1440: скруглений ≤ 2 (+`50%`), `fontSizes` ≤ 6, `shadowKinds` ≤ 2 (стекло с тенью считается одним видом), `buttonKinds` ≤ 3, `capsLabels` = `[]`, `overflowX` = false на всех ширинах;
  - наведение на группу «Что можно заказать» - наклон работает; на плитку «Нам доверяют» - переворот; Tab до плитки - переворот по фокусу; карточки «От камня к изделию» и картинка шоурума не двигаются;
  - эмуляция `prefers-reduced-motion` (через `matchMedia` в коде нельзя - проверить, что правила наклона и переворота стоят внутри `@media (prefers-reduced-motion: no-preference)`/`reduce` как сейчас);
  - консоль без ошибок; скриншоты 1440 и 375 «до/после».

- [ ] **Step 9: Коммит и остановка**

```bash
git add -A index.html katalog.html privacy.html showroom.html categories css js tests
git commit -m "feat(home): one product -- tokens, one section head and card, no labels above headings, the agreed words"
```

**СТОП: этап 2.** Показать владельцу скриншоты главной до/после (1440 и 375) и метрики. Ждать «да».

---

### Task 7: Страницы направлений, форма, просмотр фото

**Files:**
- Modify: `css/site.css` разделы «Category page: examples», «The viewer», «Works in frames», «Category page: stone gallery», «Коммерческое предложение», «Получить расчёт на главной», «Liquid glass», «Responsive»; `categories/*.html` (подводка формы); `js/category-page.js` (класс карточки камня).
- Test: `tests/site.test.js`, `tests/category-page.test.js`, `tests/design-tokens.test.js`.

**Interfaces:**
- Consumes: `.card`, `.card-photo`, `.card-title`, `.card-text`, `.card-link` (задача 5).

- [ ] **Step 1: Тест (падает)** - в `tests/site.test.js`:

```js
test('direction pages, one product (2026-10-14): the agreed words, no label above the request, no lift on the works', () => {
  fs.readdirSync(path.join(site, 'categories')).filter(f => f.endsWith('.html')).forEach(f => {
    const html = fs.readFileSync(path.join(site, 'categories', f), 'utf8');
    assert.match(html, /<p class="offer-lead">Оставьте имя и телефон\. Мастер свяжется с вами и подготовит расчёт\.<\/p>/, f);
    assert.doesNotMatch(html, /offer-kicker|Мастер задаст/, f);
  });
  const css = fs.readFileSync(path.join(site, 'css', 'site.css'), 'utf8');
  assert.doesNotMatch(css, /\.portfolio-item:hover \.portfolio-shot \{\s*transform/);
});
```

И в `tests/category-page.test.js` - тест, что карточка камня получает классы `card card-link` (найти функцию отрисовки карточки: `grep -n "createElement('a')\|className = 'stone" js/category-page.js`; проверка - по `className` созданного элемента в существующем стиле тестов этого файла).

Run: `node --test tests/site.test.js tests/category-page.test.js` - FAIL.

- [ ] **Step 2: Разметка** - во всех `categories/*.html` удалить `<p class="offer-kicker">…</p>`, заменить подводку формы на утверждённую; в `js/category-page.js` карточке камня добавить `card card-link`, фото - `card-photo`, названию - `card-title`, типу/цене - `card-text`.

- [ ] **Step 3: CSS на токены** - в перечисленных разделах по тем же таблицам, что в задачах 4 и 6:
  - `.portfolio-shot`: 4-слойная тень → `none`, рамка `inset` → `none`, скругление `20px` → `var(--radius)`; удалить `:hover` с `transform` и `img { transform: scale }`;
  - нижняя панель `.configure-bar` - стекло: `var(--glass-rim-dark), var(--shadow-1)`, капсула `var(--radius-pill)`;
  - фильтры, чипы, «Показать ещё», переключатели цены - один вид кнопки (`.btn-secondary`) и один вид чипа: `height: var(--control-h-s); border-radius: var(--radius-pill); border: 1px solid var(--line-control); font-size: var(--fs-small)`; выбранный - `background: var(--accent); color: #fff; border-color: var(--accent)`;
  - просмотр фото: окно `var(--radius)`, кнопки `50%`, тень `var(--shadow-2)`;
  - форма: поля `var(--radius-pill)` для однострочных, `var(--radius)` для многострочных; `.talk-count` без капса.

Добавить в `CHECKED`: `['css/site.css', '/* ---- Category page: examples', '/* ---- Готовые изделия']`, `['css/site.css', '/* ---- Category page: stone gallery', '/* ---- Footer']`, `['css/site.css', '/* ---- Liquid glass', null]`.

- [ ] **Step 4: Тесты** - `node --test tests/*.test.js`, переписать тесты старых решений, как в задаче 6 шаг 6.

- [ ] **Step 5: Браузер** - `lestnitsy.html`, `spa-zony.html` (без конфигуратора) на 1440 / 768 / 375 / 320: метрики как в задаче 6 шаг 8; открыть просмотр фото; отфильтровать камень и нажать «Показать ещё»; форма: пройти до телефона; нижняя панель не перекрывает форму.

- [ ] **Step 6: Коммит**

```bash
git add -A categories css js tests
git commit -m "feat(directions): one product -- tokens, one chip and card, no lift on the works, the agreed words"
```

---

### Task 8: «Готовые изделия» и политика (конец этапа 3)

**Files:**
- Modify: `katalog.html`, `js/catalog.js:37`, `css/site.css` разделы «Готовые изделия», «Политика конфиденциальности».
- Test: `tests/catalog.test.js`, `tests/design-tokens.test.js`.

- [ ] **Step 1: Тест (падает)** - в `tests/catalog.test.js` (в стиле файла; функцию счётчика найти: `grep -n "two(" js/catalog.js`):

```js
test('the counter reads «1 из 8» (2026-10-14, one product: no 01 / 08)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'catalog.js'), 'utf8');
  assert.match(src, /\(i \+ 1\) \+ ' из ' \+ n/);
  assert.doesNotMatch(src, /' \/ '/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'katalog.html'), 'utf8');
  assert.doesNotMatch(html, /catalog-kicker/);
});
```

Если в тестах файла `fs`/`path` не подключены - добавить `const fs = require('fs'); const path = require('path');` в шапку.

- [ ] **Step 2: Реализация** - `js/catalog.js:37`: `return two(i + 1) + ' / ' + two(n);` → `return (i + 1) + ' из ' + n;` (функцию `two` удалить, если больше не используется); `katalog.html` - удалить `<p class="catalog-kicker">`. CSS: «зал» `.collection` → `var(--radius)`; карточки изделий на узком экране - рецепт `.card` (фон, скругление, отступ) через токены; капс `.catalog-kicker` удалить; политика - только токены.

Добавить в `CHECKED`: `['css/site.css', '/* ---- Готовые изделия', '/* ---- Category page: stone gallery']`, `['css/site.css', '/* ---- Политика', '/* ---- Liquid glass']`. Теперь весь `css/site.css` под проверкой - заменить все срезы `site.css` в `CHECKED` одним элементом `'css/site.css'`.

- [ ] **Step 3: Тесты** - `node --test tests/*.test.js` - всё зелёное.

- [ ] **Step 4: Браузер** - `katalog.html` 1440 и 375: счётчик «1 из 8», стрелки и ← → листают; `privacy.html` - ссылки голубые как были. Метрики сайта целиком: прогнать `DesignAudit.metrics` на всех 17 страницах (кроме шоурума) на 1440 и 375; все цели выполнены, `overflowX` false.

- [ ] **Step 5: Коммит и остановка**

```bash
git add -A katalog.html js css tests
git commit -m "feat(catalog): one product -- «1 из 8», no label, the card; all of site.css on the tokens"
```

**СТОП: этап 3.** Показать владельцу направление, каталог и общую таблицу метрик по сайту. Ждать «да».

---

### Task 9: Конфигуратор (этап 4, репозиторий `D:\calculator\.worktrees\rate-catalog-subcategories`)

**Files:**
- Modify: `sayanmramor-calculator.html` (подключение токенов, `<style>`, меню «Интерьер», вкладка), `material-picker.js` (если там заданы размеры/цвета инлайном - `grep -n "style\." material-picker.js`).
- Test: `tests/calculator-markup.test.js` (новые тесты), существующие тесты, закрепляющие старые значения.

**Interfaces:**
- Consumes: `/sayanmramor-site/css/tokens.css` (тот же хост: локально и на GitHub Pages).

- [ ] **Step 1: Тест (падает)** - в `tests/calculator-markup.test.js`:

```js
// One product (2026-10-14, docs/superpowers/specs/2026-10-14-unified-product-design.md in the
// site's repository): the configurator reads the site's tokens and keeps no copies.
test('one product: the site\'s tokens, no own copies, 2 radii, the site\'s sizes, the agreed words', () => {
  assert.match(html, /<link rel="stylesheet" href="\/sayanmramor-site\/css\/tokens\.css">\r?\n<link rel="stylesheet" href="\/sayanmramor-site\/css\/header\.css">/);
  assert.match(html, /<title>Конфигуратор изделий из камня - Саянмрамор<\/title>/);
  assert.doesNotMatch(html, /Пространство/);
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /--(card|dark-bg|dark-bg-2|dark-text|dark-accent|pick-ink|pick-accent|pick-muted|pick-line|configurator-text)\s*:/, 'no copies of the site\'s values');
  [...css.matchAll(/border-radius:\s*([^;}]+)/g)].forEach(m => m[1].trim().split(/\s+(?![^(]*\))/).forEach(v =>
    assert.match(v, /^(var\(--radius\)|var\(--radius-pill\)|50%|0|inherit|calc\(var\(--radius\) - [\w.()-]+\))$/, m[0])));
  [...css.matchAll(/font-size:\s*([^;}]+)/g)].forEach(m => assert.match(m[1].trim(), /^(var\(--fs-(display|h1|h2|h3|body|small)\)|inherit|[\d.]+em)$/, m[0]));
  [...css.matchAll(/box-shadow:\s*([^;}]+)/g)].forEach(m => m[1].trim() === 'none' || m[1].split(/,(?![^(]*\))/).forEach(p => assert.match(p.trim(), /^var\(--(shadow-1|shadow-2|glass-rim|glass-rim-dark)\)$/, m[0])));
  assert.doesNotMatch(css, /text-transform:\s*uppercase/);
});
```

Run: `node --test tests/calculator-markup.test.js` - FAIL.

- [ ] **Step 2: Подключение и тексты** - перед `<link rel="stylesheet" href="/sayanmramor-site/css/header.css">` вставить `<link rel="stylesheet" href="/sayanmramor-site/css/tokens.css">`; `<title>` → `Конфигуратор изделий из камня - Саянмрамор`; меню «Пространство» → «Интерьер».

- [ ] **Step 3: Свои токены → общие** - в `:root` `<style>` удалить копии и заменить использования по таблице:

| было | стало |
|---|---|
| `--card` | `--surface` |
| `--card-hover` | `--surface-sunk` |
| `--pick-ink`, `--ink` (копия) | `--ink` (из tokens) |
| `--pick-accent` | `--accent` |
| `--pick-muted` | `--muted` |
| `--pick-line` | `--line` |
| `--pick-fill`, `--pick-tile` | `--surface-sunk` |
| `--pick-ease` | `--ease` |
| `--dark-bg` | `--graphite` |
| `--dark-bg-2` | `--graphite-2` |
| `--dark-border` | `--on-dark-line` |
| `--dark-text` | `--on-dark` |
| `--dark-text-muted`, `--dark-text-dim` | `--on-dark-muted` |
| `--dark-accent` | `--accent-on-dark` |
| `--configurator-text` (15px) | `--fs-body` (основной текст) / `--fs-small` (вторичный) |

Цвета, которых в tokens нет (`--accent-ink`, `--accent-soft`, `--stone`, `--stone-line`, `--wall`, `--wall-line`, `--sage`, `--dark-accent-soft`) - это цвета иконок и индикаторов конфигуратора; оставить их в `:root` конфигуратора (это не копии сайта).

- [ ] **Step 4: Скругления, размеры, тени** по тем же таблицам, что в задачах 4 и 6: карточки выбора (`8px`, `12px`) → `var(--radius)`; кнопки, чипы, поля, сегменты → `var(--radius-pill)`; заголовок шага → `var(--fs-h2)`; крупная цена → `var(--fs-h1)`; тени карточек → `none`; окно выбора камня, просмотр → `var(--shadow-2)`; стеклянная полоса шагов → `var(--glass-rim), var(--shadow-1)`.

- [ ] **Step 5: Тесты** - `node --test tests/*.test.js` (все 627+), переписать тесты старых значений (`grep -n "8px\|12px\|15px\|--card\b\|--dark-bg\|Калькулятор стоимости" tests/*.js`).

- [ ] **Step 6: Браузер** - конфигуратор с сайта (`?product=stoleshnitsa_kuhnya&stone=absolute-black`) на 1440 и 375: пройти все шаги до «Расчёт», открыть каталог камня, отфильтровать, выбрать; на телефоне - переходы шагов плавные (как после исправления от 2026-10-14), клавиатура не всплывает; `DesignAudit.metrics` - цели выполнены; 3D отображается.

- [ ] **Step 7: Коммит и остановка**

```bash
git add sayanmramor-calculator.html material-picker.js tests
git commit -m "feat: one product -- the site's tokens, cards and words in the configurator"
```

**СТОП: этап 4.** Показать владельцу конфигуратор до/после. Ждать «да».

---

### Task 10: Шоурум (этап 5)

**Files:**
- Modify: `showroom.html` (подключение `tokens.css` - уже в задаче 3; «Здесь можно создать»), `css/showroom.css`.
- Test: `tests/showroom.test.js`, `tests/design-tokens.test.js`.

**Interfaces:**
- Consumes: `tokens.css` (задача 3 уже подключила его в `showroom.html`).

- [ ] **Step 1: Снимок 3D «до»** - открыть `showroom.html` на 1440×900, для каждой зоны (Дом, Холл, Гостиная, Кухня, Лестница, Ванная - кнопки внизу) сделать скриншот после 4 с ожидания; скрыть интерфейс перед снимком: `document.querySelectorAll('.sr-ui, header, .sr-panel').forEach(e => e.style.visibility = 'hidden')` (точные классы - `grep -n "class=\"sr-" showroom.html | head -30`). Сохранить скриншоты в scratchpad.

- [ ] **Step 2: Тест (падает)** - добавить в `CHECKED`: `'css/showroom.css'`; в `tests/showroom.test.js`:

```js
test('showroom, one product (2026-10-14): verde instead of copper, the site\'s tokens, the label in sentence case', () => {
  const css = fs.readFileSync(path.join(site, 'css', 'showroom.css'), 'utf8');
  assert.doesNotMatch(css, /#b4562b|#9b4824|--sr-accent|rgba\(180, 86, 43/);
  assert.match(css, /\.sr-cta \{[^}]*background: var\(--accent\);/);
  const caps = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^}]*text-transform:\s*uppercase/g)].map(m => m[1].trim());
  assert.deepEqual(caps, ['.sr-logo'], 'capitals only in the wordmark');
});
```

(Если в `tests/showroom.test.js` переменная корня называется не `site` - использовать имя из его шапки.)

Run: `node --test tests/showroom.test.js tests/design-tokens.test.js` - FAIL.

- [ ] **Step 3: Реализация** - в `css/showroom.css`:
  - удалить `--sr-accent`, `--sr-accent-hover`; использования → `var(--accent)`, `var(--accent-hover)`; маркер `rgba(180, 86, 43, 0.35)` → `rgba(42, 84, 70, 0.45)` (зелёный с той же прозрачностью) внутри `box-shadow` заменить на `0 0 0 5px rgba(42, 84, 70, 0.45)` - это кольцо выделения, не тень: оформить отдельным токеном нельзя, поэтому перенести кольцо в `outline: 5px solid rgba(42, 84, 70, 0.45); outline-offset: 0` и оставить `box-shadow: var(--shadow-1)`;
  - свои `--sr-graphite`, `--sr-on-dark`, `--sr-dim`, `--sr-line` - оставить (тёмная тема сцены), но размеры шрифта `--sr-fs-*` → токены `--fs-*`; скругления `6px`, `12px`, `18px 18px 0 0`, `var(--sr-radius)` → `var(--radius-pill)` (кнопки) / `var(--radius)` (карточки, панели; лист снизу на телефоне - `var(--radius) var(--radius) 0 0`); тени → `var(--shadow-1|2)` и `var(--glass-rim-dark)`; переходы → `var(--dur-*)`;
  - капс: `.sr-top-title` и `.sr-eyebrow` - убрать `text-transform: uppercase` и `letter-spacing`; `.sr-logo` (логотип) остаётся.

- [ ] **Step 4: Тесты** - `node --test tests/*.test.js` - зелёное; переписать тесты меди в `tests/showroom.test.js` (`grep -n "copper\|b4562b\|sr-accent" tests/showroom.test.js`).

- [ ] **Step 5: Снимок 3D «после» = «до»** - повторить шаг 1 и сравнить попиксельно: скрипт сравнения в браузере (загрузить оба PNG в `<canvas>`, считать долю пикселей с отличием канала больше 1). Expected: 0 (кроме маркеров, которые скрыты вместе с интерфейсом). Если сцена отличается - откатить и найти причину (правило проекта: без потери качества шоурума).

- [ ] **Step 6: Браузер** - шоурум на 1440 и 375: выбрать маркер изделия (зелёное выделение), открыть карточку, «Создать изделие» ведёт в конфигуратор, «Все изделия», «Связаться»; метрики интерфейса; консоль без ошибок.

- [ ] **Step 7: Коммит и остановка**

```bash
git add -A showroom.html css/showroom.css tests
git commit -m "feat(showroom): one product -- verde instead of copper, the site's tokens"
```

**СТОП: этап 5.** Показать владельцу шоурум и итоговую таблицу метрик по всем поверхностям «до → после». Публикация (push в `master` сайта и в `rate-catalog-subcategories` конфигуратора) - только по команде владельца.

---

## Self-review (сделано при написании)

- Покрытие спецификации: токены (задачи 2-3), мёртвый код как условие проверки токенов (4), шапка/подвал/кнопки (4), заголовок раздела и карточка (5), главная со всеми пунктами раздела 4 спецификации и эффектами раздела 3 (6), направления/форма/просмотр (7), каталог/политика (8), конфигуратор (9), шоурум и медь (10), тексты раздела 6 - главная (6), направления (7), конфигуратор (9), шоурум «Здесь можно создать» (10, шаг 3 - убрать капс), «Открыть шоурум» (6); проверки раздела 8 - в каждой задаче.
- Отступление от спецификации, которое надо показать владельцу: «Пространство» → «Интерьер» и в меню всех страниц и конфигуратора (в спецификации - только группа на главной), ради одного имени в продукте.
- Подпись первого экрана «Раковина из кварцита — визуализация» содержит длинное тире; спецификация не трогает тексты вне таблицы - вопрос владельцу, менять ли на « - ».
- Задача 4 удаляет 5 неиспользуемых JS-файлов и их CSS - в спецификации прямо не названо; нужно, чтобы проверка токенов покрывала весь `site.css` без перевода мёртвого кода.
