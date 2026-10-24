// js/catalog.js
//
// «Готовые изделия»: a gallery after hours, not a shop window. On a wide
// screen one piece at a time: its name set large, its price, «Запросить» and,
// for a piece with several photos, their thumbnails; beside it, its photograph,
// tall. At the foot of the words, level with the photograph's, a quiet index
// of all the pieces and the count («3 из 8») between the arrows. The arrows, ← → (while the focus is in the
// collection), the index (a click, the keyboard, or a mouse passing over it)
// change the piece; the photograph cross-fades and settles. On a narrow screen
// the pieces stand one under another, each its photo, name, price and
// «Запросить». No «Купить» buttons in a row: one quiet request link per piece.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Catalog = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // The ruble sign stays on the line of its number (a no-break space).
  function formatProductPrice(priceRub) {
    if (typeof priceRub !== 'number' || !Number.isFinite(priceRub)) return 'Цена по запросу';
    return Math.round(priceRub).toLocaleString('ru-RU') + ' ₽';
  }

  // «8 изделий», «1 изделие», «3 изделия».
  function countLabel(n) {
    const tens = n % 100, ones = n % 10;
    const word = ones === 1 && tens !== 11 ? 'изделие'
      : ones >= 2 && ones <= 4 && (tens < 10 || tens >= 20) ? 'изделия' : 'изделий';
    return n + ' ' + word;
  }

  // «3 из 8»: the place in the collection (2026-10-15, the owner: no «03 / 08»).
  function position(i, n) {
    return (i + 1) + ' из ' + n;
  }

  // A request goes to the request form on the home page, where «Готовые
  // изделия» is one of the directions to choose.
  const ORDER_URL = '/sayanmramor-site/index.html#offer';

  function isAvailable(product) {
    return product.available !== false;
  }
  function priceText(product) {
    return isAvailable(product) ? formatProductPrice(product.price_rub) : 'Нет в наличии';
  }

  // A product with no photograph yet (none listed, or the file is missing):
  // a quiet line of text in the same area instead of an empty box.
  const NO_PHOTO_TEXT = 'Фото пока нет';

  function photoPlaceholder() {
    const note = document.createElement('span');
    note.className = 'product-tile-placeholder';
    note.textContent = NO_PHOTO_TEXT;
    return note;
  }

  // done (optional): called once the photograph has loaded, or has been replaced by the quiet line.
  function photo(src, alt, eager, done) {
    const img = document.createElement('img');
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.alt = alt;
    img.src = src;
    img.addEventListener('error', () => { img.replaceWith(photoPlaceholder()); if (done) done(); });
    if (done) img.addEventListener('load', done);
    return img;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // The request: a line of text with the site's arrow, naming the piece for screen readers.
  function askLink(product) {
    const a = el('a', 'ask', 'Запросить');
    a.href = ORDER_URL;
    a.setAttribute('aria-label', 'Запросить: ' + (product.name || ''));
    return a;
  }

  // Several photos of one product (the lamp: one design, a different stone
  // in each piece): a swipeable row inside the same area -- CSS scroll-snap,
  // no script. Focusable, so the keyboard can scroll it too.
  function photoStrip(name, photos) {
    const strip = el('div', 'product-tile-strip');
    strip.tabIndex = 0;
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', name + ', ' + photos.length + ' фото');
    photos.forEach((src, i) => strip.appendChild(photo(src, 'Фото ' + (i + 1) + ' из ' + photos.length)));
    return strip;
  }

  function photoCount(n) {
    const count = el('span', 'product-tile-count', n + ' фото');
    count.setAttribute('aria-hidden', 'true');   // the strip's label already says it
    return count;
  }

  // A piece as it stands on a narrow screen: its photo (or the row of them),
  // then the name and the price on one line, «Запросить» under them.
  function buildProductCard(product) {
    const card = el('div', 'product-tile');
    const imageWrap = el('div', 'product-tile-image');
    const photos = Array.isArray(product.photos) ? product.photos : [];
    if (photos.length > 1) {
      imageWrap.appendChild(photoStrip(product.name || '', photos));
      imageWrap.appendChild(photoCount(photos.length));
    } else if (photos[0]) {
      imageWrap.appendChild(photo(photos[0], product.name || ''));
    } else {
      imageWrap.appendChild(photoPlaceholder());
    }
    if (!isAvailable(product)) imageWrap.appendChild(el('span', 'badge-oos', 'Нет в наличии'));
    card.appendChild(imageWrap);
    card.appendChild(el('div', 'product-tile-name', product.name));
    card.appendChild(el('div', 'product-tile-price', formatProductPrice(product.price_rub)));
    if (product.description) card.appendChild(el('div', 'product-tile-description', product.description));
    card.appendChild(askLink(product));
    return card;
  }

  function toggle(node, cls, on) {
    if (on) node.classList.add(cls); else node.classList.remove(cls);
  }
  // A short settling movement for the piece's words, when the browser can (WAAPI); nothing otherwise.
  // Quick, as the photograph beside it changes at once (2026-10-24, the owner).
  function settle(node, reduce) {
    if (reduce || typeof node.animate !== 'function') return;
    node.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }

  // The wide screen's gallery, built once; select(i, k) shows piece i (its k-th photo).
  function buildCollection(products) {
    const n = products.length;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = el('div', 'collection');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'галерея');
    root.setAttribute('aria-label', 'Готовые изделия');

    // The piece: its words.
    const info = el('div', 'collection-info');
    const piece = el('div', 'collection-piece');
    piece.setAttribute('aria-live', 'polite');
    const title = el('h2', 'collection-title');
    const price = el('p', 'collection-price');
    const ask = el('div', 'collection-ask');
    piece.appendChild(title);
    piece.appendChild(price);
    piece.appendChild(ask);
    const thumbs = el('div', 'collection-thumbs');

    // The count and the arrows.
    const nav = el('div', 'collection-nav');
    const prev = el('button', 'collection-arrow collection-prev');
    prev.type = 'button';
    prev.setAttribute('aria-label', 'Предыдущее изделие');
    const count = el('span', 'collection-count');
    count.setAttribute('aria-hidden', 'true');   // the live words say which piece it is
    const next = el('button', 'collection-arrow collection-next');
    next.type = 'button';
    next.setAttribute('aria-label', 'Следующее изделие');
    nav.appendChild(prev);
    nav.appendChild(count);
    nav.appendChild(next);

    // The index of all the pieces.
    const list = el('ol', 'collection-list');
    list.setAttribute('aria-label', 'Все изделия');

    info.appendChild(piece);
    info.appendChild(thumbs);
    info.appendChild(list);
    info.appendChild(nav);

    // The photograph.
    const stage = el('div', 'collection-stage');
    stage.id = 'collectionStage';
    const frame = el('div', 'collection-photo');
    stage.appendChild(frame);

    const rows = [], lines = [];
    const shots = {};   // 'i-k' -> the holder of that photo (or its placeholder) in the frame
    let current = -1;
    let wanted = null;   // the photograph asked for last: the one to show once it is ready

    // The photograph asked for replaces the one shown only once it has loaded -- never an empty
    // frame (2026-10-15, the owner).
    function show(on) {
      if (wanted !== on) return;   // another one was asked for meanwhile
      Object.keys(shots).forEach(key => toggle(shots[key], 'is-on', shots[key] === on));
    }
    const loading = new Set();   // the holders whose photograph is still on its way
    const ready = holder => !loading.has(holder);

    function shot(i, k) {
      const key = i + '-' + k;
      if (!shots[key]) {
        const p = products[i];
        const photos = Array.isArray(p.photos) ? p.photos : [];
        const holder = el('div', 'collection-shot');
        const loaded = () => {
          loading.delete(holder);
          show(holder);
        };
        const img = photos[k] ? photo(photos[k], k ? (p.name || '') + ', фото ' + (k + 1) : (p.name || ''), true, loaded) : null;   // asked for: fetched at once
        if (img && img.complete === false) loading.add(holder);
        holder.appendChild(img || photoPlaceholder());
        frame.appendChild(holder);
        shots[key] = holder;
      }
      return shots[key];
    }

    // `still`: chosen from the keyboard -- a key is pressed often, so the words are simply there.
    function select(i, k, still) {
      i = (i + n) % n;
      k = k || 0;
      const on = shot(i, k);
      wanted = on;
      if (ready(on)) show(on);
      rows.forEach((b, m) => b.setAttribute('aria-current', String(m === i)));
      lines.forEach((li, m) => toggle(li, 'is-on', m === i));
      if (i === current) {   // another photo of the same piece: only the thumbnails' mark moves
        Array.from(thumbs.children).forEach((t, m) => t.setAttribute('aria-current', String(m === k)));
        return;
      }
      current = i;
      const p = products[i];
      title.textContent = p.name;
      price.textContent = priceText(p);
      ask.innerHTML = '';
      ask.appendChild(askLink(p));
      count.textContent = position(i, n);
      settle(piece, reduce || still);
      thumbs.innerHTML = '';
      const photos = Array.isArray(p.photos) ? p.photos : [];
      if (photos.length > 1) {
        photos.forEach((src, m) => {
          const b = el('button');
          b.type = 'button';
          b.setAttribute('aria-label', (p.name || '') + ', фото ' + (m + 1) + ' из ' + photos.length);
          b.setAttribute('aria-current', String(m === k));
          b.appendChild(photo(src, '', true));
          b.addEventListener('click', () => select(i, m));
          thumbs.appendChild(b);
        });
      }
      // The pieces either side are fetched ahead, so neither arrow waits.
      shot((i + 1) % n, 0);
      shot((i - 1 + n) % n, 0);
    }

    products.forEach((p, i) => {
      const li = el('li', 'collection-row');
      const b = el('button', 'collection-item', p.name);
      b.type = 'button';
      b.setAttribute('aria-controls', 'collectionStage');
      b.setAttribute('aria-current', 'false');
      // A mouse passing over the index previews; a click or the keyboard choose.
      b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') select(i); });
      b.addEventListener('focus', () => select(i, 0, b.matches && b.matches(':focus-visible')));
      b.addEventListener('click', () => select(i));
      li.appendChild(b);
      list.appendChild(li);
      rows.push(b);
      lines.push(li);
    });
    prev.addEventListener('click', e => select(current - 1, 0, !!e && e.detail === 0));   // detail 0: Enter or Space
    next.addEventListener('click', e => select(current + 1, 0, !!e && e.detail === 0));
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); select(current + 1, 0, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); select(current - 1, 0, true); }
    });

    const cards = el('div', 'collection-cards');
    products.forEach(p => cards.appendChild(buildProductCard(p)));

    root.appendChild(info);
    root.appendChild(stage);
    root.appendChild(cards);
    select(0);
    return { root, select, rows, cards, prev, next };
  }

  function renderCatalog(container, products) {
    container.innerHTML = '';
    if (!products || products.length === 0) {
      container.appendChild(el('div', 'catalog-empty', 'Пока нет готовых изделий - загляните позже.'));
      return null;
    }
    const collection = buildCollection(products);
    container.appendChild(collection.root);
    return collection;
  }

  return { NO_PHOTO_TEXT, ORDER_URL, formatProductPrice, countLabel, position, isAvailable, buildProductCard, buildCollection, renderCatalog };
});
