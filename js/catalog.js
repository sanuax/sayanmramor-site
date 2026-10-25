// js/catalog.js
//
// «Готовые изделия» as one grid (2026-10-24, the owner chose the concept «Сетка»): every piece
// at once, each on its own light plate -- its photograph, what kind of piece it is, its name,
// the price and «Запросить». Over the grid, how many pieces there are and their prices from
// the lowest to the highest, and the kinds to filter by. A piece with several photos (the
// lamp: one design, a different stone in each piece) swipes through them in the same frame.
// A photograph opens large in the site's viewer, as the works' photographs do (js/site.js).
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./offer-handoff.js'));
  } else {
    root.Catalog = factory(root.OfferHandoff);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (Handoff) {

  // The ruble sign stays on the line of its number (a no-break space); the request writes it the same way.
  const formatProductPrice = priceRub => Handoff.formatRub(priceRub);

  // «8 изделий», «1 изделие», «3 изделия».
  function countLabel(n) {
    const tens = n % 100, ones = n % 10;
    const word = ones === 1 && tens !== 11 ? 'изделие'
      : ones >= 2 && ones <= 4 && (tens < 10 || tens >= 20) ? 'изделия' : 'изделий';
    return n + ' ' + word;
  }

  // «Запросить» brings the piece into the request (2026-10-26, the owner): back to the page the
  // request was started on (js/offer-handoff.js), else the home page, with ?piece=<id>.
  function askUrl(product, store) {
    return Handoff.returnUrl(store, 'piece=' + encodeURIComponent(product.id || ''));
  }
  function session() {
    try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch (e) { return null; }
  }

  // What kind of piece it is, by its category in data/products.json, and the filter it falls under.
  const KINDS = {
    vanny: ['Ванная', 'bath'], stoly: ['Стол', 'tables'], rakushki: ['Декор', 'decor'], vazy: ['Декор', 'decor'],
    skulptury: ['Скульптура', 'decor'], svetilniki: ['Свет', 'light'],
  };
  const GROUPS = [['tables', 'Столы'], ['decor', 'Скульптура и декор'], ['bath', 'Ванная'], ['light', 'Свет']];
  const kindOf = product => KINDS[product.category] || null;

  function isAvailable(product) {
    return product.available !== false;
  }
  function priceText(product) {
    return isAvailable(product) ? formatProductPrice(product.price_rub) : 'Нет в наличии';
  }

  // «от 20 000 до 3 977 000 ₽»: the prices of the pieces in stock, the lowest to the highest.
  function priceRange(products) {
    const prices = products.filter(isAvailable).map(p => p.price_rub).filter(p => typeof p === 'number' && Number.isFinite(p));
    if (!prices.length) return '';
    const lo = Math.min(...prices), hi = Math.max(...prices);
    const num = p => Math.round(p).toLocaleString('ru-RU');
    return lo === hi ? formatProductPrice(lo) : 'от ' + num(lo) + ' до ' + num(hi) + ' ₽';
  }

  // A product with no photograph yet (none listed, or the file is missing):
  // a quiet line of text in the same area instead of an empty box.
  const NO_PHOTO_TEXT = 'Фото пока нет';

  function photoPlaceholder() {
    const note = document.createElement('span');
    note.className = 'stock-placeholder';
    note.textContent = NO_PHOTO_TEXT;
    return note;
  }

  function photo(src, alt) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = alt;
    img.src = src;
    img.addEventListener('error', () => img.replaceWith(photoPlaceholder()));
    return img;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Several photos of one product: a swipeable row inside the same frame -- CSS scroll-snap,
  // no script. Focusable, so the keyboard can scroll it too.
  function photoStrip(name, photos) {
    const strip = el('div', 'stock-strip');
    strip.tabIndex = 0;
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', name + ', ' + photos.length + ' фото');
    photos.forEach((src, i) => strip.appendChild(photo(src, 'Фото ' + (i + 1) + ' из ' + photos.length)));
    return strip;
  }

  function photoCount(n) {
    const count = el('span', 'stock-count', n + ' фото');
    count.setAttribute('aria-hidden', 'true');   // the strip's label already says it
    return count;
  }

  // «Запросить»: the site's main button, naming the piece for screen readers.
  function askButton(product) {
    const a = el('a', 'btn btn-primary stock-ask', 'Запросить');
    a.href = askUrl(product, session());
    a.setAttribute('aria-label', 'Запросить: ' + (product.name || ''));
    return a;
  }

  // One piece on its plate: the photograph (or the row of them), its kind, its name, and at the
  // foot the price and «Запросить» -- at the foot, so across a row they stand on one line.
  function buildProductCard(product) {
    const card = el('li', 'stock-card');
    const kind = kindOf(product);
    if (kind) card.dataset.group = kind[1];
    const shot = el('div', 'stock-shot');
    const photos = Array.isArray(product.photos) ? product.photos : [];
    card.photos = [];   // each photograph and its image, for the viewer
    if (photos.length > 1) {
      const strip = photoStrip(product.name || '', photos);
      Array.from(strip.children).forEach((img, i) => card.photos.push({ src: photos[i], img }));
      shot.appendChild(strip);
      shot.appendChild(photoCount(photos.length));
    } else if (photos[0]) {
      const img = photo(photos[0], product.name || '');
      card.photos.push({ src: photos[0], img });
      shot.appendChild(img);
    } else {
      shot.appendChild(photoPlaceholder());
    }
    if (!isAvailable(product)) shot.appendChild(el('span', 'stock-badge', 'Нет в наличии'));
    card.appendChild(shot);
    const text = el('div', 'stock-text');
    if (kind) text.appendChild(el('p', 'stock-kind', kind[0]));
    text.appendChild(el('h2', 'stock-name', product.name));
    if (product.description) text.appendChild(el('p', 'stock-description', product.description));
    const foot = el('div', 'stock-foot');
    foot.appendChild(el('p', 'stock-price', priceText(product)));
    foot.appendChild(askButton(product));
    text.appendChild(foot);
    card.appendChild(text);
    return card;
  }

  // The kinds to filter by: «Все» and each kind there is, with how many pieces it has.
  function buildFilter(cards) {
    const box = el('div', 'stock-filter');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Показать');
    const groups = [['all', 'Все']].concat(GROUPS).map(([id, label]) => ({
      id, label, n: id === 'all' ? cards.length : cards.filter(c => c.dataset.group === id).length,
    })).filter(g => g.n > 0);
    if (groups.length < 3) return null;   // «Все» and one kind: nothing to choose
    const chips = groups.map(g => {
      const b = el('button', 'stock-chip' + (g.id === 'all' ? ' is-on' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(g.id === 'all'));
      b.appendChild(document.createTextNode(g.label + ' '));
      b.appendChild(el('span', '', String(g.n)));
      b.addEventListener('click', () => {
        chips.forEach(c => { c.classList.toggle('is-on', c === b); c.setAttribute('aria-pressed', String(c === b)); });
        cards.forEach(card => { card.hidden = g.id !== 'all' && card.dataset.group !== g.id; });
      });
      box.appendChild(b);
      return b;
    });
    return box;
  }

  // The grid into `container`; the count and the prices into `parts.meta`, the filter into `parts.filter`.
  function renderCatalog(container, products, parts) {
    container.innerHTML = '';
    if (!products || products.length === 0) {
      container.appendChild(el('div', 'catalog-empty', 'Пока нет готовых изделий - загляните позже.'));
      return null;
    }
    const grid = el('ul', 'stock-grid');
    const cards = products.map(buildProductCard);
    cards.forEach(c => grid.appendChild(c));
    container.appendChild(grid);
    const meta = parts && parts.meta, slot = parts && parts.filter;
    if (meta) {
      meta.innerHTML = '';
      meta.appendChild(el('b', '', countLabel(products.length)));
      const range = priceRange(products);
      if (range) meta.appendChild(document.createTextNode(' ' + range));
    }
    const filter = slot ? buildFilter(cards) : null;
    if (filter) slot.appendChild(filter);
    const shots = [].concat(...cards.map(c => c.photos));
    const viewer = typeof window !== 'undefined' && window.SiteCommon && window.SiteCommon.enableViewer;
    if (viewer && shots.length) viewer(grid, shots.map(p => ({ image: p.src, thumb: p.src })), { triggers: shots.map(p => p.img), radius: 12 });
    return { grid, cards, filter, shots };
  }

  return { NO_PHOTO_TEXT, KINDS, askUrl, formatProductPrice, countLabel, priceRange, isAvailable, buildProductCard, buildFilter, renderCatalog };
});
