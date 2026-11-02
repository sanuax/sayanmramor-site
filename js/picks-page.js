// js/picks-page.js
//
// podborka.html: the list of js/picks.js. Without a list in the address it is this browser's own
// («Моя подборка», with «Поделиться ссылкой»); with one it is what someone sent («Подборка», with
// «Сохранить себе»). Stones come from the configurator's light index and pieces from the
// catalogue, so whatever the parser or the catalogue changes shows here by itself: a stone that
// has left the index is taken off the own list and said so. A heart pressed here leaves its card
// in place, so a slip can be undone; the card is gone on the next visit.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./picks.js'), require('./catalog.js'), require('./offer-handoff.js'));
  } else {
    root.PicksPage = factory(root.Picks, root.Catalog, root.OfferHandoff);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (Picks, Catalog, Handoff) {

  const STONE_INDEX_URL = '/sayanmramor-calculator/data/stone-index.json';
  const STONE_IMAGE_BASE = '/sayanmramor-calculator/data/';
  const PRODUCTS_URL = '/sayanmramor-site/data/products.json';

  // The ids in the order they were marked -> the records still in the catalogue, and how many are not.
  function found(picked, records) {
    const known = picked.map(id => records.find(r => r && r.id === id)).filter(Boolean);
    return { known, missing: picked.length - known.length };
  }

  function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // The configurator with this stone, and with the product of the direction page the visitor came from.
  function buildUrl(stoneId, product) {
    return Handoff.CALCULATOR + '?' + (product ? 'product=' + encodeURIComponent(product) + '&' : '') + 'stone=' + encodeURIComponent(stoneId);
  }

  // A stone on the catalogue's plate: its photograph, its type, its name, the price per m2,
  // and the way into the configurator with this stone.
  function stoneCard(doc, stone, product) {
    const card = el(doc, 'li', 'stock-card');
    const shot = el(doc, 'div', 'stock-shot');
    card.photos = [];
    if (stone.image) {
      const img = el(doc, 'img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = stone.name;
      img.src = STONE_IMAGE_BASE + stone.image;
      img.addEventListener('error', () => img.remove());
      shot.appendChild(img);
      card.photos.push({ src: img.src, img });
    }
    shot.appendChild(Picks.heart(doc, Picks.STONES, stone.id, stone.name));
    const text = el(doc, 'div', 'stock-text');
    if (stone.category_label_ru) text.appendChild(el(doc, 'p', 'stock-kind', stone.category_label_ru));
    text.appendChild(el(doc, 'h2', 'stock-name', stone.name));
    const foot = el(doc, 'div', 'stock-foot');
    foot.appendChild(el(doc, 'p', 'stock-price', typeof stone.price_from === 'number' ? 'от ' + Handoff.formatRub(stone.price_from) + '/м²' : ''));
    const go = el(doc, 'a', 'btn btn-primary stock-ask', 'Собрать');
    go.href = buildUrl(stone.id, product);
    go.setAttribute('aria-label', 'Собрать изделие из камня ' + stone.name);
    foot.appendChild(go);
    text.appendChild(foot);
    card.append(shot, text);
    return card;
  }

  function section(doc, title, cards) {
    const box = el(doc, 'section', 'picks-section');
    box.appendChild(el(doc, 'h2', 'picks-section-title', title));
    const grid = el(doc, 'ul', 'stock-grid');
    grid.append(...cards);
    box.appendChild(grid);
    const shots = [].concat(...cards.map(c => c.photos || []));
    const viewer = doc.defaultView && doc.defaultView.SiteCommon && doc.defaultView.SiteCommon.enableViewer;
    if (viewer && shots.length) viewer(grid, shots.map(p => ({ image: p.src, thumb: p.src })), { triggers: shots.map(p => p.img), radius: 12 });
    return box;
  }

  // The share sheet where there is one, else the clipboard, else the address to copy by hand.
  function shareButton(doc, store, status) {
    const win = doc.defaultView;
    const button = el(doc, 'button', 'btn btn-primary', 'Поделиться ссылкой');
    button.type = 'button';
    const field = el(doc, 'input', 'picks-address');
    field.readOnly = true;
    field.hidden = true;
    field.setAttribute('aria-label', 'Ссылка на подборку');
    button.addEventListener('click', () => {
      const picks = Picks.read(store);
      if (!Picks.total(picks)) { status.textContent = 'В подборке пока ничего нет.'; return; }
      const url = win.location.origin + Picks.sharePath(picks);
      const byHand = () => {
        field.value = url;
        field.hidden = false;
        field.select();
        status.textContent = 'Скопируйте ссылку и отправьте её.';
      };
      const copy = () => (win.navigator.clipboard
        ? win.navigator.clipboard.writeText(url).then(() => { field.hidden = true; status.textContent = 'Ссылка скопирована.'; }, byHand)
        : byHand());
      if (win.navigator.share && win.matchMedia('(pointer: coarse)').matches) {
        win.navigator.share({ url, title: 'Подборка камней Саянмрамор' }).catch(err => { if (!err || err.name !== 'AbortError') copy(); });
      } else copy();
    });
    return [button, field];
  }

  function emptyState(doc) {
    const box = el(doc, 'div', 'picks-empty');
    box.appendChild(el(doc, 'p', '', 'Здесь пока пусто. Отмечайте сердечком камни в калькуляторе и на страницах изделий, а ещё готовые изделия.'));
    const links = el(doc, 'div', 'picks-actions');
    const katalog = el(doc, 'a', 'btn btn-primary', 'Готовые изделия');
    katalog.href = Handoff.KATALOG;
    const stones = el(doc, 'a', 'btn btn-secondary', 'Выбрать камень');
    stones.href = '/sayanmramor-site/kamen.html';   // the stone gallery (2026-11-02, the owner: not the calculator)
    links.append(katalog, stones);
    box.appendChild(links);
    return box;
  }

  function render(doc, stonesData, productsData) {
    const win = doc.defaultView;
    const store = Picks.storage(win);
    const shared = Picks.readShared(win.location.search);
    const picks = shared || Picks.read(store);
    const stones = found(picks[Picks.STONES], (stonesData && stonesData.stones) || []);
    const pieces = found(picks[Picks.PIECES], (productsData && productsData.products) || []);

    doc.getElementById('picksTitle').textContent = shared ? 'Подборка' : 'Моя подборка';
    if (shared) doc.title = 'Подборка - Саянмрамор';
    const lead = doc.getElementById('picksLead');
    const actions = doc.getElementById('picksActions');
    const status = doc.getElementById('picksStatus');
    const host = doc.getElementById('picksHost');

    if (!shared) {
      // Only what the catalogues did answer about: a failed load takes nothing off the list.
      if (stones.missing && stonesData) Picks.removeMissing(store, Picks.STONES, stones.known.map(s => s.id));
      if (pieces.missing && productsData) Picks.removeMissing(store, Picks.PIECES, pieces.known.map(p => p.id));
    }
    const missing = stones.missing + pieces.missing;
    if ((missing && stonesData && productsData)) {
      status.textContent = shared ? 'Некоторых камней и изделий из этой подборки уже нет в каталоге.' : 'Некоторых камней и изделий уже нет в каталоге, мы убрали их из подборки.';
    }

    if (!stones.known.length && !pieces.known.length) {
      lead.textContent = '';
      if (!stonesData || !productsData) status.textContent = 'Не удалось загрузить подборку. Обновите страницу.';
      else host.replaceChildren(emptyState(doc));
      return;
    }
    if (shared) {
      lead.textContent = 'С вами поделились камнями и изделиями. Отмечайте понравившееся сердечком или сохраните всю подборку себе.';
      const save = el(doc, 'button', 'btn btn-primary', 'Сохранить себе');
      save.type = 'button';
      save.addEventListener('click', () => {
        Picks.merge(store, shared);
        Picks.sync(doc);
        status.textContent = 'Сохранено в вашу подборку.';
      });
      const mine = Picks.link(doc);
      actions.replaceChildren(save, mine);
    } else {
      lead.textContent = 'Камни и изделия, которые вы отметили сердечком. Список хранится в этом браузере. Чтобы показать его супругу или дизайнеру, отправьте ссылку.';
      actions.replaceChildren(...shareButton(doc, store, status));
    }
    const sections = [];
    if (stones.known.length) sections.push(section(doc, Picks.label({ [Picks.STONES]: stones.known, [Picks.PIECES]: [] }), stones.known.map(s => stoneCard(doc, s, new URLSearchParams(win.location.search).get('product')))));
    if (pieces.known.length) sections.push(section(doc, Picks.label({ [Picks.STONES]: [], [Picks.PIECES]: pieces.known }), pieces.known.map(p => Catalog.buildProductCard(p))));
    host.replaceChildren(...sections);
  }

  function init(doc) {
    const load = url => doc.defaultView.fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
    return Promise.all([load(STONE_INDEX_URL), load(PRODUCTS_URL)]).then(([stones, products]) => render(doc, stones, products));
  }

  return { found, buildUrl, render, init };
});
