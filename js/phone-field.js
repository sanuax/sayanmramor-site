// js/phone-field.js
//
// The phone field of the request form (docs/superpowers/specs/2026-11-13-phone-field-design.md):
// the country on its own button on the left (+7 from the start), the number on the right, typed
// as «999 123 45 67». This file holds the countries, the reading of what a client types, pastes
// or has filled in by the browser, and (below) the field itself and its country list.
//
// What a Russian client expects:
//  - «8 999 …» and «7 999 …» typed out of habit: the 8 / 7 goes (no Russian area code starts with
//    79 or 89); so does the leading 7 / 8 of an 11-digit number that is pasted.
//  - «+375 29 …» pasted or filled in by the browser sets the country by itself; +7 with 6xx / 7xx
//    is Kazakhstan.
//  - Backspace right after a space deletes the digit before it (it never sticks on the space).
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.PhoneField = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // The countries the owner's clients are likely to dial from: the exact length of a number and
  // how it is grouped (the last group takes the rest), and an example for the pale hint.
  // iso, name, code, lengths, groups, example
  const KNOWN = [
    ['RU', 'Россия', '7', [10], [3, 3, 2, 2], '9991234567'],
    ['KZ', 'Казахстан', '7', [10], [3, 3, 2, 2], '7011234567'],
    ['BY', 'Беларусь', '375', [9], [2, 3, 2, 2], '291234567'],
    ['UZ', 'Узбекистан', '998', [9], [2, 3, 2, 2], '901234567'],
    ['AM', 'Армения', '374', [8], [2, 3, 3], '77123456'],
    ['KG', 'Кыргызстан', '996', [9], [3, 3, 3], '555123456'],
    ['TJ', 'Таджикистан', '992', [9], [2, 3, 2, 2], '931234567'],
    ['AZ', 'Азербайджан', '994', [9], [2, 3, 2, 2], '501234567'],
    ['GE', 'Грузия', '995', [9], [3, 2, 2, 2], '555123456'],
    ['MD', 'Молдова', '373', [8], [3, 2, 3], '69123456'],
    ['TM', 'Туркменистан', '993', [8], [2, 2, 2, 2], '65123456'],
    ['UA', 'Украина', '380', [9], [2, 3, 2, 2], '501234567'],
    ['AE', 'ОАЭ', '971', [9], [2, 3, 4], '501234567'],
    ['TR', 'Турция', '90', [10], [3, 3, 2, 2], '5321234567'],
    ['CN', 'Китай', '86', [11], [3, 4, 4], '13123456789'],
    ['IN', 'Индия', '91', [10], [5, 5], '9812345678'],
    ['TH', 'Таиланд', '66', [9], [2, 3, 4], '812345678'],
    ['VN', 'Вьетнам', '84', [9], [2, 3, 2, 2], '912345678'],
    ['IL', 'Израиль', '972', [9], [2, 3, 4], '501234567'],
    ['CY', 'Кипр', '357', [8], [2, 3, 3], '96123456'],
    ['SA', 'Саудовская Аравия', '966', [9], [2, 3, 4], '501234567'],
    ['QA', 'Катар', '974', [8], [4, 4], '33123456'],
    ['EG', 'Египет', '20', [10], [2, 4, 4], '1012345678'],
    ['MN', 'Монголия', '976', [8], [2, 2, 2, 2], '88123456'],
    ['RS', 'Сербия', '381', [8, 9], [2, 3, 4], '601234567'],
    ['ME', 'Черногория', '382', [8], [2, 3, 3], '67123456'],
    ['DE', 'Германия', '49', [10, 11], [3, 4, 4], '15123456789'],
    ['FR', 'Франция', '33', [9], [1, 2, 2, 2, 2], '612345678'],
    ['IT', 'Италия', '39', [9, 10], [3, 3, 4], '3123456789'],
    ['ES', 'Испания', '34', [9], [3, 3, 3], '612345678'],
    ['GB', 'Великобритания', '44', [10], [4, 6], '7400123456'],
    ['PL', 'Польша', '48', [9], [3, 3, 3], '512345678'],
    ['CZ', 'Чехия', '420', [9], [3, 3, 3], '601123456'],
    ['FI', 'Финляндия', '358', [9, 10], [2, 3, 4], '401234567'],
    ['EE', 'Эстония', '372', [7, 8], [4, 4], '51234567'],
    ['LV', 'Латвия', '371', [8], [2, 3, 3], '21234567'],
    ['LT', 'Литва', '370', [8], [3, 2, 3], '61234567'],
    ['US', 'США и Канада', '1', [10], [3, 3, 4], '2015550123'],
    ['KR', 'Южная Корея', '82', [9, 10], [2, 4, 4], '1012345678'],
    ['JP', 'Япония', '81', [10], [2, 4, 4], '9012345678'],
  ];
  // The rest of the world: any length from 6 to 12 digits, in threes (iso, name, code; no
  // country with a code that begins another's: the Caribbean +1 islands are in «США и Канада»).
  const OTHER = ('AF Афганистан 93|AL Албания 355|DZ Алжир 213|AD Андорра 376|AO Ангола 244|AR Аргентина 54|AU Австралия 61|AT Австрия 43|' +
    'BH Бахрейн 973|BD Бангладеш 880|BE Бельгия 32|BJ Бенин 229|BT Бутан 975|BO Боливия 591|BA Босния и Герцеговина 387|BW Ботсвана 267|' +
    'BR Бразилия 55|BN Бруней 673|BG Болгария 359|BF Буркина-Фасо 226|BI Бурунди 257|BZ Белиз 501|KH Камбоджа 855|CM Камерун 237|' +
    'CV Кабо-Верде 238|CF Центральноафриканская Республика 236|TD Чад 235|CL Чили 56|CO Колумбия 57|KM Коморы 269|CG Республика Конго 242|' +
    'CD ДР Конго 243|CR Коста-Рика 506|HR Хорватия 385|CU Куба 53|DK Дания 45|DJ Джибути 253|EC Эквадор 593|SV Сальвадор 503|' +
    'GQ Экваториальная Гвинея 240|ER Эритрея 291|ET Эфиопия 251|FJ Фиджи 679|FO Фарерские острова 298|GA Габон 241|GM Гамбия 220|' +
    'GH Гана 233|GR Греция 30|GL Гренландия 299|GT Гватемала 502|GN Гвинея 224|GW Гвинея-Бисау 245|GY Гайана 592|HT Гаити 509|' +
    'HN Гондурас 504|HK Гонконг 852|HU Венгрия 36|IS Исландия 354|ID Индонезия 62|IR Иран 98|IQ Ирак 964|IE Ирландия 353|JO Иордания 962|' +
    'KE Кения 254|KW Кувейт 965|LA Лаос 856|LB Ливан 961|LS Лесото 266|LR Либерия 231|LY Ливия 218|LI Лихтенштейн 423|LU Люксембург 352|' +
    'MO Макао 853|MK Северная Македония 389|MG Мадагаскар 261|MW Малави 265|MY Малайзия 60|MV Мальдивы 960|ML Мали 223|MT Мальта 356|' +
    'MR Мавритания 222|MU Маврикий 230|MX Мексика 52|MC Монако 377|MA Марокко 212|MZ Мозамбик 258|MM Мьянма 95|NA Намибия 264|NP Непал 977|' +
    'NL Нидерланды 31|NZ Новая Зеландия 64|NI Никарагуа 505|NE Нигер 227|NG Нигерия 234|KP КНДР 850|NO Норвегия 47|OM Оман 968|' +
    'PK Пакистан 92|PS Палестина 970|PA Панама 507|PG Папуа - Новая Гвинея 675|PY Парагвай 595|PE Перу 51|PH Филиппины 63|PT Португалия 351|' +
    'RO Румыния 40|RW Руанда 250|SM Сан-Марино 378|ST Сан-Томе и Принсипи 239|SN Сенегал 221|SC Сейшельские острова 248|SL Сьерра-Леоне 232|' +
    'SG Сингапур 65|SK Словакия 421|SI Словения 386|SO Сомали 252|ZA ЮАР 27|SS Южный Судан 211|LK Шри-Ланка 94|SD Судан 249|SR Суринам 597|' +
    'SZ Эсватини 268|SE Швеция 46|CH Швейцария 41|SY Сирия 963|TW Тайвань 886|TZ Танзания 255|TL Восточный Тимор 670|TG Того 228|TO Тонга 676|' +
    'TN Тунис 216|UG Уганда 256|UY Уругвай 598|VU Вануату 678|VE Венесуэла 58|YE Йемен 967|ZM Замбия 260|ZW Зимбабве 263|XK Косово 383|' +
    'GI Гибралтар 350|FK Фолклендские острова 500|AW Аруба 297|CW Кюрасао 599|GF Французская Гвиана 594|GP Гваделупа 590|MQ Мартиника 596|' +
    'RE Реюньон 262|PM Сен-Пьер и Микелон 508|NC Новая Каледония 687|PF Французская Полинезия 689|WS Самоа 685|KI Кирибати 686|NR Науру 674|' +
    'PW Палау 680|FM Микронезия 691|MH Маршалловы Острова 692|SB Соломоновы Острова 677|TV Тувалу 688|CK Острова Кука 682|NU Ниуэ 683|SH Остров Святой Елены 290')
    .split('|').map(s => { const w = s.split(' '); return [w[0], w.slice(1, -1).join(' '), w[w.length - 1], [6, 7, 8, 9, 10, 11, 12], [3, 3, 3, 3], '123456789']; });

  const COUNTRIES = KNOWN.concat(OTHER).map(([iso, name, code, lens, groups, example]) => ({ iso, name, code, lens, groups, example }));
  const byIso = Object.fromEntries(COUNTRIES.map(c => [c.iso, c]));
  const POPULAR = ['RU', 'KZ', 'BY', 'UZ', 'AM', 'KG', 'TJ', 'AZ', 'GE'].map(i => byIso[i]);
  const ALL = COUNTRIES.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const CODES = [...new Set(COUNTRIES.map(c => c.code))].sort((a, b) => b.length - a.length);

  // The national digits for a country: the habit «8 999…» / «7 999…» and 11-digit Russian numbers
  // lose their leading 8 / 7; nothing past the longest number of the country.
  function clean(country, digits) {
    let d = String(digits || ''), dropped = 0;
    if (country.code === '7') {
      // «8 9xx» / «7 9xx»; in Kazakhstan also «8 6xx» / «8 7xx» (Russian area codes 86x and 87x stay as they are).
      const habit = d.length >= 2 && ((/[78]/.test(d[0]) && d[1] === '9') || (d[0] === '8' && country.iso === 'KZ' && /[67]/.test(d[1])));
      if (habit) { d = d.slice(1); dropped = 1; }
      else if (d.length === 11 && /[78]/.test(d[0])) { d = d.slice(1); dropped = 1; }
    }
    return { national: d.slice(0, Math.max(...country.lens)), dropped };
  }
  function format(country, national) {
    const g = country.groups; let out = '', i = 0;
    for (let k = 0; i < national.length; k++) {
      const n = k < g.length ? g[k] : national.length;
      out += (out ? ' ' : '') + national.slice(i, i + n); i += n;
    }
    return out;
  }
  // «375291234567» -> Belarus, «291234567». Country codes are prefix-free, so the first match is the one.
  function parseIntl(digits) {
    for (const code of CODES) {
      if (digits.startsWith(code)) {
        const national = digits.slice(code.length);
        let country = COUNTRIES.find(c => c.code === code);
        if (code === '7') country = /^[67]/.test(national) ? byIso.KZ : byIso.RU;
        return { country, national };
      }
    }
    return null;
  }
  // +7 numbers: Russia or Kazakhstan by the first digit.
  function sevenCountry(current, national) {
    if (current.code !== '7' || !national) return current;
    return /^[67]/.test(national) ? byIso.KZ : byIso.RU;
  }
  // What a field holds, a draft kept from before, or what the browser filled in -> the country and the number.
  function parse(text) {
    const raw = String(text || ''), digits = raw.replace(/\D/g, '');
    if (!digits) return { country: byIso.RU, national: '' };
    if (raw.includes('+')) {
      const p = parseIntl(digits);
      if (p) return { country: p.country, national: p.national.slice(0, Math.max(...p.country.lens)) };
    }
    const r = clean(byIso.RU, digits);
    return { country: sevenCountry(byIso.RU, r.national), national: r.national };
  }
  // What the field makes of its text after an edit (inputType: the input event's, '' when unknown):
  // { country, national, caretDigits (the digits before the caret, in the number), pending }.
  //  - A «+» starts an international number: from the «+» on it is read as a whole, whatever stood before it (a
  //    paste over «12»). While the digits are not yet a country's code («+», «+3», «+37») they stay as typed (pending).
  //  - Typed digits belong to the country on the button. A whole number that is pasted or filled in by the browser
  //    and is longer than the country allows is read the Russian way («8 (999) …» into a +375 field follows the number).
  function reading(country, raw, caret, inputType) {
    const plus = raw.indexOf('+');
    if (plus >= 0) {
      const digits = raw.slice(plus).replace(/\D/g, '');
      const p = digits ? parseIntl(digits) : null;
      if (p) {
        const national = p.national.slice(0, Math.max(...p.country.lens));
        return { country: p.country, national, caretDigits: national.length, pending: '' };
      }
      return { country, national: '', caretDigits: 0, pending: '+' + digits.slice(0, 3) };
    }
    const digits = raw.replace(/\D/g, '');
    const typing = inputType === 'insertText' || String(inputType || '').startsWith('delete');
    if (!typing && country.code !== '7' && digits.length > Math.max(...country.lens)) {
      const r = clean(byIso.RU, digits);
      return { country: sevenCountry(byIso.RU, r.national), national: r.national, caretDigits: r.national.length, pending: '' };
    }
    const r = clean(country, digits);
    const caretDigits = Math.max(0, Math.min(digitsBefore(raw, caret) - r.dropped, r.national.length));
    return { country: sevenCountry(country, r.national), national: r.national, caretDigits, pending: '' };
  }
  function complete(country, national) { return !!country && country.lens.includes(national.length); }
  function plural(n, one, few, many) {
    const t = n % 10, h = n % 100;
    return t === 1 && h !== 11 ? one : t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
  }
  // '' when the number is whole, else what to tell the client.
  function problem(country, national) {
    if (!national) return 'Укажите номер телефона.';
    if (complete(country, national)) return '';
    const longer = country.lens.filter(l => l > national.length);
    if (!longer.length) return 'Проверьте номер.';
    const left = Math.min(...longer) - national.length;
    return 'В номере не хватает ' + left + ' ' + plural(left, 'цифры', 'цифр', 'цифр') + '.';
  }
  // The same for a line of text: '' for an empty line (nothing was typed), else what is wrong with it.
  function problemOf(text) {
    if (!String(text || '').trim()) return '';
    const r = parse(text);
    return problem(r.country, r.national);
  }
  function display(country, national) { return country && national ? '+' + country.code + ' ' + format(country, national) : ''; }

  // Digits before the caret <-> caret position in a formatted value.
  function digitsBefore(value, caret) { return value.slice(0, caret).replace(/\D/g, '').length; }
  function caretAfter(value, n) {
    if (n <= 0) { const m = value.search(/\d/); return m < 0 ? value.length : m; }
    let seen = 0;
    for (let i = 0; i < value.length; i++) if (/\d/.test(value[i]) && ++seen === n) return i + 1;
    return value.length;
  }
  // Backspace / Delete right next to a space: the digit beyond it goes instead, so the caret never sticks.
  function skipSeparators(input, e) {
    if (input.selectionStart !== input.selectionEnd) return false;
    const v = input.value, at = input.selectionStart;
    if (e.inputType === 'deleteContentBackward' && at > 0 && /\D/.test(v[at - 1])) {
      let i = at - 1; while (i > 0 && /\D/.test(v[i - 1])) i--;
      if (i > 0) { e.preventDefault(); input.value = v.slice(0, i - 1) + v.slice(i); input.setSelectionRange(i - 1, i - 1); return true; }
    }
    if (e.inputType === 'deleteContentForward' && at < v.length && /\D/.test(v[at])) {
      let i = at; while (i < v.length && /\D/.test(v[i])) i++;
      if (i < v.length) { e.preventDefault(); input.value = v.slice(0, i) + v.slice(i + 1); input.setSelectionRange(at, at); return true; }
    }
    return false;
  }

  // The flag of a country as emoji. Windows draws these as two letters («RU»): flags are shown only
  // where the system draws them in colour.
  function flag(iso) { return String.fromCodePoint(...[...iso].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65)); }
  let flagsOk = null;
  function flagsSupported() {
    if (flagsOk !== null) return flagsOk;
    flagsOk = false;
    if (typeof document === 'undefined') return flagsOk;
    try {
      const c = document.createElement('canvas'); c.width = c.height = 20;
      const x = c.getContext('2d'); x.textBaseline = 'top'; x.font = '18px sans-serif'; x.fillText(flag('RU'), 0, 0);
      const d = x.getImageData(0, 0, 20, 20).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0 && (Math.abs(d[i] - d[i + 2]) > 60 || Math.abs(d[i] - d[i + 1]) > 60)) { flagsOk = true; break; }
      }
    } catch (e) { flagsOk = false; }
    return flagsOk;
  }

  // ---- The country list: a floating list under the field on a computer, a sheet from below on a phone.
  const norm = s => s.toLowerCase().replace(/ё/g, 'е');
  function picker(doc, { anchor, host, current, onPick, onClose }) {
    const win = doc.defaultView;
    const phone = win.matchMedia('(max-width: 640px)').matches;
    const showFlags = flagsSupported();
    const veil = doc.createElement('div'); veil.className = 'pk-veil';
    const box = doc.createElement('div'); box.className = 'pk ' + (phone ? 'is-sheet' : 'is-pop');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Код страны');
    box.innerHTML = (phone ? '<div class="pk-head"><span class="pk-grip"></span><p class="pk-title">Код страны</p><button type="button" class="pk-x" aria-label="Закрыть">✕</button></div>' : '') +
      '<div class="pk-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6"/><path d="M13.5 13.5 18 18"/></svg>' +
      '<input type="search" placeholder="Страна или код" aria-label="Страна или код" autocomplete="off" enterkeyhint="done"></div>' +
      '<div class="pk-list" role="listbox" aria-label="Страны"></div>';
    const list = box.querySelector('.pk-list'), search = box.querySelector('input');
    const row = c => {
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'pk-row'; b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(c === current));
      b.innerHTML = (showFlags ? '<span class="pk-flag" aria-hidden="true">' + flag(c.iso) + '</span>' : '') +
        '<span class="pk-name">' + c.name + '</span><span class="pk-code">+' + c.code + '</span>' +
        (c === current ? '<svg class="pk-tick" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5"/></svg>' : '');
      b.addEventListener('click', () => { close(); onPick(c); });
      return b;
    };
    const label = t => { const p = doc.createElement('p'); p.className = 'pk-label'; p.textContent = t; return p; };
    function render(q) {
      list.textContent = '';
      const query = norm(q.trim()), digits = query.replace(/\D/g, '');
      if (!query) { list.append(label('Часто выбирают'), ...POPULAR.map(row), label('Все страны'), ...ALL.map(row)); return; }
      const byCode = /^\+?\d+$/.test(query);
      const hits = ALL.filter(c => byCode ? c.code.startsWith(digits) : norm(c.name).includes(query));
      if (!hits.length) {
        const p = doc.createElement('p'); p.className = 'pk-empty';
        p.textContent = 'Такой страны нет в списке. Можно ввести номер с кодом страны прямо в поле.';
        list.append(p); return;
      }
      hits.sort((a, b) => (norm(a.name).startsWith(query) ? 0 : 1) - (norm(b.name).startsWith(query) ? 0 : 1));
      list.append(...hits.map(row));
    }
    render('');
    search.addEventListener('input', () => render(search.value));
    search.addEventListener('keydown', e => {
      const rows = [...list.querySelectorAll('.pk-row')];
      if (e.key === 'ArrowDown' && rows.length) { e.preventDefault(); rows[0].focus(); }
      if (e.key === 'Enter' && rows.length) { e.preventDefault(); rows[0].click(); }
    });
    list.addEventListener('keydown', e => {
      const rows = [...list.querySelectorAll('.pk-row')], i = rows.indexOf(doc.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (rows[i + 1] || rows[i]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) search.focus(); else rows[i - 1].focus(); }
    });
    // On a computer the list floats over the page (the form's card clips its content): under the
    // field, or over it when there is not room enough below.
    function place() {
      const r = host.getBoundingClientRect(), below = win.innerHeight - r.bottom - 16, above = r.top - 16;
      const up = below < 300 && above > below;
      box.style.left = Math.max(8, r.left) + 'px';
      box.style.width = Math.min(400, r.width) + 'px';
      box.style.maxHeight = Math.min(380, up ? above : below) + 'px';
      box.style.top = up ? '' : (r.bottom + 8) + 'px';
      box.style.bottom = up ? (win.innerHeight - r.top + 8) + 'px' : '';
      box.classList.toggle('is-up', up);
    }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); anchor.focus(); } }
    function onDown(e) { if (!box.contains(e.target) && !anchor.contains(e.target)) close(); }
    let closed = false;
    function close() {
      if (closed) return; closed = true;
      doc.removeEventListener('keydown', onKey, true); doc.removeEventListener('pointerdown', onDown, true);
      win.removeEventListener('resize', place); win.removeEventListener('scroll', place, true);
      box.classList.add('is-out'); veil.classList.add('is-out');
      anchor.setAttribute('aria-expanded', 'false');
      setTimeout(() => { box.remove(); veil.remove(); }, 180);
      if (onClose) onClose();
    }
    doc.body.append(...(phone ? [veil, box] : [box]));
    if (phone) {
      veil.addEventListener('click', close);
      box.querySelector('.pk-x').addEventListener('click', close);
    } else {
      place(); win.addEventListener('resize', place); win.addEventListener('scroll', place, true);
    }
    doc.addEventListener('keydown', onKey, true); doc.addEventListener('pointerdown', onDown, true);
    anchor.setAttribute('aria-expanded', 'true');
    const sel = list.querySelector('[aria-selected="true"]');
    if (sel && !phone) sel.scrollIntoView({ block: 'center' });
    // On a phone the keyboard would cover half the list: the search gets the focus on a computer only.
    if (!phone) search.focus({ preventScroll: true });
    return { close };
  }

  // ---- The field: [ +7 ▾ ] [ 999 123 45 67 ✓ ]
  const CARET = '<svg class="phf-caret" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5"/></svg>';
  const TICK = '<svg class="phf-ok" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5 8.5 14.5 15.5 6"/></svg>';
  // mount(doc, { id }) -> { el, input, value(), set(text), problem(), markError(), onChange(cb) }
  // value() is what goes into the request: «+7 999 123 45 67» ('' while no number is typed).
  function mount(doc, { id }) {
    const t = doc.createElement('template');
    t.innerHTML = '<div class="phf"><div class="phf-row"><button type="button" class="phf-country" aria-haspopup="dialog" aria-expanded="false"></button>' +
      '<div class="phf-box"><div class="phf-num"><span class="phf-ghost" aria-hidden="true"><span class="phf-ghost-typed"></span><span class="phf-ghost-rest"></span></span>' +
      '<input type="tel" class="phf-input" inputmode="tel" autocomplete="tel" aria-label="Номер телефона"></div>' + TICK + '</div></div></div>';
    const el = t.content.firstChild;
    const button = el.querySelector('.phf-country'), input = el.querySelector('input');
    const typed = el.querySelector('.phf-ghost-typed'), rest = el.querySelector('.phf-ghost-rest');
    input.id = id;
    const flags = flagsSupported();
    const listeners = [];
    let country = byIso.RU, national = '', open = null;

    function paintButton() {
      button.innerHTML = (flags ? '<span class="phf-flag" aria-hidden="true">' + flag(country.iso) + '</span>' : '') + '+' + country.code + CARET;
      button.setAttribute('aria-label', 'Код страны: ' + country.name + ', +' + country.code + '. Выбрать другую страну');
      // A three-digit code or a long number would not fit the narrow answer column: the field turns compact.
      el.classList.toggle('is-compact', country.code.length >= 3 || Math.max(...country.lens) >= 11);
    }
    function paint(caretDigits, notify) {
      const v = format(country, national);
      input.value = v;
      if (caretDigits != null && doc.activeElement === input) { const at = caretAfter(v, caretDigits); input.setSelectionRange(at, at); }
      typed.textContent = v;
      rest.textContent = format(country, national + country.example.slice(national.length)).slice(v.length);
      el.classList.toggle('is-whole', complete(country, national));
      el.classList.remove('is-error');
      if (notify) listeners.forEach(cb => cb());
    }
    function setCountry(c) { country = c; paintButton(); }
    // What was typed, pasted or filled in by the browser (see reading()).
    function take(inputType) {
      const raw = input.value, caret = input.selectionStart == null ? raw.length : input.selectionStart;
      const r = reading(country, raw, caret, inputType);
      if (r.country !== country) setCountry(r.country);
      national = r.national;
      if (r.pending) {
        // «+», «+3», «+37»: a code typed by hand stays in the field until it is a country's.
        input.value = r.pending; typed.textContent = ''; rest.textContent = '';
        el.classList.remove('is-whole', 'is-error');
        listeners.forEach(cb => cb());
        return;
      }
      paint(r.caretDigits, true);
    }
    input.addEventListener('beforeinput', e => { if (skipSeparators(input, e)) take(e.inputType); });
    input.addEventListener('input', e => take(e.inputType));
    button.addEventListener('click', () => {
      if (open) { open.close(); return; }
      open = picker(doc, {
        anchor: button, host: el, current: country,
        onPick: c => { setCountry(c); national = clean(c, national).national; paint(null, true); input.focus(); },
        onClose: () => { open = null; },
      });
    });
    paintButton(); paint();
    return {
      el, input,
      value: () => display(country, national),
      set(text) { const r = parse(text); country = r.country; national = r.national; paintButton(); paint(); },
      problem: () => (national ? problem(country, national) : ''),
      markError() { el.classList.add('is-error'); },
      onChange(cb) { listeners.push(cb); },
    };
  }

  return {
    COUNTRIES, byIso, POPULAR, ALL,
    clean, format, parseIntl, parse, sevenCountry, complete, problem, problemOf, display,
    reading, digitsBefore, caretAfter, skipSeparators, flag, flagsSupported, picker, mount,
  };
});
