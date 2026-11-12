(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteHeader = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // The header works without this script: «Изделия» and «Шоурум» are native
  // <details>, the links are plain anchors. The script only adds what a
  // <details> does not do by itself -- one panel open at a time; closing it
  // with Esc, with a click outside it, or when focus leaves it; folding it up
  // instead of cutting it off (a closed <details> hides its content at once, so
  // the panel is kept open while it folds) -- the one line under the row that
  // travels to the item under the pointer (and rests under the current
  // section), and, under MOBILE_QUERY, the menu button.
  const MOBILE_QUERY = '(max-width: 1000px)';
  const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
  const FOLD_MS = 260;   // a little longer than the fold (0.18 s): the fallback when no animationend comes
  const MENU_OPEN_MS = 300;   // the phone capsule uncovering the menu
  const MENU_CLOSE_MS = 220;  // and covering it back up
  const MENU_EASE = 'cubic-bezier(0.22, 0.68, 0.24, 1)';   // css --ease

  // «Изделия» with the groups' photographs (2026-10-20, the owner: «переноси на сайт»). Built on
  // the panel's own markup -- the groups, their titles, their links -- so the configurator's copy
  // of the header gets it too. On a wide screen: how many directions each group has, and on the
  // right the photograph of the group under the pointer (or the keyboard), resting on the group of
  // the page you are on. On a phone: a row per group (its photograph, its name, its directions in
  // a line) that opens the group's own screen -- «Все изделия» back, its photograph, its
  // directions; a group of one page («Фасады») goes straight there.
  const NAV_PHOTOS = { 'Лестницы и ступени': 'stairs', 'Интерьер': 'interior', 'Кухня и ванная': 'kitchen', 'Фасады': 'facade', 'Спа и бассейны': 'spa' };
  const NAV_NOTES = { 'Фасады': 'Облицовка фасада камнем' };
  const NAV_ASSETS = '/sayanmramor-site/assets/nav/';
  const BACK_MS = 400;   // the rows' way back in (0.34 s), then the class goes
  // The places under «Изделия» in the phone menu (2026-11-03, the owner): «Камень» and «Готовые
  // изделия» as two tiles with a photograph, «Контакты» as a row with a strip of the brand green.
  // Built inside the links themselves, so the wide capsule still shows just their names.
  const NAV_PLACES = {
    'Камень': { photo: 't-kamen.webp', note: 'Мрамор, оникс, кварцит, гранит' },
    'Готовые изделия': { photo: 't-katalog.webp', note: 'Ванны, столы, вазы, светильники' },
    'Контакты': { note: 'Ивантеевка, +7 (495) 215-51-45' },
  };
  // The bottom inset of a computed inset() clip: «inset(0px 0px 312.5px round 28px)» -> 312.5.
  function clipCut(value) {
    const m = /inset\(([^)]*?)(?:\s+round\b|\))/.exec(value || '');
    if (!m) return null;
    const v = m[1].trim().split(/\s+/).map(parseFloat);
    const b = v.length >= 3 ? v[2] : v[0];
    return Number.isFinite(b) ? b : null;
  }
  function directions(n) {
    const d = n % 10, h = n % 100;
    return n + ' ' + (d === 1 && h !== 11 ? 'направление' : d >= 2 && d <= 4 && (h < 10 || h >= 20) ? 'направления' : 'направлений');
  }

  function initProducts(doc, win, header, mq) {
    const drop = header.querySelector('.nav-products');
    const panel = drop && drop.querySelector ? drop.querySelector('.nav-panel') : null;
    if (!panel || !doc.createElement) return null;
    const groups = [...drop.querySelectorAll('.nav-group')].map(el => {
      const titleEl = el.querySelector('.nav-group-title');
      const name = titleEl ? titleEl.textContent.trim() : '';
      return { el, titleEl, name, slug: NAV_PHOTOS[name], links: [...el.querySelectorAll('a')] };
    }).filter(g => g.slug && g.links.length);
    if (!groups.length) return null;
    const make = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
    const photo = (file, w, h) => {
      const i = make('img');
      i.src = NAV_ASSETS + file; i.alt = ''; i.width = w; i.height = h; i.loading = 'lazy'; i.decoding = 'async';
      return i;
    };
    const single = g => g.links.length === 1;
    const noteOf = g => NAV_NOTES[g.name] || g.links.map(a => a.textContent.trim()).join(' · ');

    // Wide screen: the counts and the photograph.
    const shot = make('figure', 'nav-shot');
    shot.setAttribute('aria-hidden', 'true');
    const shots = groups.map(g => shot.appendChild(photo('p-' + g.slug + '.webp', 640, 800)));
    const caption = make('figcaption'), capTitle = make('p', 'nav-shot-title'), capNote = make('p', 'nav-shot-note');
    caption.append(capTitle, capNote);
    shot.appendChild(caption);
    panel.appendChild(shot);
    // Under the rows, for those who need their own size: the ready-made pieces and the
    // configurator (not the configurator's own link on the configurator).
    const foot = make('div', 'nav-panel-foot');
    foot.appendChild(make('p', null, 'Нужен свой размер или форма?'));
    const where = win.location && win.location.pathname ? win.location.pathname : '';
    [['Готовые изделия', '/sayanmramor-site/katalog.html'], ['Создать изделие', '/sayanmramor-calculator/sayanmramor-calculator.html']].forEach(([text, href]) => {
      if (where === href) return;
      const a = make('a', null, text);
      a.href = href;
      foot.appendChild(a);
    });
    panel.appendChild(foot);
    let shown = -1;
    function show(k) {
      if (k === shown) return;
      shown = k;
      groups.forEach((g, i) => { g.el.classList.toggle('is-on', i === k); shots[i].classList.toggle('is-on', i === k); });
      capTitle.textContent = groups[k].name;
      capNote.textContent = noteOf(groups[k]);
    }
    const here = groups.findIndex(g => g.links.some(a => a.classList.contains('active')));
    const rest = () => show(here >= 0 ? here : 0);

    // Phone: the rows and the groups' screens.
    const nav = header.querySelector('.site-nav');
    let open = -1, backTimer = null;
    function openGroup(k) {
      open = k;
      if (backTimer) { win.clearTimeout(backTimer); backTimer = null; }
      drop.classList.remove('is-back');
      groups.forEach((g, i) => g.el.classList.toggle('is-detail', i === k));
      header.classList.add('menu-detail');
      groups[k].row.setAttribute('aria-expanded', 'true');
      if (nav) nav.scrollTop = 0;
      const back = groups[k].el.querySelector('.nav-group-back');
      if (back) back.focus({ preventScroll: true });
    }
    function closeGroup(returnFocus) {
      if (open < 0) return;
      const g = groups[open];
      open = -1;
      header.classList.remove('menu-detail');
      groups.forEach(x => x.el.classList.remove('is-detail'));
      g.row.setAttribute('aria-expanded', 'false');
      if (!returnFocus) return;
      drop.classList.add('is-back');
      backTimer = win.setTimeout(() => { drop.classList.remove('is-back'); backTimer = null; }, BACK_MS);
      g.row.focus({ preventScroll: true });
    }

    groups.forEach((g, k) => {
      if (!single(g)) {
        const count = make('span', 'nav-group-count', String(g.links.length));
        count.setAttribute('aria-hidden', 'true');
        g.titleEl.appendChild(count);
      }
      g.el.addEventListener('mouseenter', () => { if (!mq.matches) show(k); });
      g.el.addEventListener('focusin', () => { if (!mq.matches) show(k); });

      const link = g.links[0];
      // A group of one page: its title already names it, so its link says where it goes.
      if (single(g) && link.textContent.trim() === g.name) link.textContent = 'Смотреть работы';
      const row = make(single(g) ? 'a' : 'button', 'nav-group-row');
      if (single(g)) {
        row.href = link.getAttribute('href');
        if (link.classList.contains('active')) { row.classList.add('active'); row.setAttribute('aria-current', 'page'); }
      } else {
        row.type = 'button';
        row.setAttribute('aria-expanded', 'false');
        row.addEventListener('click', () => openGroup(k));
      }
      const text = make('span');
      text.append(make('span', 'nav-group-row-name', g.name), make('span', 'nav-group-row-note', noteOf(g)));
      row.append(photo('t-' + g.slug + '.webp', 60, 60), text);
      g.row = row;
      g.el.insertBefore(row, g.el.firstChild);
      if (single(g)) return;
      const head = make('div', 'nav-group-head');
      const back = make('button', 'nav-group-back', 'Все изделия');
      back.type = 'button';
      back.addEventListener('click', () => closeGroup(true));
      const hero = make('figure', 'nav-group-hero'), heroCaption = make('figcaption');
      heroCaption.append(make('p', 'nav-group-hero-title', g.name), make('p', 'nav-group-hero-note', directions(g.links.length)));
      hero.append(photo('w-' + g.slug + '.webp', 800, 500), heroCaption);
      head.append(back, hero);
      g.el.insertBefore(head, g.titleEl);
    });
    drop.addEventListener('toggle', () => { if (drop.open && !mq.matches) rest(); });
    // A swipe to the right on a group's screen goes back, as on a phone's own screens.
    if (nav) {
      let sx = null, sy = 0;
      nav.addEventListener('touchstart', e => { const t = e.touches[0]; sx = open >= 0 && e.touches.length === 1 ? t.clientX : null; sy = t.clientY; }, { passive: true });
      nav.addEventListener('touchend', e => {
        if (sx === null) return;
        const t = e.changedTouches[0];
        if (t.clientX - sx > 70 && Math.abs(t.clientY - sy) < 40) closeGroup(true);
        sx = null;
      }, { passive: true });
    }
    rest();
    drop.classList.add('is-rich');
    return { show, openGroup, closeGroup, inGroup: () => open >= 0 };
  }

  function initPlaces(doc, header) {
    if (!doc.createElement || !header.querySelectorAll) return;
    const make = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
    [...header.querySelectorAll('.site-nav > a')].forEach(a => {
      const name = a.textContent.trim(), place = NAV_PLACES[name];
      if (!place) return;
      a.textContent = '';
      a.classList.add('nav-place', place.photo ? 'is-tile' : 'is-row');
      if (place.photo) {
        const i = make('img', 'nav-place-pic');
        i.src = NAV_ASSETS + place.photo; i.alt = ''; i.width = 440; i.height = 476; i.loading = 'lazy'; i.decoding = 'async';
        a.append(i);
      } else {
        a.append(make('span', 'nav-place-pic'));
      }
      const text = make('span', 'nav-place-text');
      text.append(make('span', 'nav-place-name', name), make('span', 'nav-place-note', place.note));
      a.append(text);
    });
  }

  function init(doc, win) {
    const header = doc.querySelector('.site-header');
    if (!header) return null;
    initPlaces(doc, header);
    const drops = header.querySelectorAll ? [...header.querySelectorAll('.nav-drop')] : [];
    const toggle = header.querySelector('.nav-toggle');
    const mq = win.matchMedia ? win.matchMedia(MOBILE_QUERY) : { matches: false };
    const reduced = () => !!(win.matchMedia && win.matchMedia(REDUCED_QUERY).matches);
    const root = doc.documentElement;
    const summaryOf = drop => drop.querySelector('summary');
    const products = initProducts(doc, win, header, mq);
    const folding = new Map();   // drop -> its pending fold's timer

    let menuAnim = null;       // the capsule's running open / close
    let menuClosing = false;   // folding back up: still drawn open, already closed
    function menuOpen() { return header.classList.contains('menu-open') && !menuClosing; }

    function stopFold(drop) {
      if (!folding.has(drop)) return;
      if (win.clearTimeout) win.clearTimeout(folding.get(drop));
      folding.delete(drop);
      drop.classList.toggle('is-closing', false);
    }

    // Close one panel: on a wide screen it folds up first, then the <details> closes.
    function closePanel(drop, returnFocus) {
      if (!drop || !drop.open || folding.has(drop)) return;
      if (returnFocus && summaryOf(drop)) summaryOf(drop).focus();
      const panel = drop.querySelector('.nav-panel');
      if (mq.matches || reduced() || !panel || !win.setTimeout) { drop.open = false; return; }
      const done = () => { if (!folding.has(drop)) return; stopFold(drop); drop.open = false; };
      drop.classList.toggle('is-closing', true);
      folding.set(drop, win.setTimeout(done, FOLD_MS));
      if (panel.addEventListener) panel.addEventListener('animationend', done, { once: true });
    }
    const closeOthers = keep => drops.forEach(d => { if (d !== keep) closePanel(d, false); });

    function setLock(open) {
      root.classList.toggle('menu-lock', open);
      if (toggle) {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Меню');
      }
    }
    // The open capsule lies over the page instead of pushing it (the owner, 2026-10-19):
    // as much as it grows, its bottom margin takes back, so its place in the page stays
    // the closed capsule's and nothing under it moves.
    // Where the next block is pulled up under the capsule by a negative margin of its own
    // (the home page's hero), the two margins collapse into the larger, not the sum: what
    // the page then still moves is measured once (pull) and taken back too.
    let closedH = 0, pull = 0;
    const heightOf = () => (header.getBoundingClientRect ? header.getBoundingClientRect().height : 0);
    const pageTop = el => el.getBoundingClientRect().top + (win.pageYOffset || 0);
    const marginFor = h => Math.min(0, closedH - h - pull);
    const overlay = h => { if (header.style) header.style.marginBottom = h > closedH ? marginFor(h) + 'px' : ''; };
    function applyMenu(open) {
      const opening = open && !header.classList.contains('menu-open');
      const next = opening && header.nextElementSibling && header.nextElementSibling.getBoundingClientRect ? header.nextElementSibling : null;
      const before = next ? pageTop(next) : 0;
      if (opening) { closedH = heightOf(); pull = 0; }
      header.classList.toggle('menu-open', open);
      setLock(open);
      if (!open && products) products.closeGroup(false);
      // In the open menu every panel is shown (no second tap); closed, they rest.
      drops.forEach(d => { stopFold(d); d.open = open; });
      overlay(open ? heightOf() : 0);
      if (next) { pull = pageTop(next) - before; overlay(heightOf()); }
    }

    // On a phone the capsule opens down into the menu and folds back up (the owner,
    // 2026-10-19). No height moves (2026-10-24, the owner): that laid the page out again in
    // every frame. The capsule stands at its open size at once, and a clip rounded as the
    // capsule uncovers it from its closed height down -- and covers it back up -- so a frame
    // is only drawn. Closing, the menu stays drawn until the clip is up; the page is unlocked
    // at once, so an anchor in the menu scrolls. A tap mid-way turns it round from where it is.
    function setMenu(open) {
      const animate = open !== menuOpen() && mq.matches && !reduced() && !!header.animate && !!header.getBoundingClientRect;
      const cut = animate && menuAnim && win.getComputedStyle ? clipCut(win.getComputedStyle(header).clipPath) : null;
      if (menuAnim) { menuAnim.onfinish = null; menuAnim.cancel(); menuAnim = null; }
      const settle = () => { menuClosing = false; header.classList.toggle('menu-closing', false); header.classList.toggle('menu-anim', false); };
      if (!animate) { settle(); applyMenu(open); return; }
      header.classList.toggle('menu-anim', true);
      if (open) {
        menuClosing = false;
        header.classList.toggle('menu-closing', false);
        applyMenu(true);
      } else {
        menuClosing = true;
        header.classList.toggle('menu-closing', true);
        header.classList.toggle('menu-open', false);   // measured closed, drawn open
        closedH = heightOf();
        header.classList.toggle('menu-open', true);
        setLock(false);
      }
      // The open capsule's margin already takes back its height, so the page under it never
      // moves; the clip is held at its end until the menu has settled, so no frame shows it open again.
      const full = Math.max(0, heightOf() - closedH);
      const from = cut != null ? Math.min(full, cut) : (open ? full : 0), to = open ? 0 : full;
      const round = win.getComputedStyle ? win.getComputedStyle(header).borderTopLeftRadius : '28px';
      const frame = c => ({ clipPath: 'inset(0 0 ' + c + 'px 0 round ' + round + ')' });
      const ms = (open ? MENU_OPEN_MS : MENU_CLOSE_MS) * (full ? Math.abs(to - from) / full : 1);   // turned round mid-way: only the rest of the way
      const anim = header.animate([frame(from), frame(to)], { duration: ms, easing: MENU_EASE, fill: 'forwards' });
      anim.onfinish = () => { menuAnim = null; settle(); if (!open) applyMenu(false); anim.cancel(); };
      menuAnim = anim;
    }

    // The panels' names are buttons only on a wide screen: in the mobile menu they are headings.
    function syncMode() {
      drops.forEach(d => {
        const s = summaryOf(d);
        if (!s) return;
        if (mq.matches) s.setAttribute('tabindex', '-1'); else s.removeAttribute('tabindex');
      });
      if (!mq.matches && menuOpen()) setMenu(false);
      if (!mq.matches && products) products.closeGroup(false);
    }

    drops.forEach(drop => {
      const summary = summaryOf(drop);
      if (summary) {
        summary.addEventListener('click', e => {
          if (mq.matches) { e.preventDefault(); return; }
          if (folding.has(drop)) { e.preventDefault(); stopFold(drop); return; }   // caught while folding: it stays open
          if (drop.open) { e.preventDefault(); closePanel(drop, false); return; }
          closeOthers(drop);                                                        // opening: the other panel folds away
        });
      }
      drop.addEventListener('focusout', e => {
        if (!mq.matches && e.relatedTarget && !drop.contains(e.relatedTarget)) closePanel(drop, false);
      });
    });
    if (toggle) {
      toggle.addEventListener('click', e => {
        const open = !menuOpen();
        setMenu(open);
        // Focus goes to the first row only when the menu was opened from the keyboard (a key press
        // clicks with detail 0). After a tap Safari drew that focus as the keyboard ring around
        // «Лестницы и ступени» until the next touch (2026-11-12, the owner).
        if (open && e.detail === 0) {
          const first = header.querySelector('.nav-group-row') || header.querySelector('.nav-group a');
          if (first) first.focus({ preventScroll: true });
        }
      });
    }
    // A link inside the menu leaves the page -- or, for an anchor on this page, must not leave the menu on top of it.
    header.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('.site-nav a, .site-header-actions a');
      if (a && menuOpen()) setMenu(false);
    });
    doc.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (menuOpen() && products && products.inGroup()) { products.closeGroup(true); return; }
      if (menuOpen()) { setMenu(false); if (toggle) toggle.focus(); return; }
      if (menuClosing) return;   // the menu's panels go with it
      drops.forEach(d => { if (d.open) closePanel(d, true); });
    });
    doc.addEventListener('click', e => {
      if (mq.matches) return;
      drops.forEach(d => { if (d.open && !d.contains(e.target)) closePanel(d, false); });
    });
    // A turned phone: the open menu takes a new height, its margin follows.
    if (win.addEventListener) win.addEventListener('resize', () => { if (menuOpen() && !menuAnim) overlay(heightOf()); });
    initTone(doc, win, header);
    const indicator = initIndicator(doc, win, header, mq);
    const onModeChange = () => { syncMode(); if (indicator) indicator.rest(); };
    if (mq.addEventListener) mq.addEventListener('change', onModeChange); else if (mq.addListener) mq.addListener(onModeChange);
    syncMode();
    return { setMenu, closePanel, indicator };
  }

  // The glass takes the tone of the page under it (2026-11-07, the owner: «как в Telegram»):
  // three points along the capsule's middle line; at each, the first thing under the capsule
  // that shows a colour decides -- a photo by its own brightness there (drawn once into a small
  // canvas; same-origin files), else a solid enough background. Two dark of three: .is-on-dark.
  function luminance(css) {
    const m = String(css || '').match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    const [r, g, b, a = 1] = m.map(Number);
    if (a < 0.5) return null;
    const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  const DARK_BELOW = 0.18;
  function initTone(doc, win, header) {
    if (!doc.elementsFromPoint || !win.getComputedStyle || !win.requestAnimationFrame || !win.addEventListener) return null;
    const shots = new Map();
    let raf = 0;
    const ask = () => { if (!raf) raf = win.requestAnimationFrame(check); };
    function picture(src, fx, fy) {
      let s = shots.get(src);
      if (!s) {
        s = { data: null };
        shots.set(src, s);
        const im = new win.Image();
        im.onload = () => {
          try {
            const c = doc.createElement('canvas'); c.width = c.height = 24;
            const g = c.getContext('2d'); g.drawImage(im, 0, 0, 24, 24);
            s.data = g.getImageData(0, 0, 24, 24).data; ask();
          } catch (e) { s.data = false; }
        };
        im.src = src;
      }
      if (!s.data) return null;
      const px = Math.min(23, Math.max(0, Math.floor(fx * 24))), py = Math.min(23, Math.max(0, Math.floor(fy * 24)));
      let sum = 0, n = 0;
      for (let x = Math.max(0, px - 2); x <= Math.min(23, px + 2); x++) {
        const i = (py * 24 + x) * 4;
        sum += luminance(`rgb(${s.data[i]},${s.data[i + 1]},${s.data[i + 2]})`); n++;
      }
      return sum / n;
    }
    function toneAt(x, y) {
      for (const el of doc.elementsFromPoint(x, y)) {
        if (header.contains(el)) continue;
        if (el.closest && el.closest('#site-intro')) continue;   // the first-visit intro's slab is not the page
        const cs = win.getComputedStyle(el), b = el.getBoundingClientRect();
        if (el.tagName === 'IMG' && el.currentSrc && el.naturalWidth) {
          // where the point falls in a picture laid like object-fit: cover
          const k = Math.max(b.width / el.naturalWidth, b.height / el.naturalHeight), w = el.naturalWidth * k, h = el.naturalHeight * k;
          const L = picture(el.currentSrc, (x - b.left - (b.width - w) / 2) / w, (y - b.top - (b.height - h) / 2) / h);
          if (L !== null) return L;
          continue;
        }
        const bg = /url\(["']?([^"')]+)/.exec(cs.backgroundImage || '');
        if (bg && b.width && b.height) { const L = picture(bg[1], (x - b.left) / b.width, (y - b.top) / b.height); if (L !== null) return L; }
        const L = luminance(cs.backgroundColor);
        if (L !== null) return L;
      }
      return 1;
    }
    function check() {
      raf = 0;
      const r = header.getBoundingClientRect(), y = r.top + Math.min(r.height, 60) / 2;
      let dark = 0;
      [0.12, 0.5, 0.88].forEach(t => { if (toneAt(r.left + r.width * t, y) < DARK_BELOW) dark++; });
      header.classList.toggle('is-on-dark', dark >= 2);
    }
    win.addEventListener('scroll', ask, { passive: true });
    win.addEventListener('resize', ask);
    // The first-visit intro (js/intro.js) lies over the whole page while <html> has .si-on; it is
    // skipped above, and the tone is read again at once when it goes, without waiting for a frame
    // (2026-11-07: the capsule stayed dark over a light page until the first scroll).
    if (win.MutationObserver && doc.documentElement) {
      new win.MutationObserver(() => check()).observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
    win.addEventListener('load', ask);
    win.addEventListener('pageshow', ask);
    // The first tone at once, without a fade (else the capsule lit up light and faded to dark on
    // every load over the dark hero); the glass changes smoothly only from the next frame on.
    check();
    win.requestAnimationFrame(() => header.classList.add('tone-ready'));
    return { check, toneAt };
  }

  // One graphite line for the whole row: it rests under the current section
  // (none on the home page), moves to the item under the pointer or the
  // keyboard focus, and comes back when they leave the row. Wide screens only.
  function initIndicator(doc, win, header, mq) {
    const nav = header.querySelector('.site-nav');
    if (!nav || !nav.querySelectorAll || !doc.createElement) return null;
    const items = [...nav.querySelectorAll(':scope > a, .nav-drop > summary')];
    if (!items.length) return null;
    const bar = doc.createElement('span');
    bar.className = 'nav-indicator';
    bar.setAttribute('aria-hidden', 'true');
    nav.appendChild(bar);
    const current = items.find(item => item.classList.contains('active')) || null;
    // Measured from the header's row (the line's containing block), not the
    // nav: the «Изделия» panel hangs from that row too.
    const box = nav.parentNode;

    function show(item) {
      if (!item || mq.matches) { bar.classList.remove('is-on'); return; }
      const n = box.getBoundingClientRect();
      const r = item.getBoundingClientRect();
      bar.style.transform = 'translateX(' + (r.left - n.left) + 'px) scaleX(' + r.width + ')';
      bar.classList.add('is-on');
    }
    const rest = () => show(current);

    items.forEach(item => {
      item.addEventListener('mouseenter', () => show(item));
      item.addEventListener('focus', () => show(item));
    });
    nav.addEventListener('mouseleave', rest);
    nav.addEventListener('focusout', e => { if (!e.relatedTarget || !nav.contains(e.relatedTarget)) rest(); });
    win.addEventListener('resize', rest);
    rest();
    // Placed first without a transition, so it does not slide in from the left edge on load.
    (win.requestAnimationFrame || (f => f()))(() => bar.classList.add('is-ready'));
    return { show, rest, bar };
  }

  // Liquid glass (2026-10-10, the owner's choice: the five places of
  // .claude/concepts/liquid-glass.html, then the configurator's step track).
  // Here, in the one script the site, the showroom and the configurator all
  // load. css/site.css, css/showroom.css and the configurator frost the glass
  // everywhere; where the browser can bend the backdrop
  // through an SVG filter -- Chromium; Safari and Firefox do not draw url()
  // in backdrop-filter -- the glass also refracts near its edges: the filter
  // goes into the page once and <html> gets .glass-bend, which the CSS reads.
  // Not when the visitor asks for less transparency (the CSS then makes the
  // glass solid).
  const GLASS_FILTER = '<svg id="lg-bend-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">' +
    '<filter id="lg-bend" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise"/>' +
    '<feGaussianBlur in="noise" stdDeviation="2" result="soft"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="soft" scale="38" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter></svg>';
  function mountGlass(doc, nav, matchMedia) {
    if (!doc || !doc.body || !nav || !('userAgentData' in nav)) return false;
    if (matchMedia && matchMedia('(prefers-reduced-transparency: reduce)').matches) return false;
    if (!doc.getElementById('lg-bend-defs')) {
      const holder = doc.createElement('div');
      holder.innerHTML = GLASS_FILTER;
      doc.body.appendChild(holder.firstChild);
    }
    doc.documentElement.classList.add('glass-bend');
    return true;
  }
  if (typeof document !== 'undefined' && typeof navigator !== 'undefined') {
    mountGlass(document, navigator, typeof window !== 'undefined' && window.matchMedia ? q => window.matchMedia(q) : null);
  }

  if (typeof document !== 'undefined' && typeof window !== 'undefined') init(document, window);

  return { init, initIndicator, initProducts, initTone, luminance, mountGlass, clipCut, MOBILE_QUERY, REDUCED_QUERY, FOLD_MS };
});
