// js/offer-form.js
//
// «Получить расчёт по вашему проекту» -- the request block that closes the
// home page and every direction page. Each page carries the same static band
// (its heading is plain HTML); this module renders the form into its
// <div data-offer-form> (data-preselect="<direction key>" picks the page's own
// direction). The directions are the SITE's -- not the configurator's product
// types. There is no backend yet: a valid submit says so and gives the phone
// and e-mail instead of pretending to send anything.
//
// The band opens in place: the heading becomes the button (an arrow at the end
// of its row, like a line of the list of directions); a click unfolds the form
// under it -- the same place, no dialog -- and puts the focus in its first
// field. The fields are numbered rows, in the order they are filled in.
// A band marked data-offer-open (the home page's closing request) is not
// folded: the form stands open under its heading.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./offer-handoff.js'));
  } else {
    root.OfferForm = factory(root.OfferHandoff);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (Handoff) {

  // Every direction of the site, in the order of the header menu.
  const DIRECTIONS = [
    { key: 'lestnitsy', label: 'Лестницы' },
    { key: 'panno', label: 'Панно' },
    { key: 'podokonniki', label: 'Подоконники' },
    { key: 'poly', label: 'Полы' },
    { key: 'steny', label: 'Стены' },
    { key: 'fasady', label: 'Фасады' },
    { key: 'vannaya', label: 'Ванная' },
    { key: 'kuhnya', label: 'Кухня' },
    { key: 'stupeni', label: 'Ступени' },
    { key: 'kaminy', label: 'Камины' },
    { key: 'spa-zony', label: 'Спа зоны' },
    { key: 'hammamy', label: 'Хаммамы' },
    { key: 'basseyny', label: 'Бассейны' },
    { key: 'gotovye-izdeliya', label: 'Готовые изделия' },
  ];

  const PHONE = '+7 (495) 215-51-45';
  const EMAIL = 'sayan-mramor@yandex.ru';
  const NOT_SENT = 'Заявки с сайта пока не отправляются. Позвоните нам: ' + PHONE +
    ' или напишите на ' + EMAIL + ' - файл с техническим заданием можно приложить к письму.';
  const NO_FILE = 'Файл не выбран';
  // The fields, in the order they are filled in (and numbered on the page).
  const FIELDS = ['Направление', 'Имя', 'Телефон', 'Техническое задание'];

  const SVG_NS = 'http://www.w3.org/2000/svg';
  // Two small line icons, drawn in currentColor: a paper clip, and the site's
  // one arrow (the same drawing as --arrow in css/site.css: 16 x 10, 2 px, square ends).
  const ICONS = {
    clip: { viewBox: '0 0 24 24', d: 'M15.5 6.5 8.2 13.8a2 2 0 0 0 2.8 2.8l7.4-7.4a4 4 0 0 0-5.7-5.7l-7.6 7.6a6 6 0 0 0 8.5 8.5L20 13' },
    arrow: { viewBox: '0 0 16 10', d: 'M1 5h12.5M10 1.5L13.5 5 10 8.5' },
  };

  let formCount = 0;

  function el(doc, tag, props, children) {
    const node = doc.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'className' || k === 'textContent' || k === 'htmlFor') node[k] = v;
      else node.setAttribute(k, v);
    });
    (children || []).forEach(c => node.appendChild(c));
    return node;
  }

  function icon(doc, name) {
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', ICONS[name].viewBox);
    svg.setAttribute('class', 'icon-' + name);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICONS[name].d);
    svg.appendChild(path);
    return svg;
  }

  function field(doc, id, labelText, control) {
    return el(doc, 'div', { className: 'offer-field' }, [
      el(doc, 'label', { className: 'offer-label', htmlFor: id, textContent: labelText }), control,
    ]);
  }

  function mount(container) {
    const doc = container.ownerDocument;
    const n = ++formCount;
    const id = name => 'offer-' + n + '-' + name;
    const preselect = container.getAttribute('data-preselect') || '';

    const select = el(doc, 'select', { id: id('direction'), name: 'direction', className: 'offer-input offer-select' },
      [el(doc, 'option', { value: '', textContent: 'Без направления' })].concat(DIRECTIONS.map(d => {
        const o = el(doc, 'option', { value: d.key, textContent: d.label });
        if (d.key === preselect) o.setAttribute('selected', '');
        return o;
      })));

    // The file control: the native input stays (focusable, visually hidden);
    // its label is the visible row -- clip, prompt, and the chosen file's name.
    const file = el(doc, 'input', { type: 'file', id: id('file'), name: 'file', className: 'offer-file-input' });
    const fileName = el(doc, 'span', { className: 'offer-file-name', textContent: NO_FILE });
    file.addEventListener('change', () => {
      fileName.textContent = file.files && file.files.length ? file.files[0].name : NO_FILE;
    });
    const fileRow = el(doc, 'div', { className: 'offer-field offer-field-file' }, [
      file,
      el(doc, 'span', { className: 'offer-label', textContent: FIELDS[3] }),
      el(doc, 'label', { className: 'offer-file', htmlFor: id('file') }, [
        el(doc, 'span', { className: 'offer-file-icon' }, [icon(doc, 'clip')]),
        el(doc, 'span', { className: 'offer-file-text' }, [
          el(doc, 'span', { className: 'offer-file-title', textContent: 'Прикрепить файл' }),
          fileName,
        ]),
      ]),
    ]);

    const consent = el(doc, 'input', { type: 'checkbox', id: id('consent'), name: 'consent', required: '' });
    const status = el(doc, 'p', { className: 'offer-status', role: 'status' });

    const form = el(doc, 'form', { className: 'offer-form', novalidate: '' }, [
      field(doc, id('direction'), FIELDS[0], select),
      field(doc, id('name'), FIELDS[1], el(doc, 'input', { type: 'text', id: id('name'), name: 'name', className: 'offer-input', autocomplete: 'name', placeholder: 'Ваше имя' })),
      field(doc, id('phone'), FIELDS[2], el(doc, 'input', { type: 'tel', id: id('phone'), name: 'phone', className: 'offer-input', autocomplete: 'tel', inputmode: 'tel', placeholder: '+7 (___) ___-__-__', required: '' })),
      fileRow,
      el(doc, 'div', { className: 'offer-consent' }, [
        consent,
        el(doc, 'label', { htmlFor: id('consent') }, [
          doc.createTextNode('Даю своё согласие на обработку моих персональных данных ('),
          el(doc, 'a', { href: '/sayanmramor-site/privacy.html', textContent: 'политика конфиденциальности' }),
          doc.createTextNode(')'),
        ]),
      ]),
      el(doc, 'button', { type: 'submit', className: 'btn btn-primary offer-submit' }, [
        el(doc, 'span', { textContent: 'Получить расчёт' }), icon(doc, 'arrow'),
      ]),
      status,
    ]);

    form.addEventListener('submit', e => {
      e.preventDefault();
      const invalid = [...form.elements].find(c => c.willValidate && !c.checkValidity());
      if (invalid) {
        status.textContent = invalid.type === 'checkbox'
          ? 'Отметьте согласие на обработку персональных данных.'
          : 'Укажите телефон, чтобы мы могли связаться с вами.';
        invalid.focus();
        return;
      }
      status.textContent = NOT_SENT;
    });

    container.replaceChildren(form);
    enhanceBand(container, form, n);
    return form;
  }

  // The band's heading becomes the button that unfolds the form in place.
  // Without this script the heading stays a heading (and the page shows the
  // <noscript> line with the phone and e-mail instead of a form).
  function enhanceBand(container, form, n) {
    const doc = container.ownerDocument;
    const band = container.closest && container.closest('.offer-band');
    const title = band && band.querySelector('.offer-title');
    const reveal = band && band.querySelector('.offer-reveal');
    if (!title || !reveal || title.querySelector('.offer-toggle')) return null;
    // A band marked data-offer-open (the home page) stands open: no toggle, the form in view.
    if (band.hasAttribute('data-offer-open')) return null;
    reveal.id = reveal.id || 'offer-' + n + '-reveal';
    const toggle = el(doc, 'button', { type: 'button', className: 'offer-toggle', 'aria-expanded': 'false', 'aria-controls': reveal.id });
    const label = el(doc, 'span', { className: 'offer-toggle-label' });
    while (title.firstChild) label.appendChild(title.firstChild);
    toggle.appendChild(label);
    toggle.appendChild(el(doc, 'span', { className: 'offer-toggle-arrow', 'aria-hidden': 'true' }));
    title.appendChild(toggle);
    band.classList.add('is-collapsible');
    toggle.addEventListener('click', () => {
      const open = !band.classList.contains('is-open');
      band.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) {
        const first = form.querySelector('select, input:not([type="file"])');
        if (first) first.focus({ preventScroll: true });
      }
    });
    return toggle;
  }

  // ---- Three questions (the home page and every direction page: <div data-offer-form data-offer-steps>) ----
  // The same request as a short talk: one question at a time -- what to make,
  // how to address you, where to answer -- and the answers gather above as a
  // receipt (each chip takes you back to its question). A phone or an e-mail
  // (at least one) and the consent are required; the name is not; a drawing or a
  // photo can be attached at the last question. The request goes by e-mail through
  // server/lead.php (2026-11-12); the last screen says it was sent, sums it up and
  // gives the phone and Telegram too. If sending fails, the last question says so.
  //
  // Between the first answer and the name (2026-10-26, the owner): a piece the
  // calculator builds asks «сами или мастер?» (the fork), and «Готовые изделия»
  // opens the catalogue -- both in this tab; js/offer-handoff.js brings the
  // piece back. The other directions go straight on to the name.
  const STEPS = [
    { chip: 'Изделие', q: ['Что будем делать ', 'из камня?'], hint: 'Выберите направление - его можно будет поменять.' },
    { chip: 'Имя', q: ['Как к вам ', 'обращаться?'], hint: 'Чтобы мастер знал, кому звонить с расчётом.' },
    // A phone or an e-mail, at least one of them (2026-11-12, the owner).
    { chip: 'Контакт', q: ['Куда ответить ', 'с расчётом?'], hint: 'Телефон или почта - достаточно чего-то одного. Мастер позвонит или напишет, уточнит детали и подготовит расчёт.' },
  ];
  const FORK = {
    q: ['Посчитаете ', 'сами', ' или доверите мастеру?'],
    hint: label => label + ' есть в нашем калькуляторе: выберите камень и размеры, изделие появится в 3D с ценой. Потом вернётесь сюда.',
    go: ['Собрать в калькуляторе', 'Камень из каталога, размеры, 3D. Цена сразу.'],
    master: ['Пусть посчитает мастер', 'Оставите имя и телефон или почту, мастер свяжется и всё уточнит.'],
  };
  const KATALOG_STEP = {
    q: ['Выберите ', 'готовое', ' изделие'],
    hint: 'Ванны из оникса, раковины, вазы и столы, которые уже сделаны в нашем цеху и ждут хозяина. Выберите то, что нравится, и мы вернём вас сюда.',
    go: 'Посмотреть каталог',
  };
  const UNSURE = 'Пока не знаю';
  const UNSURE_KEY = 'unsure';
  const TELEGRAM = 'https://t.me/TeaN_SayanMramor';
  // The request goes by e-mail to sayan-mramor@yandex.ru (2026-11-12, the owner) through server/lead.php,
  // which lives on the old site's hosting: GitHub Pages has no server of its own.
  const LEAD_URL = 'https://sayanmramor.ru/lead.php';
  const DONE_NOTE = 'Мы получили вашу заявку. Мастер свяжется с вами, уточнит детали и подготовит расчёт. Если удобнее, позвоните или напишите нам в Telegram.';
  const SEND_FAILED = 'Не получилось отправить заявку. Попробуйте ещё раз или позвоните нам: ' + PHONE + '.';
  // A ready piece from the catalogue has its price: it is booked, not priced (2026-11-02, the owner:
  // the page promised «без ожидания расчёта» and «Запросить» led to «Получить расчёт»). The band's
  // heading and lead, the last button and the closing note say so while such a piece is in the request.
  const BOOKING = {
    title: 'Забронировать',
    titleSoft: 'готовое изделие',
    lead: 'Оставьте имя и телефон или почту. Мастер подтвердит, что изделие в наличии, и договорится о доставке.',
    submit: 'Забронировать',
    done: 'Мы получили вашу заявку. Мастер подтвердит, что изделие ждёт вас, и договорится о доставке.',
  };

  // A phone is a phone with at least ten digits («+7 999 123-45-67», «89991234567»).
  function phoneOk(value) {
    return String(value || '').replace(/\D/g, '').length >= 10;
  }
  // An e-mail is something@something.zone, no spaces.
  function emailOk(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
  }
  // The last question wants a phone or an e-mail, at least one; a field that is filled must be right.
  // null when the answer will do, else the field to fix and what to say.
  function contactProblem(phoneValue, emailValue) {
    const p = String(phoneValue || '').trim(), m = String(emailValue || '').trim();
    if (!p && !m) return { field: 'phone', message: 'Укажите телефон или почту, чтобы мастер мог связаться с вами.' };
    if (p && !phoneOk(p)) return { field: 'phone', message: 'Проверьте телефон: в номере должно быть не меньше 10 цифр.' };
    if (m && !emailOk(m)) return { field: 'email', message: 'Проверьте почту: она пишется как name@mail.ru.' };
    return null;
  }

  // Where the talk goes after the first answer: the fork, the catalogue, or the name.
  function afterDirection(key) {
    const branch = Handoff.branchOf(key);
    return branch === 'calc' ? 'fork' : branch === 'katalog' ? 'katalog' : 1;
  }
  // «Вопрос 2 из 4» where the fork or the catalogue stands between, «из 3» elsewhere.
  function countLabel(current, key) {
    if (current === 3) return 'Готово';
    const four = Handoff.branchOf(key) !== 'plain';
    const n = current === 0 ? 1 : current === 'fork' || current === 'katalog' ? 2 : current + (four ? 2 : 1);
    return 'Вопрос ' + n + ' из ' + (four ? 4 : 3);
  }
  // The receipt's chip for the question between the first answer and the name (experiment, round 1:
  // the count said «Вопрос 2 из 4» over three chips): «Расчёт» for the fork, «Каталог» for the
  // catalogue; once passed, the way taken. null where no such question stands.
  const BETWEEN_CHIP = { fork: 'Расчёт', katalog: 'Каталог' };
  function betweenChip(state) {
    const step = state.direction ? afterDirection(state.direction) : 1;
    if (step === 1) return null;
    const passed = state.current !== 0 && state.current !== step;
    const value = !passed ? '' : step === 'fork' ? (state.piece ? 'Калькулятор' : 'Мастер') : (state.piece ? 'Из каталога' : '');
    return { step, label: BETWEEN_CHIP[step], value };
  }
  // A direction page names its direction: the talk starts after the first question.
  function startStep(key) {
    return key ? afterDirection(key) : 0;
  }
  // Whether the piece in the request belongs to this direction.
  function pieceOf(piece, key) {
    if (!piece) return false;
    if (piece.kind === 'katalog') return key === Handoff.KATALOG_KEY;
    return new URLSearchParams(piece.query || '').get('product') === Handoff.CALC_PRODUCT[key];
  }
  const directionLabel = key => (key === UNSURE_KEY ? UNSURE : (DIRECTIONS.find(d => d.key === key) || { label: '' }).label);
  // The direction a piece came back to: the catalogue's, or the one whose product the calculator built.
  function directionOfPiece(piece) {
    if (piece.kind === 'katalog') return Handoff.KATALOG_KEY;
    const product = new URLSearchParams(piece.query || '').get('product');
    return Object.keys(Handoff.CALC_PRODUCT).find(k => Handoff.CALC_PRODUCT[k] === product) || '';
  }

  // The hints of the name and the phone while a piece is in the request.
  const PIECE_HINTS = {
    name: 'Изделие уже в заявке. Осталось имя и телефон или почта.',
    phoneCalc: 'Мастер проверит размеры и подтвердит цену.',
    phoneKatalog: 'Мастер подтвердит, что изделие ждёт вас, и расскажет о доставке.',
  };
  // The calculator's price holds for Moscow and the Moscow region only: the same note as under its total.
  const REGION_NOTE = '* Расчёт указан для объектов, находящихся в Москве и Московской области';
  // What the card over the questions says: the calculator's price is an estimate, the catalogue's exact.
  function pieceCard(piece) {
    if (piece.kind === 'katalog') {
      return {
        kicker: 'Из каталога', title: piece.name || '', meta: '', price: Handoff.formatRub(piece.price), note: '', footnote: '', image: piece.photo || '',
        actions: [{ label: 'Выбрать другое', kind: 'other' }, { label: 'Убрать изделие', kind: 'drop' }],
      };
    }
    // Unpriced, the calculator says «Стоимость уточнит менеджер»: here a small line, not a price.
    const price = piece.priced && piece.price ? String(piece.price).replace(/\*+$/, '') + '*' : '';
    return {
      kicker: 'Из калькулятора', title: [piece.product, piece.stone].filter(Boolean).join(' · '), meta: piece.sizes || '',
      price, note: piece.priced ? 'ориентировочно' : 'цену уточнит мастер', footnote: price ? REGION_NOTE : '', image: piece.stoneImage || '',
      actions: [{ label: 'Изменить в калькуляторе', kind: 'edit' }, { label: 'Убрать изделие', kind: 'drop' }],
    };
  }
  // The calculator's passport at the end of the request.
  const PASSPORT = { title: 'Паспорт изделия', button: 'Скачать паспорт' };

  // The request in one line: the piece (or the direction), the name, the phone, the e-mail.
  function summaryLine(state) {
    const lead = state.piece ? pieceCard(state.piece).title : directionLabel(state.direction);
    return [lead, state.name, state.phone, state.email].filter(Boolean).join(' · ');
  }

  // What the letter says about the piece: its name, sizes and price, and the link that reopens it.
  function pieceText(piece, origin) {
    if (!piece) return '';
    const card = pieceCard(piece);
    const lines = [card.title, card.meta, card.price ? card.price + (card.note ? ' (' + card.note + ')' : '') : card.note];
    if (piece.kind === 'calc' && piece.query) lines.push('Открыть в калькуляторе: ' + (origin || '') + Handoff.editUrl(piece.query));
    if (piece.kind === 'katalog') lines.push('Из каталога готовых изделий');
    return lines.filter(Boolean).join('\n');
  }
  // The request's fields as the letter's handler (server/lead.php) reads them. «website» is the
  // trap for bots: a person never sees it, so it stays empty.
  function leadFields(state, extra) {
    const x = extra || {};
    return {
      direction: directionLabel(state.direction),
      name: state.name || '',
      phone: state.phone || '',
      email: state.email || '',
      piece: pieceText(state.piece, x.origin),
      picks: x.picks || '',
      page: x.page || '',
      consent: '1',
      website: '',
    };
  }
  // Sends the request; resolves true when the handler took it.
  function sendLead(win, fields, files) {
    if (!win.fetch || !win.FormData) return Promise.resolve(false);
    const data = new win.FormData();
    Object.keys(fields).forEach(k => data.append(k, fields[k]));
    (files || []).forEach(f => { if (f && f.blob) data.append(f.key, f.blob, f.name || f.key); });
    return win.fetch(LEAD_URL, { method: 'POST', body: data })
      .then(r => (r.ok ? r.json() : null))
      .then(json => !!(json && json.ok))
      .catch(() => false);
  }

  // A new first answer: the piece stays only with its own direction (then the fork is behind it).
  function chooseDirection(state, key) {
    const piece = pieceOf(state.piece, key) ? state.piece : null;
    return Object.assign({}, state, { direction: key, piece, current: piece ? 1 : afterDirection(key) });
  }

  function mountSteps(container) {
    const doc = container.ownerDocument;
    const win = doc.defaultView || {};
    const n = ++formCount;
    const id = name => 'offer-' + n + '-' + name;
    // The band's heading and lead: the page's own words, or the booking's for a ready piece.
    const band = container.closest && container.closest('.offer-band');
    const bandTitle = band && band.querySelector('.offer-title');
    const bandLead = band && band.querySelector('.offer-lead');
    const ownWords = bandTitle && bandLead ? { title: [...bandTitle.childNodes].map(c => c.cloneNode(true)), lead: bandLead.textContent } : null;
    let booked = false;
    function bandWords(booking) {
      if (!ownWords || booking === booked) return;
      booked = booking;
      const where = bandTitle.querySelector('.offer-toggle-label') || bandTitle;
      if (booking) where.replaceChildren(doc.createTextNode(BOOKING.title + ' '), el(doc, 'span', { className: 'offer-title-soft', textContent: BOOKING.titleSoft }));
      else where.replaceChildren(...ownWords.title.map(c => c.cloneNode(true)));
      bandLead.textContent = booking ? BOOKING.lead : ownWords.lead;
    }
    let state = { direction: '', name: '', nameSkipped: false, phone: '', email: '', draftEmail: '', current: 0, piece: null, attachmentName: '', draftName: '', draftPhone: '', picksOff: false };
    const labelOf = directionLabel;
    const keyOf = label => (label === UNSURE ? UNSURE_KEY : DIRECTIONS.find(d => d.label === label).key);

    // The answers ride along in this tab's storage, with the page, so a trip out and back keeps them.
    function session() {
      try { return win.sessionStorage || null; } catch (e) { return null; }
    }
    function local() {
      try { return win.localStorage || null; } catch (e) { return null; }
    }
    function fetchJson(url) {
      return typeof win.fetch === 'function' ? win.fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null);
    }
    function persist() {
      Handoff.saveTalk(session(), Object.assign({}, state, { page: win.location ? win.location.pathname : '' }));
    }
    function leave(url) {
      persist();
      win.location.assign(url);
    }

    const talkQ = (qid, parts) => el(doc, 'p', { className: 'talk-q', id: qid },
      [doc.createTextNode(parts[0]), el(doc, 'em', { textContent: parts[1] })].concat(parts[2] ? [doc.createTextNode(parts[2])] : []));
    const hint = text => el(doc, 'p', { className: 'talk-hint', textContent: text || '' });
    const section = (step, parts, hintEl, extra) => el(doc, 'section', { className: 'talk-step', 'data-step': step, 'aria-labelledby': id('q' + step) },
      [talkQ(id('q' + step), parts), hintEl].concat(extra));
    const question = (i, hintEl, extra) => section(String(i), STEPS[i].q, hintEl, extra);
    const linkButton = (text, onClick) => {
      const b = el(doc, 'button', { type: 'button', className: 'talk-link', textContent: text });
      b.addEventListener('click', onClick);
      return b;
    };
    const nextButton = (text, type) => el(doc, 'button', { type: type || 'button', className: 'talk-next' }, [el(doc, 'span', { textContent: text }), icon(doc, 'arrow')]);

    // The receipt: one chip per question, and where you are.
    const chips = STEPS.map((s, i) => {
      const chip = el(doc, 'button', { type: 'button', className: 'talk-chip', textContent: s.chip });
      chip.addEventListener('click', () => { if (reachable(i)) go(i); });
      return chip;
    });
    // The fork or the catalogue between the first answer and the name has its chip too.
    const midChip = el(doc, 'button', { type: 'button', className: 'talk-chip', hidden: '' });
    midChip.addEventListener('click', () => { if (state.direction) go(afterDirection(state.direction)); });
    const count = el(doc, 'span', { className: 'talk-count', 'aria-live': 'polite' });
    const receipt = el(doc, 'div', { className: 'talk-receipt' }, [chips[0], midChip].concat(chips.slice(1), [count]));

    // The piece from the calculator or the catalogue, over the questions.
    const pieceSlot = el(doc, 'div', { className: 'talk-piece-slot' });
    function renderPiece() {
      if (!state.piece) { pieceSlot.replaceChildren(); return; }
      const card = pieceCard(state.piece);
      const words = el(doc, 'div', { className: 'talk-piece-words' }, [
        el(doc, 'p', { className: 'talk-piece-kicker', textContent: card.kicker }),
        el(doc, 'p', { className: 'talk-piece-title', textContent: card.title }),
      ].concat(card.meta ? [el(doc, 'p', { className: 'talk-piece-meta', textContent: card.meta })] : []));
      const price = el(doc, 'p', { className: 'talk-piece-price', textContent: card.price },
        card.note ? [el(doc, 'small', { textContent: card.note })] : []);
      const parts = (card.image ? [el(doc, 'img', { className: 'talk-piece-image', src: card.image, alt: '', width: '64', height: '64', loading: 'lazy', decoding: 'async' })] : [])
        .concat([words, price]);
      if (state.current !== 3) {
        parts.push(el(doc, 'div', { className: 'talk-links talk-piece-actions' }, card.actions.map(a => linkButton(a.label, () => {
          if (a.kind === 'edit') leave(Handoff.editUrl(state.piece.query));
          else if (a.kind === 'other') leave(Handoff.KATALOG);
          else { state.piece = null; render(); persist(); }
        }))));
      }
      if (card.footnote) parts.push(el(doc, 'p', { className: 'talk-piece-footnote', textContent: card.footnote }));
      pieceSlot.replaceChildren(el(doc, 'div', { className: 'talk-piece' + (card.image ? '' : ' is-bare') }, parts));
    }

    // 1. What to make: every direction of the site, and «Пока не знаю».
    const options = DIRECTIONS.map(d => d.label).concat([UNSURE]).map(label => {
      const b = el(doc, 'button', { type: 'button', className: 'talk-option', 'aria-pressed': 'false', textContent: label });
      b.addEventListener('click', () => {
        state = chooseDirection(state, keyOf(label));
        go(state.current);
      });
      return b;
    });
    const step1 = question(0, hint(STEPS[0].hint), [el(doc, 'div', { className: 'talk-options', role: 'group', 'aria-labelledby': id('q0') }, options)]);
    // Back from the name: to whatever stands between the first answer and it.
    const back = () => go(state.piece ? 0 : startStep(state.direction) === 1 ? 0 : startStep(state.direction));

    // The fork: build it in the calculator, or leave it to the master.
    const forkHint = hint('');
    const forkButton = (words, main) => el(doc, 'button', { type: 'button', className: 'talk-fork-btn' + (main ? ' is-main' : '') }, [
      el(doc, 'span', { className: 'talk-fork-title' }, [doc.createTextNode(words[0])].concat(main ? [icon(doc, 'arrow')] : [])),
      el(doc, 'span', { className: 'talk-fork-text', textContent: words[1] }),
    ]);
    const toCalc = forkButton(FORK.go, true);
    const toMaster = forkButton(FORK.master, false);
    toCalc.addEventListener('click', () => leave(Handoff.calcUrl(state.direction)));
    toMaster.addEventListener('click', () => go(1));
    const forkStep = section('fork', FORK.q, forkHint, [
      el(doc, 'div', { className: 'talk-fork' }, [toCalc, toMaster]),
      el(doc, 'div', { className: 'talk-links' }, [linkButton('← Изменить изделие', () => go(0))]),
    ]);

    // Ready pieces: the catalogue, and back with the one chosen.
    const toKatalog = el(doc, 'a', { className: 'talk-next', href: Handoff.KATALOG }, [el(doc, 'span', { textContent: KATALOG_STEP.go }), icon(doc, 'arrow')]);
    toKatalog.addEventListener('click', persist);
    const katalogStep = section('katalog', KATALOG_STEP.q, hint(KATALOG_STEP.hint), [
      el(doc, 'div', { className: 'talk-answer' }, [toKatalog]),
      el(doc, 'div', { className: 'talk-links' }, [linkButton('← Изменить изделие', () => go(0))]),
    ]);

    // 2. The name (may be left out).
    const name = el(doc, 'input', { type: 'text', id: id('name'), name: 'name', className: 'talk-input', autocomplete: 'name', placeholder: 'Ваше имя', 'aria-labelledby': id('q1') });
    const nameNext = nextButton('Дальше');
    const toPhone = () => { state.name = name.value.trim(); state.nameSkipped = !state.name; go(2); };
    nameNext.addEventListener('click', toPhone);
    name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); toPhone(); } });
    name.addEventListener('input', () => { state.draftName = name.value; persist(); });
    const nameHint = hint(STEPS[1].hint);
    const step2 = question(1, nameHint, [
      el(doc, 'div', { className: 'talk-answer' }, [name, nameNext]),
      el(doc, 'div', { className: 'talk-links' }, [
        linkButton('← Изменить изделие', back),
        linkButton('Можно без имени', () => { name.value = ''; toPhone(); }),
      ]),
    ]);

    // 3. The phone or the e-mail (at least one), a drawing or photo if there is one, the consent, and the request.
    const phone = el(doc, 'input', { type: 'tel', id: id('phone'), name: 'phone', className: 'talk-input', autocomplete: 'tel', inputmode: 'tel', placeholder: '+7 (___) ___-__-__', 'aria-label': 'Телефон' });
    const email = el(doc, 'input', { type: 'email', id: id('email'), name: 'email', className: 'talk-input', autocomplete: 'email', inputmode: 'email', placeholder: 'Или почта', 'aria-label': 'Электронная почта' });
    const file = el(doc, 'input', { type: 'file', id: id('file'), name: 'file', className: 'offer-file-input' });
    const fileName = el(doc, 'span', { className: 'talk-file-name', textContent: 'Есть чертёж или фото? Прикрепите файл' });
    file.addEventListener('change', () => {
      const chosen = file.files && file.files.length ? file.files[0] : null;
      fileName.textContent = chosen ? chosen.name : 'Есть чертёж или фото? Прикрепите файл';
      // Kept in this browser, so «Изменить в калькуляторе» and back does not lose it.
      state.attachmentName = chosen ? chosen.name : '';
      if (chosen) Handoff.blobs.put('attachment', chosen); else Handoff.blobs.remove('attachment');
      persist();
    });
    const consent = el(doc, 'input', { type: 'checkbox', id: id('consent'), name: 'consent', required: '' });
    const status = el(doc, 'p', { className: 'offer-status talk-status', role: 'status' });
    // A hint goes as soon as the field it was about is put right.
    phone.addEventListener('input', () => { if (!contactProblem(phone.value, email.value)) status.textContent = ''; state.draftPhone = phone.value; persist(); });
    email.addEventListener('input', () => { if (!contactProblem(phone.value, email.value)) status.textContent = ''; state.draftEmail = email.value; persist(); });
    consent.addEventListener('change', () => { if (consent.checked) status.textContent = ''; });
    const phoneHint = hint(STEPS[2].hint);
    const submit = nextButton('Получить расчёт', 'submit');
    const step3 = question(2, phoneHint, [
      el(doc, 'div', { className: 'talk-answer talk-answer-contacts', role: 'group', 'aria-labelledby': id('q2') }, [
        el(doc, 'div', { className: 'talk-contacts' }, [phone, email]),
        submit,
      ]),
      el(doc, 'div', { className: 'talk-extra' }, [
        file,
        el(doc, 'label', { className: 'talk-file', htmlFor: id('file') }, [el(doc, 'span', { className: 'talk-file-icon' }, [icon(doc, 'clip')]), fileName]),
        el(doc, 'div', { className: 'offer-consent talk-consent' }, [
          consent,
          el(doc, 'label', { htmlFor: id('consent') }, [
            doc.createTextNode('Даю своё согласие на обработку моих персональных данных ('),
            el(doc, 'a', { href: '/sayanmramor-site/privacy.html', textContent: 'политика конфиденциальности' }),
            doc.createTextNode(')'),
          ]),
        ]),
      ]),
      status,
      el(doc, 'div', { className: 'talk-links' }, [linkButton('← Назад', () => go(1))]),
    ]);

    // 4. Done: the request summed up, and the honest way to send it today.
    const summary = el(doc, 'p', { className: 'talk-summary' });
    // A piece built in the calculator brings its passport: the PDF the calculator made when
    // «Получить расчёт» was pressed (js/offer-handoff.js, IndexedDB), with its preview. It is
    // read before the tap, so the tap itself saves it (an iPhone drops a download outside a
    // tap); without it the button opens the calculator on the piece, which makes it anew.
    const passportSlot = el(doc, 'div', { className: 'talk-passport-slot' });
    let passportFor = null;
    function renderPassport() {
      const piece = state.piece;
      if (state.current !== 3 || !piece || piece.kind !== 'calc') { passportSlot.replaceChildren(); passportFor = null; return; }
      if (passportFor === piece.query) return;
      passportFor = piece.query;
      const sheet = el(doc, 'div', { className: 'talk-passport-sheet', 'aria-hidden': 'true' });
      const get = el(doc, 'a', { className: 'talk-ghost talk-passport-get', href: Handoff.editUrl(piece.query), textContent: PASSPORT.button });
      const box = el(doc, 'div', { className: 'talk-passport' }, [sheet, el(doc, 'div', { className: 'talk-passport-words' }, [
        el(doc, 'p', { className: 'talk-passport-title', textContent: PASSPORT.title }),
        el(doc, 'p', { className: 'talk-passport-name', textContent: pieceCard(piece).title }),
      ]), get]);
      passportSlot.replaceChildren(box);
      const mine = record => !!record && record.query === piece.query && passportFor === piece.query;
      Handoff.blobs.get('passport-preview').then(record => {
        if (!mine(record) || !record.image) return;
        const src = typeof record.image === 'string' ? record.image : URL.createObjectURL(record.image);
        sheet.appendChild(el(doc, 'img', { src, alt: '', decoding: 'async' }));
      });
      Handoff.blobs.get('passport').then(record => {
        if (!mine(record) || !record.file) return;
        const button = el(doc, 'button', { type: 'button', className: 'talk-ghost talk-passport-get', textContent: PASSPORT.button });
        button.addEventListener('click', () => Handoff.saveFile(record.file));
        if (get.parentNode === box) box.replaceChild(button, get);
      });
    }
    // «Моя подборка» (js/picks.js) goes along in the Telegram message: the request itself is
    // not sent anywhere yet, so that is the one place it can really be attached.
    const telegram = el(doc, 'a', { className: 'talk-ghost', href: TELEGRAM, target: '_blank', rel: 'noopener', textContent: 'Написать в Telegram' });
    const picksSlot = el(doc, 'div', { className: 'talk-picks' });
    function renderPicks() {
      const Picks = win.Picks;
      if (!Picks) { picksSlot.hidden = true; return; }
      const picks = Picks.forRequest(win.location, local());
      picksSlot.hidden = !picks;
      telegram.href = TELEGRAM;
      if (!picks) return;
      const address = win.location.origin + Picks.sharePath(picks);
      if (!state.picksOff) telegram.href = Picks.telegramUrl(TELEGRAM, Picks.requestText(summaryLine(state), address));
      const see = el(doc, 'a', { className: 'talk-link', href: address, target: '_blank', rel: 'noopener', textContent: 'Посмотреть' });
      const choice = linkButton(state.picksOff ? 'Приложить' : 'Не прикладывать', () => {
        state.picksOff = !state.picksOff;
        renderPicks();
        persist();
      });
      const image = picksCover(picks);
      const words = el(doc, 'div', { className: 'talk-piece-words' }, [
        el(doc, 'p', { className: 'talk-piece-kicker', textContent: state.picksOff ? 'Подборка не приложена' : 'Моя подборка' }),
        el(doc, 'p', { className: 'talk-piece-title', textContent: Picks.label(picks) }),
      ].concat(state.picksOff ? [] : [el(doc, 'p', { className: 'talk-piece-meta', textContent: 'Ссылка на неё уже в сообщении для Telegram.' })]));
      const parts = (image ? [el(doc, 'img', { className: 'talk-piece-image', src: image, alt: '', width: '64', height: '64', decoding: 'async' })] : [])
        .concat([words, el(doc, 'div', { className: 'talk-links talk-piece-actions' }, [see, choice])]);
      picksSlot.replaceChildren(el(doc, 'div', { className: 'talk-piece talk-picks-card' + (image ? '' : ' is-bare') + (state.picksOff ? ' is-off' : '') }, parts));
    }
    // The card's picture: the first stone's photograph, else the first piece's. The catalogues
    // are read once and only when there is a list to show; until then the card has no picture.
    let picksRecords = null;
    function picksCover(picks) {
      if (!picksRecords) {
        picksRecords = { stones: [], pieces: [] };
        Promise.all([fetchJson('/sayanmramor-calculator/data/stone-index.json'), fetchJson('/sayanmramor-site/data/products.json')]).then(([stones, products]) => {
          picksRecords = { stones: (stones && stones.stones) || [], pieces: (products && products.products) || [] };
          renderPicks();
        });
      }
      const stone = picksRecords.stones.find(s => s && s.id === picks.stones[0] && s.image);
      if (stone) return '/sayanmramor-calculator/data/' + stone.image;
      const piece = picksRecords.pieces.find(p => p && p.id === picks.pieces[0]);
      return (piece && piece.photos && piece.photos[0]) || '';
    }
    const doneNote = el(doc, 'p', { className: 'talk-hint', textContent: DONE_NOTE });
    const done = el(doc, 'section', { className: 'talk-step talk-done', 'data-step': '3', 'aria-labelledby': id('q3') }, [
      el(doc, 'p', { className: 'talk-q', id: id('q3') }, [doc.createTextNode('Заявка '), el(doc, 'em', { textContent: 'отправлена' })]),
      summary,
      passportSlot,
      picksSlot,
      doneNote,
      el(doc, 'div', { className: 'talk-answer talk-done-actions' }, [
        el(doc, 'a', { className: 'talk-next', href: 'tel:' + PHONE.replace(/[^+\d]/g, '') }, [el(doc, 'span', { textContent: 'Позвонить ' + PHONE })]),
        telegram,
      ]),
      el(doc, 'div', { className: 'talk-links' }, [linkButton('← Изменить ответы', () => go(2))]),
    ]);

    const steps = { 0: step1, fork: forkStep, katalog: katalogStep, 1: step2, 2: step3, 3: done };
    const form = el(doc, 'form', { className: 'offer-talk-form', novalidate: '' }, [receipt, pieceSlot].concat(Object.values(steps)));

    function reachable(i) {
      return i === 0 || !!state.direction;
    }
    function render() {
      Object.keys(steps).forEach(k => { steps[k].hidden = k !== String(state.current); });
      options.forEach(o => o.setAttribute('aria-pressed', String(keyOf(o.textContent) === state.direction)));
      forkHint.textContent = state.direction ? FORK.hint(labelOf(state.direction)) : '';
      // An answered question shows its answer («✓ Кухня», «✓ Анна»; a skipped
      // name, once passed, «✓ Без имени»); the others their question's name.
      const values = [labelOf(state.direction), state.name || (state.nameSkipped ? 'Без имени' : ''), state.phone || state.email];
      chips.forEach((chip, i) => {
        const answered = !!values[i] && i !== state.current;
        chip.textContent = answered ? '✓ ' + values[i] : STEPS[i].chip;
        chip.classList.toggle('is-done', answered);
        chip.classList.toggle('is-current', i === state.current);
        chip.disabled = !reachable(i) || state.current === 3;
      });
      const mid = betweenChip(state);
      midChip.hidden = !mid;
      if (mid) {
        midChip.textContent = mid.value ? '✓ ' + mid.value : mid.label;
        midChip.classList.toggle('is-done', !!mid.value);
        midChip.classList.toggle('is-current', state.current === mid.step);
        midChip.disabled = state.current === 3;
      }
      count.textContent = countLabel(state.current, state.direction);
      const piece = state.piece;
      nameHint.textContent = piece ? PIECE_HINTS.name : STEPS[1].hint;
      phoneHint.textContent = piece ? (piece.kind === 'katalog' ? PIECE_HINTS.phoneKatalog : PIECE_HINTS.phoneCalc) : STEPS[2].hint;
      const booking = !!piece && piece.kind === 'katalog';
      submit.firstChild.textContent = booking ? BOOKING.submit : 'Получить расчёт';
      doneNote.textContent = booking ? BOOKING.done : DONE_NOTE;
      bandWords(booking);
      renderPiece();
      renderPassport();
      renderPicks();
    }
    function go(i, focus) {
      state.current = i;
      status.textContent = '';
      render();
      persist();
      if (focus === false) return;
      const target = i === 0 ? (options.find(o => o.getAttribute('aria-pressed') === 'true') || options[0])
        : i === 'fork' ? toCalc : i === 'katalog' ? toKatalog : i === 1 ? name : i === 2 ? phone : done.querySelector('.talk-next');
      if (target && target.focus) target.focus({ preventScroll: true });
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (state.current !== 2) return;
      const problem = contactProblem(phone.value, email.value);
      if (problem) {
        status.textContent = problem.message;
        (problem.field === 'email' ? email : phone).focus();
        return;
      }
      if (!consent.checked) {
        status.textContent = 'Отметьте согласие на обработку персональных данных.';
        consent.focus();
        return;
      }
      if (sending) return;
      state.phone = phone.value.trim();
      state.email = email.value.trim();
      // The request goes by e-mail (server/lead.php): the client's file and, for a calculator piece,
      // its passport go along. Until the handler answers the button says so and waits.
      sending = true;
      const label = submit.firstChild.textContent;
      submit.disabled = true;
      submit.firstChild.textContent = 'Отправляем…';
      status.textContent = '';
      const piece = state.piece;
      const picks = win.Picks && !state.picksOff ? win.Picks.forRequest(win.location, local()) : null;
      const extra = {
        origin: win.location ? win.location.origin : '',
        page: win.location ? win.location.href : '',
        picks: picks ? win.location.origin + win.Picks.sharePath(picks) : '',
      };
      const chosen = file.files && file.files.length ? file.files[0] : null;
      Promise.all([
        chosen ? Promise.resolve(chosen) : (state.attachmentName ? Handoff.blobs.get('attachment') : Promise.resolve(null)),
        piece && piece.kind === 'calc' ? Handoff.blobs.get('passport') : Promise.resolve(null),
      ]).then(([attachment, passport]) => {
        const files = [{ key: 'attachment', blob: attachment, name: state.attachmentName || (attachment && attachment.name) }];
        if (passport && passport.file && passport.query === piece.query) files.push({ key: 'passport', blob: passport.file, name: passport.file.name || 'passport.pdf' });
        return sendLead(win, leadFields(state, extra), files);
      }).then(ok => {
        sending = false;
        submit.disabled = false;
        submit.firstChild.textContent = label;
        if (!ok) { status.textContent = SEND_FAILED; return; }
        summary.textContent = summaryLine(state);
        go(3);
      });
    });
    let sending = false;

    // A page may name its direction (data-preselect): then the talk starts after the first question.
    const preselect = DIRECTIONS.find(d => d.key === container.getAttribute('data-preselect'));
    if (preselect) {
      state.direction = preselect.key;
      state.current = startStep(preselect.key);
    }
    // The answers given on this page before a trip out (or a reload) come back.
    const page = win.location ? win.location.pathname : '';
    const saved = Handoff.loadTalk(session());
    if (saved && saved.page === page) {
      ['direction', 'name', 'nameSkipped', 'phone', 'email', 'current', 'piece', 'attachmentName', 'draftName', 'draftPhone', 'draftEmail', 'picksOff'].forEach(k => {
        if (saved[k] !== undefined) state[k] = saved[k];
      });
      name.value = state.name || state.draftName || '';
      phone.value = state.phone || state.draftPhone || '';
      email.value = state.email || state.draftEmail || '';
      if (state.attachmentName) fileName.textContent = state.attachmentName;
      if (state.current === 3) summary.textContent = summaryLine(state);
    }
    // And the piece the address brings back: from the catalogue (?piece=) or the calculator (a passport link).
    const arrival = win.location ? Handoff.readArrival(win.location.search) : null;
    if (arrival) {
      const place = piece => {
        if (!piece || (piece.kind === 'calc' && !piece.product)) return;
        state.piece = piece;
        state.direction = directionOfPiece(piece);
        state.current = state.name || state.nameSkipped ? 2 : 1;
        render();
        persist();
      };
      if (arrival.kind === 'katalog') {
        fetchJson('/sayanmramor-site/data/products.json').then(data => place(Handoff.catalogPiece(data && data.products, arrival.id)));
      } else {
        const taken = Handoff.takeCalcPiece(local(), arrival.query);
        if (taken) place(taken);
        else fetchJson('/sayanmramor-calculator/data/stone-index.json').then(data => place(Handoff.calcPieceFromIndex(arrival.query, data && data.stones)));
      }
      if (win.history && win.history.replaceState) win.history.replaceState(null, '', page + '#offer');
    }
    render();
    container.replaceChildren(form);
    return form;
  }

  function mountAll(doc) {
    return [...doc.querySelectorAll('[data-offer-form]')].map(c => (c.hasAttribute('data-offer-steps') ? mountSteps(c) : mount(c)));
  }

  if (typeof document !== 'undefined') mountAll(document);

  return {
    DIRECTIONS, FIELDS, NOT_SENT, STEPS, FORK, KATALOG_STEP, PIECE_HINTS, PASSPORT, DONE_NOTE, BOOKING, phoneOk, emailOk, contactProblem, LEAD_URL, SEND_FAILED, pieceText, leadFields, sendLead, afterDirection, countLabel, betweenChip, startStep, chooseDirection,
    pieceCard, summaryLine,
    mount, mountSteps, mountAll, enhanceBand,
  };
});
