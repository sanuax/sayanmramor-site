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
  // request was started on (js/offer-handoff.js), else the home page, with ?piece=<id>. A sold
  // piece would come back as no card: it opens the plain request.
  function askUrl(product, store) {
    return Handoff.returnUrl(store, isAvailable(product) ? 'piece=' + encodeURIComponent(product.id || '') : '');
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
    const picks = typeof window !== 'undefined' && window.Picks;
    if (picks && product.id) shot.appendChild(picks.heart(document, picks.PIECES, product.id, product.name));
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

  // The address keeps the kind being looked at (?kind=tables), so a reload or «назад» shows it again.
  const KIND_PARAM = 'kind';
  function kindFromSearch(search) {
    const k = new URLSearchParams(search || '').get(KIND_PARAM);
    return GROUPS.some(([id]) => id === k) ? k : 'all';
  }
  function searchWithKind(search, id) {
    const params = new URLSearchParams(search || '');
    if (id === 'all') params.delete(KIND_PARAM);
    else params.set(KIND_PARAM, id);
    const q = params.toString();
    return q ? '?' + q : '';
  }

  // The kinds to filter by: «Все» and each kind there is, with how many pieces it has.
  // `onChoose(id, label)` hears a press; `initial` is the kind to show first.
  function buildFilter(cards, onChoose, initial) {
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
        choose(g.id);
        if (onChoose) onChoose(g.id, g.label);
      });
      box.appendChild(b);
      return b;
    });
    function choose(id) {
      chips.forEach((c, i) => { const on = groups[i].id === id; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', String(on)); });
      cards.forEach(card => { card.hidden = id !== 'all' && card.dataset.group !== id; });
    }
    if (initial && initial !== 'all' && groups.some(g => g.id === initial)) choose(initial);
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
    // The count and the prices are those of what is shown: all, or the kind chosen.
    const count = el('b', '', '');
    const prices = document.createTextNode('');
    const show = id => {
      const list = products.filter((p, i) => id === 'all' || cards[i].dataset.group === id);
      count.textContent = countLabel(list.length);
      const range = priceRange(list);
      prices.textContent = range ? ' ' + range : '';
      return list;
    };
    const win = typeof window !== 'undefined' ? window : null;
    const initial = win && win.location ? kindFromSearch(win.location.search) : 'all';
    if (meta) {
      meta.innerHTML = '';
      meta.removeAttribute('data-waiting');
      meta.appendChild(count);
      meta.appendChild(prices);
      const picks = typeof window !== 'undefined' && window.Picks;
      if (picks) {
        const way = el('div', '');
        way.appendChild(picks.link(document));
        meta.appendChild(way);
      }
    }
    // A choice is said aloud to a screen reader too, and kept in the address.
    const said = el('p', 'visually-hidden');
    said.setAttribute('aria-live', 'polite');
    const onChoose = (id, label) => {
      const list = show(id);
      said.textContent = (id === 'all' ? 'Все изделия' : label) + ': ' + countLabel(list.length);
      if (win && win.history && win.history.replaceState && win.location) {
        win.history.replaceState(win.history.state, '', win.location.pathname + searchWithKind(win.location.search, id) + win.location.hash);
      }
    };
    const filter = slot ? buildFilter(cards, onChoose, initial) : null;
    show(filter ? initial : 'all');
    if (slot) {
      slot.replaceChildren();
      slot.removeAttribute('data-waiting');
    }
    if (filter) {
      slot.appendChild(filter);
      slot.appendChild(said);
    }
    const shots = [].concat(...cards.map(c => c.photos));
    const viewer = typeof window !== 'undefined' && window.SiteCommon && window.SiteCommon.enableViewer;
    if (viewer && shots.length) viewer(grid, shots.map(p => ({ image: p.src, thumb: p.src })), { triggers: shots.map(p => p.img), radius: 12 });
    return { grid, cards, filter, shots };
  }

  return { NO_PHOTO_TEXT, KINDS, askUrl, formatProductPrice, countLabel, priceRange, isAvailable, kindFromSearch, searchWithKind, buildProductCard, buildFilter, renderCatalog };
});
