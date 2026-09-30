// js/offer-form.js
//
// «Получите коммерческое предложение по вашему техническому заданию» -- the
// request block the old sayanmramor.ru closed its pages with. Each page carries
// the same static band (its heading is plain HTML); this module renders the
// form into its <div data-offer-form> (data-preselect="<direction key>" picks
// the page's own direction). The directions are the SITE's -- not the
// configurator's product types. There is no backend yet: a valid submit says
// so and gives the phone and e-mail instead of pretending to send anything.
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

  const SVG_NS = 'http://www.w3.org/2000/svg';
  // Two small line icons, drawn in currentColor: a paper clip and an arrow.
  const ICONS = {
    clip: 'M15.5 6.5 8.2 13.8a2 2 0 0 0 2.8 2.8l7.4-7.4a4 4 0 0 0-5.7-5.7l-7.6 7.6a6 6 0 0 0 8.5 8.5L20 13',
    arrow: 'M5 12h14M13 6l6 6-6 6',
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
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICONS[name]);
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
      [el(doc, 'option', { value: '', textContent: 'Без категории' })].concat(DIRECTIONS.map(d => {
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
      el(doc, 'label', { className: 'offer-file', htmlFor: id('file') }, [
        el(doc, 'span', { className: 'offer-file-icon' }, [icon(doc, 'clip')]),
        el(doc, 'span', { className: 'offer-file-text' }, [
          el(doc, 'span', { className: 'offer-file-title', textContent: 'Прикрепить техническое задание' }),
          fileName,
        ]),
      ]),
    ]);

    const consent = el(doc, 'input', { type: 'checkbox', id: id('consent'), name: 'consent', required: '' });
    const status = el(doc, 'p', { className: 'offer-status', role: 'status' });

    const form = el(doc, 'form', { className: 'offer-form', novalidate: '' }, [
      field(doc, id('name'), 'ФИО', el(doc, 'input', { type: 'text', id: id('name'), name: 'name', className: 'offer-input', autocomplete: 'name' })),
      field(doc, id('phone'), 'Телефон', el(doc, 'input', { type: 'tel', id: id('phone'), name: 'phone', className: 'offer-input', autocomplete: 'tel', inputmode: 'tel', required: '' })),
      field(doc, id('direction'), 'Категория', select),
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
        el(doc, 'span', { textContent: 'Получить' }), icon(doc, 'arrow'),
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
    return form;
  }

  function mountAll(doc) {
    return [...doc.querySelectorAll('[data-offer-form]')].map(mount);
  }

  if (typeof document !== 'undefined') mountAll(document);

  return { DIRECTIONS, NOT_SENT, mount, mountAll };
});
