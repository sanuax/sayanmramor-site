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
  const EMAIL = 'info@sayanmramor.ru';
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
          doc.createTextNode('даю свое согласие на обработку моих персональных данных ('),
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
  // how to address you, where to call -- and the answers gather above as a
  // receipt (each chip takes you back to its question). The phone and the
  // consent are required, as in the form; the name is not; a drawing or a
  // photo can be attached at the last question. There is no backend yet: the
  // last screen says so, sums the request up and gives the phone and Telegram.
  //
  // Between the first answer and the name (2026-10-26, the owner): a piece the
  // calculator builds asks «сами или мастер?» (the fork), and «Готовые изделия»
  // opens the catalogue -- both in this tab; js/offer-handoff.js brings the
  // piece back. The other directions go straight on to the name.
  const STEPS = [
    { chip: 'Изделие', q: ['Что будем делать ', 'из камня?'], hint: 'Выберите направление - его можно будет поменять.' },
    { chip: 'Имя', q: ['Как к вам ', 'обращаться?'], hint: 'Чтобы мастер знал, кому звонить с расчётом.' },
    { chip: 'Телефон', q: ['Куда позвонить ', 'с расчётом?'], hint: 'Мастер перезвонит, уточнит детали и подготовит расчёт.' },
  ];
  const FORK = {
    q: ['Посчитаете ', 'сами', ' или доверите мастеру?'],
    hint: label => label + ' есть в нашем калькуляторе: выберите камень и размеры, изделие появится в 3D с ценой. Потом вернётесь сюда.',
    go: ['Собрать в калькуляторе', 'Камень из каталога, размеры, 3D. Цена сразу.'],
    master: ['Пусть посчитает мастер', 'Оставите имя и телефон, мастер перезвонит и всё уточнит.'],
  };
  const KATALOG_STEP = {
    q: ['Выберите ', 'готовое', ' изделие'],
    hint: 'Ванны из оникса, раковины, вазы и столы, которые уже сделаны в нашем цеху и ждут хозяина. Выберите то, что нравится, и мы вернём вас сюда.',
    go: 'Посмотреть каталог',
  };
  const UNSURE = 'Пока не знаю';
  const UNSURE_KEY = 'unsure';
  const TELEGRAM = 'https://t.me/TeaN_SayanMramor';
  const DONE_NOTE = 'Отправка заявок с сайта ещё настраивается. Позвоните или напишите нам в Telegram и назовите вашу заявку - мастер сразу возьмётся за расчёт.';

  // A phone is a phone with at least ten digits («+7 999 123-45-67», «89991234567»).
  function phoneOk(value) {
    return String(value || '').replace(/\D/g, '').length >= 10;
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
    name: 'Изделие уже в заявке. Осталось имя и телефон.',
    phoneCalc: 'Мастер проверит размеры и подтвердит цену.',
    phoneKatalog: 'Мастер подтвердит, что изделие ждёт вас, и расскажет о доставке.',
  };
  // What the card over the questions says: the calculator's price is an estimate, the catalogue's exact.
  function pieceCard(piece) {
    if (piece.kind === 'katalog') {
      return {
        kicker: 'Из каталога', title: piece.name || '', meta: '', price: Handoff.formatRub(piece.price), note: '', image: piece.photo || '',
        actions: [{ label: 'Выбрать другое', kind: 'other' }, { label: 'Убрать изделие', kind: 'drop' }],
      };
    }
    return {
      kicker: 'Из калькулятора', title: [piece.product, piece.stone].filter(Boolean).join(' · '), meta: piece.sizes || '',
      // Unpriced, the calculator says «Стоимость уточнит менеджер»: here a small line, not a price.
      price: piece.priced ? piece.price || '' : '', note: piece.priced ? 'ориентировочно' : 'цену уточнит мастер', image: piece.stoneImage || '',
      actions: [{ label: 'Изменить в калькуляторе', kind: 'edit' }, { label: 'Убрать изделие', kind: 'drop' }],
    };
  }
  // The calculator's passport at the end of the request.
  const PASSPORT = { title: 'Паспорт изделия', button: 'Скачать паспорт' };

  // The request in one line: the piece (or the direction), the name, the phone.
  function summaryLine(state) {
    const lead = state.piece ? pieceCard(state.piece).title : directionLabel(state.direction);
    return [lead, state.name, state.phone].filter(Boolean).join(' · ');
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
    let state = { direction: '', name: '', nameSkipped: false, phone: '', current: 0, piece: null, attachmentName: '', draftName: '', draftPhone: '' };
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
    const count = el(doc, 'span', { className: 'talk-count', 'aria-live': 'polite' });
    const receipt = el(doc, 'div', { className: 'talk-receipt' }, chips.concat([count]));

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

    // 3. The phone, a drawing or photo if there is one, the consent, and the request.
    const phone = el(doc, 'input', { type: 'tel', id: id('phone'), name: 'phone', className: 'talk-input', autocomplete: 'tel', inputmode: 'tel', placeholder: '+7 (___) ___-__-__', required: '', 'aria-labelledby': id('q2') });
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
    phone.addEventListener('input', () => { if (phoneOk(phone.value)) status.textContent = ''; state.draftPhone = phone.value; persist(); });
    consent.addEventListener('change', () => { if (consent.checked) status.textContent = ''; });
    const phoneHint = hint(STEPS[2].hint);
    const step3 = question(2, phoneHint, [
      el(doc, 'div', { className: 'talk-answer' }, [phone, nextButton('Получить расчёт', 'submit')]),
      el(doc, 'div', { className: 'talk-extra' }, [
        file,
        el(doc, 'label', { className: 'talk-file', htmlFor: id('file') }, [el(doc, 'span', { className: 'talk-file-icon' }, [icon(doc, 'clip')]), fileName]),
        el(doc, 'div', { className: 'offer-consent talk-consent' }, [
          consent,
          el(doc, 'label', { htmlFor: id('consent') }, [
            doc.createTextNode('даю свое согласие на обработку моих персональных данных ('),
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
    const done = el(doc, 'section', { className: 'talk-step talk-done', 'data-step': '3', 'aria-labelledby': id('q3') }, [
      el(doc, 'p', { className: 'talk-q', id: id('q3') }, [doc.createTextNode('Заявка '), el(doc, 'em', { textContent: 'собрана' })]),
      summary,
      passportSlot,
      el(doc, 'p', { className: 'talk-hint', textContent: DONE_NOTE }),
      el(doc, 'div', { className: 'talk-answer talk-done-actions' }, [
        el(doc, 'a', { className: 'talk-next', href: 'tel:' + PHONE.replace(/[^+\d]/g, '') }, [el(doc, 'span', { textContent: 'Позвонить ' + PHONE })]),
        el(doc, 'a', { className: 'talk-ghost', href: TELEGRAM, target: '_blank', rel: 'noopener', textContent: 'Написать в Telegram' }),
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
      const values = [labelOf(state.direction), state.name || (state.nameSkipped ? 'Без имени' : ''), state.phone];
      chips.forEach((chip, i) => {
        const answered = !!values[i] && i !== state.current;
        chip.textContent = answered ? '✓ ' + values[i] : STEPS[i].chip;
        chip.classList.toggle('is-done', answered);
        chip.classList.toggle('is-current', i === state.current);
        chip.disabled = !reachable(i) || state.current === 3;
      });
      count.textContent = countLabel(state.current, state.direction);
      const piece = state.piece;
      nameHint.textContent = piece ? PIECE_HINTS.name : STEPS[1].hint;
      phoneHint.textContent = piece ? (piece.kind === 'katalog' ? PIECE_HINTS.phoneKatalog : PIECE_HINTS.phoneCalc) : STEPS[2].hint;
      renderPiece();
      renderPassport();
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
      if (!phoneOk(phone.value)) {
        status.textContent = 'Укажите телефон, чтобы мастер мог перезвонить вам.';
        phone.focus();
        return;
      }
      if (!consent.checked) {
        status.textContent = 'Отметьте согласие на обработку персональных данных.';
        consent.focus();
        return;
      }
      state.phone = phone.value.trim();
      summary.textContent = summaryLine(state);
      go(3);
    });

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
      ['direction', 'name', 'nameSkipped', 'phone', 'current', 'piece', 'attachmentName', 'draftName', 'draftPhone'].forEach(k => {
        if (saved[k] !== undefined) state[k] = saved[k];
      });
      name.value = state.name || state.draftName || '';
      phone.value = state.phone || state.draftPhone || '';
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
    DIRECTIONS, FIELDS, NOT_SENT, STEPS, FORK, KATALOG_STEP, PIECE_HINTS, PASSPORT, DONE_NOTE, phoneOk, afterDirection, countLabel, startStep, chooseDirection,
    pieceCard, summaryLine,
    mount, mountSteps, mountAll, enhanceBand,
  };
});
