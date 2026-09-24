(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteCommon = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

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

  return { renderPortfolio, loadPortfolio, revealActiveNav };
});
