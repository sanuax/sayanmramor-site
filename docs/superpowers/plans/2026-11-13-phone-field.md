# Поле телефона «Страна отдельно»: план работ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** в третьем вопросе заявки (`js/offer-form.js` → `mountSteps`) вместо простого поля телефона - кнопка страны слева (+7 по умолчанию) и поле номера справа, как концепт Б.

**Architecture:** новый модуль `js/phone-field.js` (UMD, как `offer-handoff.js`): данные стран и чистые функции разбора номера (тестируются в node) плюс `mount()` - разметка поля и список стран (проверяется в браузере). `offer-form.js` получает его так же, как `OfferHandoff`, и ставит поле в шаг 3; наружу форма по-прежнему отдаёт строку телефона, теперь в одном виде «+7 999 123 45 67». Стили - в `css/site.css` рядом с `.talk-input`.

**Tech Stack:** статический HTML/CSS/JS без сборки, `node --test`, `node scripts/stamp_assets.js`.

**Spec:** `docs/superpowers/specs/2026-11-13-phone-field-design.md`. Рабочий концепт, с которого переносится код: `.claude/concepts/phone-input/` (`phone-core.js`, `variants.js` → `split(doc, 'b')`, `concept.css`).

## Global Constraints

- По умолчанию Россия, «+7»; номер группами «999 123 45 67»; в заявку уходит «+7 999 123 45 67» (код, пробел, группы через пробел).
- «Часто выбирают»: Россия, Казахстан, Беларусь, Узбекистан, Армения, Кыргызстан, Таджикистан, Азербайджан, Грузия - в этом порядке; дальше «Все страны» по алфавиту (`localeCompare(…, 'ru')`).
- Подписи: заголовок листа «Код страны», поиск «Страна или код», ошибка «В номере не хватает N цифр.» (N с правильным окончанием: цифры / цифр).
- Флаги только там, где система рисует их в цвете (не Windows); иначе в кнопке только «+7 ▾».
- Без сторонних библиотек. `lead.php` не меняется. Старую форму `mount` (не пошаговую) не трогать.
- Тексты без длинного тире « — », только « - ».
- После любой правки в `css/` или `js/`: `node scripts/stamp_assets.js`.
- Коммит и публикация - только по слову владельца (правило проекта): шаги «Commit» ниже выполняются в конце, одним коммитом, когда владелец скажет «публикуй».

## Review Focus

1. Черновик, сохранённый до этой правки (свободный текст «8 (999) 123-45-67», «+375 29 …») при возврате на страницу разбирается в страну и номер - тест `parse: old drafts` (Task 1).
2. Автозаполнение iPhone / Chrome кладёт в поле номера «+79991234567» или «8 (999) 123-45-67» - страна и цифры верные - тест `parse: autofill` (Task 1) и проверка в браузере (Task 3).
3. Стирание за пробелом и правка в середине номера не сбивают курсор - тест `skipSeparators` на объекте-заглушке поля (Task 1), набор с клавиатуры в браузере (Task 3).
4. Заявка только с почтой (телефон пуст) проходит, как раньше - существующий тест `contactProblem('', 'name@mail.ru') === null` остаётся зелёным (Task 3).
5. Список стран на телефоне: клавиатура не открывается сама, лист закрывается по фону и крестику, фокус возвращается в номер - проверка в браузере на 375 px (Task 2).

---

### Task 1: данные стран и разбор номера (`js/phone-field.js`, без DOM)

**Files:**
- Create: `js/phone-field.js`
- Test: `tests/phone-field.test.js`

**Interfaces:**
- Produces (`module.exports` в node, `window.PhoneField` в браузере):
  - `COUNTRIES: Array<{ iso: string, name: string, code: string, lens: number[], groups: number[], example: string }>` - около 200 стран; 40 из концепта с точными `lens`/`groups`/`example`, остальные `lens: [6..12]`, `groups: [3, 3, 3, 3]`, `example: '123456789012'`.
  - `byIso: { [iso]: country }`, `POPULAR: country[]` (9, порядок из Global Constraints), `ALL: country[]` (по алфавиту).
  - `clean(country, digits: string) -> { national: string, dropped: 0 | 1 }`
  - `format(country, national: string) -> string`
  - `parseIntl(digits: string) -> { country, national } | null`
  - `parse(text: string) -> { country, national }` - «+…» через `parseIntl`; без «+» - Россия через `clean`; пусто - `{ country: RU, national: '' }`.
  - `sevenCountry(country, national) -> country`, `complete(country, national) -> boolean`
  - `problem(country, national) -> string` ('' если номер полный), `problemOf(text: string) -> string` (= `problem(parse(text))`, '' для пустого текста)
  - `display(country, national) -> string` ('' при пустом номере)
  - `digitsBefore(value, caret) -> number`, `caretAfter(value, n) -> number`, `skipSeparators(input, event) -> boolean`

- [ ] **Step 1: Write the failing tests** in `tests/phone-field.test.js`:

```js
const P = require('../js/phone-field.js');
const shown = t => { const r = P.parse(t); return P.display(r.country, r.national) + ' ' + r.country.iso; };

test('parse: what a Russian client types or pastes', () => {
  assert.equal(shown('89991234567'), '+7 999 123 45 67 RU');
  assert.equal(shown('79991234567'), '+7 999 123 45 67 RU');
  assert.equal(shown('9991234567'), '+7 999 123 45 67 RU');
  assert.equal(shown('8 (812) 234-56-78'), '+7 812 234 56 78 RU');   // a city code stays
  assert.equal(shown('8122345678'), '+7 812 234 56 78 RU');
});
test('parse: autofill and other countries', () => {
  assert.equal(shown('+79991234567'), '+7 999 123 45 67 RU');
  assert.equal(shown('+7 (999) 123-45-67'), '+7 999 123 45 67 RU');
  assert.equal(shown('+77011234567'), '+7 701 123 45 67 KZ');
  assert.equal(shown('+375 29 123-45-67'), '+375 29 123 45 67 BY');
  assert.equal(shown('+90 532 123 45 67'), '+90 532 123 45 67 TR');
  assert.equal(shown('+1 201 555 0123'), '+1 201 555 0123 US');
});
test('parse: old drafts come back whole', () => {
  ['8 (999) 123-45-67', '+7 999 123-45-67', '+375291234567'].forEach(t => assert.equal(P.problemOf(t), '', t));
});
test('a number does not grow past its country', () => {
  assert.equal(P.clean(P.byIso.RU, '999123456789').national, '9991234567');
});
test('problem: how many digits are missing, in Russian', () => {
  assert.equal(P.problemOf('+7 999 12'), 'В номере не хватает 5 цифр.');
  assert.equal(P.problemOf('+7 999 123 45 6'), 'В номере не хватает 1 цифры.');
  assert.equal(P.problemOf('+7 999 123 4'), 'В номере не хватает 3 цифр.');
  assert.equal(P.problemOf(''), '');
});
test('countries: popular first, codes prefix-free, one entry per code but +7', () => {
  assert.deepEqual(P.POPULAR.map(c => c.iso), ['RU', 'KZ', 'BY', 'UZ', 'AM', 'KG', 'TJ', 'AZ', 'GE']);
  const codes = P.COUNTRIES.map(c => c.code);
  assert.ok(P.COUNTRIES.length >= 190);
  assert.deepEqual(codes.filter(c => c === '7').length, 2);
  codes.forEach(a => codes.forEach(b => assert.ok(a === b || !b.startsWith(a), a + ' / ' + b)));
  assert.equal(new Set(P.COUNTRIES.map(c => c.iso)).size, P.COUNTRIES.length);
  P.COUNTRIES.forEach(c => assert.ok(!/—/.test(c.name), c.name));
});
test('skipSeparators: backspace right after a space deletes the digit before it', () => {
  const input = { value: '999 123', selectionStart: 4, selectionEnd: 4, setSelectionRange(a) { this.selectionStart = this.selectionEnd = a; } };
  const e = { inputType: 'deleteContentBackward', preventDefault() { this.prevented = true; } };
  assert.equal(P.skipSeparators(input, e), true);
  assert.equal(input.value, '99 123');
  assert.equal(input.selectionStart, 2);
  assert.ok(e.prevented);
});
```

- [ ] **Step 2: Run** `node --test tests/phone-field.test.js` - Expected: FAIL, `Cannot find module '../js/phone-field.js'`.

- [ ] **Step 3: Implement** `js/phone-field.js`: UMD обёртка как в `js/offer-handoff.js` (`module.exports` / `root.PhoneField`). Функции переносятся из концепта `phone-core.js` (`clean`, `format`, `parseIntl`, `sevenCountry`, `complete`, `problem`, `plural`, `display`, `digitsBefore`, `caretAfter`, `skipSeparators`), плюс новые `parse` и `problemOf`. Список стран: 40 строк концепта + остальные страны мира (ITU-коды, русские названия), коды без пересечений префиксов (+1 - одна строка «США и Канада»; Карибские +1xxx не добавлять). `flag` и `flagsSupported` тоже здесь (нужны `mount` в Task 2; в node `flagsSupported()` возвращает false).

- [ ] **Step 4: Run** `node --test tests/phone-field.test.js` - Expected: PASS.

### Task 2: поле и список стран (`PhoneField.mount`) + стили

**Files:**
- Modify: `js/phone-field.js` (добавить `picker` и `mount`)
- Modify: `css/site.css` - блок стилей после правил `.talk-input` (строки ~1532-1538), вне участка, который проверяет `tests/design-tokens.test.js` (тот смотрит только от `/* ---- Footer` до `/* ---- Политика`)
- Test: `tests/phone-field.test.js`, `tests/site.test.js`

**Interfaces:**
- Consumes: всё из Task 1.
- Produces: `mount(doc, { id: string }) -> { el: HTMLElement, input: HTMLInputElement, value(): string, set(text: string): void, problem(): string, markError(): void, onChange(cb: () => void): void }`.
  - `el` - `<div class="pf">` с `<button class="pf-country" aria-haspopup="dialog" aria-expanded>` и `<div class="pf-box">` (бледный образец `.pf-ghost`, `<input type="tel" id={id} autocomplete="tel" inputmode="tel" aria-label="Номер телефона">`, галочка `.pf-ok`). Классы `is-whole` (номер полный) и `is-error` (после `markError()`, снимается при следующем вводе).
  - `value()` = `display(country, national)`; `set(text)` = `parse(text)` → страна и номер; `problem()` = `problem(country, national)` или '' при пустом номере.
  - Список: как `picker()` концепта (плавающий на компьютере - `position: fixed` от кнопки, вверх при нехватке места; лист снизу при `(max-width: 640px)`, без автофокуса поиска; Esc, клик мимо, крестик; выбор возвращает фокус в номер).

- [ ] **Step 1: Write the failing test** (`tests/site.test.js` или `tests/phone-field.test.js`): `assert.equal(typeof P.mount, 'function')`; в `css/site.css` есть правила `.pf-country`, `.pf-box:focus-within`, `.pk.is-sheet`, `.pk.is-pop` и `@media (max-width: 560px)` с `--pf-h: 56px`.
- [ ] **Step 2: Run** `node --test tests/phone-field.test.js tests/site.test.js` - Expected: FAIL на новых проверках.
- [ ] **Step 3: Implement** `mount` из `variants.js` → `split(doc, 'b')` и `picker` из `phone-core.js`; CSS из `concept.css` (`.pf*`, `.pk*`) без правил варианта А и В и без `.pf-frame`/`.pf-out`. `node scripts/stamp_assets.js`.
- [ ] **Step 4: Run** те же тесты - Expected: PASS. Проверка поля концептом не нужна: всё видно на сайте в Task 3.

### Task 3: поле в заявке + исправление `viaKeys`

**Files:**
- Modify: `js/offer-form.js` - обёртка (строки 17-22), `phoneOk`/`contactProblem` (241-257), шаг 3 (518-541), `go()` (691-701), отправка (716-719), восстановление (767)
- Modify: 16 страниц с `data-offer-form` (`index.html`, `kamen.html`, `podborka.html`, 13 в `categories/`): `<script src="/sayanmramor-site/js/phone-field.js"></script>` между `offer-handoff.js` и `offer-form.js`
- Test: `tests/site.test.js` (строки ~794 и ~857), `tests/phone-field.test.js`

**Interfaces:**
- Consumes: `PhoneField.mount`, `PhoneField.problemOf`, `PhoneField.parse` (Task 1-2).
- Produces: `OfferForm.phoneOk(text)` = непустой и `problemOf(text) === ''`; `OfferForm.contactProblem(phone, email)` - та же подпись; сообщение для телефона = `problemOf(phone)`.

- [ ] **Step 1: Write the failing tests:**
  - в существующем тесте «three questions» (строка ~1080) добавить `assert.match(OfferForm.contactProblem('+7 999', '').message, /не хватает 7 цифр/)` и `assert.ok(OfferForm.phoneOk('+375 29 123 45 67'))`;
  - пины скриптов (строки ~794, ~857): `offer-handoff.js` → `phone-field.js` → `offer-form.js` на всех 16 страницах;
  - `viaKeys` объявлена в `mountSteps`: `assert.match(src, /let viaKeys = false;/)`.
- [ ] **Step 2: Run** `node --test tests/site.test.js` - Expected: FAIL на новых проверках.
- [ ] **Step 3: Implement:**
  - обёртка: `factory(require('./offer-handoff.js'), require('./phone-field.js'))` / `factory(root.OfferHandoff, root.PhoneField)`;
  - шаг 3: `const phoneField = PhoneField.mount(doc, { id: id('phone') }); const phone = phoneField.input;` - в `.talk-contacts` вместо старого `<input>` идёт `phoneField.el`; `phoneField.onChange` делает то, что делал `phone.addEventListener('input', …)` (снять подсказку, `state.draftPhone = phoneField.value()`, `persist()`);
  - отправка: при `problem.field === 'phone'` вызвать `phoneField.markError()`; `state.phone = phoneField.value()`;
  - восстановление: `phoneField.set(state.phone || state.draftPhone || '')`;
  - `contactProblem`: `phoneValue` разбирается через `PhoneField.problemOf`;
  - `viaKeys`: `let viaKeys = false;` в `mountSteps`, `keydown` на документе (Tab, Enter, пробел, стрелки) ставит true, `pointerdown` - false;
  - скрипт на 16 страницах; `node scripts/stamp_assets.js`.
- [ ] **Step 4: Run** `node --test tests/*.test.js` - Expected: всё зелёное, кроме известного старого падения «the site and the configurator carry the same file» (`price-filter.js`, не наше).
- [ ] **Step 5: Проверка в браузере** (`site-dev`, `categories/lestnitsy.html#offer`, шаг 3), на 1440 и 375 px:
  - набор «89991234567» → «999 123 45 67», галочка; стирание за пробелом; правка в середине;
  - список стран: компьютер - под кнопкой, Esc закрывает; телефон - лист снизу, клавиатура не открывается, крестик и фон закрывают;
  - отправка с «+7 999 12» → «В номере не хватает 5 цифр.», поле подсвечено; с полной формой - экран «Заявка отправлена» и «+7 999 123 45 67» в итоге (письмо не отправлять: `fetch` к `lead.php` перехватить в консоли);
  - уход в калькулятор и назад (или перезагрузка) - номер и страна на месте;
  - в консоли нет ошибок (в том числе `viaKeys`).
- [ ] **Step 6: Commit** (по слову владельца, вместе с описанием и планом):

```bash
git add js/phone-field.js js/offer-form.js css/site.css tests/phone-field.test.js tests/site.test.js index.html kamen.html podborka.html categories/*.html docs/superpowers/specs/2026-11-13-phone-field-design.md docs/superpowers/plans/2026-11-13-phone-field.md
git commit -m "Request form: the phone field with the country apart (+7 by default) ... (the owner, 2026-11-13)"
```
