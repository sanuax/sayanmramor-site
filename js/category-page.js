// js/category-page.js
//
// A category page's stone section: the site's own gallery of the stones in
// /calculator/data/slabs.json (the agreed JSON contract), and the hand-off to
// the configurator through the canonical URL
// /calculator/sayanmramor-calculator.html?product=<product-key>&stone=<stone-id>
// (built by ShowroomData.buildConfiguratorUrl -- one owner of that contract
// in this site). Prices, sizes and every other part of the configuration
// live only in the configurator; this page never loads calculator code.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./showroom/showroom-data.js'));
  } else {
    root.CategoryPage = factory(root.ShowroomData);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (ShowroomData) {

  const SLABS_URL = '/calculator/data/slabs.json';
  // slabs.json stores stone images relative to its own folder.
  const STONE_IMAGE_BASE = '/calculator/data/';
  const PAGE_SIZE = 24;
  // Stone types with fewer stones than this stay reachable through search
  // instead of each getting a filter chip.
  const MIN_TYPE_COUNT = 10;

  // slabs.json -> the stones this page shows: the ones that can still be
  // ordered, with only the fields the gallery needs, sorted by name.
  function normalizeStones(data) {
    return ((data && data.stones) || [])
      .filter(s => s && s.id && s.name && s.available !== false)
      .map(s => ({
        id: s.id,
        name: s.name,
        type: s.category_label_ru || '',
        image: s.image ? STONE_IMAGE_BASE + s.image : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  // Filter chips: the common stone types, most numerous first.
  function listTypes(stones, minCount) {
    const min = minCount === undefined ? MIN_TYPE_COUNT : minCount;
    const counts = new Map();
    stones.forEach(s => { if (s.type) counts.set(s.type, (counts.get(s.type) || 0) + 1); });
    return [...counts]
      .filter(([, count]) => count >= min)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
      .map(([label, count]) => ({ label, count }));
  }

  // The search matches the stone's name or type, ignoring case and ё/е.
  function filterStones(stones, { query, type } = {}) {
    const norm = s => s.toLowerCase().replace(/ё/g, 'е');
    const q = norm((query || '').trim());
    return stones.filter(s =>
      (!type || s.type === type) &&
      (!q || norm(s.name).includes(q) || norm(s.type).includes(q)));
  }

  function init(productKey) {
    const buildUrl = stoneId => ShowroomData.buildConfiguratorUrl(productKey, stoneId);
    const search = document.getElementById('stoneSearch');
    const typesBox = document.getElementById('stoneTypes');
    const status = document.getElementById('stoneStatus');
    const grid = document.getElementById('stoneGrid');
    const more = document.getElementById('stoneMore');
    const cta = document.getElementById('configureCta');
    const chosen = document.getElementById('configureStone');

    let stones = [];
    let filtered = [];
    let shown = 0;
    let type = '';
    let selected = null;

    cta.href = buildUrl(null);

    function renderSelection() {
      cta.href = buildUrl(selected && selected.id);
      chosen.textContent = selected ? selected.name : 'Не выбран — подберёте в конфигураторе';
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

    function apply() {
      filtered = filterStones(stones, { query: search.value, type });
      grid.innerHTML = '';
      shown = 0;
      status.textContent = filtered.length ? 'Камней: ' + filtered.length : 'Ничего не найдено';
      showMore();
    }

    function renderTypes() {
      const chips = [{ label: 'Все', value: '' }].concat(listTypes(stones).map(t => ({ label: t.label, value: t.label })));
      typesBox.innerHTML = '';
      chips.forEach(chip => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'stone-type';
        b.textContent = chip.label;
        b.setAttribute('aria-pressed', String(chip.value === type));
        b.addEventListener('click', () => {
          type = chip.value;
          typesBox.querySelectorAll('.stone-type').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          apply();
        });
        typesBox.appendChild(b);
      });
    }

    search.addEventListener('input', apply);
    more.addEventListener('click', showMore);

    fetch(SLABS_URL)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        stones = normalizeStones(data);
        search.disabled = false;
        renderTypes();
        apply();
      })
      .catch(() => {
        status.textContent = 'Не удалось загрузить каталог камня — выберите камень в конфигураторе.';
      });
  }

  return { SLABS_URL, STONE_IMAGE_BASE, PAGE_SIZE, normalizeStones, listTypes, filterStones, init };
});
