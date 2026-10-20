(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteCommon = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // Portfolio rows: every row the full width and one height, every photo whole
  // in its own proportions -- never cropped. The proportion (--ar, width /
  // height) is the photo's own, from its listed size, so the rows stand before
  // the photos arrive; a photo listed without a size takes 2:3 until it loads.
  // css/site.css alone already makes full rows of one height (each photo grows
  // in step with its proportion), but leaves the last row short. The plan below
  // shares the photos out between the rows -- in their order -- so that every
  // row, the last one too, is full and the rows are about the row height.
  const DEFAULT_RATIO = 2 / 3;
  const MAX_SCALE = 1.5;   // a row may stand up to 1.5 x the row height; past that it stops short of the edge
  function photoRatio(item) {
    return item && item.width > 0 && item.height > 0 ? item.width / item.height : DEFAULT_RATIO;
  }
  function setRatio(figure, ratio) {
    const r = Math.round(ratio * 10000) / 10000;
    figure.style.setProperty('--ar', String(r));
    figure.dataset.ar = String(r);
  }

  // How many photos go into each row. The number of rows is what the row height
  // asks for; the photos are then split, in order, so that the rows' total
  // proportions are as even as they can be (least squares over all splits),
  // which keeps the rows' heights close to each other.
  function rowPlan(ratios, width, gap, rowHeight) {
    const n = ratios.length;
    if (!n || !(width > 0) || !(rowHeight > 0)) return [];
    const total = ratios.reduce((a, b) => a + b, 0);
    const rows = Math.max(1, Math.min(n, Math.round((total * rowHeight + gap * n) / (width + gap))));
    const prefix = [0];
    ratios.forEach(r => prefix.push(prefix[prefix.length - 1] + r));
    const ideal = total / rows;
    const cost = (i, j) => (prefix[j] - prefix[i] - ideal) ** 2;   // photos i..j-1 in one row
    // best[k][j]: the least cost of putting the first j photos into k rows.
    const best = [Array(n + 1).fill(Infinity)];
    const cut = [Array(n + 1).fill(0)];
    best[0][0] = 0;
    for (let k = 1; k <= rows; k++) {
      best[k] = Array(n + 1).fill(Infinity);
      cut[k] = Array(n + 1).fill(0);
      for (let j = k; j <= n; j++) {
        for (let i = k - 1; i < j; i++) {
          const c = best[k - 1][i] + cost(i, j);
          if (c < best[k][j]) { best[k][j] = c; cut[k][j] = i; }
        }
      }
    }
    const counts = [];
    for (let k = rows, j = n; k > 0; k--) { const i = cut[k][j]; counts.unshift(j - i); j = i; }
    return counts;
  }

  // Each photo's flex: a full row shares the width (less its gaps) by
  // proportion and grows by proportion (the 1px it is short of absorbs
  // rounding); a row that would stand taller than MAX_SCALE x the row height
  // (a page with two photos) keeps that height and stops short of the edge.
  function layoutRows(container) {
    const items = Array.from(container.children);
    const style = getComputedStyle(container);
    const gap = parseFloat(style.columnGap) || 0;
    const rowHeight = parseFloat(style.getPropertyValue('--row-h')) || 300;
    const width = container.clientWidth;
    const ratios = items.map(el => parseFloat(el.dataset.ar) || DEFAULT_RATIO);
    let start = 0;
    rowPlan(ratios, width, gap, rowHeight).forEach(count => {
      const row = ratios.slice(start, start + count);
      const sum = row.reduce((a, b) => a + b, 0);
      const gaps = gap * (count - 1);
      const tooTall = (width - gaps) / sum > rowHeight * MAX_SCALE;
      row.forEach((r, k) => {
        items[start + k].style.flex = tooTall
          ? '0 0 ' + (r * rowHeight * MAX_SCALE).toFixed(2) + 'px'
          : r + ' 1 calc((100% - ' + gaps + 'px) * ' + (r / sum).toFixed(6) + ' - 1px)';
      });
      start += count;
    });
    container.classList.add('is-planned');
  }

  function enableRows(container) {
    // Without ResizeObserver the CSS rows stay (the last one may be short).
    if (container.dataset.rows || typeof ResizeObserver === 'undefined') return;
    container.dataset.rows = 'on';
    let queued = false;
    const relayout = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; layoutRows(container); });
    };
    let width = -1;
    new ResizeObserver(entries => {
      const w = entries[entries.length - 1].contentRect.width;
      if (w !== width) { width = w; relayout(); }
    }).observe(container);
    container.addEventListener('load', relayout, true);   // an unlisted photo arrived: its proportion is known
    relayout();
  }

  // A photo without a caption is still a work, not decoration: it is named
  // after the page it stands on («Лестницы из камня - работа 2»).
  function portfolioAlt(pageTitle, item, i) {
    if (item.caption) return item.caption;
    return pageTitle ? pageTitle + ' - работа ' + (i + 1) : '';
  }

  // The grid's copy of a photo (640 px) and the original, for dense screens;
  // `sizes` is the photo's width at the tallest row of each layout (css/site.css).
  function photoSources(item) {
    if (!item.thumb || !item.width) return null;
    const r = photoRatio(item);
    return {
      srcset: item.thumb + ' 640w, ' + item.image + ' ' + item.width + 'w',
      sizes: '(max-width: 600px) ' + Math.ceil(r * 260) + 'px, (max-width: 900px) ' + Math.ceil(r * 300) + 'px, ' + Math.ceil(r * 440) + 'px',
    };
  }

  function renderPortfolio(container, items) {
    container.innerHTML = '';
    items = items || [];
    const h1 = document.querySelector ? document.querySelector('h1') : null;
    const pageTitle = h1 ? h1.textContent.trim() : '';
    items.forEach((item, i) => {
      const figure = document.createElement('figure');
      figure.className = 'portfolio-item';
      // The frame: rounded, a soft shadow and a hairline edge; under a pointer it lifts (css/site.css).
      // Until the photo arrives the frame shows its 16 px preview, blurred.
      const shot = document.createElement('span');
      shot.className = 'portfolio-shot';
      if (item.preview) shot.style.setProperty('--preview', 'url("' + item.preview + '")');
      setRatio(figure, photoRatio(item));
      const img = document.createElement('img');
      const sources = photoSources(item);
      if (sources) { img.srcset = sources.srcset; img.sizes = sources.sizes; }
      img.src = item.thumb || item.image;
      img.alt = portfolioAlt(pageTitle, item, i);
      img.loading = 'lazy';
      img.decoding = 'async';
      if (item.width && item.height) { img.width = item.width; img.height = item.height; }
      img.addEventListener('load', () => {
        if (!(item.width && item.height) && img.naturalHeight) setRatio(figure, img.naturalWidth / img.naturalHeight);
        shot.classList.add('is-loaded');
      });
      img.addEventListener('error', () => { figure.classList.add('image-broken'); img.remove(); });
      shot.appendChild(img);
      figure.appendChild(shot);
      if (item.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = item.caption;
        figure.appendChild(caption);
      }
      container.appendChild(figure);
    });
    enableRows(container);
    enableReveal(container);
    enableViewer(container, items);
  }

  // The rows come into view once, as they come up the screen: each photo fades
  // in as it rises a little, left to right 60 ms apart (css/site.css). Then the
  // classes go: the photo is the plain photo again.
  const REVEAL_STEP = 60;
  function revealOrder(figures) {
    return figures.slice().sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return ra.top - rb.top || ra.left - rb.left;
    });
  }
  function enableReveal(container) {
    if (typeof IntersectionObserver === 'undefined') return;
    const figures = Array.from(container.children);
    figures.forEach(f => f.classList.add('will-reveal'));
    const io = new IntersectionObserver(entries => {
      const entering = revealOrder(entries.filter(e => e.isIntersecting).map(e => e.target));
      entering.forEach((f, n) => {
        io.unobserve(f);
        f.style.setProperty('--reveal-delay', Math.min(n, 8) * REVEAL_STEP + 'ms');
        f.classList.add('is-revealed');
        let settled = false;
        const settle = e => {
          if (settled || (e && (e.target !== f || e.propertyName !== 'transform'))) return;
          settled = true;
          f.removeEventListener('transitionend', settle);
          f.classList.remove('will-reveal', 'is-revealed');
          f.style.removeProperty('--reveal-delay');
        };
        f.addEventListener('transitionend', settle);
        setTimeout(settle, 1000 + Math.min(n, 8) * REVEAL_STEP);   // a page not being drawn sends no transitionend
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    // Watched once the rows are laid out (enableRows plans them in the next frame), so a row
    // rises when it really comes up the screen, not where it stood before the plan.
    requestAnimationFrame(() => requestAnimationFrame(() => figures.forEach(f => io.observe(f))));
  }

  // ---- The viewer ----------------------------------------------------------------
  // A photo opens where it stands: it grows from its frame to the whole screen
  // (the frame's place stays empty meanwhile), on a dark veil, with the count,
  // the close button, the arrows and a strip of all the photos. ← → and the
  // strip switch at once; the arrows and a swipe slide the next photo in from
  // its side. Esc, ×, the veil or a swipe down close it: the photo goes back
  // into its frame, quicker than it came out. The focus stays inside while it
  // is open and returns to the photo it came from.
  const VIEWER_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';   // quick to answer, soft to land
  const SLIDE_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const SVG = {
    close: '<path d="M6 6l12 12M18 6 6 18"/>', prev: '<path d="m15 5-7 7 7 7"/>', next: '<path d="m9 5 7 7-7 7"/>',
  };
  function iconButton(doc, cls, label, icon) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'viewer-btn ' + cls;
    b.setAttribute('aria-label', label);
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + SVG[icon] + '</svg>';
    return b;
  }
  // Where a photo stands whole in the stage (contain), in viewport pixels.
  function fitRect(stageRect, ratio, pad) {
    let w = stageRect.width - pad * 2, h = w / ratio;
    if (h > stageRect.height - 16) { h = stageRect.height - 16; w = h * ratio; }
    return { left: stageRect.left + (stageRect.width - w) / 2, top: stageRect.top + (stageRect.height - h) / 2, width: w, height: h };
  }

  function enableViewer(container, items) {
    if (typeof document === 'undefined' || !document.body || !items.length || container.dataset.viewer) return;
    container.dataset.viewer = 'on';
    const doc = document;
    const figures = Array.from(container.children);
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lb = null, stage, count, strip, veil, index = -1, img = null, opener = null, busy = false;

    figures.forEach((f, i) => {
      const alt = f.querySelector('img') ? f.querySelector('img').alt : '';
      f.tabIndex = 0;
      f.setAttribute('role', 'button');
      f.setAttribute('aria-label', (alt || 'Фото ' + (i + 1)) + ': открыть крупно');
      f.addEventListener('click', () => open(i));
      f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
    });

    function build() {
      lb = doc.createElement('div');
      lb.className = 'viewer';
      lb.setAttribute('role', 'dialog');
      lb.setAttribute('aria-modal', 'true');
      lb.setAttribute('aria-label', 'Просмотр фото');
      lb.hidden = true;
      veil = doc.createElement('div');
      veil.className = 'viewer-veil';
      const top = doc.createElement('div');
      top.className = 'viewer-top';
      count = doc.createElement('span');
      count.className = 'viewer-count';
      count.setAttribute('aria-live', 'polite');
      const close = iconButton(doc, 'viewer-close', 'Закрыть', 'close');
      top.append(count, close);
      stage = doc.createElement('div');
      stage.className = 'viewer-stage';
      const prev = iconButton(doc, 'viewer-prev', 'Предыдущее фото', 'prev');
      const next = iconButton(doc, 'viewer-next', 'Следующее фото', 'next');
      stage.append(prev, next);
      strip = doc.createElement('div');
      strip.className = 'viewer-strip';
      strip.setAttribute('role', 'group');
      strip.setAttribute('aria-label', 'Все фото');
      items.forEach((item, i) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Фото ' + (i + 1));
        const t = doc.createElement('img');
        t.src = item.thumb || item.image;
        t.alt = '';
        t.loading = 'lazy';
        t.height = 56;
        t.width = Math.round(56 * photoRatio(item));
        b.appendChild(t);
        b.addEventListener('click', () => go(i, 0, true));
        strip.appendChild(b);
      });
      lb.append(veil, top, stage, strip);
      doc.body.appendChild(lb);

      close.addEventListener('click', closeViewer);
      veil.addEventListener('click', closeViewer);
      stage.addEventListener('click', e => { if (e.target === stage) closeViewer(); });
      prev.addEventListener('click', () => go(index - 1, -1));
      next.addEventListener('click', () => go(index + 1, 1));
      lb.addEventListener('keydown', onKey);
      addEventListener('resize', () => { if (img && !busy) place(img, target(index)); });
      enableSwipe();
    }

    // On whole pixels: a photograph at rest between two pixels is drawn soft and shifts when redrawn.
    const target = i => { const r = fitRect(stage.getBoundingClientRect(), photoRatio(items[i]), innerWidth < 700 ? 12 : 88); return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }; };
    const shotOf = i => figures[i].querySelector('.portfolio-shot');
    function place(el, r) {
      el._rect = r;
      el.style.width = r.width + 'px';
      el.style.height = r.height + 'px';
      el.style.transform = 'translate(' + r.left + 'px,' + r.top + 'px)';
    }
    function photo(i) {
      const el = doc.createElement('img');
      el.className = 'viewer-img';
      el.alt = figures[i].querySelector('img') ? figures[i].querySelector('img').alt : '';
      el.src = items[i].image;   // the original: the grid's copy is already cached as a stand-in below
      el.style.backgroundImage = 'url("' + (items[i].thumb || items[i].image) + '")';
      el.draggable = false;
      stage.appendChild(el);
      return el;
    }
    function setCurrent(i) {
      index = i;
      count.innerHTML = '<b>' + (i + 1) + '</b> / ' + items.length;
      Array.from(strip.children).forEach((b, n) => b.setAttribute('aria-current', String(n === i)));
      strip.children[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }

    function open(i) {
      if (busy) return;
      if (!lb) build();
      busy = true;
      opener = figures[i];
      const gutter = innerWidth - doc.documentElement.clientWidth;   // the page must not jump when its scrollbar goes
      doc.documentElement.classList.add('viewer-open');
      if (gutter > 0) doc.body.style.paddingRight = gutter + 'px';
      lb.hidden = false;
      requestAnimationFrame(() => {
        lb.classList.add('is-open');
        setCurrent(i);
        img = photo(i);
        const from = shotOf(i).getBoundingClientRect(), to = target(i);
        place(img, to);
        shotOf(i).style.visibility = 'hidden';
        flip(img, from, to, 520).finished.then(() => {
          busy = false;
          lb.querySelector('.viewer-close').focus({ preventScroll: true });
        });
      });
    }

    // FLIP: an element already standing at b animates from rect a.
    function flip(el, a, b, ms) {
      const sx = a.width / b.width, sy = a.height / b.height;
      return el.animate([
        { transform: 'translate(' + a.left + 'px,' + a.top + 'px) scale(' + sx + ',' + sy + ')', borderRadius: 20 / sx + 'px / ' + 20 / sy + 'px' },
        { transform: 'translate(' + b.left + 'px,' + b.top + 'px) scale(1,1)', borderRadius: '12px' },
      ], { duration: reduce ? 0 : ms, easing: VIEWER_EASE });
    }

    function closeViewer() {
      if (busy || !img) return;
      busy = true;
      const i = index, shot = shotOf(i), from = img._rect;
      shot.scrollIntoView({ block: 'nearest' });
      const to = shot.getBoundingClientRect();
      lb.classList.remove('is-open');
      const sx = to.width / from.width, sy = to.height / from.height;
      img.animate([
        { transform: 'translate(' + from.left + 'px,' + from.top + 'px) scale(1,1)', borderRadius: '12px' },
        { transform: 'translate(' + to.left + 'px,' + to.top + 'px) scale(' + sx + ',' + sy + ')', borderRadius: 20 / sx + 'px / ' + 20 / sy + 'px' },
      ], { duration: reduce ? 0 : 340, easing: VIEWER_EASE, fill: 'forwards' }).finished.then(() => {
        shot.style.visibility = '';
        img.remove();
        img = null;
        lb.hidden = true;
        busy = false;
        doc.documentElement.classList.remove('viewer-open');
        doc.body.style.paddingRight = '';
        opener.focus({ preventScroll: true });
      });
    }

    // Another photo: from the arrows and a swipe it slides in from its side;
    // from the keys and the strip it is simply there (a key is pressed often).
    function go(i, dir, instant) {
      if (busy || !img || i === index || i < 0 || i >= items.length) return;
      dir = dir || (i > index ? 1 : -1);
      const old = img, next = photo(i), r = target(i);
      place(next, r);
      shotOf(index).style.visibility = '';
      shotOf(i).style.visibility = 'hidden';
      setCurrent(i);
      img = next;
      if (instant || reduce) { old.remove(); return; }
      busy = true;
      const shift = Math.min(innerWidth * 0.18, 160) * dir, o = old._rect;
      old.animate([
        { transform: 'translate(' + o.left + 'px,' + o.top + 'px)', opacity: 1 },
        { transform: 'translate(' + (o.left - shift) + 'px,' + o.top + 'px) scale(0.96)', opacity: 0 },
      ], { duration: 260, easing: SLIDE_EASE, fill: 'forwards' }).finished.then(() => old.remove());
      next.animate([
        { transform: 'translate(' + (r.left + shift) + 'px,' + r.top + 'px) scale(0.96)', opacity: 0, filter: 'blur(4px)' },
        { transform: 'translate(' + r.left + 'px,' + r.top + 'px) scale(1)', opacity: 1, filter: 'blur(0)' },
      ], { duration: 320, easing: SLIDE_EASE }).finished.then(() => { busy = false; });
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); closeViewer(); }
      else if (e.key === 'ArrowRight') go(index + 1, 1, true);
      else if (e.key === 'ArrowLeft') go(index - 1, -1, true);
      else if (e.key === 'Tab') {   // the focus stays inside the viewer
        const all = Array.from(lb.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        const first = all[0], last = all[all.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    // A finger or a mouse on the photo: it follows; sideways switches (a quick
    // flick is enough), down closes; past the first and the last photo it
    // drags with friction; let go short of that and it springs back.
    function enableSwipe() {
      let start = null;
      stage.addEventListener('pointerdown', e => {
        if (busy || !img || e.target !== img || start) return;
        start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, base: img._rect };
        img.setPointerCapture(e.pointerId);
      });
      stage.addEventListener('pointermove', e => {
        if (!start || e.pointerId !== start.id) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y, b = start.base;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
          const s = Math.max(0.75, 1 - dy / 1600);
          img.style.transform = 'translate(' + (b.left + dx * 0.4 + b.width * (1 - s) / 2) + 'px,' + (b.top + dy) + 'px) scale(' + s + ')';
          veil.style.opacity = String(Math.max(0.3, 1 - dy / 500));
        } else {
          const edge = (dx > 0 && index === 0) || (dx < 0 && index === items.length - 1);
          img.style.transform = 'translate(' + (b.left + (edge ? dx * 0.25 : dx)) + 'px,' + b.top + 'px)';
        }
      });
      const end = e => {
        if (!start || e.pointerId !== start.id) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        const speed = Math.hypot(dx, dy) / Math.max(1, performance.now() - start.t);
        const b = start.base;
        start = null;
        veil.style.opacity = '';
        if (dy > 120 || (dy > 30 && speed > 0.11 && dy > Math.abs(dx))) { place(img, b); closeViewer(); return; }
        const i = index + (dx < 0 ? 1 : -1);
        if ((Math.abs(dx) > 80 || (Math.abs(dx) > 20 && speed > 0.11)) && i >= 0 && i < items.length) { place(img, b); go(i, dx < 0 ? 1 : -1); return; }
        const from = img.style.transform;
        place(img, b);
        img.animate([{ transform: from }, { transform: img.style.transform }], { duration: 260, easing: SLIDE_EASE });
      };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);
    }
  }

  function loadPortfolio(productKey, container) {
    fetch('/sayanmramor-site/data/portfolio.json')
      .then(r => r.json())
      .then(data => renderPortfolio(container, data[productKey] || []))
      .catch(() => { container.textContent = 'Не удалось загрузить примеры работ.'; });
  }

  // On a phone the sections are one scrollable row: bring the current one
  // into view instead of leaving it past the right edge.
  function revealActiveNav(doc) {
    const nav = doc.querySelector('.site-nav');
    const active = nav && nav.querySelector('a.active');
    if (!active || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }
  if (typeof document !== 'undefined') revealActiveNav(document);

  // The sticky header and the fixed configure bar cover the page's top and
  // bottom edges, and their height changes with the width (the menu wraps).
  // Their live heights (plus a gap for the focus ring) go into the
  // scroll-padding variables of site.css, so the browser scrolls a focused
  // stone card, or any other scrolled-to element, clear of both.
  const FIXED_UI_GAP = 16;
  function reserveFixedUi(doc) {
    const root = doc.documentElement;
    const parts = [['--sticky-top', doc.querySelector('.site-header')], ['--fixed-bottom', doc.querySelector('.configure-bar')]]
      .filter(([, el]) => el);
    // The configure bar floats a little above the bottom edge (a glass capsule): its gap counts too.
    const view = doc.defaultView;
    const offset = el => (view && view.getComputedStyle ? parseFloat(view.getComputedStyle(el).bottom) : 0) || 0;
    const measure = () => parts.forEach(([name, el]) => {
      // The phone menu grows the capsule down over the page: that is not the bar to keep clear of,
      // and «Заказать» in it would scroll to its anchor a whole menu short.
      if (el.classList && el.classList.contains('menu-open')) return;
      const extra = name === '--fixed-bottom' ? offset(el) : 0;
      root.style.setProperty(name, Math.ceil(el.getBoundingClientRect().height + extra) + FIXED_UI_GAP + 'px');
    });
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      parts.forEach(([, el]) => ro.observe(el));
    }
  }
  if (typeof document !== 'undefined') reserveFixedUi(document);

  // Years on the market (home, «О компании»): counted from the founding day in
  // data-since (6 February 2014, not shown on the page), so the figure turns
  // over by itself each 6 February. The page carries the figure as of its last
  // edit, so it reads right without the script too.
  function yearsSince(since, now) {
    const [y, m, d] = since.split('-').map(Number);
    let years = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) years--;
    return Math.max(0, years);
  }
  function yearsWord(n) {
    const last = n % 10, lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 14) return 'лет';
    if (last === 1) return 'год';
    if (last >= 2 && last <= 4) return 'года';
    return 'лет';
  }
  function showYearsOnMarket(doc, now) {
    Array.from(doc.querySelectorAll('[data-since]')).forEach(el => {
      const n = yearsSince(el.dataset.since, now || new Date());
      const figure = el.querySelector('[data-years]'), word = el.querySelector('[data-years-word]');
      if (figure) figure.textContent = String(n);
      if (word) word.textContent = yearsWord(n);
    });
  }
  if (typeof document !== 'undefined') showYearsOnMarket(document);

  // «Нам доверяют» as passes (2026-10-11, the owner: the motion of the 21st.dev «Lunar Boarding
  // Pass», ported without React): each tile becomes a two-sided pass in a 3D stage. As the wall
  // comes up the screen the logos are stamped onto their tiles one after another; under a mouse
  // the pass leans towards the pointer and a band of foil light follows it; on hover or keyboard
  // focus it turns over to its dark stub -- the company's name and its site typed out. Nothing
  // on the back is new: the name is the logo's own alt (or the ministry's caption), the site the
  // link's own address. Without the script, or with reduced motion, the tiles stay as they were.
  function trustSite(href) {
    try { return new URL(href).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  function mountTrustMotion(doc, win) {
    const wall = doc.querySelector('.home-trust-wall');
    if (!wall || !win.IntersectionObserver) return;
    if (win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const make = (tag, cls, text) => { const el = doc.createElement(tag); el.className = cls; if (text) el.textContent = text; return el; };
    Array.from(wall.querySelectorAll('.home-trust-item')).forEach((a, n) => {
      const caption = a.querySelector('.home-trust-mcx-name'), logo = a.querySelector('.home-trust-logo');
      const name = (caption && caption.textContent) || (logo && logo.alt) || '';
      const said = a.querySelector('.visually-hidden');
      const front = make('span', 'trust-face trust-front');
      Array.from(a.childNodes).filter(c => c !== said).forEach(c => front.appendChild(c));
      const back = make('span', 'trust-face trust-back');
      back.setAttribute('aria-hidden', 'true');
      back.append(make('span', 'trust-glare'), make('span', 'trust-back-name' + (name.length > 30 ? ' is-long' : ''), name), make('span', 'trust-back-site', trustSite(a.href)), make('span', 'trust-back-go', 'Открыть сайт'));
      const flip = make('span', 'trust-flip'), tilt = make('span', 'trust-tilt');
      flip.append(front, back);
      tilt.appendChild(flip);
      a.insertBefore(tilt, said);
      a.classList.add('trust-pass');
      a.style.setProperty('--n', n);
      a.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = a.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        a.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        a.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        a.style.setProperty('--rx', (-(py - 0.5) * 2 * 9).toFixed(2) + 'deg');
        a.style.setProperty('--ry', ((px - 0.5) * 2 * 9).toFixed(2) + 'deg');
      });
      a.addEventListener('pointerleave', () => { a.style.setProperty('--rx', '0deg'); a.style.setProperty('--ry', '0deg'); });
    });
    wall.classList.add('trust-motion');
    const io = new win.IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      wall.classList.add('is-in');
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.25 });
    io.observe(wall);
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') mountTrustMotion(document, window);

  // «Что можно заказать» as tilt cards (2026-10-12, the owner: the 21st.dev «Tilt Card», ported
  // without React): under a mouse each group leans away from the pointer (15deg at the edge),
  // grows by 5% and a soft spotlight follows the pointer; on leaving it settles back. The photos
  // inside no longer move on their own. Touch screens and reduced motion keep the groups still.
  const TILT = { limit: 15, scale: 1.05, dir: -1 };   // dir -1: «evade», tilts away from the pointer
  function mountGroupTilt(doc, win) {
    if (!win.matchMedia || !win.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
    Array.from(doc.querySelectorAll('.home-group')).forEach(card => {
      card.classList.add('tilt-card');
      let settle = 0;   // after leaving: drop the transform once the card is back flat (0.2s in the CSS)
      card.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        win.clearTimeout(settle);
        card.classList.add('is-tilting');
        const r = card.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        card.style.setProperty('--rx', ((py - 0.5) * TILT.limit * 2 * TILT.dir).toFixed(2) + 'deg');
        card.style.setProperty('--ry', (-(px - 0.5) * TILT.limit * 2 * TILT.dir).toFixed(2) + 'deg');
        card.style.setProperty('--tilt-s', String(TILT.scale));
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        card.style.setProperty('--spot-r', Math.round(0.4 * Math.hypot(r.width, r.height)) + 'px');
      });
      card.addEventListener('pointerleave', () => {
        ['--rx', '--ry', '--tilt-s'].forEach(p => card.style.removeProperty(p));
        win.clearTimeout(settle);
        settle = win.setTimeout(() => card.classList.remove('is-tilting'), 260);
      });
    });
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') mountGroupTilt(document, window);

  return { renderPortfolio, loadPortfolio, portfolioAlt, photoRatio, photoSources, rowPlan, layoutRows, revealOrder, fitRect, revealActiveNav, reserveFixedUi, yearsSince, yearsWord, showYearsOnMarket, trustSite };
});
