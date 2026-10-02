(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteHeader = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // The header works without this script: «Изделия» is a native <details>, the
  // links are plain anchors. The script only adds what a <details> does not do
  // by itself -- closing the panel with Esc, with a click outside it, or when
  // focus leaves it -- the one line under the row that travels to the item
  // under the pointer (and rests under the current section), and, under
  // MOBILE_QUERY, the menu button.
  const MOBILE_QUERY = '(max-width: 1000px)';

  function init(doc, win) {
    const header = doc.querySelector('.site-header');
    if (!header) return null;
    const products = header.querySelector('.nav-products');
    const summary = products && products.querySelector('summary');
    const toggle = header.querySelector('.nav-toggle');
    const mq = win.matchMedia ? win.matchMedia(MOBILE_QUERY) : { matches: false };
    const root = doc.documentElement;

    function menuOpen() { return header.classList.contains('menu-open'); }

    function closePanel(returnFocus) {
      if (!products || !products.open) return;
      products.open = false;
      if (returnFocus && summary) summary.focus();
    }

    function setMenu(open) {
      header.classList.toggle('menu-open', open);
      root.classList.toggle('menu-lock', open);
      if (toggle) {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Меню');
      }
      // In the open menu the products are always listed (no second tap); closed, they rest.
      if (products) products.open = open;
    }

    // «Изделия» is a button only on a wide screen: in the mobile menu it is a heading.
    function syncMode() {
      if (mq.matches) {
        if (summary) summary.setAttribute('tabindex', '-1');
      } else {
        if (menuOpen()) setMenu(false);
        if (summary) summary.removeAttribute('tabindex');
      }
    }

    if (summary) {
      summary.addEventListener('click', e => { if (mq.matches) e.preventDefault(); });
    }
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
      const a = e.target.closest && e.target.closest('.site-nav a');
      if (a && menuOpen()) setMenu(false);
    });
    doc.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (menuOpen()) { setMenu(false); if (toggle) toggle.focus(); return; }
      if (products && products.open) closePanel(true);
    });
    doc.addEventListener('click', e => {
      if (products && products.open && !mq.matches && !products.contains(e.target)) closePanel(false);
    });
    products && products.addEventListener('focusout', e => {
      if (!mq.matches && e.relatedTarget && !products.contains(e.relatedTarget)) closePanel(false);
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
    const items = [...nav.querySelectorAll(':scope > a, .nav-products > summary')];
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

  return { init, initIndicator, MOBILE_QUERY };
});
