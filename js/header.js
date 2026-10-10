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

  function init(doc, win) {
    const header = doc.querySelector('.site-header');
    if (!header) return null;
    const drops = header.querySelectorAll ? [...header.querySelectorAll('.nav-drop')] : [];
    const toggle = header.querySelector('.nav-toggle');
    const mq = win.matchMedia ? win.matchMedia(MOBILE_QUERY) : { matches: false };
    const reduced = () => !!(win.matchMedia && win.matchMedia(REDUCED_QUERY).matches);
    const root = doc.documentElement;
    const summaryOf = drop => drop.querySelector('summary');
    const folding = new Map();   // drop -> its pending fold's timer

    function menuOpen() { return header.classList.contains('menu-open'); }

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

    function setMenu(open) {
      header.classList.toggle('menu-open', open);
      root.classList.toggle('menu-lock', open);
      if (toggle) {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Меню');
      }
      // In the open menu every panel is shown (no second tap); closed, they rest.
      drops.forEach(d => { stopFold(d); d.open = open; });
    }

    // The panels' names are buttons only on a wide screen: in the mobile menu they are headings.
    function syncMode() {
      drops.forEach(d => {
        const s = summaryOf(d);
        if (!s) return;
        if (mq.matches) s.setAttribute('tabindex', '-1'); else s.removeAttribute('tabindex');
      });
      if (!mq.matches && menuOpen()) setMenu(false);
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
      toggle.addEventListener('click', () => {
        const open = !menuOpen();
        setMenu(open);
        if (open) {
          const first = header.querySelector('.nav-group a');
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
      if (menuOpen()) { setMenu(false); if (toggle) toggle.focus(); return; }
      drops.forEach(d => { if (d.open) closePanel(d, true); });
    });
    doc.addEventListener('click', e => {
      if (mq.matches) return;
      drops.forEach(d => { if (d.open && !d.contains(e.target)) closePanel(d, false); });
    });
    const indicator = initIndicator(doc, win, header, mq);
    const onModeChange = () => { syncMode(); if (indicator) indicator.rest(); };
    if (mq.addEventListener) mq.addEventListener('change', onModeChange); else if (mq.addListener) mq.addListener(onModeChange);
    syncMode();
    return { setMenu, closePanel, indicator };
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

  if (typeof document !== 'undefined' && typeof window !== 'undefined') init(document, window);

  return { init, initIndicator, MOBILE_QUERY, REDUCED_QUERY, FOLD_MS };
});
