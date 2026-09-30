(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteCommon = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // Portfolio masonry. The grid has 1px rows; each photo spans as many rows as
  // it is tall plus the gap, and the grid's ordinary (sparse) auto-placement
  // puts every next photo in the first free spot to the right / below, so the
  // photos read left to right, top to bottom, and close up vertically.
  function masonrySpan(height, gap) {
    return Math.max(1, Math.ceil(height + gap));
  }

  function layoutMasonry(container, gap) {
    const items = Array.from(container.children);
    const heights = items.map(el => el.getBoundingClientRect().height);   // read everything, then write
    items.forEach((el, i) => { el.style.gridRowEnd = 'span ' + masonrySpan(heights[i], gap); });
  }

  function enableMasonry(container) {
    // Without ResizeObserver the plain grid (no masonry class) stays in place.
    if (container.dataset.masonry || typeof ResizeObserver === 'undefined') return;
    container.dataset.masonry = 'on';
    container.classList.add('is-masonry');
    let queued = false;
    const relayout = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        layoutMasonry(container, parseFloat(getComputedStyle(container).columnGap) || 0);
      });
    };
    let width = -1;
    new ResizeObserver(entries => {
      const w = entries[entries.length - 1].contentRect.width;
      if (w !== width) { width = w; relayout(); }
    }).observe(container);
    container.addEventListener('load', relayout, true);    // a photo arrived: its real height is known
    container.addEventListener('error', relayout, true);
    relayout();
  }

  function renderPortfolio(container, items) {
    container.innerHTML = '';
    (items || []).forEach(item => {
      const figure = document.createElement('figure');
      figure.className = 'portfolio-item';
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.caption || '';
      img.loading = 'lazy';
      img.addEventListener('error', () => { figure.classList.add('image-broken'); img.remove(); });
      figure.appendChild(img);
      if (item.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = item.caption;
        figure.appendChild(caption);
      }
      container.appendChild(figure);
    });
    enableMasonry(container);
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
    const measure = () => parts.forEach(([name, el]) => {
      root.style.setProperty(name, Math.ceil(el.getBoundingClientRect().height) + FIXED_UI_GAP + 'px');
    });
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      parts.forEach(([, el]) => ro.observe(el));
    }
  }
  if (typeof document !== 'undefined') reserveFixedUi(document);

  return { renderPortfolio, loadPortfolio, revealActiveNav, reserveFixedUi, masonrySpan, layoutMasonry };
});
