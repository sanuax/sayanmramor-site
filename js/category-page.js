// js/category-page.js
//
// A category page's stone section: the site's own gallery of the stones in
// /sayanmramor-calculator/data/stone-index.json -- the light index built from the
// calculator's slabs.json (its one source of truth) by
// scripts/build_stone_index.py: the same stone fields, only the few this
// page needs, only the stones that can still be ordered -- and the hand-off to
// the configurator through the canonical URL
// /sayanmramor-calculator/sayanmramor-calculator.html?product=<product-key>&stone=<stone-id>
// (built by ShowroomData.buildConfiguratorUrl -- one owner of that contract
// in this site). Each card shows the stone's price per m2 «от …». The gallery has
// the configurator's own filters (2026-10-10): «Страна», «Тип», «Цвет» -- pills
// opening lists to tick, any number at once -- «Цена» «от … до …» (price_from:
// the cheapest slab, js/price-filter.js), «Сбросить», and the sort «Цвет» (the
// gradient, the index's tone, from the photos) / «A-Z» / «Цена ↑». The price of a piece, its sizes and every other part of the
// configuration live only in the configurator; this page never loads calculator code.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./showroom/showroom-data.js'), require('./price-filter.js'));
  } else {
    root.CategoryPage = factory(root.ShowroomData, root.PriceFilter);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (ShowroomData, PriceFilter) {

  const STONE_INDEX_URL = '/sayanmramor-calculator/data/stone-index.json';
  // The index (like slabs.json) stores stone images relative to its own folder.
  const STONE_IMAGE_BASE = '/sayanmramor-calculator/data/';
  const PAGE_SIZE = 24;

  // The stone's lowest price per m2: the index's price_from or, for a slabs.json
  // record, its cheapest slab; null without a price.
  function lowestPrice(s) {
    const ok = p => typeof p === 'number' && Number.isFinite(p) && p > 0;
    if (ok(s.price_from)) return Math.round(s.price_from);
    const prices = (s.slabs || []).map(slab => slab && slab.price_per_m2_rub).filter(ok);
    return prices.length ? Math.round(Math.min(...prices)) : null;
  }

  // [{ label_ru: 'Италия', ... }, ...] (the index and slabs.json alike) -> ['Италия', ...]
  function labels(items) {
    return [...new Set((items || []).map(x => x && x.label_ru).filter(Boolean))];
  }

  // stone-index.json (or slabs.json itself: the same fields) -> the stones
  // this page shows: the ones that can still be
  // ordered, with only the fields the gallery needs, sorted by name.
  function normalizeStones(data) {
    return ((data && data.stones) || [])
      .filter(s => s && s.id && s.name && s.available !== false)
      .map(s => ({
        id: s.id,
        name: s.name,
        type: s.category_label_ru || '',
        image: s.image ? STONE_IMAGE_BASE + s.image : null,
        price: lowestPrice(s),
        countries: labels(s.countries),
        colors: labels(s.colors),
        tone: typeof s.tone === 'number' ? s.tone : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  // Natural stone and the man-made one (experiment, round 2: a designer could not tell them apart in
  // the catalogue). The index's own types; the card and the stone's view say «Искусственный камень».
  const ARTIFICIAL_TYPES = ['Кварцевый агломерат', 'Искусственный мрамор', 'Спеченный камень'];
  const isArtificial = stone => ARTIFICIAL_TYPES.includes(stone && stone.type);

  // The search a link brings (kamen.html?q=<name>, from a photo's caption in a gallery's viewer).
  function linkedQuery(search) {
    try { return (new URLSearchParams(search || '').get('q') || '').trim().slice(0, 80); } catch (e) { return ''; }
  }
  // The one stone of that very name, if there is exactly one: it opens at once.
  function exactStone(stones, query) {
    const norm = s => s.toLowerCase().replace(/ё/g, 'е');
    const same = query ? stones.filter(s => norm(s.name) === norm(query)) : [];
    return same.length === 1 ? same[0] : null;
  }

  // A filter's choices: every value the stones have, in alphabetical order (as the configurator lists them).
  function listOptions(stones, field) {
    const values = new Set();
    stones.forEach(s => [].concat(s[field] || []).forEach(v => { if (v) values.add(v); }));
    return [...values].sort((a, b) => a.localeCompare(b, 'ru'));
  }

  // The search matches the stone's name or type, ignoring case and ё/е. Within a list
  // filter, any ticked value will do; the filters together must all hold. The price
  // ({ from, to }, either end open) keeps the stones whose lowest price per m2 is inside it.
  function filterStones(stones, { query, types, countries, colors, price } = {}) {
    const norm = s => s.toLowerCase().replace(/ё/g, 'е');
    const q = norm((query || '').trim());
    const any = (chosen, values) => !chosen || !chosen.length || [].concat(values).some(v => chosen.includes(v));
    return stones.filter(s =>
      any(types, s.type) && any(countries, s.countries) && any(colors, s.colors) &&
      PriceFilter.inRange(s.price, price) &&
      (!q || norm(s.name).includes(q) || norm(s.type).includes(q)));
  }

  // 'tone-asc' | 'tone-desc' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'; a
  // stone without a place in the gradient or a price always last, whichever way it runs.
  function sortStones(stones, key) {
    const [field, dir] = (key || 'name-asc').split('-');
    const k = dir === 'desc' ? -1 : 1;
    const byName = (a, b) => a.name.localeCompare(b.name, 'ru');
    if (field === 'tone') {
      return stones.slice().sort((a, b) => (a.tone == null) - (b.tone == null) || (a.tone - b.tone) * k || byName(a, b));
    }
    return stones.slice().sort(field === 'price'
      ? (a, b) => (a.price == null) - (b.price == null) || (a.price - b.price) * k || byName(a, b)
      : (a, b) => byName(a, b) * k);
  }

  // A page's own kinds of stone first (experiment, round 3: «Фасады» opened on white marble and
  // quartz agglomerate; the stone for outdoors comes first there). Nothing is hidden: the stones of
  // those types keep their order and lead, the rest follow in theirs.
  function typesFirst(stones, firstTypes) {
    if (!firstTypes || !firstTypes.length) return stones;
    const lead = stones.filter(s => firstTypes.includes(s.type));
    return lead.concat(stones.filter(s => !firstTypes.includes(s.type)));
  }

  // Whether «Сбросить» shows: any search text, any ticked value, any price end.
  function hasActiveFilters({ query, types, countries, colors, price } = {}) {
    return !!(query && query.trim()) || [types, countries, colors].some(l => l && l.length > 0) || PriceFilter.isActive(price);
  }

  // ---- The stone window's own facts (the owner chose concept «Б. Шторка», 2026-11-15) ----
  // Every slab in stock, per stone: the configurator's data/stone-slabs.json, built beside the index
  // by its scripts/build_stone_index.py: { updated_at, stones: { <id>: [[long cm, short cm, price per
  // m2 or null], ...] } }, cheapest first. ~470 KB (47 KB on the wire), so it loads only when a window
  // first opens; the index the gallery needs stays light.
  const STONE_SLABS_URL = '/sayanmramor-calculator/data/stone-slabs.json';

  // The stone before or after this one in the gallery as it is filtered and sorted, round the ends;
  // null when the gallery does not show it or shows nothing else.
  function neighbour(list, stone, step) {
    const i = stone && list ? list.findIndex(s => s.id === stone.id) : -1;
    if (i < 0 || list.length < 2) return null;
    return list[(i + step + list.length) % list.length];
  }

  // «1 плита» / «3 плиты» / «36 плит» в наличии.
  function inStock(n) {
    const tens = n % 100, ones = n % 10;
    const word = tens > 10 && tens < 20 ? 'плит' : ones === 1 ? 'плита' : ones > 1 && ones < 5 ? 'плиты' : 'плит';
    return n + ' ' + word + ' в наличии';
  }

  // The cheapest and the dearest price per m2 among the slabs, or null when none has a price.
  function priceSpan(rows) {
    const prices = (rows || []).map(r => r[2]).filter(p => typeof p === 'number' && p > 0);
    return prices.length ? { from: Math.min(...prices), to: Math.max(...prices) } : null;
  }

  // The date of the list as it stands in the file (no time zone can move it a day).
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function stockDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m || +m[2] < 1 || +m[2] > 12) return '';
    return 'Наличие и цены на ' + Number(m[3]) + ' ' + MONTHS[m[2] - 1] + ' ' + m[1];
  }

  const SORT_LABELS = { 'tone-asc': 'Цвет', 'tone-desc': 'Цвет ↓', 'name-asc': 'A-Z', 'name-desc': 'Z-A', 'price-asc': 'Цена ↑', 'price-desc': 'Цена ↓' };

  // The configurator with only a stone (the page «Камень», kamen.html: no product of its own;
  // the configurator picks the stone and leaves the product to the client).
  const CONFIGURATOR = '/sayanmramor-calculator/sayanmramor-calculator.html';
  const stoneOnlyUrl = stoneId => CONFIGURATOR + (stoneId ? '?stone=' + encodeURIComponent(stoneId) : '');

  // productKey: the direction page's product, or null on «Камень». options.firstTypes: the types
  // that lead the gallery in its colour order (the default); «A-Z» and «Цена» stay plain.
  function init(productKey, options) {
    const firstTypes = (options && options.firstTypes) || [];
    const buildUrl = stoneId => (productKey ? ShowroomData.buildConfiguratorUrl(productKey, stoneId) : stoneOnlyUrl(stoneId));
    const search = document.getElementById('stoneSearch');
    const filtersBox = document.getElementById('stoneFilters');
    const status = document.getElementById('stoneStatus');
    const grid = document.getElementById('stoneGrid');
    const more = document.getElementById('stoneMore');
    const cta = document.getElementById('configureCta');
    const chosen = document.getElementById('configureStone');

    let stones = [];
    let filtered = [];
    let shown = 0;
    const state = { types: [], countries: [], colors: [], price: null, sort: 'tone-asc' };
    let selected = null;

    cta.href = buildUrl(null);
    // In the bar at the foot, the one thing that stays in view all the way through the stones.
    if (window.Picks) {
      const way = window.Picks.link(document);
      if (productKey) way.href = window.Picks.PAGE + '?product=' + encodeURIComponent(productKey);   // «Собрать» there keeps this page's product
      cta.parentNode.insertBefore(way, cta);
    }

    // The empty state as in the page's HTML: «Не выбран» plus a tail that
    // site.css drops on very narrow screens (the bar keeps its one line).
    function emptyChoice() {
      const tail = document.createElement('span');
      tail.className = 'configure-tail';
      tail.textContent = ' - подберёте в конфигураторе';
      return ['Не выбран', tail];
    }

    // The bar at the foot (2026-11-07, the audit: on a phone the capsule above and the bar below took
    // 118 px of 812, and «Не выбран» on every page read as an error): it comes up only once the
    // visitor has scrolled past most of the first screen, or has chosen a stone, and it says nothing
    // about the stone until one is chosen. css/site.css hides it under .js until .is-shown.
    const bar = cta.closest ? cta.closest('.configure-bar') : null;
    // It steps aside (.is-aside) while the request form or the footer is on screen (experiment,
    // round 1: on a phone it lay over the name and phone fields with their buttons, and over the
    // footer's phone and e-mail -- right where the visitor writes or looks for a way to call).
    const aside = new Set();
    const showBar = () => {
      if (!bar) return;
      const far = (window.scrollY || 0) > (window.innerHeight || 800) * 0.6;
      bar.classList.toggle('is-shown', far || !!selected);
      bar.classList.toggle('is-aside', aside.size > 0);
      bar.classList.toggle('has-stone', !!selected);
    };
    if (bar && window.addEventListener) {
      let raf = 0;
      window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; showBar(); }); }, { passive: true });
      if (typeof IntersectionObserver !== 'undefined') {
        const io = new IntersectionObserver(entries => {
          entries.forEach(e => { if (e.isIntersecting) aside.add(e.target); else aside.delete(e.target); });
          showBar();
        });
        [document.getElementById('offer'), document.querySelector('.site-footer')].forEach(t => { if (t) io.observe(t); });
      }
      showBar();
    }

    function renderSelection() {
      cta.href = buildUrl(selected && selected.id);
      if (selected) chosen.textContent = selected.name;
      else chosen.replaceChildren(...emptyChoice());
      chosen.classList.toggle('is-empty', !selected);
      showBar();
      grid.querySelectorAll('.stone-card').forEach(card => {
        card.setAttribute('aria-pressed', String(!!selected && card.dataset.id === selected.id));
      });
    }

    // ---- The stone, large ----
    // (experiment, round 2) A designer could not open a stone: the card showed a square of its photo and
    // only chose it. A press on the card's corner button opens the stone over the page: its photo whole,
    // its type and country, the price «от … до …», every slab in stock with its size and price (a row
    // that scrolls sideways), the way to «Моя подборка» and to the configurator with this stone. The
    // thickness and finish are not in the data: they are asked for, never guessed.
    // (the owner, 2026-11-15, concept «Б. Шторка») On a phone it is a sheet from below, pulled down by
    // its photo it goes; arrows on the photo, a swipe sideways and the keyboard's ← → turn to the next
    // stone of the gallery as it is filtered and sorted.
    let view = null;
    const canView = () => typeof HTMLDialogElement !== 'undefined' && typeof document.createElement('dialog').showModal === 'function';
    const asks = query => !!(window.matchMedia && window.matchMedia(query).matches);
    const isSheet = () => asks('(max-width: 640px)');
    const calm = () => asks('(prefers-reduced-motion: reduce)');
    let slabsData = null;
    const loadSlabs = () => slabsData || (slabsData = fetch(STONE_SLABS_URL)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(() => { slabsData = null; return null; }));   // the window goes on without the slabs; the next opening asks again
    function buildView() {
      const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
      const icon = d => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
      const button = (cls, label, d) => { const b = el('button', cls); b.type = 'button'; b.setAttribute('aria-label', label); b.innerHTML = icon(d); return b; };
      const LEFT = 'M15 5l-7 7 7 7', RIGHT = 'M9 5l7 7-7 7';
      const dialog = el('dialog', 'stone-view');
      dialog.setAttribute('aria-labelledby', 'stoneViewName');
      dialog.tabIndex = -1;   // opened by a tap it takes the focus itself, see openView
      const media = el('div', 'stone-view-media');
      const img = el('img');
      img.decoding = 'async';
      img.addEventListener('load', () => img.classList.add('is-loaded'));   // it fades in once it is ready, never pops in
      const prev = button('stone-view-step is-prev', 'Предыдущий камень', LEFT);
      const next = button('stone-view-step is-next', 'Следующий камень', RIGHT);
      media.append(img, el('span', 'stone-view-grab'), prev, next);
      const text = el('div', 'stone-view-text');
      const kind = el('p', 'stone-view-kind');
      const name = el('h2', 'stone-view-name');
      name.id = 'stoneViewName';
      const price = el('div', 'stone-view-price');
      const sum = el('p', 'stone-view-sum');
      const sub = el('p', 'stone-view-sub');
      price.append(sum, sub);
      const stock = el('section', 'stone-view-stock');
      stock.hidden = true;
      const stockHead = el('div', 'stone-view-stock-head');
      const stockTitle = el('h3', 'stone-view-stock-title');
      const rowBack = button('stone-view-scroll', 'Плиты левее', LEFT);
      const rowOn = button('stone-view-scroll', 'Плиты правее', RIGHT);
      stockHead.append(stockTitle, rowBack, rowOn);
      const row = el('ul', 'stone-view-slabs');
      const listDate = el('p', 'stone-view-date');
      stock.append(stockHead, row, listDate);
      const note = el('p', 'stone-view-note');
      note.append(
        'Толщину и фактуру поверхности подберём под изделие - ',
        Object.assign(el('a', null, 'в заявке'), { href: '#offer' }),
        ' или по телефону ',
        Object.assign(el('a', null, '+7 (495) 215-51-45'), { href: 'tel:+74952155145' }),
        '.');
      text.append(kind, name, price, stock, note);
      const actions = el('div', 'stone-view-actions');
      const configure = el('a', 'btn btn-primary', 'Рассчитать в конфигураторе');
      const pick = el('button', 'btn btn-secondary stone-view-pick');
      pick.type = 'button';
      pick.innerHTML = icon('M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.4 7.2 4.4c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.1 4.4 6.5-1.6 4.8-9.2 9.4-9.2 9.4z');
      const pickWord = el('span', 'stone-view-pick-word');
      pick.appendChild(pickWord);
      actions.append(configure);
      if (window.Picks) actions.append(pick);
      const close = el('button', 'stone-view-close');
      close.type = 'button';
      close.setAttribute('aria-label', 'Закрыть');
      close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';
      dialog.append(media, text, actions, close);
      document.body.appendChild(dialog);

      let stone = null;
      const paintPick = () => {
        if (!window.Picks || !stone) return;
        const on = window.Picks.has(window.Picks.read(window.Picks.storage(window)), window.Picks.STONES, stone.id);
        pickWord.textContent = on ? 'В подборке' : 'В подборку';
        pick.setAttribute('aria-pressed', String(on));
      };
      pick.addEventListener('click', () => {
        window.Picks.toggle(window.Picks.storage(window), window.Picks.STONES, stone.id);
        window.Picks.sync(document);   // the hearts on the cards and «Моя подборка» follow
      });
      document.addEventListener('picks-change', paintPick);

      // «от 13 494 до 33 735 ₽/м²»: the index knows the lowest price at once, the slabs bring the highest.
      function paintPrice(from, to) {
        const ranged = from != null && to != null && to > from;
        sum.replaceChildren(from != null
          ? 'от ' + PriceFilter.formatRub(from) + (ranged ? ' до ' + PriceFilter.formatRub(to) : '') + ' '
          : 'Цена по запросу');
        if (from != null) sum.appendChild(el('span', null, '₽/м²'));
        sub.textContent = ranged ? 'Цена камня за метр зависит от плиты' : 'Цена камня за квадратный метр';
        sub.hidden = from == null;
      }
      // Every slab, each drawn in its own proportions with the stone in it, beside its size and price.
      function paintStock(s, rows, updated) {
        if (!rows || !rows.length) { stock.hidden = true; return; }
        const span = priceSpan(rows);
        paintPrice(s.price != null ? s.price : span && span.from, span && span.to);
        stockTitle.textContent = inStock(rows.length);
        const big = Math.max(...rows.map(r => r[0]));
        const frag = document.createDocumentFragment();
        rows.forEach(([long, short, rub]) => {
          const li = el('li');
          const box = el('span', 'stone-view-slab-box');
          const pic = el('span', 'stone-view-slab-pic');
          pic.style.width = Math.max(10, Math.round(long / big * 64)) + 'px';
          pic.style.height = Math.max(8, Math.round(short / big * 64)) + 'px';
          if (s.image) pic.style.backgroundImage = 'url("' + s.image + '")';
          box.appendChild(pic);
          li.append(box, el('span', 'stone-view-slab-size', long + ' × ' + short),
            el('span', 'stone-view-slab-price', rub ? PriceFilter.formatRub(rub) + ' ₽/м²' : 'цена по запросу'));
          frag.appendChild(li);
        });
        row.replaceChildren(frag);
        row.scrollLeft = 0;
        listDate.textContent = [stockDate(updated), 'размеры в сантиметрах'].filter(Boolean).join(', ');
        stock.hidden = false;
        paintRowEnds();
      }
      // The row's own arrows (a computer: a mouse does not scroll sideways), dimmed at its ends.
      function paintRowEnds() {
        rowBack.disabled = row.scrollLeft <= 1;
        rowOn.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 1;
      }
      row.addEventListener('scroll', paintRowEnds, { passive: true });
      const slide = way => row.scrollBy({ left: way * row.clientWidth * 0.8, behavior: calm() ? 'auto' : 'smooth' });
      rowBack.addEventListener('click', () => slide(-1));
      rowOn.addEventListener('click', () => slide(1));

      // The next stone of the gallery; the text comes in from the side it was asked from.
      function turn(step) {
        const to = neighbour(filtered, stone, step);
        if (!to) return;
        fill(to);
        dialog.classList.remove('turn-next', 'turn-prev');
        void dialog.offsetWidth;   // the same way twice running plays again
        dialog.classList.add(step > 0 ? 'turn-next' : 'turn-prev');
      }
      prev.addEventListener('click', () => turn(-1));
      next.addEventListener('click', () => turn(1));
      dialog.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') turn(1);
        else if (e.key === 'ArrowLeft') turn(-1);
      });

      // Closing: on a phone the sheet goes down, the veil fades; elsewhere (and under reduced motion) at once.
      let leaving = 0;
      function shut() {
        if (!dialog.open || leaving) return;
        if (!isSheet() || calm()) { dialog.close(); return; }
        dialog.classList.remove('is-dragging');
        dialog.classList.add('is-leaving');
        dialog.style.transform = 'translateY(100%)';
        leaving = setTimeout(() => dialog.close(), 280);
      }
      close.addEventListener('click', shut);
      dialog.addEventListener('cancel', e => { e.preventDefault(); shut(); });   // Esc
      // A press on the veil around the stone closes it; the page under it holds still meanwhile.
      dialog.addEventListener('click', e => { if (e.target === dialog) shut(); });
      dialog.addEventListener('close', () => {
        clearTimeout(leaving);
        leaving = 0;
        dialog.classList.remove('is-leaving', 'is-dragging', 'turn-next', 'turn-prev');
        dialog.style.transform = '';
        document.documentElement.classList.remove('viewer-open');
        document.body.style.paddingRight = '';
      });
      note.querySelector('a[href="#offer"]').addEventListener('click', () => dialog.close());

      // Touches. The page behind is not locked on a phone: a swipe that is not scrolling the text (on the
      // veil, on the photo, in a text that fits, or sideways) must not scroll it. Sideways: the row of
      // slabs scrolls by itself; anywhere else it turns to the next stone. Down on the photo: the sheet
      // follows the finger and goes past 90 px.
      let g = null;
      dialog.addEventListener('touchstart', e => {
        const t = e.touches[0];
        g = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, axis: null, inRow: row.contains(e.target), onPhoto: media.contains(e.target), pull: 0 } : null;
      }, { passive: true });
      dialog.addEventListener('touchmove', e => {
        const t = e.touches[0];
        if (g && !g.axis && Math.hypot(t.clientX - g.x, t.clientY - g.y) > 8) g.axis = Math.abs(t.clientX - g.x) > Math.abs(t.clientY - g.y) ? 'x' : 'y';
        if (g && g.inRow && g.axis === 'x') return;
        if (g && g.onPhoto && g.axis === 'y' && isSheet() && !leaving) {
          g.pull = Math.max(0, t.clientY - g.y);
          dialog.classList.add('is-dragging');
          dialog.style.transform = g.pull ? 'translateY(' + g.pull + 'px)' : '';
        }
        if (!text.contains(e.target) || text.scrollHeight <= text.clientHeight + 1 || (g && g.axis === 'x')) e.preventDefault();
      }, { passive: false });
      const letGo = e => {
        const was = g;
        g = null;
        if (!was) return;
        if (was.pull || dialog.classList.contains('is-dragging')) {
          dialog.classList.remove('is-dragging');
          if (e.type === 'touchend' && was.pull > 90) shut();
          else dialog.style.transform = '';   // back up, by the sheet's own transition
          return;
        }
        const t = e.changedTouches && e.changedTouches[0];
        const dx = t ? t.clientX - was.x : 0;
        if (e.type === 'touchend' && was.axis === 'x' && !was.inRow && Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1);
      };
      dialog.addEventListener('touchend', letGo);
      dialog.addEventListener('touchcancel', letGo);

      function fill(s) {
        stone = s;
        img.classList.remove('is-loaded');
        img.removeAttribute('src');
        img.hidden = !s.image;
        if (s.image) {
          img.src = s.image;
          img.alt = 'Камень ' + s.name;
          if (img.complete && img.naturalWidth) img.classList.add('is-loaded');   // already in the browser's memory: no fade
        }
        kind.replaceChildren([s.type, s.countries.join(', ')].filter(Boolean).join(', '));
        if (isArtificial(s)) kind.appendChild(el('span', 'stone-view-made', 'Искусственный камень'));
        name.textContent = s.name;
        paintPrice(s.price, null);
        stock.hidden = true;
        row.replaceChildren();
        configure.href = buildUrl(s.id);
        paintPick();
        const alone = !neighbour(filtered, s, 1);
        prev.hidden = alone;
        next.hidden = alone;
        text.scrollTop = 0;
        loadSlabs().then(data => {
          if (stone !== s || !data || !data.stones) return;   // another stone by now, or no slabs today
          paintStock(s, data.stones[s.id], data.updated_at);
        });
      }
      return { dialog, close, text, fill };
    }
    // A modal dialog puts the focus on its first link («в заявке»), and after a tap Safari drew it as
    // the keyboard ring (2026-11-12, the owner): opened by a tap (or a link) the dialog holds the focus
    // itself, no ring; opened from the keyboard the close button has it.
    function openView(stone, viaKeys) {
      if (!view) view = buildView();
      view.fill(stone);
      // On a computer the page is locked (overflow hidden) with its scrollbar's room kept. On a phone
      // it is NOT: overflow hidden on the whole page makes iOS Safari resize its visible area and the
      // page behind jumps (2026-11-12, the owner); there the window's backdrop swallows the swipes instead.
      const touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      if (!touch) {
        const gutter = window.innerWidth - document.documentElement.clientWidth;   // the page must not jump when its scrollbar goes
        document.documentElement.classList.add('viewer-open');
        document.body.style.paddingRight = gutter > 0 ? gutter + 'px' : '';
      }
      view.dialog.showModal();
      view.text.scrollTop = 0;   // the text scrolls in its own box; the window and its photo hold still
      (viaKeys ? view.close : view.dialog).focus({ preventScroll: true });
    }

    function cardFor(stone) {
      const li = document.createElement('li');
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'stone-card';
      card.dataset.id = stone.id;
      card.setAttribute('aria-pressed', String(!!selected && selected.id === stone.id));
      const media = document.createElement('span');
      media.className = 'stone-card-media';
      if (stone.image) {
        const img = document.createElement('img');
        img.src = stone.image;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener('error', () => img.remove());
        media.appendChild(img);
      }
      if (isArtificial(stone)) {
        const made = document.createElement('span');
        made.className = 'stone-card-made';
        made.textContent = 'Искусственный камень';
        media.appendChild(made);
      }
      const name = document.createElement('span');
      name.className = 'stone-card-name';
      name.textContent = stone.name;
      const kind = document.createElement('span');
      kind.className = 'stone-card-type';
      kind.textContent = stone.type;
      card.append(media, name, kind);
      // «от … ₽/м²» -- the stone's lowest price per m2, as the configurator's card shows it.
      if (stone.price != null) {
        const price = document.createElement('span');
        price.className = 'stone-card-price';
        price.textContent = 'от ' + PriceFilter.formatRub(stone.price) + ' ₽/м²';
        card.appendChild(price);
      }
      card.addEventListener('click', () => {
        // A press chooses the stone (the bar below), a second press lets it go, as before. The stone
        // opens large only by its own button on the photo (the owner, 2026-11-12: a dialog on every
        // press got in the way of choosing).
        selected = selected && selected.id === stone.id ? null : stone;
        renderSelection();
      });
      li.appendChild(card);
      if (canView()) {
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'stone-open';
        open.setAttribute('aria-haspopup', 'dialog');
        open.setAttribute('aria-label', 'Открыть крупно: ' + stone.name);
        open.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5"/></svg>';
        // It only opens: choosing the stone would change the bottom bar behind the window (2026-11-12,
        // the owner: the background jerked on a phone); the window has its own «Рассчитать» and «В подборку».
        open.addEventListener('click', e => openView(stone, e.detail === 0));
        li.appendChild(open);
      }
      const picks = window.Picks;
      if (picks) li.appendChild(picks.heart(document, picks.STONES, stone.id, stone.name));
      return li;
    }

    function showMore() {
      const next = filtered.slice(shown, shown + PAGE_SIZE);
      const frag = document.createDocumentFragment();
      next.forEach(stone => frag.appendChild(cardFor(stone)));
      grid.appendChild(frag);
      shown += next.length;
      more.hidden = shown >= filtered.length;
    }

    let resetBtn = null;
    function apply() {
      const query = search.value;
      filtered = sortStones(filterStones(stones, Object.assign({ query }, state)), state.sort);
      if (state.sort.startsWith('tone-')) filtered = typesFirst(filtered, firstTypes);
      grid.innerHTML = '';
      shown = 0;
      status.textContent = filtered.length ? 'Камней: ' + filtered.length : 'Ничего не найдено';
      if (resetBtn) resetBtn.hidden = !hasActiveFilters(Object.assign({ query }, state));
      paintWays();
      showMore();
    }

    // ---- The filter row: pills that open a panel, one panel at a time ----
    const closers = [];
    const closeAll = except => closers.forEach(c => { if (c !== except) c(); });
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

    function dropdown(name, buildPanel) {
      const box = el('div', 'stone-dd');
      box.dataset.filter = name;
      const btn = el('button', 'stone-dd-btn');
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      const label = el('span', 'stone-dd-label');
      btn.append(label, el('span', 'stone-dd-caret'));
      const panel = el('div', 'stone-dd-panel');
      panel.hidden = true;
      box.append(btn, panel);
      const close = () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
      closers.push(close);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const open = panel.hidden;
        closeAll();
        if (open) { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
      });
      panel.addEventListener('click', e => e.stopPropagation());
      buildPanel(panel);
      return { box, btn, label, close };
    }

    // «Страна» / «Тип» / «Цвет»: a list to tick; the pill counts what is ticked.
    function listFilter(name, title, key, values) {
      const dd = dropdown(name, panel => {
        values.forEach(v => {
          const option = el('label', 'stone-dd-option');
          const box = el('input');
          box.type = 'checkbox';
          box.value = v;
          box.addEventListener('change', () => {
            state[key] = [...panel.querySelectorAll('input:checked')].map(i => i.value);
            update();
            apply();
          });
          option.append(box, el('span', null, v));
          panel.appendChild(option);
        });
      });
      function update() {
        const n = state[key].length;
        dd.label.textContent = n ? title + ' (' + n + ')' : title;
        dd.btn.classList.toggle('is-active', n > 0);
      }
      update();
      return {
        box: dd.box,
        reset() { dd.box.querySelectorAll('input').forEach(i => { i.checked = false; }); state[key] = []; update(); dd.close(); },
        set(chosen) { dd.box.querySelectorAll('input').forEach(i => { i.checked = chosen.includes(i.value); }); state[key] = values.filter(v => chosen.includes(v)); update(); dd.close(); },
      };
    }

    // «Цена»: the «от» / «до» fields and the slider; the pill names the range.
    function priceFilter() {
      const ends = PriceFilter.bounds(stones.map(s => s.price));
      if (!ends) return null;
      let control = null;
      const dd = dropdown('price', panel => {
        panel.classList.add('stone-dd-price');
        control = PriceFilter.mount(panel, {
          min: ends.min, max: ends.max, label: 'Цена камня, ₽/м²', prices: stones.map(s => s.price),
          onChange: value => { state.price = value; update(); apply(); },
        });
      });
      function update() {
        const text = PriceFilter.summary(state.price);
        dd.label.textContent = text ? 'Цена: ' + text : 'Цена';
        dd.btn.classList.toggle('is-active', !!text);
      }
      update();
      return { box: dd.box, reset() { control.reset(); state.price = null; update(); dd.close(); } };
    }

    // «Цвет» / «A-Z» / «Цена ↑»: one of three; the chosen one again turns its direction.
    function sortControl() {
      const box = el('div', 'stone-sort');
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Сортировка');
      const buttons = ['tone', 'name', 'price'].map(field => {
        const b = el('button', 'stone-sort-btn');
        b.type = 'button';
        b.dataset.field = field;
        b.dataset.dir = 'asc';
        b.addEventListener('click', () => {
          const [current] = state.sort.split('-');
          if (current === field) b.dataset.dir = b.dataset.dir === 'asc' ? 'desc' : 'asc';
          else buttons.forEach(x => { x.dataset.dir = 'asc'; });
          state.sort = field + '-' + b.dataset.dir;
          paint();
          apply();
        });
        return b;
      });
      function paint() {
        buttons.forEach(b => {
          const on = state.sort.startsWith(b.dataset.field + '-');
          b.textContent = SORT_LABELS[b.dataset.field + '-' + b.dataset.dir];
          b.setAttribute('aria-pressed', String(on));
        });
      }
      paint();
      box.append(...buttons);
      return box;
    }

    // A page's own ways into the gallery by type (the kitchen's advice, experiment, round 1):
    // <button data-stone-types="Гранит|Кварцит"> ticks exactly those types in «Тип»; again, it unticks
    // them. A type the catalogue does not hold today is left out; a button with none left stays hidden.
    const ways = [...document.querySelectorAll('[data-stone-types]')];
    const sameTypes = types => types.length > 0 && types.length === state.types.length && types.every(t => state.types.includes(t));
    const wayTypes = new Map();
    function paintWays() {
      wayTypes.forEach((types, b) => b.setAttribute('aria-pressed', String(sameTypes(types))));
    }
    function enableWays(typeFilter, typeOptions) {
      ways.forEach(b => {
        const types = b.dataset.stoneTypes.split('|').filter(t => typeOptions.includes(t));
        if (!types.length) return;
        wayTypes.set(b, types);
        b.hidden = false;
        b.addEventListener('click', () => {
          typeFilter.set(sameTypes(types) ? [] : types);
          apply();
          const controls = filtersBox && filtersBox.closest('.stone-controls');
          if (controls && controls.getBoundingClientRect().top > window.innerHeight * 0.5) controls.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
      });
      const box = ways.length ? ways[0].closest('.stone-ways') : null;
      if (box) box.hidden = ways.every(b => b.hidden);
    }

    function renderFilters() {
      if (!filtersBox) return;
      const typeOptions = listOptions(stones, 'type');
      const typeFilter = listFilter('category', 'Тип', 'types', typeOptions);
      enableWays(typeFilter, typeOptions);
      const parts = [
        listFilter('country', 'Страна', 'countries', listOptions(stones, 'countries')),
        typeFilter,
        listFilter('color', 'Цвет', 'colors', listOptions(stones, 'colors')),
        priceFilter(),
      ].filter(Boolean);
      resetBtn = el('button', 'stone-reset', 'Сбросить');
      resetBtn.type = 'button';
      resetBtn.hidden = true;
      resetBtn.addEventListener('click', () => {
        search.value = '';
        parts.forEach(p => p.reset());
        apply();
      });
      const row = el('div', 'stone-filter-row');
      row.append(...parts.map(p => p.box), resetBtn);
      filtersBox.replaceChildren(row, sortControl());
      filtersBox.hidden = false;
      document.addEventListener('click', () => closeAll());
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
    }

    search.addEventListener('input', apply);
    more.addEventListener('click', showMore);
    // The page's inline script held the room of the filters, the plates and «Показать ещё»
    // (.is-waiting); the real ones are in place now.
    function ready() {
      const section = grid.closest && grid.closest('.stone-section');
      if (section) section.classList.remove('is-waiting');
      if (filtersBox) filtersBox.inert = false;
    }

    fetch(STONE_INDEX_URL)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        stones = normalizeStones(data);
        search.disabled = false;
        renderFilters();
        // A link from a photo's caption brings the stone's name: it stands in the search, and the
        // one stone of that very name opens at once (experiment, round 2).
        const query = linkedQuery(window.location && window.location.search);
        if (query) search.value = query;
        apply();
        ready();
        const linked = exactStone(stones, query);
        if (linked && canView()) openView(linked);
      })
      .catch(() => {
        grid.innerHTML = '';
        if (filtersBox) filtersBox.hidden = true;
        more.hidden = true;
        ready();
        status.textContent = 'Не удалось загрузить каталог камня - выберите камень в конфигураторе.';
      });
  }

  return { STONE_INDEX_URL, STONE_SLABS_URL, neighbour, inStock, priceSpan, stockDate, STONE_IMAGE_BASE, PAGE_SIZE, SORT_LABELS, ARTIFICIAL_TYPES, isArtificial, linkedQuery, exactStone, normalizeStones, listOptions, filterStones, sortStones, typesFirst, hasActiveFilters, stoneOnlyUrl, init };
});
