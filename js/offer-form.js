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
    module.exports = factory();
  } else {
    root.OfferForm = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

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

  // ---- Three questions (the home page: <div data-offer-form data-offer-steps>) ----
  // The same request as a short talk: one question at a time -- what to make,
  // how to address you, where to call -- and the answers gather above as a
  // receipt (each chip takes you back to its question). The phone and the
  // consent are required, as in the form; the name is not; a drawing or a
  // photo can be attached at the last question. There is no backend yet: the
  // last screen says so, sums the request up and gives the phone and Telegram.
  const STEPS = [
    { chip: 'Изделие', q: ['Что будем делать ', 'из камня?'], hint: 'Выберите направление - его можно будет поменять.' },
    { chip: 'Имя', q: ['Как к вам ', 'обращаться?'], hint: 'Чтобы мастер знал, кому звонить с расчётом.' },
    { chip: 'Телефон', q: ['Куда позвонить ', 'с расчётом?'], hint: 'Мастер перезвонит, уточнит детали и подготовит расчёт.' },
  ];
  const UNSURE = 'Пока не знаю';
  const TELEGRAM = 'https://t.me/TeaN_SayanMramor';
  const DONE_NOTE = 'Отправка заявок с сайта ещё настраивается. Позвоните или напишите нам в Telegram и назовите вашу заявку - мастер сразу возьмётся за расчёт.';

  // A phone is a phone with at least ten digits («+7 999 123-45-67», «89991234567»).
  function phoneOk(value) {
    return String(value || '').replace(/\D/g, '').length >= 10;
  }

  function mountSteps(container) {
    const doc = container.ownerDocument;
    const n = ++formCount;
    const id = name => 'offer-' + n + '-' + name;
    const answers = { direction: '', name: '', phone: '' };
    let current = 0;

    const question = (i, extra) => {
      const q = el(doc, 'p', { className: 'talk-q', id: id('q' + i) }, [doc.createTextNode(STEPS[i].q[0]), el(doc, 'em', { textContent: STEPS[i].q[1] })]);
      return el(doc, 'section', { className: 'talk-step', 'data-step': String(i), 'aria-labelledby': id('q' + i) },
        [q, el(doc, 'p', { className: 'talk-hint', textContent: STEPS[i].hint })].concat(extra));
    };
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

    // 1. What to make: every direction of the site, and «Пока не знаю».
    const options = DIRECTIONS.map(d => d.label).concat([UNSURE]).map(label => {
      const b = el(doc, 'button', { type: 'button', className: 'talk-option', 'aria-pressed': 'false', textContent: label });
      b.addEventListener('click', () => {
        answers.direction = label;
        options.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
        go(1);
      });
      return b;
    });
    const step1 = question(0, [el(doc, 'div', { className: 'talk-options', role: 'group', 'aria-labelledby': id('q0') }, options)]);

    // 2. The name (may be left out).
    const name = el(doc, 'input', { type: 'text', id: id('name'), name: 'name', className: 'talk-input', autocomplete: 'name', placeholder: 'Ваше имя', 'aria-labelledby': id('q1') });
    const nameNext = nextButton('Дальше');
    const toPhone = () => { answers.name = name.value.trim(); go(2); };
    nameNext.addEventListener('click', toPhone);
    name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); toPhone(); } });
    const step2 = question(1, [
      el(doc, 'div', { className: 'talk-answer' }, [name, nameNext]),
      el(doc, 'div', { className: 'talk-links' }, [
        linkButton('← Изменить изделие', () => go(0)),
        linkButton('Можно без имени', () => { name.value = ''; toPhone(); }),
      ]),
    ]);

    // 3. The phone, a drawing or photo if there is one, the consent, and the request.
    const phone = el(doc, 'input', { type: 'tel', id: id('phone'), name: 'phone', className: 'talk-input', autocomplete: 'tel', inputmode: 'tel', placeholder: '+7 (___) ___-__-__', required: '', 'aria-labelledby': id('q2') });
    const file = el(doc, 'input', { type: 'file', id: id('file'), name: 'file', className: 'offer-file-input' });
    const fileName = el(doc, 'span', { className: 'talk-file-name', textContent: 'Есть чертёж или фото? Прикрепите файл' });
    file.addEventListener('change', () => {
      fileName.textContent = file.files && file.files.length ? file.files[0].name : 'Есть чертёж или фото? Прикрепите файл';
    });
    const consent = el(doc, 'input', { type: 'checkbox', id: id('consent'), name: 'consent', required: '' });
    const status = el(doc, 'p', { className: 'offer-status talk-status', role: 'status' });
    // A hint goes as soon as the field it was about is put right.
    phone.addEventListener('input', () => { if (phoneOk(phone.value)) status.textContent = ''; });
    consent.addEventListener('change', () => { if (consent.checked) status.textContent = ''; });
    const step3 = question(2, [
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
    const done = el(doc, 'section', { className: 'talk-step talk-done', 'data-step': '3', 'aria-labelledby': id('q3') }, [
      el(doc, 'p', { className: 'talk-q', id: id('q3') }, [doc.createTextNode('Заявка '), el(doc, 'em', { textContent: 'собрана' })]),
      summary,
      el(doc, 'p', { className: 'talk-hint', textContent: DONE_NOTE }),
      el(doc, 'div', { className: 'talk-answer talk-done-actions' }, [
        el(doc, 'a', { className: 'talk-next', href: 'tel:' + PHONE.replace(/[^+\d]/g, '') }, [el(doc, 'span', { textContent: 'Позвонить ' + PHONE })]),
        el(doc, 'a', { className: 'talk-ghost', href: TELEGRAM, target: '_blank', rel: 'noopener', textContent: 'Написать в Telegram' }),
      ]),
      el(doc, 'div', { className: 'talk-links' }, [linkButton('← Изменить ответы', () => go(2))]),
    ]);

    const steps = [step1, step2, step3, done];
    const form = el(doc, 'form', { className: 'offer-talk-form', novalidate: '' }, [receipt].concat(steps));

    function reachable(i) {
      return i === 0 || !!answers.direction;
    }
    function render() {
      steps.forEach((s, i) => { s.hidden = i !== current; });
      // An answered question shows its answer («✓ Кухня», «✓ Анна»; a skipped
      // name, once passed, «✓ Без имени»); the others their question's name.
      const values = [answers.direction, answers.name || (current > 1 ? 'Без имени' : ''), answers.phone];
      chips.forEach((chip, i) => {
        const answered = !!values[i] && i !== current;
        chip.textContent = answered ? '✓ ' + values[i] : STEPS[i].chip;
        chip.classList.toggle('is-done', answered);
        chip.classList.toggle('is-current', i === current);
        chip.disabled = !reachable(i) || current === 3;
      });
      count.textContent = current < 3 ? 'Вопрос ' + (current + 1) + ' из 3' : 'Готово';
    }
    function go(i, focus) {
      current = i;
      status.textContent = '';
      render();
      if (focus === false) return;
      const target = i === 0 ? (options.find(o => o.getAttribute('aria-pressed') === 'true') || options[0]) : i === 1 ? name : i === 2 ? phone : done.querySelector('.talk-next');
      if (target && target.focus) target.focus({ preventScroll: true });
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (current !== 2) return;
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
      answers.phone = phone.value.trim();
      summary.textContent = [answers.direction, answers.name, answers.phone].filter(Boolean).join(' · ');
      go(3);
    });

    // A page may name its direction (data-preselect): then the talk starts at the name.
    const preselect = DIRECTIONS.find(d => d.key === container.getAttribute('data-preselect'));
    if (preselect) {
      answers.direction = preselect.label;
      options.forEach(o => o.setAttribute('aria-pressed', String(o.textContent === preselect.label)));
      current = 1;
    }
    render();
    container.replaceChildren(form);
    return form;
  }

  function mountAll(doc) {
    return [...doc.querySelectorAll('[data-offer-form]')].map(c => (c.hasAttribute('data-offer-steps') ? mountSteps(c) : mount(c)));
  }

  if (typeof document !== 'undefined') mountAll(document);

  return { DIRECTIONS, FIELDS, NOT_SENT, STEPS, DONE_NOTE, phoneOk, mount, mountSteps, mountAll, enhanceBand };
});
