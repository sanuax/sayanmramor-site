// js/home-collection.js
//
// «Готовые изделия» on the home page: every product of data/products.json as
// an exhibition wall -- two rows, the pieces of a row at one height, each in
// its own proportions (no cropping), standing on one line; under each its
// number in the collection (its place in the data), name and price, and the
// way through to the catalogue. Nothing is added to the data: the names and
// prices are the owner's, formatted by catalog.js exactly as in the catalogue.
// No «Купить» here: buying stays in the catalogue.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(root.Catalog || (typeof require === 'function' ? require('./catalog.js') : null));
  } else {
    root.HomeCollection = factory(root.Catalog);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (Catalog) {

  const CATALOG_URL = '/sayanmramor-site/katalog.html';
  const LOAD_ERROR = 'Не удалось загрузить готовые изделия.';
  const PER_ROW = 4;

  // { number, name, price, photo } for each product, in the order of the data.
  function items(products) {
    return (products || []).map((p, i) => ({
      number: String(i + 1).padStart(2, '0'),
      name: p.name,
      price: Catalog.formatProductPrice(p.price_rub),
      photo: (p.photos && p.photos[0]) || '',
    }));
  }

  // The rows of the wall: PER_ROW pieces each.
  function rows(list) {
    const out = [];
    for (let i = 0; i < list.length; i += PER_ROW) out.push(list.slice(i, i + PER_ROW));
    return out;
  }

  // A row knows the sum of its pieces' proportions, so CSS can keep its
  // height within what the photographs allow (--exhibit-max-h).
  function updateRow(row) {
    const sum = [...row.children].reduce((s, li) => s + Number(li.style.getPropertyValue('--ar') || 0.75), 0);
    row.style.setProperty('--sum', sum.toFixed(3));
  }

  function piece(doc, item, row) {
    const li = doc.createElement('li');
    li.className = 'exhibit-item';
    li.style.setProperty('--ar', '0.75');            // until the photo tells its own proportion
    const a = doc.createElement('a');
    a.className = 'exhibit-link';
    a.href = CATALOG_URL;
    const frame = doc.createElement('span');
    frame.className = 'exhibit-photo';
    if (item.photo) {
      const img = doc.createElement('img');
      img.alt = item.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('load', () => {
        if (img.naturalWidth && img.naturalHeight) {
          li.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(3));
          updateRow(row);
        }
      });
      img.addEventListener('error', () => { frame.textContent = Catalog.NO_PHOTO_TEXT; frame.classList.add('is-empty'); });
      img.src = item.photo;
      frame.appendChild(img);
    } else {
      frame.textContent = Catalog.NO_PHOTO_TEXT;
      frame.classList.add('is-empty');
    }
    const label = doc.createElement('span');
    label.className = 'exhibit-label';
    const number = doc.createElement('span');
    number.className = 'exhibit-number';
    number.textContent = item.number;
    const name = doc.createElement('span');
    name.className = 'exhibit-name';
    name.textContent = item.name;
    const price = doc.createElement('span');
    price.className = 'exhibit-price';
    price.textContent = item.price;
    label.append(number, name, price);
    a.append(frame, label);
    li.appendChild(a);
    return li;
  }

  function render(container, products) {
    const doc = container.ownerDocument;
    container.replaceChildren(...rows(items(products)).map(group => {
      const row = doc.createElement('ul');
      row.className = 'exhibit-row';
      group.forEach(item => row.appendChild(piece(doc, item, row)));
      updateRow(row);
      return row;
    }));
    return container;
  }

  function init(doc) {
    const container = doc.querySelector('[data-collection]');
    if (!container || !Catalog) return null;
    return fetch('/sayanmramor-site/data/products.json')
      .then(r => r.json())
      .then(data => render(container, data.products || []))
      .catch(() => { container.textContent = LOAD_ERROR; });
  }

  if (typeof document !== 'undefined' && typeof window !== 'undefined') init(document);

  return { CATALOG_URL, LOAD_ERROR, PER_ROW, items, rows, render, init };
});
