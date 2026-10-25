# Заявка, калькулятор и каталог: одна заявка - план работ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** из заявки «Получить расчёт» (главная и 13 страниц направлений) человек уходит собрать изделие в калькуляторе или выбрать готовое в каталоге и возвращается в ту же заявку, где изделие стоит карточкой, а в конце можно скачать паспорт.

**Architecture:** один новый модуль сайта `js/offer-handoff.js` - единственный владелец договора «куда вернуть, что передать»: его грузят и сайт, и калькулятор (калькулятор уже грузит `/sayanmramor-site/js/header.js` тем же способом). Заявка (`js/offer-form.js` → `mountSteps`) получает экраны развилки и каталога, карточку изделия и блок паспорта. Каталог (`js/catalog.js`) и калькулятор только строят адрес возврата и кладут изделие в хранилище.

**Tech Stack:** ванильный JS (UMD-модули `root.X = factory()`), `node --test` без jsdom (тесты - чистые функции, исходники и разметка регулярками), `sessionStorage` / `localStorage` / IndexedDB, dev-сервер `site-dev` (порт 8010) отдаёт сайт и калькулятор с одного адреса.

**Spec:** `docs/superpowers/specs/2026-10-26-offer-calculator-link-design.md` (читать целиком перед любой задачей).

## Global Constraints

- В новых текстах нет длинного тире « — », только « - ».
- `css/header.css` не трогать (тест держит отпечаток). Кнопки на страницах - `--radius-btn: 6px`. Анимации фото не трогать.
- Вид блока заявки остаётся как в `master`, кроме добавленного (развилка, экран каталога, карточка, блок паспорта).
- Новые CSS-правила заявки - в блоке `/* ---- «Получить расчёт» на главной: три вопроса мастеру` в `css/site.css`, и каждый селектор начинается с `main .offer-talk`, `.offer-talk` или `.talk-` (тест в `tests/site.test.js` это проверяет). Hover только под `@media (hover: hover)`; анимации выключаются под `prefers-reduced-motion: reduce`.
- После правок `css/` или `js/` сайта - `node scripts/stamp_assets.js` (иначе падает тест).
- Главная не грузит код калькулятора и 3D; из калькулятора на сайт уходит только адрес и записи в хранилище.
- Ничего не отправляется: в коде заявки нет `fetch(` к серверу заявок, `XMLHttpRequest`, `sendBeacon` (тест). `fetch` своих JSON-файлов (`data/products.json`, `stone-index.json`) разрешён - поправить тест так, чтобы он запрещал только отправку.
- Ничего не пушить. Сайт: ветка `unified-product`. Калькулятор: новая ветка `offer-link` от `origin/rate-catalog-subcategories` в `D:\calculator\.worktrees\rate-catalog-subcategories` (сейчас там `3d-edges`, она целиком в опубликованной ветке). `core.autocrlf=true`: тесты разметки, ищущие `\n`, проверять на закоммиченном дереве, если после смены ветки падают.
- Сообщения коммитов в стиле репозитория: `«...»: что сделано (the owner, 2026-10-26)` + строка `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Хранилище недоступно** (приватный режим, встроенный браузер Telegram, `localStorage` бросает исключение) - заявка работает как сейчас, ни одной ошибки в консоли; изделие из калькулятора видно по адресу (изделие и камень без цены). → тесты в Task 1 со «сломанным» хранилищем.
2. **Чужая или старая запись калькулятора** в `localStorage` (другая конфигурация, вкладка закрыта вчера) - не показывается и удаляется. → Task 1, `takeCalcPiece`.
3. **Готового изделия больше нет** (`?piece=` с неизвестным id или `available: false`) - карточки нет, заявка как обычно. → Task 1, `catalogPiece`.
4. **Человек сменил направление** в первом вопросе после того, как изделие встало в заявку - карточка уходит (Кухня → Ванная), а при том же направлении остаётся. → Task 2, `chooseDirection`.
5. **«Назад» браузера из калькулятора/каталога без изделия** - заявка открывается на развилке (или экране каталога) с выбранным направлением и уже введёнными ответами. → Task 3, сохранение `current` в состоянии + проверка в Task 7.

---

## Карта файлов

Сайт (`D:\sayanmramor-site`):
- Create `js/offer-handoff.js` - договор передачи: направления → изделия калькулятора, адреса, хранилища, файлы. Тест `tests/offer-handoff.test.js`.
- Modify `js/offer-form.js` (`mountSteps` и экспорт) - развилка, экран каталога, карточка, восстановление, паспорт.
- Modify `css/site.css` (блок трёх вопросов) - `.talk-fork*`, `.talk-piece*`, `.talk-passport*`.
- Modify `js/catalog.js` - «Запросить» с id изделия.
- Modify `index.html`, `categories/*.html` (13), `katalog.html` - подключить `js/offer-handoff.js` до `offer-form.js` / `catalog.js`.
- Modify `tests/site.test.js`, `tests/catalog.test.js`.

Калькулятор (`D:\calculator\.worktrees\rate-catalog-subcategories`):
- Modify `sayanmramor-calculator.html` - скрипт `/sayanmramor-site/js/offer-handoff.js`, «Получить расчёт» → паспорт + возврат, без формы.
- Modify `tests/calculator-markup.test.js`, `tests/result-lead.test.js`.

---

### Task 1: договор передачи `js/offer-handoff.js`

**Files:**
- Create: `js/offer-handoff.js`
- Test: `tests/offer-handoff.test.js`

**Interfaces:**
- Produces (глобал `window.OfferHandoff`, в node `require('../js/offer-handoff.js')`):
  - `HOME = '/sayanmramor-site/index.html'`, `KATALOG = '/sayanmramor-site/katalog.html'`, `CALCULATOR = '/sayanmramor-calculator/sayanmramor-calculator.html'`, `KATALOG_KEY = 'gotovye-izdeliya'`
  - `CALC_PRODUCT: { [siteKey]: calcKey }` - 10 пар из спеки (`lestnitsy: 'lestnitsa'`, `panno: 'panno'`, `podokonniki: 'podokonnik'`, `poly: 'pol'`, `steny: 'stena'`, `fasady: 'fasad'`, `vannaya: 'stoleshnitsa_vannaya'`, `kuhnya: 'stoleshnitsa_kuhnya'`, `stupeni: 'stupeni'`, `kaminy: 'kaminy'`)
  - `CALC_LABEL: { [calcKey]: string }` - подписи калькулятора (`product-types.js` `label`: «Лестницы», «Панно», «Подоконники», «Полы», «Стены», «Фасады», «Столешницы в ванную», «Столешницы на кухню», «Ступени», «Камины»)
  - `branchOf(siteKey: string) -> 'calc' | 'katalog' | 'plain'`
  - `calcUrl(siteKey) -> string` (`CALCULATOR + '?product=' + calcKey`), `editUrl(query) -> string` (`CALCULATOR + '?' + query`)
  - `formatRub(n: number|null) -> string` - `37 000 ₽` (неразрывный пробел перед ₽, как `formatProductPrice` каталога), не число → `'Цена по запросу'`
  - Состояние заявки, `sessionStorage['sayan-offer-talk']`: `TalkState = { page: string, direction: string /*key или '' или 'unsure'*/, name: string, nameSkipped: boolean, phone: string, current: 0|'fork'|'katalog'|1|2|3, piece: Piece|null, attachmentName: string }`
  - `saveTalk(store, state) -> void`, `loadTalk(store) -> TalkState|null`
  - `returnUrl(store, query: string) -> string` = `(loadTalk(store)?.page || HOME) + (query ? '?' + query : '') + '#offer'`
  - `readArrival(search: string) -> {kind:'katalog', id} | {kind:'calc', query} | null` - `piece=<id>` → каталог; есть `pv` → калькулятор, `query` = весь поиск без `?`
  - `Piece = {kind:'calc', query, product, stone, stoneImage, sizes, price, priced: boolean} | {kind:'katalog', id, name, price: number|null, photo}`
  - `putCalcPiece(store, piece)`, `takeCalcPiece(store, query) -> Piece|null` - `localStorage['sayan-offer-piece']`; отдаёт запись, только если её `query === query`; ключ удаляет всегда
  - `catalogPiece(products: object[], id) -> Piece|null` (нет или `available === false` → `null`; `photo` = `photos[0]`)
  - `calcPieceFromIndex(query, stones: {id,name,image}[]) -> Piece` - запасной путь: `product` из `CALC_LABEL[product]`, `stone`/`stoneImage` из индекса (`'/sayanmramor-calculator/data/' + image`), `sizes: ''`, `price: ''`, `priced: false`
  - `blobs.put(name, blob) -> Promise<void>`, `blobs.get(name) -> Promise<Blob|null>`, `blobs.remove(name) -> Promise<void>` - IndexedDB `sayan-offer`, хранилище `files`; любые ошибки → `null` / тихо. Имена: `'passport'`, `'passport-preview'`, `'attachment'`.
  - `saveFile(file: File) -> void` - как `savePassportFile` калькулятора: `navigator.share({files})`, если можно, иначе скачивание через `a[download]`.
- Все функции с хранилищем принимают его параметром и переживают `store`, который бросает на любом вызове (`try/catch`, возвращают `null` / ничего).

- [ ] **Step 1: Write the failing tests** (`tests/offer-handoff.test.js`, `node:test` + `assert/strict`, хранилище - простой объект с `getItem/setItem/removeItem`)
  - `branchOf`: `'kuhnya' → 'calc'`, `'gotovye-izdeliya' → 'katalog'`, `'hammamy' → 'plain'`, `'' → 'plain'`; `Object.keys(CALC_PRODUCT).length === 10`; все 10 ключей есть в `require('../js/offer-form.js').DIRECTIONS`.
  - `returnUrl(emptyStore, 'piece=vaza-01') === '/sayanmramor-site/index.html?piece=vaza-01#offer'`; после `saveTalk(store, {page:'/sayanmramor-site/categories/stoleshnitsy-kuhnya.html', ...})` - возврат на эту страницу; `returnUrl(store, '')` заканчивается на `.html#offer`.
  - `readArrival('?piece=vaza-01')` → `{kind:'katalog', id:'vaza-01'}`; `readArrival('?product=pol&stone=x&pv=1&len=3000')` → `{kind:'calc', query:'product=pol&stone=x&pv=1&len=3000'}`; `readArrival('')` и `readArrival('?product=pol')` → `null`.
  - `takeCalcPiece`: совпадение → запись и ключ удалён; другой `query` → `null` и ключ удалён.
  - `catalogPiece`: на выборке из `data/products.json` - `'rakushka-01'` → `{kind:'katalog', name:'Ракушка', price:37000, ...}`; неизвестный id → `null`; `available:false` → `null`.
  - `calcPieceFromIndex('product=stoleshnitsa_kuhnya&stone=s1&pv=1', [{id:'s1', name:'Taj Mahal', image:'images/s1.webp'}])` → `product:'Столешницы на кухню', stone:'Taj Mahal', stoneImage:'/sayanmramor-calculator/data/images/s1.webp', priced:false`.
  - `formatRub(37000) === '37 000 ₽'` (с ` ` перед ₽), `formatRub(null) === 'Цена по запросу'`.
  - Хранилище, бросающее исключение: `saveTalk` не бросает, `loadTalk → null`, `takeCalcPiece → null`, `returnUrl` → главная.

- [ ] **Step 2: Run** `node --test tests/offer-handoff.test.js` - Expected: FAIL (`Cannot find module '../js/offer-handoff.js'`).
- [ ] **Step 3: Implement `js/offer-handoff.js`** по Interfaces, в оформлении соседних модулей (шапка-комментарий, UMD как в `js/catalog.js`). `blobs` и `saveFile` в node не вызываются, но модуль в node должен загружаться (не трогать `indexedDB`/`document` при загрузке).
- [ ] **Step 4: Run** `node --test tests/offer-handoff.test.js` - Expected: PASS.
- [ ] **Step 5: Commit** (`js/offer-handoff.js`, `tests/offer-handoff.test.js`): `«Получить расчёт»: one owner of where a request returns and what comes back with it (the owner, 2026-10-26)`.

### Task 2: развилка и экран каталога в заявке

**Files:**
- Modify: `js/offer-form.js` (`mountSteps`, экспорт), `css/site.css` (блок трёх вопросов)
- Modify: `index.html`, `categories/*.html` - `<script src="/sayanmramor-site/js/offer-handoff.js"></script>` прямо перед `offer-form.js`; потом `node scripts/stamp_assets.js`
- Test: `tests/site.test.js`

**Interfaces:**
- Consumes: `OfferHandoff.branchOf`, `calcUrl`, `KATALOG`.
- Produces (экспорт `OfferForm`):
  - `FORK = { q: ['Посчитаете ', 'сами', ' или доверите мастеру?'], hint: label => label + ' есть в нашем калькуляторе: выберите камень и размеры, изделие появится в 3D с ценой. Потом вернётесь сюда.', go: ['Собрать в калькуляторе', 'Камень из каталога, размеры, 3D. Цена сразу.'], master: ['Пусть посчитает мастер', 'Оставите имя и телефон, мастер перезвонит и всё уточнит.'] }`
  - `KATALOG_STEP = { q: ['Выберите ', 'готовое', ' изделие'], hint: 'Ванны из оникса, раковины, вазы и столы, которые уже сделаны в нашем цеху и ждут хозяина. Выберите то, что нравится, и мы вернём вас сюда.', go: 'Посмотреть каталог' }`
  - `afterDirection(siteKey) -> 'fork' | 'katalog' | 1` (по `branchOf`)
  - `countLabel(current, siteKey) -> string`: ветки `calc`/`katalog`: `0 → 'Вопрос 1 из 4'`, `'fork'|'katalog' → 'Вопрос 2 из 4'`, `1 → '3 из 4'`, `2 → '4 из 4'`; ветка `plain`: `'Вопрос N из 3'` как сейчас; `3 → 'Готово'`
  - `chooseDirection(state: TalkState, siteKey) -> TalkState` - новое направление, `current = afterDirection(key)`, `piece` остаётся только если он того же направления (`calc`: `CALC_PRODUCT[key]` совпадает с продуктом в `piece.query`; `katalog`: `key === KATALOG_KEY`)
  - `startStep(preselectKey) -> 0 | 'fork' | 1` - страница с `data-preselect`: `calc` → `'fork'`, иначе `1`; без предвыбора → `0`

- [ ] **Step 1: Write the failing tests** в `tests/site.test.js` (рядом с тестом «three questions (offer-form.js)»):
  - `afterDirection('kuhnya') === 'fork'`, `afterDirection('gotovye-izdeliya') === 'katalog'`, `afterDirection('basseyny') === 1`, `afterDirection('') === 1` («Пока не знаю»).
  - `countLabel('fork','kuhnya') === 'Вопрос 2 из 4'`, `countLabel(2,'kuhnya') === 'Вопрос 4 из 4'`, `countLabel(1,'hammamy') === 'Вопрос 2 из 3'`, `countLabel(3,'kuhnya') === 'Готово'`.
  - `startStep('kuhnya') === 'fork'`, `startStep('spa-zony') === 1`, `startStep('') === 0`.
  - `chooseDirection` (Review Focus 4): с `piece` кухни и ключом `'vannaya'` → `piece === null`; с ключом `'kuhnya'` → `piece` тот же.
  - Копия `FORK`/`KATALOG_STEP` равна спеке; ни в одной строке `offer-form.js` нет « — ».
  - Разметка: на `index.html` и каждой `categories/*.html` `offer-handoff.js` стоит прямо перед `offer-form.js`; обновить список скриптов главной в тесте «the home page is static» (`'js/offer-handoff.js'` перед `'js/offer-form.js'`).
  - Поправить проверку «nothing leaves the page yet»: запрет `XMLHttpRequest|sendBeacon` и `method: 'POST'` вместо любого `fetch(`.
- [ ] **Step 2: Run** `node --test tests/site.test.js` - Expected: FAIL на новых проверках.
- [ ] **Step 3: Implement.** `STEPS` и три чипа не меняются. Экраны `'fork'` и `'katalog'` - новые `section.talk-step` (`data-step="fork"`/`"katalog"`) в том же стиле, что `question()` (вопрос `p.talk-q` с `em`, `p.talk-hint`), плюс:
  - развилка: `div.talk-fork` с двумя `button.talk-fork-btn` (первая `is-main`; внутри `span.talk-fork-title` со стрелкой `icon('arrow')` у первой и `span.talk-fork-text`). «Собрать в калькуляторе» → сохранить состояние (Task 3 даёт `persist()`; до Task 3 - просто переход) и `location.assign(OfferHandoff.calcUrl(key))`. «Пусть посчитает мастер» → `go(1)`;
  - экран каталога: одна `a.talk-next` «Посмотреть каталог» со стрелкой, `href = OfferHandoff.KATALOG`;
  - внизу обоих `linkButton('← Изменить изделие', () => go(0))`.
  - Ответ на первый вопрос идёт через `chooseDirection`; `go(1)` из первого вопроса больше не зашит. Предвыбор страницы → `startStep`. Счётчик → `countLabel`. «← Изменить изделие» на шаге имени ведёт на развилку/каталог, если ветка не `plain`.
  - CSS: `.talk-fork { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-3); margin-top: var(--s-5); }`, кнопки как `.talk-option` по рамке, `min-height: 132px`, `border-radius: 10px`, `is-main` - заливка `var(--on-dark)` и текст `var(--graphite)` (как `.talk-next`); под `@media (max-width: 560px)` - одна колонка. Цвета только из существующих значений блока.
- [ ] **Step 4:** `node scripts/stamp_assets.js`, затем `node --test tests/site.test.js` - Expected: PASS.
- [ ] **Step 5: Commit**: `«Получить расчёт»: after a piece the calculator makes, a fork; ready pieces open the catalogue (the owner, 2026-10-26)`.

### Task 3: возвращение с изделием, карточка, сохранение ответов

**Files:**
- Modify: `js/offer-form.js`, `css/site.css`; `stamp_assets`
- Test: `tests/site.test.js`

**Interfaces:**
- Consumes: всё из Task 1 (`loadTalk/saveTalk`, `readArrival`, `takeCalcPiece`, `catalogPiece`, `calcPieceFromIndex`, `editUrl`, `blobs`), `chooseDirection` / `countLabel` из Task 2.
- Produces (экспорт `OfferForm`):
  - `PIECE_HINTS = { name: 'Изделие уже в заявке. Осталось имя и телефон.', phoneCalc: 'Мастер проверит размеры и подтвердит цену.', phoneKatalog: 'Мастер подтвердит, что изделие ждёт вас, и расскажет о доставке.' }`
  - `pieceCard(piece) -> { kicker, title, meta, price, note, image, actions: [{label, kind: 'edit'|'other'|'drop'}] }`: calc → `kicker 'Из калькулятора'`, `title product + ' · ' + stone`, `meta sizes`, `price` как есть, `note priced ? 'ориентировочно' : ''`, actions `Изменить в калькуляторе`/`Убрать изделие`; katalog → `kicker 'Из каталога'`, `title name`, `price` = `OfferHandoff.formatRub(piece.price)`, `note ''`, actions `Выбрать другое`/`Убрать изделие`
  - `summaryLine(state) -> string` - `[piece ? (calc: product + ' · ' + stone; katalog: name) : directionLabel, name, phone].filter(Boolean).join(' · ')`
- `persist()` внутри `mountSteps` - `saveTalk(sessionStorage, {page: location.pathname, ...answers, current, piece})` на каждом `go()` и вводе имени/телефона (по `input`).

- [ ] **Step 1: Write the failing tests:** `pieceCard` для обоих видов (значения из спеки: `'≈ 186 400 ₽'` + `'ориентировочно'`; `'37 000 ₽'`, `null → 'Цена по запросу'`); `summaryLine` с изделием из калькулятора начинается с `'Столешницы на кухню · Taj Mahal'`; исходник `offer-form.js` вызывает `history.replaceState` и `readArrival(location.search)`; CSS-правила `.talk-piece` есть в блоке трёх вопросов.
- [ ] **Step 2: Run** `node --test tests/site.test.js tests/offer-handoff.test.js` - Expected: FAIL.
- [ ] **Step 3: Implement.** При монтировании:
  1. `state = loadTalk(sessionStorage)`; если `state.page !== location.pathname` - начать заново (кроме случая прибытия, см. 2).
  2. `arrival = readArrival(location.search)`. `katalog` → `fetch('/sayanmramor-site/data/products.json')` → `catalogPiece`; `calc` → `takeCalcPiece(localStorage, query)`, иначе `fetch('/sayanmramor-calculator/data/stone-index.json')` → `calcPieceFromIndex`. Изделие ставится в состояние, направление = его направление сайта (`KATALOG_KEY` или ключ из `CALC_PRODUCT` по продукту), `current = state.name || state.nameSkipped ? 2 : 1`. Затем `history.replaceState(null, '', location.pathname + '#offer')` и прокрутка к `#offer`. Пока `fetch` идёт, заявка уже нарисована; карточка дорисовывается, когда пришли данные. Не нашлось изделия - заявка как обычно.
  3. Карточка `div.talk-piece` под `.talk-receipt` (вид из концепта: подложка `rgba(127, 166, 152, 0.12)`, рамка `inset 0 0 0 1px rgba(127, 166, 152, 0.35)`, радиус 12 px; картинка 64×64 радиус 8 px; `kicker` капсом 12 px цвета `var(--accent-on-dark)`; цена шрифтом `--font-display` 18 px справа; кнопки - `linkButton`). «Изменить в калькуляторе» → `persist()` + `location.assign(OfferHandoff.editUrl(piece.query))`; «Выбрать другое» → `persist()` + `location.assign(OfferHandoff.KATALOG)`; «Убрать изделие» → `piece = null`, остаться на шаге.
  4. Подсказки шагов имени и телефона при изделии - `PIECE_HINTS`. Чип 1 - «✓ <направление>».
  5. Файл: при выборе - `blobs.put('attachment', file)`; при монтировании, если в состоянии есть `attachmentName`, - `blobs.get('attachment')` и показать имя в строке файла (сам `<input type=file>` заполнить нельзя - файл держится в IndexedDB и уйдёт с заявкой, когда появится отправка; в состоянии хранить `attachmentName`).
  6. На телефоне (`max-width: 560px`) карточка: картинка 52 px, цена под названием.
- [ ] **Step 4:** `stamp_assets`, `node --test tests/*.test.js` - Expected: PASS.
- [ ] **Step 5: Commit**: `«Получить расчёт»: the piece comes back into the request and stays there; the answers survive the trip (the owner, 2026-10-26)`.

### Task 4: последний экран - изделие и паспорт

**Files:**
- Modify: `js/offer-form.js`, `css/site.css`; `stamp_assets`
- Test: `tests/site.test.js`

**Interfaces:**
- Consumes: `pieceCard`, `summaryLine` (Task 3), `blobs.get('passport'|'passport-preview')`, `saveFile`, `editUrl`.
- Produces: `PASSPORT = { title: 'Паспорт изделия', button: 'Скачать паспорт' }` в экспорте.

- [ ] **Step 1: Write the failing tests:** `OfferForm.PASSPORT` равен спеке; исходник: экран `talk-done` строит `summaryLine(...)`, карточку без кнопок и блок `.talk-passport` только для `piece.kind === 'calc'`; CSS `.talk-passport` есть.
- [ ] **Step 2: Run** - FAIL.
- [ ] **Step 3: Implement.** На экране «Заявка собрана»: сводка - `summaryLine`; карточка изделия без `actions`; для калькулятора - `div.talk-passport`: превью (`img` из `blobs.get('passport-preview')`, объектный URL; если нет - блок без картинки), подпись `PASSPORT.title`, кнопка `button.talk-ghost` «Скачать паспорт». PDF берётся из `blobs.get('passport')` **заранее**, при показе экрана (на iPhone сохранение должно случиться внутри касания): есть файл → по нажатию `OfferHandoff.saveFile(file)`; нет → кнопка становится ссылкой `a.talk-ghost` на `editUrl(piece.query)` (калькулятор откроет изделие, паспорт скачивают там).
- [ ] **Step 4:** `stamp_assets`, `node --test tests/*.test.js` - PASS.
- [ ] **Step 5: Commit**: `«Получить расчёт»: the end of the request shows the piece and hands over its passport (the owner, 2026-10-26)`.

### Task 5: каталог - «Запросить» с изделием

**Files:**
- Modify: `js/catalog.js`, `katalog.html` (`offer-handoff.js` перед `catalog.js`); `stamp_assets`
- Test: `tests/catalog.test.js`

**Interfaces:**
- Consumes: `OfferHandoff.returnUrl`, `OfferHandoff.formatRub` (заменить им `formatProductPrice` внутри, экспорт `formatProductPrice` оставить как обёртку - тесты каталога его зовут).
- Produces: `Catalog.askUrl(product, store) -> string` = `OfferHandoff.returnUrl(store, 'piece=' + encodeURIComponent(product.id))`. В node `catalog.js` берёт `OfferHandoff` через `require('./offer-handoff.js')` (как `category-page.js` берёт свои зависимости).

- [ ] **Step 1: Write the failing tests:** `askUrl({id:'rakushka-01'}, emptyStore) === '/sayanmramor-site/index.html?piece=rakushka-01#offer'`; со состоянием заявки страницы кухни - возврат туда; карточка: `ask.href === Catalog.askUrl(product, ...)` (заменить старую проверку на `ORDER_URL`); `katalog.html` грузит `offer-handoff.js` перед `catalog.js`; на `katalog.html` по-прежнему нет `data-offer-form`.
- [ ] **Step 2: Run** `node --test tests/catalog.test.js` - FAIL.
- [ ] **Step 3: Implement** `askButton(product)` с `a.href = askUrl(product, sessionStorage)` (в браузере; `sessionStorage` недоступен → главная). Если человек вернулся в каталог «Назад» после заявки, ссылка считается заново при отрисовке - этого достаточно.
- [ ] **Step 4:** `stamp_assets`, `node --test tests/*.test.js` - PASS.
- [ ] **Step 5: Commit**: `«Готовые изделия»: «Запросить» brings the piece into the request (the owner, 2026-10-26)`.

### Task 6: калькулятор - «Получить расчёт» ведёт в заявку

**Files (калькулятор, ветка `offer-link`):**
- Modify: `sayanmramor-calculator.html`
- Test: `tests/calculator-markup.test.js`, `tests/result-lead.test.js`

**Interfaces:**
- Consumes (с сайта): `OfferHandoff.putCalcPiece`, `returnUrl`, `blobs.put`, `formatRub` не нужен (цена уже строкой `resultTotalEl`).
- Produces: `buildPassportFile() -> Promise<{ file: File, preview: string|null }>` - тело нынешнего `downloadPassport` до `new File(...)`; `preview` = `shots[0]` (dataURL от `ThreeScene.capture`). `downloadPassport` и CTA зовут её.

- [ ] **Step 0:** `git -C D:/calculator/.worktrees/rate-catalog-subcategories switch -c offer-link origin/rate-catalog-subcategories`.
- [ ] **Step 1: Write the failing tests** (`calculator-markup.test.js`):
  - есть `<script src="/sayanmramor-site/js/offer-handoff.js"></script>` (до основного инлайн-скрипта);
  - в `#leadArea` нет `id="leadForm"`, `id="leadSuccess"`, `lead-payload.js` не подключён; `#resultCtaBtn` «Получить расчёт», под ним `p.lead-note` с текстом `Откроется заявка на расчёт, изделие уже будет в ней.` (черновик спеки говорил «на главной»; возврат теперь может быть на страницу направления - текст обобщён, показать владельцу), `#passportBtn` и `#resultShowroomLink` на месте;
  - исходник: обработчик `resultCtaBtn` зовёт `buildPassportFile()`, `OfferHandoff.blobs.put('passport'`, `OfferHandoff.putCalcPiece(localStorage`, `location.assign(OfferHandoff.returnUrl(sessionStorage, currentPassportQuery()))`; кнопка на время сборки `disabled` и «Готовим паспорт...»; ошибка паспорта не мешает переходу (`.catch` перед переходом).
  - Переписать старые проверки формы (строки ~193-231, ~341) под новый `#leadArea`; в `result-lead.test.js` убрать проверки формы в разметке, оставить проверки `LeadPayload` (модуль остаётся будущей точкой отправки, но страница его не грузит).
- [ ] **Step 2: Run** `node --test tests/calculator-markup.test.js tests/result-lead.test.js` - FAIL.
- [ ] **Step 3: Implement.** Запись для заявки: `{ kind: 'calc', query: currentPassportQuery(), product: view.title, stone: stone ? stone.name : '', stoneImage: stone && stone.image ? '/sayanmramor-calculator/data/' + stone.image : '', sizes: (view.specs.find(s => s.key === 'dimensions') || view.specs[0] || {}).value || '', price: resultTotalEl.textContent, priced: pricing.status === 'ok' }`. Удалить форму, `leadMode`, `applyLeadMode`, `showLeadErrors`, `readLeadInput`, `submitLead`-обвязку и их стили; `#ctaBtn` в сводке не трогать.
- [ ] **Step 4: Run** `node --test tests/*.test.js` - PASS (если падают тесты разметки на `\n` после смены ветки - проверить на `git archive HEAD`, см. Global Constraints).
- [ ] **Step 5: Commit**: `Result: «Получить расчёт» takes the piece and its passport into the site's request; the calculator's own form is gone (the owner, 2026-10-26)`.

### Task 7: проверка целиком в браузере и показ владельцу

- [ ] **Step 1:** `preview_start` `site-dev` (калькулятор с ветки `offer-link` - dev-сервер берёт `D:\calculator\.worktrees\rate-catalog-subcategories`).
- [ ] **Step 2: Сценарии** (ширина 1440 и 390; консоль без ошибок):
  1. Главная → «Кухня» → развилка «Вопрос 2 из 4» → «Собрать в калькуляторе» → калькулятор на столешнице → результат → «Получить расчёт» → главная `#offer`, карточка с камнем, размерами, ценой, «Вопрос 3 из 4» → имя → телефон → «Заявка собрана»: сводка с изделием, превью паспорта, «Скачать паспорт» скачивает PDF.
  2. Главная → «Готовые изделия» → «Посмотреть каталог» → «Запросить» у «Ракушки» → карточка «Ракушка · 37 000 ₽» → «Выбрать другое» → другое изделие заменило первое.
  3. Страница «Кухня» → заявка сразу на развилке → калькулятор → возврат на страницу «Кухня», не на главную.
  4. «Создать изделие» в шапке → калькулятор → «Получить расчёт» → главная с карточкой.
  5. Review Focus 5: развилка → калькулятор → «Назад» браузера → развилка с «✓ Кухня».
  6. Review Focus 4: изделие в заявке → «Изменить изделие» → «Ванная» → карточки нет.
  7. Хаммамы: три вопроса, без развилки.
  8. Review Focus 1: в консоли подменить `localStorage.setItem` на бросающий и повторить сценарий 1 - карточка с изделием и камнем без цены, «Скачать паспорт» ведёт в калькулятор.
- [ ] **Step 3:** снимки экрана развилки, карточки и последнего экрана (обе ширины); показать владельцу. Ничего не пушить: публикация - сайт и калькулятор вместе, только по команде владельца.
