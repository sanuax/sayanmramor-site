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
    const card = el(doc, 'li', 'stock-card stock-card-stone');
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
    go.appendChild(el(doc, 'span', 'stock-ask-tail', ' изделие'));
    go.href = buildUrl(stone.id, product);
    go.setAttribute('aria-label', 'Собрать изделие из камня ' + stone.name);
    foot.appendChild(go);
    text.appendChild(foot);
    card.append(shot, text);
    return card;
  }

  // A card of its size before its record has come: the plate and the photo area, the words unseen.
  function waitingCard(doc, stone) {
    const card = el(doc, 'li', 'stock-card' + (stone ? ' stock-card-stone' : ''));
    const text = el(doc, 'div', 'stock-text');
    text.append(el(doc, 'p', 'stock-kind', ' '), el(doc, 'p', 'stock-name', ' '));
    const foot = el(doc, 'div', 'stock-foot');
    const ask = el(doc, 'span', 'btn btn-primary stock-ask', stone ? 'Собрать' : 'Запросить');
    if (stone) ask.appendChild(el(doc, 'span', 'stock-ask-tail', ' изделие'));
    foot.append(el(doc, 'p', 'stock-price', ' '), ask);
    text.appendChild(foot);
    card.append(el(doc, 'div', 'stock-shot'), text);
    return card;
  }

  // Beside each list's title, the way to more of its kind.
  const MORE = {
    stones: ['Выбрать ещё камни', '/sayanmramor-site/kamen.html'],
    pieces: ['Все готовые изделия', '/sayanmramor-site/katalog.html'],
  };
  function sectionHead(doc, title, kind) {
    const head = el(doc, 'div', 'picks-section-head');
    head.appendChild(el(doc, 'h2', 'picks-section-title', title));
    const more = el(doc, 'a', 'picks-more', MORE[kind][0]);
    more.href = MORE[kind][1];
    head.appendChild(more);
    return head;
  }

  function section(doc, title, cards, kind) {
    const box = el(doc, 'section', 'picks-section');
    box.dataset.kind = kind;
    box.appendChild(sectionHead(doc, title, kind));
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

  // Nothing to show: one line for each way it came about, never two that argue (2026-11-02).
  const EMPTY = {
    own: 'Здесь пока пусто. Отмечайте сердечком камни и готовые изделия, они появятся здесь.',
    ownGone: 'Камней и изделий из вашей подборки уже нет в каталоге, мы убрали их. Отмечайте сердечком новые, они появятся здесь.',
    sharedGone: 'Камней и изделий из этой подборки уже нет в каталоге. Посмотрите, что есть сейчас.',
  };
  function emptyState(doc, text) {
    const box = el(doc, 'div', 'picks-empty');
    box.appendChild(el(doc, 'p', '', text || EMPTY.own));
    const links = el(doc, 'div', 'picks-actions');
    const katalog = el(doc, 'a', 'btn btn-primary', 'Готовые изделия');
    katalog.href = Handoff.KATALOG;
    const stones = el(doc, 'a', 'btn btn-secondary', 'Выбрать камень');
    stones.href = '/sayanmramor-site/kamen.html';   // the stone gallery (2026-11-02, the owner: not the calculator)
    links.append(katalog, stones);
    box.appendChild(links);
    return box;
  }

  // The title, the lead and the actions: all known from the address and this browser's list alone.
  function head(doc, shared, store, status) {
    doc.getElementById('picksTitle').textContent = shared ? 'Подборка' : 'Моя подборка';
    if (shared) doc.title = 'Подборка - Саянмрамор';
    const lead = doc.getElementById('picksLead');
    const actions = doc.getElementById('picksActions');
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
  }

  // Before the stones and the pieces have come: the page as it will stand, so nothing jumps.
  // How many of each is known at once, from the address or this browser's list. podborka.html
  // calls it right after the list's place, before the request and the footer are parsed.
  function prepare(doc) {
    const win = doc.defaultView;
    const store = Picks.storage(win);
    const shared = Picks.readShared(win.location.search);
    const picks = shared || Picks.read(store);
    const host = doc.getElementById('picksHost');
    if (!Picks.total(picks)) {
      host.replaceChildren(emptyState(doc));
      return;
    }
    head(doc, shared, store, doc.getElementById('picksStatus'));
    const waiting = (count, labelled, stone) => {
      const box = el(doc, 'section', 'picks-section');
      box.appendChild(sectionHead(doc, Picks.label(labelled), stone ? 'stones' : 'pieces'));
      const grid = el(doc, 'ul', 'stock-grid stock-skeleton');
      grid.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < count; i++) grid.appendChild(waitingCard(doc, stone));
      box.appendChild(grid);
      return box;
    };
    const boxes = [];
    if (picks[Picks.STONES].length) boxes.push(waiting(picks[Picks.STONES].length, { [Picks.STONES]: picks[Picks.STONES], [Picks.PIECES]: [] }, true));
    if (picks[Picks.PIECES].length) boxes.push(waiting(picks[Picks.PIECES].length, { [Picks.STONES]: [], [Picks.PIECES]: picks[Picks.PIECES] }, false));
    host.replaceChildren(...boxes);
  }

  function render(doc, stonesData, productsData) {
    const win = doc.defaultView;
    const store = Picks.storage(win);
    const shared = Picks.readShared(win.location.search);
    const picks = shared || Picks.read(store);
    const stones = found(picks[Picks.STONES], (stonesData && stonesData.stones) || []);
    const pieces = found(picks[Picks.PIECES], (productsData && productsData.products) || []);

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
    const left = stones.known.length + pieces.known.length;
    if (missing && stonesData && productsData && left) {
      status.textContent = shared ? 'Некоторых камней и изделий из этой подборки уже нет в каталоге.' : 'Некоторых камней и изделий уже нет в каталоге, мы убрали их из подборки.';
    }

    if (!stones.known.length && !pieces.known.length) {
      lead.textContent = '';
      actions.replaceChildren();
      if (!stonesData || !productsData) {
        host.replaceChildren();
        status.textContent = 'Не удалось загрузить подборку. Обновите страницу.';
      } else host.replaceChildren(emptyState(doc, missing ? (shared ? EMPTY.sharedGone : EMPTY.ownGone) : EMPTY.own));
      return;
    }
    head(doc, shared, store, status);
    const sections = [];
    if (stones.known.length) sections.push(section(doc, Picks.label({ [Picks.STONES]: stones.known, [Picks.PIECES]: [] }), stones.known.map(s => stoneCard(doc, s, new URLSearchParams(win.location.search).get('product'))), 'stones'));
    if (pieces.known.length) sections.push(section(doc, Picks.label({ [Picks.STONES]: [], [Picks.PIECES]: pieces.known }), pieces.known.map(p => Catalog.buildProductCard(p)), 'pieces'));
    host.replaceChildren(...sections);
    if (!shared) answerHearts(doc, store, host, status);
  }

  // A heart pressed off on the own list: the card stays (a slip is undone by the same heart) but
  // dims, the list's title counts what is left, and the status line says what happened
  // (2026-11-02, the owner: it went by without a word).
  const GONE = { stones: 'Камни убраны', pieces: 'Изделия убраны' };
  function answerHearts(doc, store, host, status) {
    const marked = () => {
      const now = Picks.read(store);
      return new Set([Picks.STONES, Picks.PIECES].flatMap(kind => now[kind].map(id => kind + ':' + id)));
    };
    let before = marked();
    if (host.answering) return;
    host.answering = true;
    doc.addEventListener('picks-change', () => {
      const now = marked();
      let said = '';
      host.querySelectorAll('.picks-section').forEach(box => {
        let left = 0;
        box.querySelectorAll('.stock-card').forEach(card => {
          const heart = card.querySelector('.pick-heart');
          if (!heart) return;
          const key = heart.dataset.kind + ':' + heart.dataset.id;
          const on = now.has(key);
          card.classList.toggle('is-removed', !on);
          if (on) left++;
          if (before.has(key) && !on) said = 'Убрано из подборки: ' + heart.dataset.name + '. Нажмите сердечко, чтобы вернуть.';
          if (!before.has(key) && on) said = 'Снова в подборке: ' + heart.dataset.name + '.';
        });
        const kind = box.dataset.kind;
        const title = box.querySelector('.picks-section-title');
        const ids = Array(left).fill('');
        title.textContent = left ? Picks.label({ [Picks.STONES]: kind === 'stones' ? ids : [], [Picks.PIECES]: kind === 'pieces' ? ids : [] }) : GONE[kind];
      });
      if (said) status.textContent = said;
      before = now;
    });
  }

  function init(doc) {
    const load = url => doc.defaultView.fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
    return Promise.all([load(STONE_INDEX_URL), load(PRODUCTS_URL)]).then(([stones, products]) => render(doc, stones, products));
  }

  return { found, buildUrl, EMPTY, prepare, render, init };
});
