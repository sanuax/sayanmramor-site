(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteCommon = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // Builds the exact DOM contract D:\calculator\material-picker.js's
  // init() requires (ids, classes, data-filter attributes) so the picker
  // works unmodified on a page that never had this markup written by
  // hand. Idempotent: calling it twice on the same page is a no-op the
  // second time.
  function injectMaterialPickerMarkup() {
    if (document.getElementById('pickerOverlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.id = 'pickerOverlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Выбор камня');
    overlay.innerHTML =
      '<div class="picker-header">' +
        '<input type="search" id="pickerSearch" placeholder="Поиск по названию…" autocomplete="off">' +
        '<button type="button" id="pickerClose" aria-label="Закрыть">✕</button>' +
      '</div>' +
      '<div class="picker-filters" id="pickerFilters">' +
        '<div class="filter-dropdown" data-filter="hardness">' +
          '<button type="button" class="filter-dropdown-btn" aria-haspopup="true" aria-expanded="false"></button>' +
          '<div class="filter-dropdown-panel" hidden></div>' +
        '</div>' +
        '<div class="filter-dropdown" data-filter="category">' +
          '<button type="button" class="filter-dropdown-btn" aria-haspopup="true" aria-expanded="false"></button>' +
          '<div class="filter-dropdown-panel" hidden></div>' +
        '</div>' +
        '<div class="filter-dropdown" data-filter="color">' +
          '<button type="button" class="filter-dropdown-btn" aria-haspopup="true" aria-expanded="false"></button>' +
          '<div class="filter-dropdown-panel" hidden></div>' +
        '</div>' +
      '</div>' +
      '<div class="picker-sort" id="pickerSort">' +
        '<button type="button" class="sort-btn active" data-sort-field="name" data-sort-dir="asc">A-Z</button>' +
        '<button type="button" class="sort-btn" data-sort-field="price" data-sort-dir="asc">Цена ↑</button>' +
      '</div>' +
      '<div class="picker-results" id="pickerResults">' +
        '<div class="picker-grid" id="pickerGrid"></div>' +
        '<div class="picker-sentinel" id="pickerSentinel"></div>' +
        '<div class="picker-empty" id="pickerEmpty" hidden>Ничего не найдено</div>' +
      '</div>';

    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox-overlay';
    lightbox.id = 'lightboxOverlay';
    lightbox.hidden = true;
    lightbox.innerHTML =
      '<button type="button" id="lightboxClose" aria-label="Закрыть">✕</button>' +
      '<img id="lightboxImg" alt="">';

    document.body.appendChild(overlay);
    document.body.appendChild(lightbox);
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
  }

  function loadPortfolio(productKey, container) {
    fetch('/sayanmramor-site/data/portfolio.json')
      .then(r => r.json())
      .then(data => renderPortfolio(container, data[productKey] || []))
      .catch(() => { container.textContent = 'Не удалось загрузить примеры работ.'; });
  }

  return { injectMaterialPickerMarkup, renderPortfolio, loadPortfolio };
});
