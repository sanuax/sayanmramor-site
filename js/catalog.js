(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Catalog = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // The ruble sign stays on the line of its number (a no-break space).
  function formatProductPrice(priceRub) {
    if (typeof priceRub !== 'number' || !Number.isFinite(priceRub)) return 'Цена по запросу';
    return Math.round(priceRub).toLocaleString('ru-RU') + ' ₽';
  }

  // Ordering goes through the company's contacts (address, phone, route) on
  // the home page -- the one place to reach a manager until there is a form.
  const ORDER_URL = '/sayanmramor-site/index.html#contacts';

  function isAvailable(product) {
    return product.available !== false;
  }

  // A product with no photograph yet (none listed, or the file is missing):
  // a quiet line of text in the same 4:5 area instead of an empty box.
  const NO_PHOTO_TEXT = 'Фото пока нет';

  function photoPlaceholder() {
    const note = document.createElement('span');
    note.className = 'product-tile-placeholder';
    note.textContent = NO_PHOTO_TEXT;
    return note;
  }

  // Several photos of one product (the lamp: one design, a different stone
  // in each piece): a swipeable row inside the same 4:5 area -- CSS
  // scroll-snap, no script. Focusable, so the keyboard can scroll it too.
  function photoStrip(name, photos) {
    const strip = document.createElement('div');
    strip.className = 'product-tile-strip';
    strip.tabIndex = 0;
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', name + ', ' + photos.length + ' фото');
    photos.forEach((src, i) => {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = 'Фото ' + (i + 1) + ' из ' + photos.length;
      img.src = src;
      img.addEventListener('error', () => img.replaceWith(photoPlaceholder()));
      strip.appendChild(img);
    });
    return strip;
  }

  function photoCount(n) {
    const count = document.createElement('span');
    count.className = 'product-tile-count';
    count.setAttribute('aria-hidden', 'true');   // the strip's label already says it
    count.textContent = n + ' фото';
    return count;
  }

  function buildProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-tile';

    const imageWrap = document.createElement('div');
    imageWrap.className = 'product-tile-image';
    const photos = Array.isArray(product.photos) ? product.photos : [];
    const photo = photos[0];
    if (photos.length > 1) {
      imageWrap.appendChild(photoStrip(product.name || '', photos));
      imageWrap.appendChild(photoCount(photos.length));
    } else if (photo) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = product.name || '';
      img.src = photo;
      img.addEventListener('error', () => img.replaceWith(photoPlaceholder()));
      imageWrap.appendChild(img);
    } else {
      imageWrap.appendChild(photoPlaceholder());
    }
    if (!isAvailable(product)) {
      const badge = document.createElement('span');
      badge.className = 'badge-oos';
      badge.textContent = 'Нет в наличии';
      imageWrap.appendChild(badge);
    }

    const name = document.createElement('div');
    name.className = 'product-tile-name';
    name.textContent = product.name;

    const price = document.createElement('div');
    price.className = 'product-tile-price';
    price.textContent = formatProductPrice(product.price_rub);

    card.appendChild(imageWrap);
    card.appendChild(name);
    card.appendChild(price);

    if (product.description) {
      const desc = document.createElement('div');
      desc.className = 'product-tile-description';
      desc.textContent = product.description;
      card.appendChild(desc);
    }

    // «Купить»: the site's primary button (the same as «Создать изделие»),
    // leading to the contacts; its label names the product for screen readers.
    const buy = document.createElement('a');
    buy.className = 'btn btn-primary product-tile-buy';
    buy.href = ORDER_URL;
    buy.textContent = 'Купить';
    buy.setAttribute('aria-label', 'Купить: ' + (product.name || ''));
    card.appendChild(buy);

    return card;
  }

  function renderCatalog(container, products) {
    container.innerHTML = '';
    if (!products || products.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'catalog-empty';
      empty.textContent = 'Пока нет готовых изделий - загляните позже.';
      container.appendChild(empty);
      return;
    }
    products.forEach(product => container.appendChild(buildProductCard(product)));
  }

  return { NO_PHOTO_TEXT, ORDER_URL, formatProductPrice, isAvailable, buildProductCard, renderCatalog };
});
