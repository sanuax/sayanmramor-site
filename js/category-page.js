// js/category-page.js
//
// A category page's stone section: the site's own gallery of the stones in
// /calculator/data/stone-index.json -- the light index built from the
// calculator's slabs.json (its one source of truth) by
// scripts/build_stone_index.py: the same stone fields, only the few this
// page needs, only the stones that can still be ordered -- and the hand-off to
// the configurator through the canonical URL
// /calculator/sayanmramor-calculator.html?product=<product-key>&stone=<stone-id>
// (built by ShowroomData.buildConfiguratorUrl -- one owner of that contract
// in this site). Each card shows the stone's price per m2 «от …». The gallery has
// the configurator's own filters (2026-10-10): «Страна», «Тип», «Цвет» -- pills
// opening lists to tick, any number at once -- «Цена» «от … до …» (price_from:
// the cheapest slab, js/price-filter.js), «Сбросить», and the sort «A-Z» /
// «Цена ↑». The price of a piece, its sizes and every other part of the
// configuration live only in the configurator; this page never loads calculator code.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./showroom/showroom-data.js'), require('./price-filter.js'));
  } else {
    root.CategoryPage = factory(root.ShowroomData, root.PriceFilter);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (ShowroomData, PriceFilter) {

  const STONE_INDEX_URL = '/calculator/data/stone-index.json';
  // The index (like slabs.json) stores stone images relative to its own folder.
  const STONE_IMAGE_BASE = '/calculator/data/';
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
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
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

  // 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'; a stone without a price
  // always last, whichever way the price runs.
  function sortStones(stones, key) {
    const [field, dir] = (key || 'name-asc').split('-');
    const k = dir === 'desc' ? -1 : 1;
    const byName = (a, b) => a.name.localeCompare(b.name, 'ru');
    return stones.slice().sort(field === 'price'
      ? (a, b) => (a.price == null) - (b.price == null) || (a.price - b.price) * k || byName(a, b)
      : (a, b) => byName(a, b) * k);
  }

  // Whether «Сбросить» shows: any search text, any ticked value, any price end.
  function hasActiveFilters({ query, types, countries, colors, price } = {}) {
    return !!(query && query.trim()) || [types, countries, colors].some(l => l && l.length > 0) || PriceFilter.isActive(price);
  }

  const SORT_LABELS = { 'name-asc': 'A-Z', 'name-desc': 'Z-A', 'price-asc': 'Цена ↑', 'price-desc': 'Цена ↓' };

  function init(productKey) {
    const buildUrl = stoneId => ShowroomData.buildConfiguratorUrl(productKey, stoneId);
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
    const state = { types: [], countries: [], colors: [], price: null, sort: 'name-asc' };
    let selected = null;

    cta.href = buildUrl(null);

    // The empty state as in the page's HTML: «Не выбран» plus a tail that
    // site.css drops on very narrow screens (the bar keeps its one line).
    function emptyChoice() {
      const tail = document.createElement('span');
      tail.className = 'configure-tail';
      tail.textContent = ' - подберёте в конфигураторе';
      return ['Не выбран', tail];
    }

    function renderSelection() {
      cta.href = buildUrl(selected && selected.id);
      if (selected) chosen.textContent = selected.name;
      else chosen.replaceChildren(...emptyChoice());
      chosen.classList.toggle('is-empty', !selected);
      grid.querySelectorAll('.stone-card').forEach(card => {
        card.setAttribute('aria-pressed', String(!!selected && card.dataset.id === selected.id));
      });
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
        selected = selected && selected.id === stone.id ? null : stone;
        renderSelection();
      });
      li.appendChild(card);
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
      grid.innerHTML = '';
      shown = 0;
      status.textContent = filtered.length ? 'Камней: ' + filtered.length : 'Ничего не найдено';
      if (resetBtn) resetBtn.hidden = !hasActiveFilters(Object.assign({ query }, state));
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

    // «A-Z» / «Цена ↑»: one of two; the chosen one again turns its direction.
    function sortControl() {
      const box = el('div', 'stone-sort');
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Сортировка');
      const buttons = ['name', 'price'].map(field => {
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

    function renderFilters() {
      if (!filtersBox) return;
      const parts = [
        listFilter('country', 'Страна', 'countries', listOptions(stones, 'countries')),
        listFilter('category', 'Тип', 'types', listOptions(stones, 'type')),
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

    fetch(STONE_INDEX_URL)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        stones = normalizeStones(data);
        search.disabled = false;
        renderFilters();
        apply();
      })
      .catch(() => {
        status.textContent = 'Не удалось загрузить каталог камня - выберите камень в конфигураторе.';
      });
  }

  return { STONE_INDEX_URL, STONE_IMAGE_BASE, PAGE_SIZE, SORT_LABELS, normalizeStones, listOptions, filterStones, sortStones, hasActiveFilters, init };
});
