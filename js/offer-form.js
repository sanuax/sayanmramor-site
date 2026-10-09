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

  function mountAll(doc) {
    return [...doc.querySelectorAll('[data-offer-form]')].map(mount);
  }

  if (typeof document !== 'undefined') mountAll(document);

  return { DIRECTIONS, FIELDS, NOT_SENT, mount, mountAll, enhanceBand };
});
