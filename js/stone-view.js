// js/stone-view.js
//
// The stone, large: one window for the site's stone galleries (js/category-page.js) and the
// configurator's stone picker (its material-picker.js loads this file from the site, with
// css/stone-view.css). The owner chose concept «Б. Шторка» on 2026-11-15, then asked the
// configurator to open its stones the same way.
//
// Over the page on a dark veil: the stone's photo whole, its type and country, the price
// «от … до … ₽/м²», every slab in stock with its size and price (a row that scrolls sideways), the
// way to «Моя подборка» and the page's own action (the site: to the configurator with this stone;
// the configurator: choose it). The thickness and finish are not in the data: they are asked for,
// never guessed. On a phone it is a sheet from below, pulled down by its photo it goes; arrows on
// the photo, a swipe sideways and the keyboard's ← → turn to the next stone of the list the page
// gives (its gallery as it is filtered and sorted).
//
// A stone here: { id, name, type, image (URL), price (lowest per m2 or null), countries: [label],
// available (false: not in stock) }.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.StoneView = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // Every slab in stock, per stone: the configurator's data/stone-slabs.json, built beside its
  // stone index by scripts/build_stone_index.py: { updated_at, stones: { <id>: [[long cm, short cm,
  // price per m2 or null], ...] } }, cheapest first. ~470 KB (47 KB on the wire), so it loads only
  // when a window first opens.
  const STONE_SLABS_URL = '/sayanmramor-calculator/data/stone-slabs.json';
  const PHONE = '+7 (495) 215-51-45';
  const PHONE_HREF = 'tel:+74952155145';

  // Natural stone and the man-made one (experiment, round 2: a designer could not tell them apart).
  const ARTIFICIAL_TYPES = ['Кварцевый агломерат', 'Искусственный мрамор', 'Спеченный камень'];
  const isArtificial = stone => ARTIFICIAL_TYPES.includes(stone && stone.type);

  // 44287 -> «44 287» (a no-break space, as js/price-filter.js writes it).
  const formatRub = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // The stone before or after this one in the list, round the ends; null when the list does not
  // hold it or holds nothing else.
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

  const canView = () => typeof HTMLDialogElement !== 'undefined' && typeof document.createElement('dialog').showModal === 'function';

  // options:
  //   list()   the stones to turn through, in the page's order
  //   action   { label, href(stone) } a link, or { label, choose(stone) } a button
  //   offer    true: the note sends to the request on this page (#offer); else to the phone only
  // -> { open(stone, viaKeys), close(), isOpen() }
  function create(options) {
    const list = () => (options.list && options.list()) || [];
    const asks = query => !!(window.matchMedia && window.matchMedia(query).matches);
    const isSheet = () => asks('(max-width: 640px)');
    const calm = () => asks('(prefers-reduced-motion: reduce)');
    let slabsData = null;
    const loadSlabs = () => slabsData || (slabsData = fetch(STONE_SLABS_URL)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(() => { slabsData = null; return null; }));   // the window goes on without the slabs; the next opening asks again

    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const icon = d => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
    const button = (cls, label, d) => { const b = el('button', cls); b.type = 'button'; b.setAttribute('aria-label', label); b.innerHTML = icon(d); return b; };
    const LEFT = 'M15 5l-7 7 7 7', RIGHT = 'M9 5l7 7-7 7';
    const dialog = el('dialog', 'stone-view');
    dialog.setAttribute('aria-labelledby', 'stoneViewName');
    dialog.tabIndex = -1;   // opened by a tap it takes the focus itself, see open()
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
    const phone = Object.assign(el('a', null, PHONE), { href: PHONE_HREF });
    if (options.offer) {
      note.append('Толщину и фактуру поверхности подберём под изделие - ',
        Object.assign(el('a', null, 'в заявке'), { href: '#offer' }), ' или по телефону ', phone, '.');
    } else {
      note.append('Толщину и фактуру поверхности подберём под изделие - спросите по телефону ', phone, '.');
    }
    text.append(kind, name, price, stock, note);
    const actions = el('div', 'stone-view-actions');
    const action = options.action || {};
    const go = action.href ? el('a', 'btn btn-primary', action.label) : el('button', 'btn btn-primary', action.label);
    if (!action.href) go.type = 'button';
    const pick = el('button', 'btn btn-secondary stone-view-pick');
    pick.type = 'button';
    pick.innerHTML = icon('M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.4 7.2 4.4c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.1 4.4 6.5-1.6 4.8-9.2 9.4-9.2 9.4z');
    const pickWord = el('span', 'stone-view-pick-word');
    pick.appendChild(pickWord);
    actions.append(go);
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
    if (action.choose) go.addEventListener('click', () => action.choose(stone));

    // «от 13 494 до 33 735 ₽/м²»: the list knows the lowest price at once, the slabs bring the highest.
    function paintPrice(s, from, to) {
      if (s.available === false) { sum.replaceChildren('Нет в наличии'); sub.hidden = true; return; }
      const ranged = from != null && to != null && to > from;
      sum.replaceChildren(from != null ? 'от ' + formatRub(from) + (ranged ? ' до ' + formatRub(to) : '') + ' ' : 'Цена по запросу');
      if (from != null) sum.appendChild(el('span', null, '₽/м²'));
      sub.textContent = ranged ? 'Цена камня за метр зависит от плиты' : 'Цена камня за квадратный метр';
      sub.hidden = from == null;
    }
    // Every slab, each drawn in its own proportions with the stone in it, beside its size and price.
    function paintStock(s, rows, updated) {
      if (!rows || !rows.length) { stock.hidden = true; return; }
      const span = priceSpan(rows);
      paintPrice(s, s.price != null ? s.price : span && span.from, span && span.to);
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
          el('span', 'stone-view-slab-price', rub ? formatRub(rub) + ' ₽/м²' : 'цена по запросу'));
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

    // The next stone of the list; the text comes in from the side it was asked from.
    function turn(step) {
      const to = neighbour(list(), stone, step);
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
    const toOffer = note.querySelector('a[href="#offer"]');
    if (toOffer) toOffer.addEventListener('click', () => dialog.close());

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
      kind.replaceChildren([s.type, (s.countries || []).join(', ')].filter(Boolean).join(', '));
      if (isArtificial(s)) kind.appendChild(el('span', 'stone-view-made', 'Искусственный камень'));
      name.textContent = s.name;
      paintPrice(s, s.price, null);
      stock.hidden = true;
      row.replaceChildren();
      if (action.href) go.href = action.href(s);
      paintPick();
      const alone = !neighbour(list(), s, 1);
      prev.hidden = alone;
      next.hidden = alone;
      text.scrollTop = 0;
      if (s.available === false) return;   // no slabs in stock to show
      loadSlabs().then(data => {
        if (stone !== s || !data || !data.stones) return;   // another stone by now, or no slabs today
        paintStock(s, data.stones[s.id], data.updated_at);
      });
    }

    // A modal dialog puts the focus on its first link («в заявке»), and after a tap Safari drew it as
    // the keyboard ring (2026-11-12, the owner): opened by a tap (or a link) the dialog holds the focus
    // itself, no ring; opened from the keyboard the close button has it.
    function open(s, viaKeys) {
      fill(s);
      // On a computer the page is locked (overflow hidden) with its scrollbar's room kept. On a phone
      // it is NOT: overflow hidden on the whole page makes iOS Safari resize its visible area and the
      // page behind jumps (2026-11-12, the owner); there the window's backdrop swallows the swipes instead.
      const touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      if (!touch) {
        const gutter = window.innerWidth - document.documentElement.clientWidth;   // the page must not jump when its scrollbar goes
        document.documentElement.classList.add('viewer-open');
        document.body.style.paddingRight = gutter > 0 ? gutter + 'px' : '';
      }
      dialog.showModal();
      text.scrollTop = 0;   // the text scrolls in its own box; the window and its photo hold still
      (viaKeys ? close : dialog).focus({ preventScroll: true });
    }

    return { open, close: () => { if (dialog.open) dialog.close(); }, isOpen: () => dialog.open };
  }

  return { STONE_SLABS_URL, ARTIFICIAL_TYPES, isArtificial, formatRub, neighbour, inStock, priceSpan, stockDate, canView, create };
});
